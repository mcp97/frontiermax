import {
  getBenchmarkRecord,
  type PublicResult,
} from "../../../../lib/public-evidence";

export const dynamic = "force-dynamic";

async function runtimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env as unknown as { DB?: D1Database };
}

function normalizeResult(result: PublicResult, sampledAt: string | null) {
  return {
    rank: Number.isFinite(result.rank) ? result.rank : null,
    name: result.display_name,
    modelId: result.model_id ?? null,
    subjectId: result.subject_id,
    subjectType: result.subject_type,
    metrics: Object.entries(result.metrics ?? {}).map(([name, metric]) => ({
      name,
      value: metric.value,
      displayValue:
        metric.value == null
          ? "Not measured"
          : `${metric.value}${metric.unit === "%" ? "%" : ""}`,
      direction:
        metric.higher_is_better === true
          ? "higher"
          : metric.higher_is_better === false
            ? "lower"
            : "unknown",
      unit: metric.unit ?? null,
      label: metric.label ?? name,
    })),
    sourceUrl: result.source_url ?? null,
    sampledAt,
    metadata: result.metadata ?? {},
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  try {
    const result = await getBenchmarkRecord(await runtimeEnv(), slug);
    const benchmark = result.data.benchmark;
    const snapshots = result.data.latest_snapshots ?? [];
    const latest = snapshots[0] ?? null;
    const metricDirection =
      benchmark.metrics.find((metric) => metric.key === benchmark.primary_metric)
        ?.higher_is_better;
    const normalizedSnapshots = snapshots.map((snapshot, index) => ({
      id: `${benchmark.benchmark_id}:${snapshot.sampled_at ?? index}`,
      sampledAt: snapshot.sampled_at ?? null,
      sourceType: snapshot.source_type ?? null,
      provenance: snapshot.provenance ?? null,
      results: (snapshot.results ?? []).map((entry) =>
        normalizeResult(entry, snapshot.sampled_at ?? null),
      ),
    }));

    return Response.json(
      {
        detail: {
          id: benchmark.benchmark_id,
          title: benchmark.name,
          description: benchmark.description,
          category: benchmark.category,
          benchmarkType: benchmark.benchmark_type,
          modelType: benchmark.model_type,
          reviewState: benchmark.review_state,
          datePublished: null,
          dateModified: benchmark.source_updated_at,
          primaryMetric: benchmark.primary_metric,
          metricDirection:
            metricDirection === true
              ? "higher"
              : metricDirection === false
                ? "lower"
                : "unknown",
          metricDefinitions: benchmark.metrics,
          variables: [],
          relatedUrls: [],
          distributions: [],
          results: latest
            ? latest.results.map((entry) =>
                normalizeResult(entry, latest.sampled_at ?? null),
              )
            : [],
          snapshots: normalizedSnapshots,
          sourceUrl: benchmark.urls.page,
          apiUrl: benchmark.urls.api,
          resultsUrl: benchmark.urls.results,
          fetchedAt: result.fetchedAt,
          checkedAt: result.fetchedAt,
          sourceHash: latest?.provenance?.source_hash ?? "",
          parserVersion: `benchmarklist-api-${result.data.api_version}`,
          stale: result.stale,
          limitations: [
            "Scores are comparable only within compatible snapshots and configurations.",
            "Agent and system results are not silently attributed to a base model.",
            "Missing cost, latency, or token measurements remain missing.",
          ],
        },
        catalogEntry: {
          id: benchmark.benchmark_id,
          title: benchmark.name,
          description: benchmark.description,
          category: benchmark.category,
          url: benchmark.urls.page,
        },
      },
      {
        headers: {
          "Cache-Control":
            "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400",
          "X-Content-Source": "BenchmarkList API v1",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error: "This benchmark snapshot is temporarily unavailable.",
        detail: error instanceof Error ? error.message : "Unknown source error",
        retryable: true,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
