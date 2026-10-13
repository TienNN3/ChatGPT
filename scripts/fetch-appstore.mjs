import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const targetDate = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate || "")) {
  throw new Error("Usage: node scripts/fetch-appstore.mjs YYYY-MM-DD");
}

const searchUrl = "https://itunes.apple.com/search?term=Play%20Together&country=th&entity=software&limit=50";
const searchResponse = await fetch(searchUrl);
if (!searchResponse.ok) throw new Error(`App Store search failed: HTTP ${searchResponse.status}`);
const search = await searchResponse.json();
const app = search.results.find((item) => item.bundleId === "com.haegin.playtogether")
  || search.results.find((item) => /play together/i.test(item.trackName || "") && /haegin/i.test(item.sellerName || ""));
if (!app?.trackId) throw new Error("Could not resolve Play Together App Store ID");

const rssUrl = `https://itunes.apple.com/th/rss/customerreviews/id=${app.trackId}/sortBy=mostRecent/json`;
const rssResponse = await fetch(rssUrl);
if (!rssResponse.ok) throw new Error(`App Store RSS failed: HTTP ${rssResponse.status}`);
const feed = await rssResponse.json();
const entries = Array.isArray(feed.feed?.entry) ? feed.feed.entry : [];
const ictDate = (value) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date(value));
const pii = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?66|0)[ -]?\d(?:[ -]?\d){7,}|\b(?:uid|user id|order id|transaction id)\s*[:#]?\s*[A-Z0-9-]{4,}/iu;
const output = [];
let privacyFiltered = 0;
for (const entry of entries) {
  const rating = Number(entry["im:rating"]?.label);
  const updated = entry.updated?.label;
  const text = String(entry.content?.label || "").trim();
  if (!rating || !updated || !text || ictDate(updated) !== targetDate) continue;
  if (pii.test(text)) { privacyFiltered += 1; continue; }
  const author = String(entry.author?.name?.label || "").trim();
  const links = Array.isArray(entry.link) ? entry.link : [];
  const link = links.find((item) => item.attributes?.rel === "related")?.attributes?.href
    || links.find((item) => item.attributes?.href)?.attributes?.href
    || app.trackViewUrl;
  output.push({
    source_id: String(entry.id?.label || `${app.trackId}-${updated}`),
    source: "App Store",
    storefront: "TH",
    locale: /[\u0E00-\u0E7F]/u.test(text) ? "th" : "other",
    created_at: updated,
    link,
    author_masked: author ? `${[...author][0]}***` : "Ẩ***",
    text_original: text,
    rating
  });
}

const result = {
  target_date: targetDate,
  fetched_at: new Date().toISOString(),
  app: { id: app.trackId, name: app.trackName, bundle_id: app.bundleId },
  source_url: rssUrl,
  privacy_filtered: privacyFiltered,
  items: output
};
await mkdir("run-artifacts", { recursive: true });
const outputPath = join("run-artifacts", `appstore-${targetDate}.json`);
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Saved ${output.length} sanitized App Store reviews for ${targetDate} to ${outputPath}`);
