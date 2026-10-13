import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dailyDir = new URL("../public/data/daily/", import.meta.url).pathname;
const fallback = /cần dịch|cần review thủ công/iu;
const imageOnly = /^\[(?:Image post|Post without accessible text)/iu;
// Bộ nhớ đệm bản dịch (thư mục .staging được ignore) để chạy lại không phải dịch lại khi bị giới hạn tần suất.
const cachePath = new URL("../.staging/translations-vi.json", import.meta.url).pathname;
const cache = new Map(Object.entries(await readFile(cachePath, "utf8").then(JSON.parse).catch(() => ({}))));
const saveCache = () => writeFile(cachePath, `${JSON.stringify(Object.fromEntries(cache), null, 2)}\n`).catch(() => {});

async function translate(text, attempt = 1) {
  if (imageOnly.test(text)) return "Bài đăng chỉ có hình ảnh; Facebook không cung cấp phần chữ để dịch.";
  // Gửi nội dung qua POST để bài dài không vượt giới hạn độ dài URL.
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  for (const [key, value] of Object.entries({ client: "gtx", sl: "auto", tl: "vi", dt: "t" })) url.searchParams.set(key, value);
  try {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: new URLSearchParams({ q: text }), signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
    const payload = await response.json();
    const result = (payload[0] || []).map((part) => part[0]).join("").trim();
    if (!result) throw new Error("empty translation");
    return result;
  } catch (error) {
    if (attempt >= 8) throw new Error(`Không dịch được nội dung sau 8 lần: ${error.message}`);
    // HTTP 429: dịch vụ đang giới hạn tần suất, chờ lâu hơn trước khi thử lại.
    await new Promise((resolve) => setTimeout(resolve, error.status === 429 ? 60_000 : attempt * 1500));
    return translate(text, attempt + 1);
  }
}

function sentimentFor(original, vietnamese) {
  const value = `${original}\n${vietnamese}`.toLocaleLowerCase("vi");
  const positive = /(yêu|thích|xinh|đẹp|dễ thương|hay quá|vui|tuyệt|cảm ơn|muốn có|đáng yêu|ชอบ|รัก|ดีมาก|สวย|น่ารัก)/iu.test(value);
  const negative = /(không (?:thể|được|vào|mua)|không có gì xảy ra|lỗi|bug|lag|giật|treo|văng|rác|tệ|chán|ghét|đắt|lừa|mất|khó chịu|vấn đề|bực|thất vọng|โกง|บัค|ปัญหา|แพง)/iu.test(value);
  if (positive && negative) return "Mixed";
  if (negative) return "Negative";
  if (positive) return "Positive";
  return "Neutral";
}

const files = (await readdir(dailyDir)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name));
const targets = [];
for (const file of files) {
  const payload = JSON.parse(await readFile(join(dailyDir, file), "utf8"));
  for (const item of payload.items || []) {
    if (item.source?.startsWith("Facebook") && fallback.test(item.text_vn || "")) targets.push({ file, item });
  }
}

const translations = new Map();
const unique = [...new Set(targets.map(({ item }) => item.text_th))];
let failure = null;
try {
  for (const [index, text] of unique.entries()) {
    if (!cache.has(text)) { cache.set(text, await translate(text)); await new Promise((resolve) => setTimeout(resolve, 700)); }
    translations.set(text, cache.get(text));
    if ((index + 1) % 20 === 0 || index + 1 === unique.length) { await saveCache(); console.log(`Đã dịch ${index + 1}/${unique.length} nội dung duy nhất.`); }
  }
} catch (error) {
  failure = error;
  await saveCache();
  console.error(`Dừng giữa chừng: ${error.message}. Áp dụng ${translations.size}/${unique.length} bản dịch đã có; chạy lại để dịch tiếp.`);
}

let updated = 0;
for (const file of files) {
  const path = join(dailyDir, file);
  const payload = JSON.parse(await readFile(path, "utf8"));
  let changed = false;
  for (const item of payload.items || []) {
    const translated = translations.get(item.text_th);
    if (!translated || !fallback.test(item.text_vn || "")) continue;
    item.text_vn = translated;
    item.translation_method = imageOnly.test(item.text_th) ? "image_without_accessible_text" : "machine_translation";
    item.sentiment = sentimentFor(item.text_th, translated);
    item.confidence = item.sentiment === "Neutral" ? 0.6 : 0.68;
    item.needs_review = true;
    changed = true;
    updated++;
  }
  if (changed) await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`);
}

console.log(`Đã cập nhật ${updated} feedback Facebook bằng tiếng Việt.`);
if (failure) process.exitCode = 1;
