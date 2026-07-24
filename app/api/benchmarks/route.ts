import {
  getBenchmarkCatalog,
  type PublicBenchmark,
} from "../../../lib/public-evidence";

export const dynamic = "force-dynamic";

async function runtimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env as unknown as { DB?: D1Database };
}

function toCatalogRecord(benchmark: PublicBenchmark) {
  const aliases = Array.isArray(benchmark.aliases)
    ? benchmark.aliases.map(String)
    : [];
  const metricNames = benchmark.metrics.map((metric) => metric.label);
  const search = [
    benchmark.benchmark_id,
    benchmark.name,
    benchmark.description,
    benchmark.category,
    benchmark.benchmark_type,
    benchmark.model_type,
    benchmark.source,
    ...aliases,
    ...metricNames,
  ]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ");

  return {
    id: benchmark.benchmark_id,
    title: benchmark.name,
    description: benchmark.description || "Source-linked benchmark record.",
    category: benchmark.category || "uncategorized",
    url: benchmark.urls.page,
    search,
    priority:
      (benchmark.review_state === "verified" ? 100_000 : 0) +
      benchmark.stats.result_count,
    benchmarkType: benchmark.benchmark_type,
    modelType: benchmark.model_type,
    reviewState: benchmark.review_state,
    primaryMetric: benchmark.primary_metric,
    source: benchmark.source,
    sampledAt: benchmark.stats.latest_snapshot_at,
    resultCount: benchmark.stats.result_count,
    subjectCount: benchmark.stats.subject_count,
    modelCount: benchmark.stats.model_count,
    metrics: benchmark.metrics,
  };
}

export async function GET() {
  try {
    const result = await getBenchmarkCatalog(await runtimeEnv());
    const benchmarks = result.data.benchmarks.map(toCatalogRecord);
    return Response.json(
      {
        meta: {
          source: "BenchmarkList Public Data API",
          sourceUrl: result.sourceUrl,
          fetchedAt: result.fetchedAt,
          apiVersion: result.data.api_version,
          benchmarkCount: benchmarks.length,
          rawRecordCount: result.data.count,
          stale: result.stale,
        },
        benchmarks,
      },
      {
        headers: {
          "Cache-Control":
            "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400",
          "X-Content-Source": "BenchmarkList API v1",
          "X-Evidence-Stale": String(result.stale),
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error: "BenchmarkList is temporarily unavailable and no cached snapshot exists.",
        detail: error instanceof Error ? error.message : "Unknown source error",
        retryable: true,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
