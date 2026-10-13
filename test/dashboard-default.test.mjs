import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("opens with the latest 30 calendar days selected", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /const state = \{ mode:'range'/);
  assert.match(html, /data-mode="range" class="active"/);
  assert.match(html, /fromDate'\)\.value=dateAdd\(initialDate,-29\)/);
  assert.match(html, /toDate'\)\.value=initialDate/);
});

test("exposes daily intelligence shortcuts and separates uncertain dates", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /data-days="yesterday">Hôm qua/);
  assert.match(html, /Volume có ngày đăng/);
  assert.match(html, /i\.date_basis!==['"]observed_at['"]/);
  assert.match(html, /id="activityFilter"/);
  assert.match(html, /NSS = % phản hồi tích cực . % phản hồi tiêu cực/);
  assert.match(html, /Thảo luận theo cộng đồng \/ nguồn/);
  assert.match(html, /function channelName\(item\)/);
});
