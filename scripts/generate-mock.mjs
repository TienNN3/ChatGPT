import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildMetrics, dedupe, maskAuthor } from "./lib/metrics.mjs";

const root = new URL("../", import.meta.url).pathname;
const dailyDir = join(root, "public/data/daily");
await mkdir(dailyDir, { recursive: true });

const rawDays = [
  {
    date: "2026-10-10",
    items: [
      ["Google Play", "https://example.invalid/mock/gp-101", "Somchai", "อีเวนต์ใหม่สนุกมาก รางวัลปัง", "Sự kiện mới rất vui, phần thưởng tuyệt vời.", "Positive", 0.95, "Event & Update content", "Phần thưởng sự kiện", "midgame", null, 5],
      ["App Store", "https://example.invalid/mock/ios-101", "Nok", "เกมแลคตอนตกปลา", "Game bị lag khi câu cá.", "Negative", 0.96, "Bug / Crash / Lag / Performance", "Lag khi câu cá", "midgame", "P2", 2],
      ["Fanpage", "https://example.invalid/mock/fb-101", "Mint", "ชุดใหม่สวยดี 555", "Trang phục mới đẹp đấy, haha.", "Positive", 0.88, "Event & Update content", "Phần thưởng sự kiện", "unknown", null, null]
    ]
  },
  {
    date: "2026-10-11",
    items: [
      ["Google Play", "https://example.invalid/mock/gp-102", "Arun", "สุ่มเกลือดีจริงๆ ครับ", "Gacha 'may mắn' thật đấy. Câu này mang ý mỉa mai vì kết quả quá tệ.", "Negative", 0.84, "Gacha / Shop / Pricing", "Giá trị phần thưởng gacha", "payer", "P2", 1],
      ["CS", "https://example.invalid/mock/cs-102", "Pim", "เข้าเกมไม่ได้หลังอัปเดต", "Không thể đăng nhập sau bản cập nhật.", "Negative", 0.91, "Login / Account / Data", "Đăng nhập tài khoản", "veteran", "P1", null],
      ["App Store", "https://example.invalid/mock/ios-102", "Dao", "ภาษาไทยรอบนี้อ่านง่ายขึ้น", "Tiếng Thái ở bản này dễ đọc hơn.", "Positive", 0.9, "Localization (Thai text, wrong translation)", "Bản địa hóa tiếng Thái", "midgame", null, 5]
    ]
  },
  {
    date: "2026-10-12",
    items: [
      ["Google Play", "https://example.invalid/mock/gp-103", "Kiet", "ตกปลาแล้วหลุดสามครั้ง", "Bị mất kết nối ba lần khi câu cá.", "Negative", 0.94, "Bug / Crash / Lag / Performance", "Lag khi câu cá", "midgame", "P1", 1],
      ["Fanpage", "https://example.invalid/mock/fb-103", "May", "ของแจกกิจกรรมดีมาก", "Quà tặng sự kiện rất tốt.", "Positive", 0.93, "Rewards / Compensation", "Phần thưởng sự kiện", "new", null, null],
      ["App Store", "https://example.invalid/mock/ios-103", "Beam", "เติมแล้วของเข้าเร็ว", "Nạp tiền xong nhận vật phẩm nhanh.", "Positive", 0.92, "Topup & Payment", "Phần thưởng sự kiện", "payer", null, 5],
      ["Community export", "https://example.invalid/mock/group-103", "Fon", "เกมสนุกแต่บางครั้งแลค", "Game vui nhưng đôi lúc bị lag.", "Mixed", 0.86, "Bug / Crash / Lag / Performance", "Lag khi câu cá", "veteran", "P3", null]
    ]
  }
];

const dates = [];
const previousNss = [];
for (const day of rawDays) {
  const normalized = dedupe(day.items.map((row, index) => ({
    id: `mock-${day.date}-${String(index + 1).padStart(3, "0")}`,
    source: row[0], link: row[1], author: row[2], text_th: row[3], text_vn: row[4],
    sentiment: row[5], confidence: row[6], topic: row[7], topic_secondary: [], theme: row[8],
    segment: row[9], severity: row[10], rating: row[11], needs_review: row[6] < 0.6
  })));
  const items = normalized.map(({ author, links, rating, ...item }) => ({
    ...item,
    link: links[0] || item.link,
    source_links: links,
    author_masked: maskAuthor(author),
    ...(rating ? { rating } : {})
  }));
  const d1 = previousNss.at(-1) ?? null;
  const nss7 = previousNss.length ? Math.round(previousNss.reduce((a, b) => a + b, 0) / previousNss.length * 10) / 10 : null;
  const metrics = buildMetrics(items, 0, { nss: d1, nss7 });
  previousNss.push(metrics.nss);
  const negative = items.filter((item) => item.sentiment === "Negative");
  const positive = items.filter((item) => item.sentiment === "Positive");
  const quote = (item) => ({ text_th: item.text_th, text_vn: item.text_vn, link: item.link });
  const payload = {
    date: day.date,
    generated_at: `${day.date}T08:00:00+07:00`,
    data_mode: "mock",
    metrics,
    alerts: items.filter((item) => item.severity === "P0").map((item) => ({ level: "P0", title: item.theme, detail: item.text_vn, links: [item.link] })),
    report: {
      overview: `Dữ liệu mock có ${items.length} phản hồi và NSS ${metrics.nss}. Dữ liệu mỏng, không dùng để kết luận về người chơi thật.`,
      bright_spots: positive.slice(0, 2).map((item) => ({ title: item.theme, count: 1, quote: quote(item) })),
      pain_points: negative.slice(0, 2).map((item) => ({ issue: item.theme, cause: "Có thể do trải nghiệm trong tình huống được mô tả chưa ổn định.", effect: "Có thể làm giảm mức hài lòng nếu kéo dài.", count: 1, severity: item.severity, quotes: [quote(item)] })),
      segments: Object.fromEntries(["new", "midgame", "veteran", "payer"].map((segment) => [segment, { summary: items.some((item) => item.segment === segment) ? "Có phản hồi mock trong nhóm này." : "Chưa có dữ liệu.", links: items.filter((item) => item.segment === segment).map((item) => item.link).slice(0, 1) }])),
      next_actions: Object.fromEntries(["new", "midgame", "veteran", "payer"].map((segment) => [segment, [{ task: "Xác minh bằng dữ liệu thật trước khi hành động.", owner: "Community", priority: "P2" }]])),
      data_health: ["Toàn bộ dữ liệu trong file này là dữ liệu mock tổng hợp để kiểm thử giao diện.", "Các nguồn thật chưa được cấu hình."]
    },
    items
  };
  await writeFile(join(dailyDir, `${day.date}.json`), `${JSON.stringify(payload, null, 2)}\n`);
  dates.push(day.date);
}

const themes = JSON.parse(await readFile(join(root, "public/data/themes.json"), "utf8"));
await writeFile(join(root, "public/data/index.json"), `${JSON.stringify({ dates, last_updated: "2026-10-12T08:00:00+07:00", data_mode: "mock", theme_version: themes.version }, null, 2)}\n`);
console.log(`Generated ${dates.length} mock daily files: ${dates.join(", ")}`);
