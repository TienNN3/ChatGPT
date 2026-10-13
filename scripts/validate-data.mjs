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
const files = await readdir(join(dataDir, "daily"));
for (const file of files.filter((name) => name.endsWith(".json"))) {
  const day = await parse(join(dataDir, "daily", file));
  if (!day) continue;
  if (day.date !== file.slice(0, -5)) errors.push(`${file}: date does not match filename`);
  if (!day.metrics || !day.report || !Array.isArray(day.items) || !Array.isArray(day.alerts)) errors.push(`${file}: missing required top-level fields`);
  if (day.metrics?.volume !== day.items?.length) errors.push(`${file}: metrics.volume does not match items.length`);
  for (const item of day.items || []) {
    for (const key of ["id", "source", "link", "author_masked", "text_th", "text_vn", "sentiment", "topic", "theme", "segment"]) {
      if (item[key] === undefined || item[key] === "") errors.push(`${file}/${item.id || "unknown"}: missing ${key}`);
    }
    if (!/^.$|^.{1}\*\*\*$/u.test(item.author_masked)) errors.push(`${file}/${item.id}: author is not masked`);
    if (!themeLabels.has(item.theme)) errors.push(`${file}/${item.id}: unknown theme ${item.theme}`);
    if (item.confidence < 0.6 && item.needs_review !== true) errors.push(`${file}/${item.id}: low confidence must need review`);
  }
}
for (const date of index?.dates || []) if (!files.includes(`${date}.json`)) errors.push(`index.json: missing daily/${date}.json`);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Validated ${files.length} daily files and ${(themes?.themes || []).length} themes.`);
