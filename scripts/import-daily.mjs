// Nhập phản hồi mới của lượt thu thập hằng ngày (Facebook group/fanpage, YouTube, TikTok) theo kiểu CHỈ THÊM.
// Không xoá, không sửa mục đã có: mục trùng id hoặc trùng (link + nguyên văn) bị bỏ qua.
// Mỗi mục phải đã được che tên, dịch tiếng Việt + tiếng Anh và gắn nhãn (xem docs/daily-collection.md).
// Usage: node scripts/import-daily.mjs <staging.json> [--dry-run]
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildMetrics } from "./lib/metrics.mjs";

const inputPath = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (!inputPath) throw new Error("Usage: node scripts/import-daily.mjs <staging.json> [--dry-run]");
const root = new URL("../", import.meta.url).pathname;
const dailyDir = join(root, "public/data/daily");
const indexPath = join(root, "public/data/index.json");
const staging = JSON.parse(await readFile(inputPath, "utf8"));
if (!staging.collection?.collected_at || !/^\d{4}-\d{2}-\d{2}$/.test(staging.collection?.target_date || "") || !Array.isArray(staging.items)) {
  throw new Error("Staging JSON must contain collection.collected_at, collection.target_date (YYYY-MM-DD) and items[]");
}
const themes = new Set(JSON.parse(await readFile(join(root, "public/data/themes.json"), "utf8")).themes.map((theme) => theme.label));
const topicOf = Object.fromEntries(JSON.parse(await readFile(join(root, "public/data/themes.json"), "utf8")).themes.map((theme) => [theme.label, theme.topic]));
const INTENTS = new Set(["question", "answer", "share", "event_entry", "bug", "performance", "account", "complaint", "suggestion", "praise", "trade", "social", "chat"]);
const SENTIMENTS = new Set(["Positive", "Negative", "Neutral", "Mixed"]);
const pii = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?66|0)[ -]?\d(?:[ -]?\d){7,}|\b(?:uid|user id|order id|transaction id)\s*[:#]?\s*[A-Z0-9-]{4,}/iu;
const normalize = (value) => String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase();
const LINKS = {
  "Facebook Group": /^https:\/\/(?:www\.)?facebook\.com\/groups\/[^/]+\/posts\/\d+\/?(?:\?comment_id=\d+)?$/,
  "Facebook Fanpage": /^https:\/\/(?:www\.)?facebook\.com\/playtogetherthailandofficial\/.+[?&]comment_id=\d+$/i,
  YouTube: /^https:\/\/www\.youtube\.com\/(?:watch\?v=[\w-]{11}(?:&lc=[\w.-]+)?|shorts\/[\w-]{11})$/,
  TikTok: /^https:\/\/www\.tiktok\.com\/@[\w.]+\/video\/\d+(\?comment_id=\d+)?$/
};
const PREFIX = { "Facebook Group": "facebook", "Facebook Fanpage": "facebook", YouTube: "youtube", TikTok: "tiktok" };

const payloads = new Map();
for (const file of (await readdir(dailyDir)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))) {
  const payload = JSON.parse(await readFile(join(dailyDir, file), "utf8"));
  payloads.set(payload.date, payload);
}
const existingIds = new Set(), existingKeys = new Set();
for (const payload of payloads.values()) for (const item of payload.items || []) { existingIds.add(item.id); existingKeys.add(`${item.link}|${normalize(item.text_th)}`); }

