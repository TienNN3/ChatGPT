// Nhập export Sensor Tower của app Play Together VNG (Thái Lan) theo kiểu gộp an toàn:
// - Rating theo ngày (Rating Count - Star Ratings, Detailed): thêm/cập nhật snapshot ngày theo platform|app_id.
//   Snapshot tuần cũ của cùng app nằm trong khoảng file mới chỉ bị thay khi tổng lượt mới khớp với dữ liệu ngày;
//   snapshot ngoài khoảng và của app khác (Global · HAEGIN) giữ nguyên.
// - Review (đã dịch + gắn nhãn ở staging): chỉ thêm/cập nhật theo id, không đụng review cũ.
// Ngày của Sensor Tower là ngày theo lịch trong export (không có giờ), giữ nguyên không quy đổi múi giờ.
// Usage: node scripts/import-sensortower-vng.mjs --ratings <csv> [--ratings <csv>] [--reviews <staging.json>]
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildMetrics, maskAuthor } from "./lib/metrics.mjs";

const args = process.argv.slice(2);
const ratingPaths = [], reviewPaths = [];
for (let i = 0; i < args.length; i += 2) {
  if (args[i] === "--ratings") ratingPaths.push(args[i + 1]);
  else if (args[i] === "--reviews") reviewPaths.push(args[i + 1]);
  else throw new Error(`Unknown argument ${args[i]}`);
}
if (!ratingPaths.length && !reviewPaths.length) throw new Error("Usage: node scripts/import-sensortower-vng.mjs --ratings <csv> [--reviews <staging.json>]");

function parseDelimited(raw) {
  const text = raw.toString(raw[0] === 0xff && raw[1] === 0xfe ? "utf16le" : "utf8").replace(/^﻿/, "");
  const parsed = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "\t" && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      if (row.some((value) => value !== "")) parsed.push(row);
      row = [];
    } else field += char;
  }
  if (field || row.length) { row.push(field); parsed.push(row); }
  const headers = parsed.shift();
  return parsed.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

const root = new URL("../", import.meta.url).pathname;
const dailyDir = join(root, "public/data/daily");
const indexPath = join(root, "public/data/index.json");
const payloads = new Map();
for (const file of (await readdir(dailyDir)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))) {
  const payload = JSON.parse(await readFile(join(dailyDir, file), "utf8"));
  payloads.set(payload.date, payload);
}
const emptyReport = (date) => ({ overview: `Dữ liệu store ngày ${date}.`, bright_spots: [], pain_points: [], segments: Object.fromEntries(["new", "midgame", "veteran", "payer"].map((name) => [name, { summary: "Không đủ dữ liệu.", links: [] }])), next_actions: Object.fromEntries(["new", "midgame", "veteran", "payer"].map((name) => [name, []])), data_health: ["Sensor Tower: rating và review store của Play Together VNG tại Thái Lan."] });
const dayPayload = (date) => {
  if (!payloads.has(date)) payloads.set(date, { date, alerts: [], items: [], report: emptyReport(date) });
  return payloads.get(date);
};
const touched = new Set(), itemsTouched = new Set();
const addDays = (date, days) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const num = (value) => (value === "" || value === undefined ? null : Number(value));

