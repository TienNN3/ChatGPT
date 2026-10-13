import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dailyDir = new URL("../public/data/daily/", import.meta.url).pathname;
const fallback = /cần dịch|cần review thủ công/iu;
const imageOnly = /^\[(?:Image post|Post without accessible text)/iu;

async function translate(text, attempt = 1) {
  if (imageOnly.test(text)) return "Bài đăng chỉ có hình ảnh; Facebook không cung cấp phần chữ để dịch.";
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  for (const [key, value] of Object.entries({ client: "gtx", sl: "auto", tl: "vi", dt: "t", q: text })) url.searchParams.set(key, value);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const result = (payload[0] || []).map((part) => part[0]).join("").trim();
    if (!result) throw new Error("empty translation");
    return result;
  } catch (error) {
    if (attempt >= 3) throw new Error(`Không dịch được nội dung sau 3 lần: ${error.message}`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 500));
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
for (let start = 0; start < unique.length; start += 5) {
  const batch = unique.slice(start, start + 5);
  const results = await Promise.all(batch.map((text) => translate(text)));
  batch.forEach((text, index) => translations.set(text, results[index]));
  console.log(`Đã dịch ${Math.min(start + batch.length, unique.length)}/${unique.length} nội dung duy nhất.`);
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
