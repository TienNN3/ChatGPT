import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildMetrics } from "./lib/metrics.mjs";

const inputPath = process.argv[2];
if (!inputPath) throw new Error("Usage: node scripts/import-sensortower-ios.mjs <csv-path>");

function parseDelimited(text) {
  const rows = [];
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
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift();
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

const translations = [
  "Mong giảm giá vật phẩm, thêm đồ dễ thương và đồ trang trí nhà. Game nhìn chung rất tốt nhưng quảng cáo quá nhiều, gây mất thời gian.",
  "Không thể chơi vì game liên tục bị văng. Người chơi cảm thấy rất khó chịu.",
  "Game thường xuyên bị văng khi đang chơi.",
  "Game rất tuyệt. Mong có thể chuyển đến sống cùng bạn bè và giá vật phẩm rẻ hơn.",
  "Game có quá nhiều lỗi. Người chơi tải về rồi nhanh chóng xóa.",
  "Sau khi cập nhật, game vẫn thường xuyên mất kết nối dù mạng gia đình tốt. Mong đội ngũ kiểm tra.",
  "Khi nạp tiền bằng cách quét mã ngân hàng, người chơi thường không nhận được vật phẩm.",
  "Game rất vui và gợi lại cảm giác tuổi thơ, nhưng vật phẩm hơi đắt. Mong giảm giá.",
  "Chơi trên iPad thường xuyên bị treo và văng.",
  "Game vui nhưng gacha rất đen. Chơi hơn 5 năm vẫn chưa từng quay được vật phẩm cầu vồng.",
  "Game báo đăng nhập không hợp lệ dù luôn đăng nhập bằng Facebook. Người chơi lo lắng và bị lỡ tiến độ pass.",
  "Kiếm tiền trong game quá ít trong khi mọi vật phẩm đều đắt.",
  "Game rất tốt. Mong có thanh trạng thái ăn, ngủ, tắm và thêm nhiều công việc.",
  "Người chơi vừa quay lại vì ký ức trước đây và thấy game rất vui.",
  "Quảng cáo quá dài làm game bị văng. Xem xong vẫn không nhận được phần thưởng và chỉ thấy báo lỗi.",
  "Gacha quá đen khiến người chơi rất bực bội.",
  "Game vui nhưng có vẻ cần kết nối mạng mạnh.",
  "Mong có thể hẹn hò với NPC và giảm giá vật phẩm vì đang quá đắt.",
  "Game rất vui. Mong có thêm nhiều minigame.",
  "Quảng cáo gây khó chịu và game tạo cảm giác liên tục thúc ép nạp tiền.",
  "Người chơi không thích một người chơi tên Yawaga vì hành vi gây phiền.",
  "Tỷ lệ gacha quá thấp, quảng cáo thường bị lỗi và game thúc ép nạp tiền. Mong xử lý người chơi gian lận.",
  "Đây là game yêu thích của người chơi. Họ mong có thêm các vật phẩm Mitra, Makara, Cottee và Eos.",
  "Mong giảm giá vật phẩm, thêm đồ dễ thương và thêm đồ trang trí nhà. Các phần khác của game đều ổn.",
  "Game thường tự thoát khi quay vật phẩm, khiến người chơi không nhận được vật phẩm đã quay.",
  "Game có quá nhiều quảng cáo đến mức người chơi không còn muốn chơi.",
  "Game rất vui, có nhiều minigame, trang phục miễn phí đẹp, thú cưng, trồng trọt, câu cá và nhiều hoạt động.",
  "Mong game bổ sung nghề nghiệp để kiếm tiền và tăng sự thú vị.",
  "Quảng cáo quá dài và làm game bị văng sau khi xem xong. Người chơi cho rằng hệ thống xử lý chưa hợp lý.",
  "Sau khi đăng nhập trên iOS, người chơi không thể đăng nhập lại trên thiết bị Android.",
  "Nội dung game ít đổi mới, chủ yếu lặp lại cá và rồng đổi màu. Mong có thêm loài vật mới.",
  "Thích sự kiện giá đặc biệt hằng ngày nhưng mong có mô tả và bản xem trước để phân biệt đồ trang trí, đồ mặc và vật phẩm trong lượt quay.",
  "Mong có thể mời bạn bè sống chung và cùng trang trí một ngôi nhà.",
  "Sau bản cập nhật mới nhất, game bị văng rất thường xuyên.",
  "Người chơi bị văng khỏi game mỗi lần vào và quyết định xóa game.",
  "Game tự văng ra rất thường xuyên.",
  "Người chơi mong game có mã quà tặng.",
  "Mong giảm giá vật phẩm, thêm đồ dễ thương và thêm đồ trang trí nhà. Các phần khác của game đều ổn.",
  "Game rất tốt nhưng thường bị văng trong lúc chơi.",
  "Người chơi thích không khí thân thiện, hình ảnh đẹp và có nhiều hoạt động để chơi.",
  "Mong sửa lỗi sự kiện vì game bị treo, không thể chơi và vào lại vẫn không thao tác được.",
  "Trên iPad, người chơi chỉ nhận được ít lựa chọn và không thể đổi tên nên cảm thấy bị lừa.",
  "Mong giảm giá nội thất và trang phục vì đang quá đắt.",
  "Ngôn ngữ trong game không nhất quán, lúc tiếng Thái lúc tiếng Anh. Người chơi muốn đọc cốt truyện nhiệm vụ bằng tiếng Thái.",
  "Quay 150 lần vẫn không nhận được kiếm đào khoáng. Người chơi cho rằng giá quá đắt.",
  "Ba thiết bị cùng lúc không thể vào game và hệ thống báo mạng không ổn định. Người chơi không biết liên hệ ai.",
  "Người chơi chấm 10 điểm.",
  "Người chơi rất yêu thích và thấy game cực kỳ vui.",
  "Không thể chơi vì game bị văng, khiến người chơi buồn.",
  "Game bị văng rất thường xuyên. Mong đội ngũ sửa lỗi.",
  "Mong tăng giới hạn 80 đồ nội thất trong vườn, tăng giới hạn 200 ô trồng và thêm đồ mới. Người chơi cũng đề xuất khóa trạng thái cây trồng.",
  "Ngọc xanh rất khó xuất hiện dù người chơi đã đập đá suốt một tháng.",
  "Game rất vui, có nhiều minigame, trang phục miễn phí đẹp, thú cưng, trồng trọt, câu cá và nhiều hoạt động.",
  "Cá vòng hiếm xuất hiện quá khó, khiến người chơi chán và mất hứng câu cá."
];

const raw = await readFile(inputPath);
const encoding = raw[0] === 0xff && raw[1] === 0xfe ? "utf16le" : "utf8";
const allRows = parseDelimited(raw.toString(encoding).replace(/^\uFEFF/, ""));
const rows = allRows.filter((row) => row.Date?.startsWith("2026-")).sort((a, b) => b.Date.localeCompare(a.Date));
if (rows.length !== translations.length) throw new Error(`Expected ${translations.length} rows for 2026, found ${rows.length}`);

const sentimentMap = { Happy: "Positive", Unhappy: "Negative", Neutral: "Neutral", Mixed: "Mixed" };
const appLink = "https://apps.apple.com/th/app/id1402384531";
const pii = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?66|0)[ -]?\d(?:[ -]?\d){7,}|\b(?:uid|user id|order id|transaction id)\s*[:#]?\s*[A-Z0-9-]{4,}/iu;
const noise = /(?:ขาย|รับซื้อ).*(?:ไอดี|เหรียญ)|แจกฟรี|https?:\/\/\S+|^\s*[@#]\S+\s*$/iu;
const classify = (text, sentiment) => {
  const value = text.toLocaleLowerCase();
  if (/ไม่ได้รับไอเทม|เติมเงินผ่าน/.test(value)) return ["Topup & Payment", "Không nhận vật phẩm sau thanh toán", sentiment === "Negative" ? "P0" : null];
  if (/ล็อคอิน|ล็อกผ่าน|เข้าเกมส์ไม่ได้|เข้าเกมไม่ได้|login/.test(value)) return ["Login / Account / Data", "Lỗi đăng nhập đa thiết bị", sentiment === "Negative" ? "P2" : null];
  if (/เด้ง|หลุด|ค้าง|บัค|kick out|crash/.test(value)) return ["Bug / Crash / Lag / Performance", "Game bị văng và treo", sentiment === "Negative" ? (/เล่นไม่ได้|กดอะไรไม่ได้|every time/.test(value) ? "P1" : "P2") : null];
  if (/โฆษณา|advert/.test(value)) return ["Other", "Quảng cáo gây gián đoạn", sentiment === "Negative" ? "P2" : null];
  if (/สุ่ม|เกลือ|กาชา|เรท|draw|เพชรฟ้า/.test(value)) return ["Gacha / Shop / Pricing", "Giá trị phần thưởng gacha", sentiment === "Negative" ? "P2" : null];
  if (/ราคา|แพง|ลดราคา|special prices/.test(value)) return ["Gacha / Shop / Pricing", "Giá vật phẩm quá cao", sentiment === "Negative" || sentiment === "Mixed" ? "P2" : null];
  if (/ภาษาไทย|ภาษา/.test(value)) return ["Localization (Thai text, wrong translation)", "Bản địa hóa tiếng Thái", sentiment === "Negative" || sentiment === "Mixed" ? "P2" : null];
  if (/อีเว้น|event/.test(value)) return ["Event & Update content", "Lỗi và nội dung sự kiện", sentiment === "Negative" ? "P1" : null];
  if (/yawaga|คนนี้|scam/.test(value)) return ["Social / Scam / Harassment / Toxic", "Tương tác xã hội tiêu cực", sentiment === "Negative" ? "P3" : null];
  if (/ตกปลา|ปลา|สวน|ปลูก|สัตว์|มินิเกม|งานทำ|อาชีพ|npc|บ้าน|dragon|กิจกรรม/.test(value)) return ["Activities (fishing, bugs, pets, housing, jobs, minigames)", "Hoạt động và tính năng trong game", sentiment === "Negative" ? "P2" : null];
  return ["Other", sentiment === "Positive" ? "Trải nghiệm game tích cực" : "Góp ý trải nghiệm chung", sentiment === "Negative" ? "P3" : null];
};
const segment = (text) => /เติม|ราคา|แพง|สุ่ม|กาชา|special prices|draw/.test(text.toLocaleLowerCase()) ? "payer"
  : /5ปี|ตั้งแต่เกมเปิด|ความทรงจำ/.test(text) ? "veteran"
  : /ตกปลา|สวน|อีเว้น|มินิเกม|กิจกรรม|อาชีพ/.test(text) ? "midgame" : "unknown";
const maxSeverity = (values) => values.sort((a, b) => Number(a?.slice(1) ?? 9) - Number(b?.slice(1) ?? 9))[0] || null;
const mask = (name) => name?.trim() ? `${[...name.trim()][0]}***` : "Ẩ***";
const byDate = new Map();
let noiseCount = 0, privacyCount = 0;
for (const [index, row] of rows.entries()) {
  const original = `${row.Title}. ${row.Content}`.trim();
  if (pii.test(original)) { privacyCount += 1; continue; }
  if (noise.test(original)) { noiseCount += 1; continue; }
  const sentiment = sentimentMap[row.Sentiment] || "Neutral";
  const [topic, theme, severity] = classify(original, sentiment);
  const item = {
    id: `ios-${createHash("sha256").update(`${row.Date}|${row.Username}|${original}`).digest("hex").slice(0, 16)}`,
    source: "App Store",
    link: appLink,
    author_masked: mask(row.Username),
    text_th: original,
    text_vn: translations[index],
    sentiment,
    confidence: 0.86,
    topic,
    topic_secondary: [],
    theme,
    segment: segment(original),
    severity,
    needs_review: false,
    rating: Number(row.Rating)
  };
  if (!byDate.has(row.Date)) byDate.set(row.Date, []);
  const duplicate = byDate.get(row.Date).some((existing) => existing.author_masked === item.author_masked && existing.text_th === item.text_th);
  if (!duplicate) byDate.get(row.Date).push(item);
}

const projectRoot = new URL("../", import.meta.url).pathname;
const dailyDir = join(projectRoot, "public/data/daily");
await mkdir(dailyDir, { recursive: true });
const sortedDates = [...byDate.keys()].sort();
const dailyMetrics = new Map();
const generatedAt = new Date(Date.now() + 7 * 3600_000).toISOString().replace("Z", "+07:00");
for (const date of sortedDates) {
  const items = byDate.get(date);
  const priorDate = new Date(`${date}T00:00:00Z`); priorDate.setUTCDate(priorDate.getUTCDate() - 1);
  const d1 = dailyMetrics.get(priorDate.toISOString().slice(0, 10))?.nss ?? null;
  const trailing = sortedDates.filter((candidate) => candidate < date && candidate >= new Date(new Date(`${date}T00:00:00Z`).getTime() - 7 * 86400_000).toISOString().slice(0, 10)).map((candidate) => dailyMetrics.get(candidate)?.nss).filter(Number.isFinite);
  const nss7 = trailing.length ? Math.round(trailing.reduce((a, b) => a + b, 0) / trailing.length * 10) / 10 : null;
  const metrics = buildMetrics(items, date === sortedDates[0] ? noiseCount : 0, { nss: d1, nss7 });
  dailyMetrics.set(date, metrics);
  const positiveGroups = Object.groupBy(items.filter((item) => item.sentiment === "Positive"), (item) => item.theme);
  const negativeGroups = Object.groupBy(items.filter((item) => item.sentiment === "Negative"), (item) => item.theme);
  const quote = (item) => ({ text_th: item.text_th, text_vn: item.text_vn, link: item.link });
  const segmentReport = Object.fromEntries(["new", "midgame", "veteran", "payer"].map((name) => {
    const matches = items.filter((item) => item.segment === name);
    return [name, { summary: matches.length ? `Có ${matches.length} phản hồi thuộc nhóm ${name}.` : "Không đủ dữ liệu.", links: matches.slice(0, 1).map((item) => item.link) }];
  }));
  const alerts = items.filter((item) => item.severity === "P0").map((item) => ({ level: "P0", title: item.theme, detail: item.text_vn, links: [item.link] }));
  const overview = `Có ${items.length} review iOS và NSS ${metrics.nss}. Dữ liệu mỏng. ${metrics.nss_d1 === null ? "Chưa có dữ liệu D-1." : `NSS D-1 là ${metrics.nss_d1}.`} ${metrics.nss_7d_avg === null ? "Chưa đủ dữ liệu trung bình 7 ngày." : `NSS trung bình 7 ngày là ${metrics.nss_7d_avg}.`}`;
  const payload = {
    date, generated_at: generatedAt, data_mode: "production", metrics, alerts,
    report: {
      overview,
      bright_spots: Object.entries(positiveGroups).slice(0, 3).map(([title, group]) => ({ title, count: group.length, quote: quote(group[0]) })),
      pain_points: Object.entries(negativeGroups).slice(0, 3).map(([issue, group]) => ({ issue, cause: "Có thể do trải nghiệm hoặc hệ thống chưa đáp ứng kỳ vọng trong tình huống được mô tả.", effect: "Nếu kéo dài, vấn đề có thể làm giảm mức hài lòng và tỷ lệ quay lại.", count: group.length, severity: maxSeverity(group.map((item) => item.severity)), quotes: group.slice(0, 2).map(quote) })),
      segments: segmentReport,
      next_actions: Object.fromEntries(["new", "midgame", "veteran", "payer"].map((name) => [name, [{ task: "Kiểm tra thêm dữ liệu từ nhiều nguồn trước khi thực hiện thay đổi.", owner: "Community", priority: "P2" }]])),
      data_health: [
        `Sensor Tower iOS TH: đã nhập ${items.length} review đã che tên cho ngày này.`,
        "Google Play, Facebook group, fanpage và CS chưa có trong lần backfill này.",
        `Toàn bộ export có ${privacyCount} item bị loại vì PII và ${noiseCount} item noise.`
      ]
    },
    items
  };
  await writeFile(join(dailyDir, `${date}.json`), `${JSON.stringify(payload, null, 2)}\n`);
}

const themesPath = join(projectRoot, "public/data/themes.json");
const themes = JSON.parse(await readFile(themesPath, "utf8"));
const known = new Set(themes.themes.map((theme) => theme.label));
let addedThemes = 0;
for (const items of byDate.values()) for (const item of items) if (!known.has(item.theme)) {
  themes.themes.push({ id: `imported-${createHash("sha256").update(item.theme).digest("hex").slice(0, 8)}`, label: item.theme, topic: item.topic });
  known.add(item.theme);
  addedThemes += 1;
}
if (addedThemes) themes.version += 1;
await writeFile(themesPath, `${JSON.stringify(themes, null, 2)}\n`);
const files = (await readdir(dailyDir)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();
const indexedDays = await Promise.all(files.map(async (name) => JSON.parse(await readFile(join(dailyDir, name), "utf8"))));
const latestWithData = indexedDays.filter((day) => day.items?.length).at(-1)?.date ?? files.at(-1)?.slice(0, -5);
await writeFile(join(projectRoot, "public/data/index.json"), `${JSON.stringify({ dates: files.map((name) => name.slice(0, -5)), latest_with_data: latestWithData, last_updated: generatedAt, data_mode: "production", theme_version: themes.version }, null, 2)}\n`);
console.log(`Imported ${[...byDate.values()].reduce((sum, items) => sum + items.length, 0)} iOS reviews across ${sortedDates.length} dates.`);
