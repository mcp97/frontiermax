import {
  benchmarkListConfig,
  getCatalog,
  type ScrapeEnv,
} from "../../../lib/benchmarklist";

export const dynamic = "force-dynamic";

async function getRuntimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env as unknown as ScrapeEnv;
}

export async function GET() {
  try {
    const catalog = await getCatalog(await getRuntimeEnv());
    if (!catalog) {
      return Response.json(
        { error: "The BenchmarkList catalog has not been indexed yet." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      {
        meta: {
          source: catalog.source,
          sourceUrl: catalog.sourceUrl,
          fetchedAt: catalog.fetchedAt,
          parserVersion: catalog.parserVersion,
          benchmarkCount: catalog.benchmarks.length,
          rawRecordCount: catalog.rawRecordCount,
          refreshWindowMs: benchmarkListConfig.catalogTtlMs,
        },
        benchmarks: catalog.benchmarks,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
          "X-Content-Source": "BenchmarkList",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error: "BenchmarkList could not be refreshed right now.",
        detail: error instanceof Error ? error.message : "Unknown indexing error",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
