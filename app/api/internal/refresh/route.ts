import {
  refreshCatalog,
  refreshDetailBatch,
  type ScrapeEnv,
} from "../../../../lib/benchmarklist";

export const dynamic = "force-dynamic";

async function getRuntimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env as unknown as ScrapeEnv;
}

function sameSecret(left: string, right: string) {
  if (left.length !== right.length || !left.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function POST(request: Request) {
  const runtime = await getRuntimeEnv();
  const configured = runtime.BENCHMARK_SYNC_TOKEN ?? "";
  const supplied = request.headers.get("x-benchmark-sync-token") ?? "";
  if (!configured) {
    return Response.json(
      { error: "Manual refresh is disabled; the scheduled indexer remains available." },
      { status: 503 },
    );
  }
  if (!sameSecret(configured, supplied)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const catalog = await refreshCatalog(runtime);
    const batch = await refreshDetailBatch(runtime, "manual");
    return Response.json({
      ok: true,
      benchmarkCount: catalog?.benchmarks.length ?? 0,
      batch,
    });
  } catch (error) {
    return Response.json(
      {
        error: "Refresh failed.",
        detail: error instanceof Error ? error.message : "Unknown refresh error",
      },
      { status: 500 },
    );
  }
}
