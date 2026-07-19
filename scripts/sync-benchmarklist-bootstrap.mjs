import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://benchmarklist.com/search-index.json";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "public/data/benchmarklist-bootstrap.json");

function compactSearchText(...values) {
  const seen = new Set();
  const tokens = [];
  for (const token of values.join(" ").toLowerCase().replace(/[\u0000-\u001f\u007f]+/g, " ").split(/\s+/)) {
    const normalized = token.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    tokens.push(normalized);
    if (tokens.length >= 240) break;
  }
  return tokens.join(" ");
}

const response = await fetch(SOURCE_URL, {
  headers: {
    Accept: "application/json",
    "User-Agent":
      "FrontierMaxBenchmarkIndexer/0.2 (+https://agent-frontier.monilpat.chatgpt.site; source-attributed research index)",
  },
});

if (!response.ok) {
  throw new Error(`BenchmarkList returned ${response.status}`);
}

const raw = await response.json();
if (!Array.isArray(raw)) throw new Error("BenchmarkList search index is not an array");

const benchmarks = raw
  .filter((entry) => entry?.kind === "benchmark")
  .map((entry) => {
    const id = String(entry.id ?? "").trim();
    const title = String(entry.title ?? "").trim();
    const description = String(entry.subtitle ?? "").trim().slice(0, 480);
    // BenchmarkList appends a result count to some taxonomy labels (for example,
    // "Agentic / Business / 6 rows"). Keep the real slash-separated taxonomy,
    // but do not turn each row count into a separate catalog filter.
    const category =
      String(entry.meta ?? "Uncategorized")
        .replace(/\s*\/\s*\d[\d,]*\s+rows?\s*$/i, "")
        .trim() || "Uncategorized";
    return {
      id,
      title,
      description,
      category,
      url: new URL(String(entry.url ?? `/benchmarks/${id}/`), "https://benchmarklist.com").toString(),
      search: compactSearchText(
        id,
        title,
        category,
        description,
        String(entry.search ?? ""),
      ),
      priority: Number.isFinite(Number(entry.priority)) ? Number(entry.priority) : 0,
    };
  })
  .filter((entry) => entry.id && entry.title)
  .sort((left, right) => left.title.localeCompare(right.title));

const payload = {
  meta: {
    source: "BenchmarkList",
    sourceUrl: SOURCE_URL,
    fetchedAt: new Date().toISOString(),
    parserVersion: "benchmarklist-bootstrap-v0.1.0",
    benchmarkCount: benchmarks.length,
    rawRecordCount: raw.length,
    bootstrap: true,
  },
  benchmarks,
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(payload)}\n`, "utf8");
console.log(`Saved ${benchmarks.length} BenchmarkList records to ${output}`);
