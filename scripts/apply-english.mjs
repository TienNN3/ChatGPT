// Áp bản dịch tiếng Anh của phản hồi vào dữ liệu theo ngày (chế độ EN của dashboard).
// Đầu vào: một hoặc nhiều file JSON { "<item id>": { "text": "...", "summary": "..." } }.
// Chỉ ghi text_en / summary_en; text_vn, summary_vn và nguyên văn tiếng Thái giữ nguyên.
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const inputs = process.argv.slice(2);
if (!inputs.length) throw new Error("Usage: node scripts/apply-english.mjs <english.json> [...]");
const english = {};
for (const path of inputs) Object.assign(english, JSON.parse(await readFile(path, "utf8")));
const dailyDir = new URL("../public/data/daily/", import.meta.url).pathname;
let applied = 0;
for (const file of (await readdir(dailyDir)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))) {
  const path = join(dailyDir, file);
  const payload = JSON.parse(await readFile(path, "utf8"));
  let changed = false;
  for (const item of payload.items || []) {
    const entry = english[item.id];
    const text = String(entry?.text ?? "").trim(), summary = String(entry?.summary ?? "").trim();
    if (!text) continue;
    if (item.text_en !== text || (summary && item.summary_en !== summary)) {
      item.text_en = text;
      if (summary) item.summary_en = summary;
      applied++; changed = true;
    }
  }
  if (changed) await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`);
}
console.log(`Applied ${applied} English translations.`);
