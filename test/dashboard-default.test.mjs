import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("opens with yesterday selected", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /const state = \{ mode:'range'/);
  assert.match(html, /data-mode="range" class="active"/);
  assert.match(html, /fromDate'\)\.value=dateAdd\(initialDate,-1\)/);
  assert.match(html, /toDate'\)\.value=dateAdd\(initialDate,-1\)/);
});

test("exposes daily intelligence shortcuts and separates uncertain dates", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /data-days="yesterday">Hôm qua/);
  assert.match(html, /Số feedback theo ngày/);
  assert.match(html, /i\.date_basis!==['"]observed_at['"]/);
  assert.match(html, /id="activityFilter"/);
  assert.doesNotMatch(html, /NSS/);
  assert.match(html, /Mỗi ngày, mỗi cộng đồng có bao nhiêu feedback/);
  assert.match(html, /function channelName\(item\)/);
  assert.match(html, /Bản dịch tiếng Việt được đặt trước nguyên văn/);
});
