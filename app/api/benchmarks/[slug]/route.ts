import {
  getBenchmarkDetail,
  getCatalog,
  RefreshDeferredError,
  type ScrapeEnv,
} from "../../../../lib/benchmarklist";

export const dynamic = "force-dynamic";

async function getRuntimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env as unknown as ScrapeEnv;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  try {
    const runtime = await getRuntimeEnv();
    const catalog = await getCatalog(runtime);
    if (!catalog) {
      return Response.json(
        { error: "The BenchmarkList catalog has not been indexed yet." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    const catalogEntry = catalog.benchmarks.find((benchmark) => benchmark.id === slug);
    if (!catalogEntry) {
      return Response.json({ error: "Benchmark not found." }, { status: 404 });
    }
    const detail = await getBenchmarkDetail(runtime, slug, catalogEntry.url);
    return Response.json(
      {
        detail,
        catalogEntry,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=300, stale-while-revalidate=3600",
          "X-Content-Source": "BenchmarkList",
        },
      },
    );
  } catch (error) {
    const deferred = error instanceof RefreshDeferredError;
    return Response.json(
      {
        error: "This benchmark could not be indexed right now.",
        detail: error instanceof Error ? error.message : "Unknown indexing error",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          ...(deferred ? { "Retry-After": String(error.retryAfterSeconds) } : {}),
        },
      },
    );
  }
}
