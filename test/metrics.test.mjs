import test from "node:test";
import assert from "node:assert/strict";
import { buildMetrics, calculateNss, dedupe, maskAuthor } from "../scripts/lib/metrics.mjs";

test("calculates NSS from all four sentiment classes", () => {
  assert.equal(calculateNss({ Positive: 3, Neutral: 1, Negative: 1, Mixed: 1 }), 33.3);
});

test("deduplicates author and text while preserving source links", () => {
  const result = dedupe([{ author: "A", text_th: "same", link: "one" }, { author: "a", text_th: "same", link: "two" }]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].links, ["one", "two"]);
});

test("masks author and builds store metrics", () => {
  assert.equal(maskAuthor("สมชาย"), "ส***");
  const metrics = buildMetrics([{ source: "Google Play", sentiment: "Positive", topic: "Other", segment: "new", rating: 5 }]);
  assert.equal(metrics.store.gp_avg, 5);
  assert.equal(metrics.nss, 100);
});
