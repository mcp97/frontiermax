const MISSING_VALUES = new Set([
  "",
  "-",
  "—",
  "–",
  "n/a",
  "na",
  "none",
  "null",
  "unknown",
  "unavailable",
  "not available",
  "not reported",
]);

function normalizedName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[._/-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function hasReportedValue(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  return !MISSING_VALUES.has(value.trim().toLowerCase());
}

/**
 * @param {string} name
 * @param {string | null} [primaryMetric]
 */
export function classifyMetricName(name, primaryMetric = null) {
  const normalized = normalizedName(name);
  if (!normalized) return null;

  if (/(^|\s)(cost|price|pricing|usd|dollars?)(\s|$)/.test(normalized) || name.includes("$")) {
    return "cost";
  }
  if (/(latency|duration|completion time|wall clock|time to|ttft|milliseconds?|seconds?|minutes?)/.test(normalized)) {
    return "time";
  }
  if (/(^|\s)tokens?(\s|$)/.test(normalized)) {
    return "tokens";
  }

  const normalizedPrimary = normalizedName(primaryMetric);
  if (normalizedPrimary && normalized === normalizedPrimary) return "score";
  if (/(^|\s)(score|accuracy|f1|elo|reward|quality)(\s|$)/.test(normalized)) return "score";
  if (/(pass|success|win) rate/.test(normalized) || /^pass(?:\s|@)?(?:k|\d+)$/.test(normalized)) return "score";
  return null;
}

/**
 * @param {Array<{ metrics?: Array<{ name: string, value: unknown, displayValue?: unknown }> }>} results
 * @param {string | null} [primaryMetric]
 */
export function coverageByRow(results, primaryMetric = null) {
  return results.map((result) => {
    const keys = new Set();
    for (const metric of result.metrics ?? []) {
      if (!hasReportedValue(metric.value) && !hasReportedValue(metric.displayValue)) continue;
      const key = classifyMetricName(metric.name, primaryMetric);
      if (key) keys.add(key);
    }
    return keys;
  });
}

/**
 * @param {Array<{ metrics?: Array<{ name: string }> }>} results
 * @param {string | null} [primaryMetric]
 */
export function tableMetricNames(results, primaryMetric = null) {
  const names = [];
  for (const result of results) {
    for (const metric of result.metrics ?? []) {
      if (!names.includes(metric.name)) names.push(metric.name);
    }
  }
  if (primaryMetric) {
    const primaryIndex = names.findIndex((name) => normalizedName(name) === normalizedName(primaryMetric));
    if (primaryIndex > 0) names.unshift(...names.splice(primaryIndex, 1));
  }
  return names;
}
