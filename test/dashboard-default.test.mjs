import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("opens in a clear one-day view for yesterday", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /const state = \{ mode:'day'/);
  assert.match(html, /data-mode="day" class="active"/);
  assert.match(html, /const initialDate=dateAdd\(latest,-1\)/);
  assert.match(html, /Ngày cần xem/);
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

test("uses calendar days and validates manual ranges", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /function calendarDates\(start,end\)/);
  assert.match(html, /Mỗi lần xem tối đa 90 ngày/);
  assert.match(html, /available\.has\(date\).*\{date,items:\[\],ratings:\[\],alerts:\[\]\}/);
});
