export const SENTIMENTS = ["Positive", "Neutral", "Negative", "Mixed"];

export function calculateNss(counts) {
  const total = SENTIMENTS.reduce((sum, key) => sum + (counts[key] || 0), 0);
  return total ? Math.round((((counts.Positive || 0) - (counts.Negative || 0)) / total) * 1000) / 10 : 0;
}

export function groupCount(items, field, fallback = "unknown") {
  return items.reduce((result, item) => {
    const key = item[field] || fallback;
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

export function maskAuthor(author = "") {
  const clean = String(author).trim();
  return clean ? `${[...clean][0]}***` : "Ẩ***";
}

export function dedupe(items) {
  const found = new Map();
  for (const item of items) {
    const key = `${String(item.author || "").toLocaleLowerCase()}|${String(item.text_th || "").trim().toLocaleLowerCase()}`;
    if (!found.has(key)) {
      found.set(key, { ...item, links: [item.link].filter(Boolean) });
    } else if (item.link && !found.get(key).links.includes(item.link)) {
      found.get(key).links.push(item.link);
    }
  }
  return [...found.values()];
}

export function buildMetrics(items, noise = 0, previous = {}) {
  const bySentiment = groupCount(items, "sentiment");
  const reviews = items.filter((item) => Number.isFinite(item.rating));
  const sourceRatings = (source) => {
    const values = reviews.filter((item) => item.source === source).map((item) => item.rating);
    return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : null;
  };
  return {
    volume: items.length,
    noise,
    by_source: groupCount(items, "source"),
    by_sentiment: Object.fromEntries(SENTIMENTS.map((key) => [key, bySentiment[key] || 0])),
    by_topic: groupCount(items, "topic"),
    by_segment: groupCount(items, "segment"),
    nss: calculateNss(bySentiment),
    nss_d1: previous.nss ?? null,
    nss_7d_avg: previous.nss7 ?? null,
    store: {
      gp_avg: sourceRatings("Google Play"),
      ios_avg: sourceRatings("App Store"),
      star_1: reviews.filter((item) => item.rating === 1).length,
      star_5: reviews.filter((item) => item.rating === 5).length
    }
  };
}
