// Nhập video/bình luận TikTok tiếng Thái đã làm sạch vào dữ liệu theo ngày.
// Chỉ thêm hoặc cập nhật mục có source "TikTok" theo id; không đụng tới nguồn khác.
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildMetrics } from "./lib/metrics.mjs";

const inputPath = process.argv[2];
if (!inputPath) throw new Error("Usage: node scripts/import-tiktok.mjs <tiktok-staging-json>");
const root = new URL("../", import.meta.url).pathname;
const dailyDir = join(root, "public/data/daily");
const indexPath = join(root, "public/data/index.json");
const staging = JSON.parse(await readFile(inputPath, "utf8"));
if (!Array.isArray(staging.items) || !staging.collection?.collected_at) throw new Error("Staging JSON must contain collection.collected_at and items[]");

const required = ["kind", "date", "author", "link", "text_th", "text_vn", "sentiment", "topic", "theme"];
const incoming = staging.items.map((raw) => {
  for (const key of required) if (!raw[key]) throw new Error(`TikTok item missing ${key}: ${raw.link}`);
  if (!/^https:\/\/www\.tiktok\.com\/@[\w.]+\/video\/\d+(\?comment_id=\d+)?$/.test(raw.link)) throw new Error(`Not a TikTok video/comment link: ${raw.link}`);
  if (!["video", "comment"].includes(raw.kind)) throw new Error(`Invalid kind: ${raw.kind}`);
  return {
    id: `tiktok-${createHash("sha256").update(raw.link).digest("hex").slice(0, 16)}`,
    source: "TikTok", community: "TikTok", link: raw.link,
    author_masked: `${[...String(raw.author).trim()][0] || "U"}***`,
    text_th: raw.text_th, text_vn: raw.text_vn, translation_method: "ai_contextual",
    sentiment: raw.sentiment, topic: raw.topic, topic_secondary: [], theme: raw.theme, segment: "unknown", severity: null,
    confidence: 0.7, needs_review: true,
    content_kind: raw.kind, activity_type: raw.kind === "video" ? "Video của người chơi" : "Bình luận",
    ...(raw.intent ? { intent: raw.intent, keywords: raw.keywords || [], summary_vn: raw.summary || "", label_method: "ai_review" } : {}),
    date_basis: "published_at", published_label: raw.published_label || null, date_precision: raw.approx ? "approximate" : "exact",
    engagement: { views: raw.views ?? null, reactions: [], comment_count: raw.comment_count ?? null, video_title: raw.video_title || null },
    collected_at: staging.collection.collected_at, date: raw.date
  };
});

const files = (await readdir(dailyDir)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name));
const payloads = new Map();
for (const file of files) { const payload = JSON.parse(await readFile(join(dailyDir, file), "utf8")); payloads.set(payload.date, payload); }
const touched = new Set();
const incomingIds = new Set(incoming.map((item) => item.id));
// Bỏ bản cũ của cùng id (để cập nhật), giữ nguyên mọi mục khác.
for (const payload of payloads.values()) {
  const before = payload.items.length;
  payload.items = payload.items.filter((item) => !(item.source === "TikTok" && incomingIds.has(item.id)));
  if (payload.items.length !== before) touched.add(payload.date);
}
const emptyReport = (date) => ({ overview: `Phản hồi TikTok ngày ${date}.`, bright_spots: [], pain_points: [], segments: Object.fromEntries(["new", "midgame", "veteran", "payer"].map((name) => [name, { summary: "Không đủ dữ liệu.", links: [] }])), next_actions: Object.fromEntries(["new", "midgame", "veteran", "payer"].map((name) => [name, []])), data_health: ["TikTok: video tiếng Thái của creator và bình luận tiếng Thái của người xem, đã che tên tác giả."] });
for (const { date, ...item } of incoming) {
  const payload = payloads.get(date) || { date, alerts: [], items: [], report: emptyReport(date) };
  payload.items.push(item);
  payloads.set(date, payload);
  touched.add(date);
}
for (const date of touched) {
  const payload = payloads.get(date);
  payload.metrics = buildMetrics(payload.items, 0, {});
  payload.report ||= emptyReport(date);
  payload.data_mode = "production";
  await writeFile(join(dailyDir, `${date}.json`), `${JSON.stringify(payload, null, 2)}\n`);
}
const index = JSON.parse(await readFile(indexPath, "utf8"));
index.dates = [...new Set([...index.dates, ...[...payloads.entries()].filter(([, p]) => p.items.length).map(([d]) => d)])].sort();
index.last_updated = new Date().toISOString();
await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
console.log(`Imported ${incoming.length} TikTok items (${incoming.filter((i) => i.content_kind === "video").length} videos, ${incoming.filter((i) => i.content_kind === "comment").length} comments) across ${new Set(incoming.map((i) => i.date)).size} dates.`);