const errors = [], added = [], skipped = [];
for (const raw of staging.items) {
  const where = raw.link || raw.id || "(no link)";
  const problems = [];
  if (!LINKS[raw.source]) problems.push(`unsupported source ${raw.source} (Sensor Tower/store data is imported manually)`);
  else if (!LINKS[raw.source].test(raw.link || "")) problems.push(`link does not match ${raw.source} format`);
  for (const key of ["text_th", "text_vn", "text_en", "summary_vn", "summary_en", "author_masked", "content_kind", "date", "date_basis"]) if (!raw[key]) problems.push(`missing ${key}`);
  if (raw.author_masked && !/^.\*\*\*$/u.test(raw.author_masked)) problems.push("author_masked must look like X***");
  if (!SENTIMENTS.has(raw.sentiment)) problems.push(`invalid sentiment ${raw.sentiment}`);
  if (!INTENTS.has(raw.intent)) problems.push(`invalid intent ${raw.intent}`);
  if (!Array.isArray(raw.keywords) || raw.keywords.length < 1 || raw.keywords.length > 4) problems.push("keywords must have 1–4 entries");
  if (!themes.has(raw.theme)) problems.push(`unknown theme ${raw.theme}`);
  if (!["published_at", "observed_at"].includes(raw.date_basis)) problems.push("date_basis must be published_at or observed_at");
  if (raw.date_basis === "published_at" && raw.date !== staging.collection.target_date) problems.push(`date ${raw.date} is not the target date ${staging.collection.target_date}`);
  if (raw.source === "Facebook Fanpage" && raw.content_kind !== "comment") problems.push("fanpage data must be user comments only");
  if (pii.test(`${raw.text_th}\n${raw.text_vn}\n${raw.text_en}`)) problems.push("possible PII in text");
  if (problems.length) { errors.push(`${where}: ${problems.join("; ")}`); continue; }
  const id = raw.id || `${PREFIX[raw.source]}-${createHash("sha256").update(`${raw.link}|${normalize(raw.text_th)}|${raw.author_masked}|${raw.content_kind}`).digest("hex").slice(0, 16)}`;
  if (existingIds.has(id) || existingKeys.has(`${raw.link}|${normalize(raw.text_th)}`)) { skipped.push(id); continue; }
  existingIds.add(id); existingKeys.add(`${raw.link}|${normalize(raw.text_th)}`);
  const { date, ...rest } = raw;
  added.push({ date, item: {
    ...rest, id, topic: raw.topic || topicOf[raw.theme], topic_secondary: raw.topic_secondary || [], segment: raw.segment || "unknown",
    severity: raw.severity ?? null, confidence: raw.confidence ?? 0.7, needs_review: raw.needs_review ?? true,
    translation_method: raw.translation_method || "ai_contextual", label_method: raw.label_method || "ai_review",
    community: raw.community || (raw.source === "YouTube" || raw.source === "TikTok" ? raw.source : undefined),
    engagement: raw.engagement || { reactions: [], comment_count: null },
    collected_at: staging.collection.collected_at
  } });
}
if (errors.length) { console.error(`Rejected ${errors.length} item(s); nothing was written:\n${errors.join("\n")}`); process.exit(1); }

const emptyReport = (date) => ({ overview: `Phản hồi ngày ${date}.`, bright_spots: [], pain_points: [], segments: Object.fromEntries(["new", "midgame", "veteran", "payer"].map((name) => [name, { summary: "Không đủ dữ liệu.", links: [] }])), next_actions: Object.fromEntries(["new", "midgame", "veteran", "payer"].map((name) => [name, []])), data_health: ["Thu thập hằng ngày: Facebook, YouTube, TikTok (đã che tên tác giả)."] });
const touched = new Set();
for (const { date, item } of added) {
  if (!payloads.has(date)) payloads.set(date, { date, alerts: [], items: [], report: emptyReport(date) });
  payloads.get(date).items.push(item);
  touched.add(date);
}
console.log(`${dryRun ? "[dry-run] " : ""}Adding ${added.length} item(s), skipped ${skipped.length} already stored, across ${touched.size} date(s): ${[...touched].sort().join(", ")}`);
if (dryRun) process.exit(0);
for (const date of touched) {
  const payload = payloads.get(date);
  payload.metrics = buildMetrics(payload.items, payload.metrics?.noise || 0, { nss: payload.metrics?.nss_d1, nss7: payload.metrics?.nss_7d_avg });
  payload.report ||= emptyReport(date);
  payload.data_mode = "production";
  await writeFile(join(dailyDir, `${date}.json`), `${JSON.stringify(payload, null, 2)}\n`);
}
const index = JSON.parse(await readFile(indexPath, "utf8"));
index.dates = [...new Set([...index.dates, ...touched])].sort();
index.latest_with_data = [...payloads.entries()].filter(([, payload]) => payload.items.length).map(([date]) => date).sort().at(-1);
index.last_updated = new Date().toISOString();
await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
