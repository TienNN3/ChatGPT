import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildMetrics } from "./lib/metrics.mjs";

const inputPath = process.argv[2];
if (!inputPath) throw new Error("Usage: node scripts/import-facebook.mjs <facebook-observations-json>");
const root = new URL("../", import.meta.url).pathname;
const dailyDir = join(root, "public/data/daily");
const indexPath = join(root, "public/data/index.json");
const allowedSources = new Set(["Facebook Group", "Facebook Fanpage"]);
const monthNumbers = new Map(Object.entries({ January: "01", February: "02", March: "03", April: "04", May: "05", June: "06", July: "07", August: "08", September: "09", October: "10", November: "11", December: "12" }));
const normalize = (value) => String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase();
const legacyKey = (item) => `${item.link}|${normalize(item.text_th ?? item.text)}|${item.author_masked}`;
const itemKey = (item) => `${item.link}|${normalize(item.text_th ?? item.text)}|${item.author_masked}|${item.content_kind ?? item.kind ?? ""}`;
const generatedAt = new Date().toISOString();
const thaiFanpageHandle = "playtogetherthailandofficial";
const quote = (item) => ({ text_th: item.text_th, text_vn: item.text_vn, link: item.link });
const maxSeverity = (values) => values.filter(Boolean).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))[0] || null;

function cleanLink(value, kind) {
  const url = new URL(value);
  if (!/(^|\.)facebook\.com$/i.test(url.hostname)) throw new Error(`Not a Facebook URL: ${value}`);
  const commentId = url.searchParams.get("comment_id");
  const isCanonical = /\/posts\//.test(url.pathname);
  if (!isCanonical && !(kind === "comment" && commentId)) throw new Error(`Not a Facebook post/comment reference: ${value}`);
  return { link: `${url.origin}${url.pathname}${commentId ? `?comment_id=${encodeURIComponent(commentId)}` : ""}`, link_quality: isCanonical ? "canonical_permalink" : "captured_comment_reference" };
}

function dateInBangkok(value) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

function observationDate(label, collectedAt) {
  const clean = String(label || "").replaceAll("\u202f", " ").trim();
  if (!clean) return { date: dateInBangkok(new Date(collectedAt)), date_basis: "observed_at" };
  const relative = clean.match(/^(?:(a|an)|([0-9]+))\s+(minute|hour|day)s?\s+ago$/i);
  if (relative) {
    const count = relative[1] ? 1 : Number(relative[2]);
    const unitMs = { minute: 60_000, hour: 3_600_000, day: 86_400_000 }[relative[3].toLowerCase()];
    return { date: dateInBangkok(new Date(new Date(collectedAt).getTime() - count * unitMs)), date_basis: "published_at" };
  }
  const absolute = clean.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,\s*(\d{4}))?/i);
  if (!absolute) throw new Error(`Unsupported Facebook timestamp: ${label}`);
  const collectionYear = new Date(collectedAt).toLocaleString("en-US", { timeZone: "Asia/Bangkok", year: "numeric" });
  const monthName = absolute[1][0].toUpperCase() + absolute[1].slice(1).toLowerCase();
  return { date: `${absolute[3] || collectionYear}-${monthNumbers.get(monthName)}-${String(absolute[2]).padStart(2, "0")}`, date_basis: "published_at" };
}