// ---- Rating ----
const ratingLog = [];
for (const path of ratingPaths) {
  const rows = parseDelimited(await readFile(path)).filter((row) => row["Country / Region"] === "TH" && /^\d{4}-\d{2}-\d{2}$/.test(row.Date) && row["Total Avg Rating"] !== "");
  const groups = Map.groupBy(rows, (row) => row["App ID"]);
  for (const [appId, appRows] of groups) {
    const platform = /^\d+$/.test(appId) ? "App Store" : "Google Play";
    const byDate = new Map(appRows.map((row) => [row.Date, row]));
    const dates = [...byDate.keys()].sort(), first = dates[0], last = dates.at(-1);
    // Thay snapshot tuần cũ trong khoảng phủ bởi dữ liệu ngày, sau khi đối chiếu tổng lượt mới.
    for (const [date, payload] of payloads) {
      if (date > last || addDays(date, 6) < first) continue;
      const kept = [];
      for (const rating of payload.ratings || []) {
        if (rating.platform !== platform || rating.app_id !== appId || rating.granularity === "day") { kept.push(rating); continue; }
        const week = dates.filter((d) => d >= date && d <= addDays(date, 6));
        const dailySum = week.reduce((sum, d) => sum + (num(byDate.get(d)["Incremental Rating Count"]) || 0), 0);
        const diff = Math.abs(dailySum - (rating.incremental_rating_count || 0));
        if (week.length && diff <= Math.max(0.05, Math.abs(rating.incremental_rating_count || 0) * 0.02)) {
          ratingLog.push(`replace week ${platform} ${date} (${week.length} days, sum ${dailySum.toFixed(2)})`);
          touched.add(date);
        } else {
          ratingLog.push(`KEEP week ${platform} ${date}: daily sum ${dailySum.toFixed(2)} vs week ${rating.incremental_rating_count}`);
          kept.push(rating);
        }
      }
      payload.ratings = kept;
    }
    for (const date of dates) {
      const row = byDate.get(date), payload = dayPayload(date);
      const snapshot = {
        platform, app_name: row["App Name"], app_id: appId, granularity: "day",
        incremental_avg_rating: num(row["Incremental Avg Rating"]), total_avg_rating: num(row["Total Avg Rating"]),
        incremental_rating_count: num(row["Incremental Rating Count"]), total_rating_count: num(row["Total Rating Count"]),
        source: "Sensor Tower"
      };
      payload.ratings = [...(payload.ratings || []).filter((r) => !(r.platform === platform && r.app_id === appId && r.granularity === "day")), snapshot];
      touched.add(date);
    }
    ratingLog.push(`${platform} ${appId}: ${dates.length} daily snapshots ${first} → ${last}`);
  }
}
// Snapshot cũ không ghi chu kỳ là snapshot tuần (ngày thứ Hai, cộng dồn cả tuần).
for (const [date, payload] of payloads) for (const rating of payload.ratings || []) if (!rating.granularity) { rating.granularity = "week"; touched.add(date); }

// ---- Review ----
let reviewCount = 0;
const links = { "Google Play": "https://play.google.com/store/apps/details?id=com.vng.playtogether&hl=th", "App Store": "https://apps.apple.com/th/app/id1612175933" };
for (const path of reviewPaths) {
  const staging = JSON.parse(await readFile(path, "utf8"));
  const ids = new Set(staging.map((raw) => raw.id));
  for (const [date, payload] of payloads) {
    const before = payload.items.length;
    payload.items = payload.items.filter((item) => !ids.has(item.id));
    if (payload.items.length !== before) { touched.add(date); itemsTouched.add(date); }
  }
  for (const raw of staging) {
    for (const key of ["id", "source", "date", "author", "text_th", "text_vn", "sentiment", "intent", "summary_vn", "theme", "topic"]) if (!raw[key]) throw new Error(`Review ${raw.id} missing ${key}`);
    if (!links[raw.source]) throw new Error(`Unknown store ${raw.source}`);
    const payload = dayPayload(raw.date);
    payload.items.push({
      id: raw.id, source: raw.source, link: links[raw.source], author_masked: maskAuthor(raw.author),
      app_name: "Play Together VNG", app_id: raw.app_id,
      text_th: raw.text_th, text_vn: raw.text_vn, translation_method: "ai_contextual",
      sentiment: raw.sentiment, confidence: 0.75, topic: raw.topic, topic_secondary: [], theme: raw.theme,
      segment: "unknown", severity: null, needs_review: true, rating: raw.rating,
      intent: raw.intent, keywords: raw.keywords, summary_vn: raw.summary_vn, label_method: "ai_review",
      content_kind: "review", activity_type: "Đánh giá store", date_basis: "published_at",
      store_sentiment: raw.st_sentiment || null, store_tags: raw.st_tags ? raw.st_tags.split(",").filter(Boolean) : [], app_version: raw.version || null
    });
    touched.add(raw.date); itemsTouched.add(raw.date);
    reviewCount += 1;
  }
}

for (const date of touched) {
  const payload = payloads.get(date);
  // Chỉ tính lại chỉ số khi danh sách phản hồi của ngày thay đổi; ngày chỉ thêm rating giữ nguyên chỉ số cũ.
  if (itemsTouched.has(date) || !payload.metrics) payload.metrics = buildMetrics(payload.items, payload.metrics?.noise || 0, { nss: payload.metrics?.nss_d1, nss7: payload.metrics?.nss_7d_avg });
  payload.report ||= emptyReport(date);
  payload.data_mode = "production";
  await writeFile(join(dailyDir, `${date}.json`), `${JSON.stringify(payload, null, 2)}\n`);
}
const index = JSON.parse(await readFile(indexPath, "utf8"));
index.dates = [...new Set([...index.dates, ...touched])].sort();
index.last_updated = new Date().toISOString();
await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
console.log(ratingLog.filter((line) => !line.startsWith("replace")).join("\n"));
console.log(`Replaced ${ratingLog.filter((line) => line.startsWith("replace")).length} weekly snapshots; imported ${reviewCount} reviews; wrote ${touched.size} daily files.`);
