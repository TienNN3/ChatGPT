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
