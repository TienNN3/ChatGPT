import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("opens with the latest seven-day range selected", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /const state = \{ mode:'range'/);
  assert.match(html, /data-mode="range" class="active"/);
  assert.match(html, /data-days="7">7 ngày gần nhất/);
  assert.match(html, /initialStart=dateAdd\(latest,-6\)/);
  assert.match(html, /setMode\('range'\)/);
});

test("yesterday follows Bangkok calendar boundaries even when collection is delayed", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const dateAdd = html.match(/^    function dateAdd[^\n]+/m)?.[0];
  const yesterday = html.match(/^    function yesterdayInBangkok[^\n]+/m)?.[0];
  assert.ok(dateAdd && yesterday);
  const getYesterday = new Function(`${dateAdd}\n${yesterday}\nreturn yesterdayInBangkok;`)();
  assert.equal(getYesterday(new Date("2026-10-13T16:59:59Z")), "2026-10-12");
  assert.equal(getYesterday(new Date("2026-10-13T17:00:00Z")), "2026-10-13");
  assert.equal(getYesterday(new Date("2026-12-31T17:00:00Z")), "2026-12-31");
  assert.match(html, /button\.dataset\.days==='yesterday'\?yesterdayInBangkok\(\):latest/);
  assert.match(html, /\.max=\[dates\.at\(-1\),yesterdayInBangkok\(\)\]/);
});

test("keeps the selected period authoritative and separates uncertain dates", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /data-days="yesterday">Hôm qua/);
  assert.match(html, /Nhận định cho kỳ/);
  assert.match(html, /Toàn bộ số liệu dưới đây được tính lại theo đúng kỳ đang chọn/);
  assert.match(html, /Phản hồi theo nguồn/);
  assert.match(html, /i\.date_basis!==['"]observed_at['"]/);
  assert.match(html, /id="includeUndated"/);
  assert.match(html, /id="activityFilter"/);
  assert.doesNotMatch(html, /NSS/);
  assert.match(html, /Chi tiết số lượng theo ngày và nguồn/);
  assert.match(html, /const channelName = item =>/);
  assert.match(html, /Bản dịch tiếng Việt được đặt trước nguyên văn/);
  assert.match(html, /calendarDates\(dateAdd\(chosen\[0\],-29\),chosen\[0\]\)/);
  assert.match(html, /previousDays\(current\)/);
  assert.match(html, /data\/facebook-insights\.json/);
});

test("shows the supplied Thailand community badge", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /assets\/vnggames-th-badge\.png/);
  assert.match(html, /alt="VNGGames Thailand Community"/);
});

test("does not mistake the Thai word for bat for a frozen game", async () => {
  for (const date of ["2026-10-11", "2026-10-13"]) {
    const day = JSON.parse(await readFile(new URL(`../public/data/daily/${date}.json`, import.meta.url), "utf8"));
    const batItems = day.items.filter((item) => /ค้างคาว/iu.test(item.text_th || ""));
    assert.ok(batItems.length > 0, `expected a bat-related item on ${date}`);
    assert.ok(batItems.every((item) => item.theme !== "Game bị văng và treo"));
  }
});

test("reads as a report: summary, likes, dislikes and actions for the selected period", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  for (const heading of ["Tóm tắt nhanh", "Người chơi thích gì", "Người chơi chưa hài lòng", "Cần xử lý", "Người chơi đang làm gì", "Từ khoá được nhắc nhiều", "Từ khoá theo ngày", "Ghi chú về dữ liệu"]) {
    assert.ok(html.includes(heading), `missing section: ${heading}`);
  }
  for (const label of ["Chủ yếu tích cực", "Chủ yếu tiêu cực", "Chủ yếu trung tính"]) assert.ok(html.includes(label));
  // Bài rao bán vẫn được đếm nhưng không dùng để xếp hạng chủ đề thích / chưa hài lòng.
  assert.match(html, /const isOpinion = item => intentOf\(item\)!=='trade';/);
  // Tránh phần trăm gây hiểu nhầm khi kỳ trước quá ít dữ liệu.
  assert.match(html, /if\(previous<10\)/);
  // Điểm store cập nhật theo tuần nên luôn nhìn lại 90 ngày.
  // Rating: 90 ngày tính đến cuối kỳ, mở rộng thêm kỳ trước để so sánh lượt mới; biểu đồ và review vẫn giới hạn 90 ngày.
  assert.match(html, /function ratingWindow\(current\)\{const start=dateAdd\(current\.at\(-1\),-89\),prev=dateAdd\(current\[0\],-current\.length\);return calendarDates\(prev<start\?prev:start,current\.at\(-1\)\)\}/);
  assert.match(html, /const ratingRecent = \(\) => \{const end=state\.ratingDays\.at\(-1\)\?\.date,start=end\?dateAdd\(end,-89\)/);
});