function classify(text) {
  const value = normalize(text);
  if (/(ค้างคาว|\bbats?\b)/iu.test(value)) return { topic: "Activities (fishing, bugs, pets, housing, jobs, minigames)", theme: "Hoạt động và tính năng trong game" };
  if (/(login|log in|account|role id|transfer|vng|บัญชี|เข้าสู่ระบบ)/iu.test(value)) return { topic: "Login / Account / Data", theme: "Đăng nhập tài khoản" };
  if (/(lag|crash|freeze|bug|error|can't|cannot|ไม่ได้|ปัญหา|หลุด|ค้าง(?!คาว))/iu.test(value)) return { topic: "Bug / Crash / Lag / Performance", theme: "Game bị văng và treo" };
  if (/(gacha|สุ่ม|ราคา|ขาย|sell|buy|บาท|฿|gem|เพชร)/iu.test(value)) return { topic: "Gacha / Shop / Pricing", theme: "Giá trị phần thưởng gacha" };
  if (/(event|กิจกรรม|coupon|code|reward|รางวัล)/iu.test(value)) return { topic: "Event & Update content", theme: "Phần thưởng sự kiện" };
  if (/(fish|fishing|pet|house|home|farm|ตกปลา|สัตว์|บ้าน|ฟาร์ม|minigame)/iu.test(value)) return { topic: "Activities (fishing, bugs, pets, housing, jobs, minigames)", theme: "Hoạt động và tính năng trong game" };
  if (/(scam|โกง|toxic|harass)/iu.test(value)) return { topic: "Social / Scam / Harassment / Toxic", theme: "Tương tác xã hội tiêu cực" };
  return { topic: "Other", theme: "Góp ý trải nghiệm chung" };
}

function fallbackVietnamese(kind, text) {
  if (/^\[(?:Image post|Post without accessible text)/i.test(String(text).trim())) return "Bài đăng hình ảnh/không có chữ truy cập được; mô tả ảnh được giữ ở bản gốc và cần review thủ công.";
  return `Đã lưu nguyên văn ${kind === "comment" ? "bình luận" : "bài đăng"} Facebook; cần dịch và phân loại thủ công.`;
}

function activityType(raw, classification) {
  const value = normalize(raw.text);
  if (raw.kind === "comment") return "Bình luận";
  if (raw.source === "Facebook Fanpage") return "Nội dung chính thức";
  if (/(ขาย|ราคา|บาท|฿|รับฟาร์ม|รับขุด|บริการ|คิวว่าง|sell|sale|buy|trade|แลก|ผ่อน)/iu.test(value)) return "Rao bán / trao đổi";
  if (/^\[(?:Image post|Post without accessible text)/i.test(raw.text) || /(ร่วมกิจกรรม|เข้าร่วมกิจกรรม|happy autumn|เริ่มหนาว|อวด|โชว์|น่ารัก|cute)/iu.test(value)) return "Khoe / tham gia hoạt động";
  if (["Bug / Crash / Lag / Performance", "Login / Account / Data", "Topup & Payment"].includes(classification.topic)) return "Hỏi đáp / báo lỗi";
  return "Thảo luận";
}

function communityName(link, source) {
  const url = new URL(link);
  const group = url.pathname.match(/^\/groups\/([^/]+)/i);
  if (group) return `Facebook Group · ${decodeURIComponent(group[1])}`;
  const page = url.pathname.split("/").filter(Boolean)[0];
  return page ? `Facebook Fanpage · @${page}` : source;
}

function buildReport(items, date, collection, importStats) {
  const positive = Map.groupBy(items.filter((item) => item.sentiment === "Positive"), (item) => item.theme);
  const pain = Map.groupBy(items.filter((item) => item.sentiment === "Negative" || item.sentiment === "Mixed"), (item) => item.theme);
  const sources = [...new Set(items.map((item) => item.source))].join(", ");
  const segments = Object.fromEntries(["new", "midgame", "veteran", "payer"].map((name) => {
    const matches = items.filter((item) => item.segment === name);
    return [name, { summary: matches.length ? `Có ${matches.length} phản hồi thuộc nhóm ${name}.` : "Không đủ dữ liệu.", links: matches.slice(0, 1).map((item) => item.link) }];
  }));
  return {
    overview: `Có ${items.length} feedback trong ngày từ ${sources || "các nguồn đã cấu hình"}. Post, comment, bài khoe, rao bán và thảo luận Facebook đều được giữ lại khi truy cập được.`,
    bright_spots: [...positive].slice(0, 3).map(([title, group]) => ({ title, count: group.length, quote: quote(group[0]) })),
    pain_points: [...pain].slice(0, 3).map(([issue, group]) => ({ issue, cause: "Cần đối chiếu nguyên văn và xác minh thêm trước khi kết luận nguyên nhân.", effect: "Vấn đề có thể làm giảm mức hài lòng hoặc cản trở tiếp tục chơi.", count: group.length, severity: maxSeverity(group.map((item) => item.severity)), quotes: group.slice(0, 2).map(quote) })),
    segments,
    next_actions: Object.fromEntries(["new", "midgame", "veteran", "payer"].map((name) => [name, [{ task: "Đối chiếu permalink và review các mục chưa dịch/phân loại trước khi thay đổi sản phẩm.", owner: "Community", priority: "P2" }]])),
    data_health: [
      `Facebook ngày ${date}: ${items.filter((item) => item.source?.startsWith("Facebook")).length} quan sát đã ẩn danh; post/comment và reaction metadata được lưu khi có.`,
      `Lần thu thập ${collection.collected_at}: ${importStats.total} quan sát duy nhất (${importStats.posts} post, ${importStats.comments} comment), gồm ${importStats.imageOnly} bài chỉ có hình/không có chữ truy cập được và ${importStats.withReactions} post có reaction metadata.`,
      `${importStats.observedDate} mục không có ngày đăng hiển thị được dùng ngày quan sát và gắn date_basis=observed_at; không tự suy đoán ngày đăng.`,
      `Fanpage chỉ giữ bình luận từ facebook.com/${thaiFanpageHandle}; đã loại ${importStats.filteredFanpagePosts} bài fanpage và ${importStats.filteredNonThaiFanpageComments} bình luận không thuộc fanpage Thái.`,
      `Phạm vi truy cập: ${collection.accessible_groups}/8 group đọc được; ${collection.locked_groups}/8 group bị khóa/riêng tư; fanpage chuyển hướng sang trang global.`,
      `Có ${importStats.nonCanonical} comment chỉ giữ được captured reference thay vì canonical post permalink; mục này được đánh dấu để review.`
    ]
  };
}

const staging = JSON.parse(await readFile(inputPath, "utf8"));
if (!Array.isArray(staging.observations)) throw new Error("Staging JSON must contain an observations array");
if (!staging.collection?.collected_at) throw new Error("Staging JSON must include collection.collected_at");
await mkdir(dailyDir, { recursive: true });
const files = (await readdir(dailyDir)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name));
const payloads = new Map();
const manual = new Map();
const affectedDates = new Set();
for (const file of files) {
  const payload = JSON.parse(await readFile(join(dailyDir, file), "utf8"));
  payloads.set(payload.date, payload);
  for (const item of payload.items || []) if (item.source?.startsWith("Facebook")) {
    manual.set(itemKey(item), item);
    manual.set(legacyKey(item), item);
    affectedDates.add(payload.date);
  }
}

const staged = [];
const dedupe = new Set();
let filteredFanpagePosts = 0;
let filteredNonThaiFanpageComments = 0;
for (const raw of staging.observations) {
  if (!allowedSources.has(raw.source)) throw new Error(`Invalid Facebook source: ${raw.source}`);
  if (!/^.{1}\*\*\*$/u.test(raw.author_masked)) throw new Error(`Author must already be masked: ${raw.author_masked}`);
  if (!new Set(["post", "comment"]).has(raw.kind)) throw new Error(`Invalid content kind: ${raw.kind}`);
  if (raw.source === "Facebook Fanpage") {
    if (raw.kind !== "comment") { filteredFanpagePosts++; continue; }
    const page = new URL(raw.link).pathname.split("/").filter(Boolean)[0]?.toLowerCase();
    if (page !== thaiFanpageHandle) { filteredNonThaiFanpageComments++; continue; }
  }
  const text = String(raw.text || "").trim();
  if (!text) throw new Error(`Missing text for ${raw.link}`);
  const linkInfo = cleanLink(raw.link, raw.kind);
  const dateInfo = observationDate(raw.timestamp, staging.collection.collected_at);
  const key = `${linkInfo.link}|${normalize(text)}|${raw.author_masked}|${raw.kind}`;
  if (dedupe.has(key)) continue;
  dedupe.add(key);
  const previous = manual.get(key) || manual.get(`${linkInfo.link}|${normalize(text)}|${raw.author_masked}`);
  const classification = classify(text);
  const batFalsePositive = previous?.theme === "Game bị văng và treo" && /(ค้างคาว|\bbats?\b)/iu.test(normalize(text));
  staged.push({
    id: `facebook-${createHash("sha256").update(key).digest("hex").slice(0, 16)}`,
    source: raw.source, community: communityName(linkInfo.link, raw.source), link: linkInfo.link, link_quality: linkInfo.link_quality, author_masked: raw.author_masked,
    text_th: text, text_vn: previous?.text_vn || fallbackVietnamese(raw.kind, text), translation_method: previous?.translation_method, ...(previous?.text_vn_machine ? { text_vn_machine: previous.text_vn_machine } : {}), sentiment: previous?.sentiment || "Neutral",
    topic: batFalsePositive ? classification.topic : previous?.topic || classification.topic, topic_secondary: previous?.topic_secondary || [], theme: batFalsePositive ? classification.theme : previous?.theme || classification.theme,
    segment: previous?.segment || "unknown", severity: previous?.severity ?? null, confidence: previous?.confidence ?? 0.45,
    needs_review: previous?.needs_review ?? true, content_kind: raw.kind, activity_type: activityType(raw, classification), date_basis: dateInfo.date_basis, published_label: raw.timestamp || null,
    engagement: { reactions: Array.isArray(raw.engagement?.reactions) ? raw.engagement.reactions : [], comment_count: raw.engagement?.comment_count ?? null },
    collected_at: staging.collection.collected_at, date: dateInfo.date,
    // Giữ nhãn loại nội dung/từ khoá/tóm tắt đã gán trước đó (scripts/apply-labels.mjs).
    ...(previous?.intent ? { intent: previous.intent, keywords: previous.keywords || [], summary_vn: previous.summary_vn || "", label_method: previous.label_method, ...(previous.sentiment_rule ? { sentiment_rule: previous.sentiment_rule } : {}) } : {})
  });
}

const byDate = Map.groupBy(staged, (item) => item.date);
for (const date of byDate.keys()) affectedDates.add(date);
const importStats = {
  total: staged.length, posts: staged.filter((item) => item.content_kind === "post").length, comments: staged.filter((item) => item.content_kind === "comment").length,
  imageOnly: staged.filter((item) => /^\[(?:Image post|Post without accessible text)/i.test(item.text_th)).length,
  withReactions: staged.filter((item) => item.content_kind === "post" && item.engagement.reactions.length).length,
  observedDate: staged.filter((item) => item.date_basis === "observed_at").length,
  nonCanonical: staged.filter((item) => item.link_quality !== "canonical_permalink").length,
  filteredFanpagePosts,
  filteredNonThaiFanpageComments
};
for (const payload of payloads.values()) payload.items = (payload.items || []).filter((item) => !item.source?.startsWith("Facebook"));
for (const [date, incoming] of byDate) {
  const payload = payloads.get(date) || { date, alerts: [], items: [] };
  payload.items.push(...incoming.map(({ date: _date, ...item }) => item));
  payloads.set(date, payload);
}
for (const date of affectedDates) {
  const payload = payloads.get(date);
  if (!payload) continue;
  payload.metrics = buildMetrics(payload.items, 0, {});
  payload.alerts = payload.items.filter((item) => item.severity === "P0" || item.severity === "P1").map((item) => ({ level: item.severity, title: item.theme, detail: item.text_vn, links: [item.link] }));
  payload.report = buildReport(payload.items, date, staging.collection, importStats);
  payload.generated_at = generatedAt;
  payload.data_mode = "production";
  await writeFile(join(dailyDir, `${date}.json`), `${JSON.stringify(payload, null, 2)}\n`);
}
const index = JSON.parse(await readFile(indexPath, "utf8"));
index.dates = [...payloads.entries()].filter(([, payload]) => payload.items.length).map(([date]) => date).sort();
index.latest_with_data = index.dates.at(-1);
index.last_updated = generatedAt;
index.data_mode = "production";
await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
console.log(`Imported ${staged.length} Facebook observations (${importStats.posts} posts, ${importStats.comments} comments) across ${byDate.size} dates.`);
