// Áp nhãn loại nội dung (intent), từ khoá và câu tóm tắt vào dữ liệu theo ngày.
// Đầu vào: một hoặc nhiều file JSON dạng { "<item id>": { intent, keywords, sentiment, summary } }.
// Không đổi nội dung phản hồi; cảm xúc cũ được giữ trong sentiment_rule để đối chiếu.
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildMetrics } from "./lib/metrics.mjs";

const inputs = process.argv.slice(2);
if (!inputs.length) throw new Error("Usage: node scripts/apply-labels.mjs <labels.json> [...]");
const INTENTS = new Set(["question", "answer", "share", "event_entry", "bug", "performance", "account", "complaint", "suggestion", "praise", "trade", "social", "chat"]);
const SENTIMENTS = new Set(["Positive", "Negative", "Neutral", "Mixed"]);
// Gộp các cách viết khác nhau của cùng một từ khoá.
const ALIASES = new Map(Object.entries({
  "vvip": "vvip pass", "vip pass": "vvip pass", "vip": "vvip pass", "gói vvip": "vvip pass",
  "hộp quay": "gacha", "quay gacha": "gacha", "hộp gacha": "gacha", "hộp bốc thăm": "gacha",
  "chuyển dữ liệu": "chuyển tài khoản vng", "chuyển tài khoản": "chuyển tài khoản vng", "chuyển server vng": "chuyển tài khoản vng", "chuyển sang vng": "chuyển tài khoản vng",
  "crash": "văng game", "văng": "văng game", "thoát game": "văng game",
  "giật lag": "lag", "giật": "lag", "đơ": "lag",
  "cá": "câu cá", "đi câu": "câu cá", "côn trùng": "bắt côn trùng",
  "nhà": "trang trí nhà", "trang trí": "trang trí nhà", "đồ nội thất": "nội thất",
  "quần áo": "trang phục", "đồ": "trang phục", "xe": "phương tiện",
  "pet": "thú cưng", "nông trại": "nông trại", "trang trại": "nông trại",
  "rau củ khổng lồ": "rau khổng lồ", "cây khổng lồ": "rau khổng lồ",
  "thời tiết": "đổi thời tiết", "dịch vụ đổi thời tiết": "đổi thời tiết",
  "farm thuê": "cày thuê", "dịch vụ cày thuê": "cày thuê", "đào thuê": "cày thuê",
  "bán vật phẩm": "mua bán vật phẩm", "mua bán": "mua bán vật phẩm", "rao bán": "mua bán vật phẩm",
  "kết bạn": "tìm bạn", "code": "code quà tặng", "giftcode": "code quà tặng", "mã quà tặng": "code quà tặng",
  "kim cương miễn phí": "kim cương", "đá quý": "kim cương", "gem": "kim cương",
  "kaia": "đảo kaia", "lễ hội halloween": "halloween", "sự kiện halloween": "halloween"
}));
const normKeyword = (value) => { const k = String(value || "").normalize("NFC").toLocaleLowerCase("vi").replace(/\s+/g, " ").trim(); return ALIASES.get(k) || k; };

const labels = {};
for (const path of inputs) Object.assign(labels, JSON.parse(await readFile(path, "utf8")));
const dailyDir = new URL("../public/data/daily/", import.meta.url).pathname;
let applied = 0, sentimentChanged = 0;
for (const file of (await readdir(dailyDir)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))) {
  const path = join(dailyDir, file);
  const payload = JSON.parse(await readFile(path, "utf8"));
  let changed = false;
  for (const item of payload.items || []) {
    const label = labels[item.id];
    if (!label) continue;
    if (!INTENTS.has(label.intent)) throw new Error(`${item.id}: invalid intent ${label.intent}`);
    item.intent = label.intent;
    item.keywords = [...new Set((label.keywords || []).map(normKeyword).filter(Boolean))].slice(0, 4);
    item.summary_vn = String(label.summary || "").trim();
    if (SENTIMENTS.has(label.sentiment) && label.sentiment !== item.sentiment) {
      item.sentiment_rule ??= item.sentiment;
      item.sentiment = label.sentiment;
      sentimentChanged++;
    }
    item.label_method = "ai_review";
    item.needs_review = true;
    applied++; changed = true;
  }
  if (changed) { payload.metrics = buildMetrics(payload.items, 0, {}); await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`); }
}
console.log(`Applied labels to ${applied} items; sentiment updated on ${sentimentChanged}.`);
