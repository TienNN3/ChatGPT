// Áp bản dịch tiếng Việt theo ngữ cảnh (theo docs/translation-guide.md) vào dữ liệu theo ngày.
// Đầu vào: một hoặc nhiều file JSON { "<item id>": "<bản dịch>" }. Nguyên văn không đổi;
// bản dịch trước đó được giữ một lần trong text_vn_machine để đối chiếu.
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const inputs = process.argv.slice(2);
if (!inputs.length) throw new Error("Usage: node scripts/apply-translations.mjs <translations.json> [...]");
const translations = {};
for (const path of inputs) Object.assign(translations, JSON.parse(await readFile(path, "utf8")));
const dailyDir = new URL("../public/data/daily/", import.meta.url).pathname;
let applied = 0;
for (const file of (await readdir(dailyDir)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))) {
  const path = join(dailyDir, file);
  const payload = JSON.parse(await readFile(path, "utf8"));
  let changed = false;
  for (const item of payload.items || []) {
    const text = String(translations[item.id] ?? "").trim();
    if (!text || text === item.text_vn) continue;
    item.text_vn_machine ??= item.text_vn;
    item.text_vn = text;
    item.translation_method = "ai_contextual";
    applied++; changed = true;
  }
  if (changed) await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`);
}
console.log(`Applied ${applied} contextual translations.`);