test("splits the report into overview, sources, store reviews and feedback tabs", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  for (const tab of ["overview", "sources", "store", "feedback"]) {
    assert.match(html, new RegExp(`data-tab="${tab}"`));
    assert.match(html, new RegExp(`data-panel="${tab}"`));
  }
  assert.match(html, /Tỷ lệ cảm xúc theo nguồn/);
  assert.match(html, /Số sao và nội dung không khớp/);
  assert.match(html, /data-group="week"/);
  assert.match(html, /data-scale="share"/);
  // Review store: cột tiếng Việt là tóm tắt phân loại, không được trình bày như bản dịch.
  assert.match(html, /const isSummaryText = item =>/);
  // Nếu kỳ đang chọn không có review mới, phần nội dung vẫn phải hiển thị review gần nhất
  // trong 90 ngày và ghi rõ phạm vi; KPI của kỳ vẫn giữ nguyên.
  assert.match(html, /const shownReviews=n\?reviews:recentReviews/);
  assert.match(html, /Phần nội dung bên dưới đang dùng/);
  assert.match(html, /Dùng kỳ 90 ngày này/);
});

test("uses neutral topic names on screen and offers a copyable text report", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  // Một phản hồi khen về bạn bè không được hiển thị dưới tên "Tương tác xã hội tiêu cực".
  assert.match(html, /'Tương tác xã hội tiêu cực':'Bạn bè và tương tác xã hội'/);
  assert.match(html, /const themeLabel = name => THEME_NAMES\[name\] \|\| name;/);
  assert.match(html, /id="copyReport"/);
  assert.match(html, /function reportText\(\)/);
});

test("reports store ratings for the VNG app separately from the global app", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /const isVngApp = row => \/VNG\/i\.test\(row\.app_name\|\|''\)/);
  assert.match(html, /function newRatings\(platform,vng,start,end\)/);
  assert.match(html, /Điểm theo ứng dụng/);
  // Sensor Tower có cả app Global (HAEGIN) và app VNG; không được gộp hai app thành một điểm.
  const day = JSON.parse(await readFile(new URL("../public/data/daily/2026-10-05.json", import.meta.url), "utf8"));
  const apps = new Set((day.ratings || []).filter((r) => r.platform === "Google Play").map((r) => /VNG/i.test(r.app_name)));
  assert.deepEqual([...apps].sort(), [false, true]);
});

test("lists every data source in the roster so missing sources are explained", async () => {
  const { readdir } = await import("node:fs/promises");
  const roster = JSON.parse(await readFile(new URL("../public/data/sources.json", import.meta.url), "utf8"));
  const keys = new Set(roster.sources.map((s) => s.key));
  for (const s of roster.sources) assert.ok(roster.statuses[s.status], `unknown status for ${s.key}`);
  const dir = new URL("../public/data/daily/", import.meta.url);
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".json"))) {
    const day = JSON.parse(await readFile(new URL(file, dir), "utf8"));
    for (const item of day.items || []) assert.ok(keys.has(item.community || item.source), `${file}: ${item.community || item.source} missing from sources.json`);
  }
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /data\/sources\.json/);
  assert.match(html, /id="sourcePending"/);
});

test("every feedback item has a content type, keywords and a short summary", async () => {
  const { readdir } = await import("node:fs/promises");
  const intents = new Set(["question", "answer", "share", "event_entry", "bug", "performance", "account", "complaint", "suggestion", "praise", "trade", "social", "chat"]);
  const dir = new URL("../public/data/daily/", import.meta.url);
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".json"))) {
    const day = JSON.parse(await readFile(new URL(file, dir), "utf8"));
    for (const item of day.items || []) {
      assert.ok(intents.has(item.intent), `${file}/${item.id}: missing or invalid intent`);
      assert.ok(Array.isArray(item.keywords) && item.keywords.length >= 1 && item.keywords.length <= 4, `${file}/${item.id}: keywords`);
      assert.ok(item.summary_vn, `${file}/${item.id}: summary_vn`);
    }
  }
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /const INTENTS = \{/);
  assert.match(html, /id="dailyKeywords"/);
});

test("ships a how-it-works guide reachable from the ? button", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /id="helpToggle"/);
  assert.match(html, /how-it-works\.md/);
  const guide = await readFile(new URL("../public/how-it-works.md", import.meta.url), "utf8");
  for (const rule of ["observed_at", "ค้างคาว", "sources.json", "intent", "Play Together VNG", "apply-labels.mjs", "npm run check"]) assert.ok(guide.includes(rule), `guide missing: ${rule}`);
});

test("links overview elements to the feedback list by day, keyword and content type", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /id="dateFilter"/);
  assert.match(html, /data-filter-date=/);
  assert.match(html, /data-view="intent"/);
  assert.match(html, /focusExplorer\(\{dateFilter:date\}\)/);
});

test("uses calendar days and validates manual ranges", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /function calendarDates\(start,end\)/);
  assert.match(html, /Mỗi lần xem tối đa 90 ngày/);
  assert.match(html, /available\.has\(date\).*\{date,items:\[\],ratings:\[\],alerts:\[\]\}/);
});
