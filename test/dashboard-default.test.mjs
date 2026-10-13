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
  for (const heading of ["Tóm tắt nhanh", "Người chơi thích gì", "Người chơi chưa hài lòng", "Cần xử lý", "Hoạt động cộng đồng", "Ghi chú về dữ liệu"]) {
    assert.ok(html.includes(heading), `missing section: ${heading}`);
  }
  for (const label of ["Chủ yếu tích cực", "Chủ yếu tiêu cực", "Chủ yếu trung tính"]) assert.ok(html.includes(label));
  // Bài rao bán vẫn được đếm nhưng không dùng để xếp hạng chủ đề thích / chưa hài lòng.
  assert.match(html, /const isOpinion = item => item\.activity_type!=='Rao bán \/ trao đổi'/);
  // Tránh phần trăm gây hiểu nhầm khi kỳ trước quá ít dữ liệu.
  assert.match(html, /if\(previous<10\)/);
  // Điểm store cập nhật theo tuần nên luôn nhìn lại 90 ngày.
  assert.match(html, /function ratingWindow\(current\)\{return calendarDates\(dateAdd\(current\.at\(-1\),-89\),current\.at\(-1\)\)\}/);
});

test("uses calendar days and validates manual ranges", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /function calendarDates\(start,end\)/);
  assert.match(html, /Mỗi lần xem tối đa 90 ngày/);
  assert.match(html, /available\.has\(date\).*\{date,items:\[\],ratings:\[\],alerts:\[\]\}/);
});
