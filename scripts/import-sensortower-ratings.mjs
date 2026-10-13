import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildMetrics } from "./lib/metrics.mjs";

const [androidPath, iosPath] = process.argv.slice(2);
if (!androidPath || !iosPath) throw new Error("Usage: node scripts/import-sensortower-ratings.mjs <android-csv> <ios-csv>");

function parseDelimited(text) {
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

async function readRatings(path, platform) {
  const raw = await readFile(path);
  const encoding = raw[0] === 0xff && raw[1] === 0xfe ? "utf16le" : "utf8";
  const rows = parseDelimited(raw.toString(encoding).replace(/^\uFEFF/, ""));
  return rows.filter((row) => row.Date?.startsWith("2026-") && row["Country / Region"] === "TH").map((row) => ({
    platform,
    app_name: row["App Name"],
    app_id: row["App ID"],
    incremental_avg_rating: Number(row["Incremental Avg Rating"]),
    total_avg_rating: Number(row["Total Avg Rating"]),
    incremental_rating_count: Number(row["Incremental Rating Count"]),
    total_rating_count: Number(row["Total Rating Count"]),
    source: "Sensor Tower",
    date: row.Date
  })).filter((row) => [row.incremental_avg_rating, row.total_avg_rating, row.incremental_rating_count, row.total_rating_count].every(Number.isFinite));
}

const ratings = [...await readRatings(androidPath, "Google Play"), ...await readRatings(iosPath, "App Store")];
const unique = new Map(ratings.map((row) => [`${row.date}|${row.platform}|${row.app_id}`, row]));
const byDate = Map.groupBy([...unique.values()], (row) => row.date);
const root = new URL("../", import.meta.url).pathname;
const dailyDir = join(root, "public/data/daily");
await mkdir(dailyDir, { recursive: true });
const files = (await readdir(dailyDir)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name));
const days = new Map();
const affectedDates = new Set(byDate.keys());
for (const file of files) {
  const payload = JSON.parse(await readFile(join(dailyDir, file), "utf8"));
  if (Array.isArray(payload.ratings) && payload.ratings.length) affectedDates.add(payload.date);
  delete payload.ratings;
  days.set(payload.date, payload);
}

const emptyReport = (date, count) => ({
  overview: `Không có feedback trong ngày ${date}; có ${count} snapshot rating Sensor Tower.`,
  bright_spots: [], pain_points: [],
  segments: Object.fromEntries(["new", "midgame", "veteran", "payer"].map((name) => [name, { summary: "Không đủ dữ liệu.", links: [] }])),
  next_actions: Object.fromEntries(["new", "midgame", "veteran", "payer"].map((name) => [name, []])),
  data_health: ["Rating là snapshot tổng tích lũy từ Sensor Tower, không được tính vào feedback volume hoặc NSS."]
});

const generatedAt = new Date(Date.now() + 7 * 3_600_000).toISOString().replace("Z", "+07:00");
for (const [date, rows] of byDate) {
  const payload = days.get(date) || { date, items: [], alerts: [], metrics: buildMetrics([]), report: emptyReport(date, rows.length) };
  payload.ratings = rows.map(({ date: _date, ...row }) => row);
  payload.generated_at = generatedAt;
  payload.data_mode = "production";
  days.set(date, payload);
}
for (const date of affectedDates) await writeFile(join(dailyDir, `${date}.json`), `${JSON.stringify(days.get(date), null, 2)}\n`);

const indexPath = join(root, "public/data/index.json");
const index = JSON.parse(await readFile(indexPath, "utf8"));
index.dates = [...new Set([...index.dates, ...byDate.keys()])].sort();
index.last_updated = generatedAt;
await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
console.log(`Imported ${unique.size} rating snapshots across ${byDate.size} dates.`);
