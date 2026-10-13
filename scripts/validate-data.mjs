import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const dataDir = new URL("../public/data/", import.meta.url).pathname;
const errors = [];
const parse = async (path) => {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { errors.push(`${path}: ${error.message}`); return null; }
};

const index = await parse(join(dataDir, "index.json"));
const themes = await parse(join(dataDir, "themes.json"));
if (!Array.isArray(index?.dates)) errors.push("index.json: dates must be an array");
if (!Array.isArray(themes?.themes)) errors.push("themes.json: themes must be an array");
const themeLabels = new Set((themes?.themes || []).map((theme) => theme.label));
const ids = new Set();
const pii = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?66|0)[ -]?\d(?:[ -]?\d){7,}|\b(?:uid|user id|order id|transaction id)\s*[:#]?\s*[A-Z0-9-]{4,}/iu;
const files = await readdir(join(dataDir, "daily"));
for (const file of files.filter((name) => name.endsWith(".json"))) {
  const day = await parse(join(dataDir, "daily", file));
  if (!day) continue;
  if (day.date !== file.slice(0, -5)) errors.push(`${file}: date does not match filename`);
  if (!day.metrics || !day.report || !Array.isArray(day.items) || !Array.isArray(day.alerts)) errors.push(`${file}: missing required top-level fields`);
  if (day.metrics?.volume !== day.items?.length) errors.push(`${file}: metrics.volume does not match items.length`);
  for (const rating of day.ratings || []) {
    for (const key of ["platform", "app_name", "app_id", "total_avg_rating", "total_rating_count", "source"]) if (rating[key] === undefined || rating[key] === "") errors.push(`${file}: rating snapshot missing ${key}`);
    if (!["Google Play", "App Store"].includes(rating.platform)) errors.push(`${file}: invalid rating platform ${rating.platform}`);
    if (!Number.isFinite(rating.total_avg_rating) || rating.total_avg_rating < 1 || rating.total_avg_rating > 5) errors.push(`${file}: invalid total_avg_rating`);
    if (!Number.isFinite(rating.total_rating_count) || rating.total_rating_count < 0) errors.push(`${file}: invalid total_rating_count`);
  }
  for (const item of day.items || []) {
    for (const key of ["id", "source", "link", "author_masked", "text_th", "text_vn", "sentiment", "topic", "theme", "segment"]) {
      if (item[key] === undefined || item[key] === "") errors.push(`${file}/${item.id || "unknown"}: missing ${key}`);
    }
    if (!/^.$|^.{1}\*\*\*$/u.test(item.author_masked)) errors.push(`${file}/${item.id}: author is not masked`);
    if (!themeLabels.has(item.theme)) errors.push(`${file}/${item.id}: unknown theme ${item.theme}`);
    if (item.confidence < 0.6 && item.needs_review !== true) errors.push(`${file}/${item.id}: low confidence must need review`);
    if (ids.has(item.id)) errors.push(`${file}/${item.id}: duplicate id`);
    ids.add(item.id);
    if (pii.test(`${item.text_th}\n${item.text_vn}`)) errors.push(`${file}/${item.id}: possible PII in feedback text`);
    if (item.source?.startsWith("Facebook")) {
      const canonical = /^https:\/\/(?:www\.)?facebook\.com\/.*\/posts\//.test(item.link);
      const capturedComment = item.content_kind === "comment" && item.link_quality === "captured_comment_reference" && /[?&]comment_id=/.test(item.link);
      if (!canonical && !capturedComment) errors.push(`${file}/${item.id}: Facebook link is not a valid captured post/comment reference`);
      if (!new Set(["post", "comment"]).has(item.content_kind)) errors.push(`${file}/${item.id}: missing/invalid Facebook content_kind`);
      if (!item.activity_type) errors.push(`${file}/${item.id}: missing Facebook activity_type`);
      if (!new Set(["published_at", "observed_at"]).has(item.date_basis)) errors.push(`${file}/${item.id}: missing/invalid Facebook date_basis`);
      if (!item.engagement || !Array.isArray(item.engagement.reactions)) errors.push(`${file}/${item.id}: missing Facebook engagement metadata`);
    }
  }
}
for (const date of index?.dates || []) if (!files.includes(`${date}.json`)) errors.push(`index.json: missing daily/${date}.json`);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Validated ${files.length} daily files and ${(themes?.themes || []).length} themes.`);
