import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildMetrics, maskAuthor } from "./lib/metrics.mjs";

const inputPath = process.argv[2];
if (!inputPath) throw new Error("Usage: node scripts/import-sensortower-android.mjs <csv-path>");

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

const sentimentMap = { Happy: "Positive", Unhappy: "Negative", Neutral: "Neutral", Mixed: "Mixed" };
const storeLink = "https://play.google.com/store/apps/details?id=com.haegin.playtogether&hl=th";
const pii = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?66|0)[ -]?\d(?:[ -]?\d){7,}|\b(?:uid|user id|order id|transaction id)\s*[:#]?\s*[A-Z0-9-]{4,}/iu;
const noise = /(?:ขาย|รับซื้อ).*(?:ไอดี|เหรียญ)|แจกฟรี|https?:\/\/\S+|^\s*[@#]\S+\s*$/iu;

function classify(text, sentiment) {
  const value = text.toLocaleLowerCase();
  if (/เติมเงิน|ชำระ|ซื้อแพ็ค|ซื้อไอเทม|payment|package|ประเทศของคุณ/.test(value)) return ["Topup & Payment", "Không nhận vật phẩm sau thanh toán", sentiment === "Negative" ? "P1" : null];
  if (/ล็อคอิน|ล็อกอิน|เข้าสู่ระบบ|เข้าเกมไม่ได้|บัญชี|ไอดีหาย|ข้อมูลหาย|login|facebook/.test(value)) return ["Login / Account / Data", "Đăng nhập tài khoản", sentiment === "Negative" ? "P1" : null];
  if (/เด้ง|หลุด|ค้าง|แลค|กระตุก|บัค|บั๊ก|ช้า|crash|lag|error|อัปเดตไม่ได้|ดาวน์โหลดไม่ได้/.test(value)) return ["Bug / Crash / Lag / Performance", "Game bị văng và treo", sentiment === "Negative" ? "P1" : null];
  if (/โฆษณา|advert/.test(value)) return ["Other", "Quảng cáo gây gián đoạn", sentiment === "Negative" ? "P2" : null];
  if (/สุ่ม|กาชา|เกลือ|เรท|เพชร|ราคา|แพง|ลดราคา|เหรียญ|เงินในเกม|draw|gacha/.test(value)) return ["Gacha / Shop / Pricing", /ราคา|แพง|เหรียญ|เงินในเกม/.test(value) ? "Giá vật phẩm quá cao" : "Giá trị phần thưởng gacha", sentiment === "Negative" ? "P2" : null];
  if (/ภาษาไทย|แปล|ภาษา/.test(value)) return ["Localization (Thai text, wrong translation)", "Bản địa hóa tiếng Thái", sentiment === "Negative" ? "P2" : null];
  if (/อีเวนต์|อีเว้น|กิจกรรมใหม่|อัพเดต|อัปเดต|event|update/.test(value)) return ["Event & Update content", "Phần thưởng sự kiện", sentiment === "Negative" ? "P2" : null];
  if (/โกง|หลอก|ด่า|หยาบ|แฮก|ผู้เล่น|เพื่อน|scam|hack|toxic/.test(value)) return ["Social / Scam / Harassment / Toxic", "Tương tác xã hội tiêu cực", sentiment === "Negative" ? "P3" : null];
  if (/ตกปลา|ปลา|สวน|ปลูก|สัตว์|มินิเกม|งาน|อาชีพ|บ้าน|แต่งตัว|ชุด|เต้น|แข่ง|กิจกรรม/.test(value)) return ["Activities (fishing, bugs, pets, housing, jobs, minigames)", "Hoạt động và tính năng trong game", sentiment === "Negative" ? "P2" : null];
  return ["Other", sentiment === "Positive" ? "Trải nghiệm game tích cực" : "Góp ý trải nghiệm chung", sentiment === "Negative" ? "P3" : null];
}

function vietnameseSummary(topic, sentiment) {
  const tone = sentiment === "Positive" ? "tích cực" : sentiment === "Negative" ? "tiêu cực" : sentiment === "Mixed" ? "trái chiều" : "trung tính";
  const subject = {
    "Topup & Payment": "việc nạp tiền, thanh toán hoặc nhận vật phẩm",
    "Login / Account / Data": "đăng nhập, tài khoản hoặc dữ liệu người chơi",
    "Bug / Crash / Lag / Performance": "lỗi, lag, treo hoặc văng game",
    "Gacha / Shop / Pricing": "gacha, cửa hàng, giá bán hoặc phần thưởng",
    "Localization (Thai text, wrong translation)": "ngôn ngữ và bản địa hóa tiếng Thái",
    "Event & Update content": "sự kiện và nội dung cập nhật",
    "Social / Scam / Harassment / Toxic": "tương tác cộng đồng hoặc hành vi người chơi",
    "Activities (fishing, bugs, pets, housing, jobs, minigames)": "hoạt động và tính năng trong game",
    Other: "trải nghiệm chung và quảng cáo"
  }[topic];
  return `Phản hồi ${tone} về ${subject}. Đây là tóm tắt phân loại; cần đối chiếu nguyên văn tiếng Thái.`;
}

const raw = await readFile(inputPath);
const encoding = raw[0] === 0xff && raw[1] === 0xfe ? "utf16le" : "utf8";
const rows = parseDelimited(raw.toString(encoding).replace(/^\uFEFF/, "")).filter((row) => row.Date?.startsWith("2026-"));
const imported = new Map();
let privacyCount = 0, noiseCount = 0;
for (const row of rows) {
  const original = [row.Title, row.Content].filter(Boolean).join(". ").trim();
  if (!original || pii.test(original)) { privacyCount += 1; continue; }
  if (noise.test(original)) { noiseCount += 1; continue; }
  const sentiment = sentimentMap[row.Sentiment] || "Neutral";
  const [topic, theme, severity] = classify(original, sentiment);
  const item = {
    id: `android-${createHash("sha256").update(`${row.Date}|${row.Username}|${original}`).digest("hex").slice(0, 16)}`,
    source: "Google Play", link: storeLink, author_masked: maskAuthor(row.Username), text_th: original,
    text_vn: vietnameseSummary(topic, sentiment), sentiment, confidence: 0.72, topic, topic_secondary: [], theme,
    segment: /เติม|ราคา|แพง|สุ่ม|กาชา|เพชร|เหรียญ/.test(original.toLocaleLowerCase()) ? "payer" : /หลายปี|ตั้งแต่เปิด|กลับมาเล่น/.test(original) ? "veteran" : "unknown",
    severity, needs_review: true, rating: Number(row.Rating), translation_status: "summary_only"
  };
  if (!imported.has(row.Date)) imported.set(row.Date, []);
  if (!imported.get(row.Date).some((existing) => existing.id === item.id)) imported.get(row.Date).push(item);
}

const root = new URL("../", import.meta.url).pathname;
const dailyDir = join(root, "public/data/daily");
await mkdir(dailyDir, { recursive: true });
const existingFiles = (await readdir(dailyDir)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name));
const days = new Map();
for (const file of existingFiles) {
  const payload = JSON.parse(await readFile(join(dailyDir, file), "utf8"));
  payload.items = (payload.items || []).filter((item) => !item.id.startsWith("android-"));
  days.set(payload.date, payload);
}
for (const [date, items] of imported) {
  const payload = days.get(date) || { date, alerts: [], items: [] };
  payload.items.push(...items);
  days.set(date, payload);
}

const allDates = [...days.keys()].sort();
const generatedAt = new Date(Date.now() + 7 * 3600_000).toISOString().replace("Z", "+07:00");
const metricsByDate = new Map();
const maxSeverity = (values) => values.sort((a, b) => Number(a?.slice(1) ?? 9) - Number(b?.slice(1) ?? 9))[0] || null;
const quote = (item) => ({ text_th: item.text_th, text_vn: item.text_vn, link: item.link });
for (const date of allDates) {
  const payload = days.get(date), items = payload.items;
  const previousDate = new Date(`${date}T00:00:00Z`); previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  const d1 = metricsByDate.get(previousDate.toISOString().slice(0, 10))?.nss ?? null;
  const threshold = new Date(new Date(`${date}T00:00:00Z`).getTime() - 7 * 86400_000).toISOString().slice(0, 10);
  const trailing = allDates.filter((candidate) => candidate < date && candidate >= threshold).map((candidate) => metricsByDate.get(candidate)?.nss).filter(Number.isFinite);
  payload.metrics = buildMetrics(items, date === allDates[0] ? noiseCount : 0, { nss: d1, nss7: trailing.length ? Math.round(trailing.reduce((a, b) => a + b, 0) / trailing.length * 10) / 10 : null });
  metricsByDate.set(date, payload.metrics);
  if (imported.has(date)) {
    const positive = Object.groupBy(items.filter((item) => item.sentiment === "Positive"), (item) => item.theme);
    const negative = Object.groupBy(items.filter((item) => item.sentiment === "Negative"), (item) => item.theme);
    const segmentReport = Object.fromEntries(["new", "midgame", "veteran", "payer"].map((name) => {
      const matches = items.filter((item) => item.segment === name);
      return [name, { summary: matches.length ? `Có ${matches.length} phản hồi thuộc nhóm ${name}.` : "Không đủ dữ liệu.", links: matches.slice(0, 1).map((item) => item.link) }];
    }));
    payload.alerts = items.filter((item) => item.severity === "P0").map((item) => ({ level: "P0", title: item.theme, detail: item.text_vn, links: [item.link] }));
    payload.report = {
      overview: `Có ${items.length} review store và NSS ${payload.metrics.nss}. Dữ liệu gồm Google Play${items.some((item) => item.source === "App Store") ? " và App Store" : ""}.`,
      bright_spots: Object.entries(positive).slice(0, 3).map(([title, group]) => ({ title, count: group.length, quote: quote(group[0]) })),
      pain_points: Object.entries(negative).slice(0, 3).map(([issue, group]) => ({ issue, cause: "Cần đối chiếu nguyên văn và xác minh thêm trước khi kết luận nguyên nhân.", effect: "Vấn đề có thể làm giảm mức hài lòng và tỷ lệ quay lại.", count: group.length, severity: maxSeverity(group.map((item) => item.severity)), quotes: group.slice(0, 2).map(quote) })),
      segments: segmentReport,
      next_actions: Object.fromEntries(["new", "midgame", "veteran", "payer"].map((name) => [name, [{ task: "Đối chiếu review gốc và gom thêm tín hiệu trước khi thay đổi sản phẩm.", owner: "Community", priority: "P2" }]])),
      data_health: [`Sensor Tower Android TH: đã nhập ${imported.get(date).length} review đã che tên cho ngày này.`, "Bản tiếng Việt của Android là tóm tắt phân loại và được đánh dấu cần review, không phải bản dịch nguyên văn.", `Toàn bộ export có ${privacyCount} item bị loại vì PII/rỗng và ${noiseCount} item noise.`, "Facebook group, fanpage và CS chưa có trong lần backfill này."]
    };
  }
  payload.generated_at = generatedAt;
  payload.data_mode = "production";
  await writeFile(join(dailyDir, `${date}.json`), `${JSON.stringify(payload, null, 2)}\n`);
}

const indexPath = join(root, "public/data/index.json");
const index = JSON.parse(await readFile(indexPath, "utf8"));
index.dates = allDates;
index.latest_with_data = allDates.filter((date) => days.get(date).items.length).at(-1);
index.last_updated = generatedAt;
index.data_mode = "production";
await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
console.log(`Imported ${[...imported.values()].reduce((sum, items) => sum + items.length, 0)} Android reviews across ${imported.size} dates; filtered ${privacyCount} private/empty and ${noiseCount} noise items.`);
