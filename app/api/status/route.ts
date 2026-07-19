import { benchmarkListConfig } from "../../../lib/benchmarklist";

export const dynamic = "force-dynamic";

async function getRuntimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env as unknown as RuntimeEnv;
}

type RuntimeEnv = {
  DB?: D1Database;
  BUCKET?: R2Bucket;
};

type RefreshState = {
  cursor: number;
  total: number;
  last_success_at: number | null;
  lease_until: number | null;
  lease_owner: string | null;
  last_error: string | null;
  catalog_r2_key: string | null;
  catalog_hash: string | null;
};

type ScrapeRun = {
  id: string;
  trigger: string;
  status: string;
  started_at: number;
  completed_at: number | null;
  discovered_count: number;
  processed_count: number;
};

type CountRow = { count: number };
type RefreshSummary = {
  attempted: number;
  failed: number;
  next_retry_at: number | null;
};

function iso(timestamp: number | null | undefined) {
  return timestamp ? new Date(timestamp).toISOString() : null;
}

function noStoreJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  const runtime = await getRuntimeEnv();
  const db = runtime.DB;
  const bucket = runtime.BUCKET;
  if (!db || !bucket) {
    return noStoreJson(
      {
        status: "unavailable",
        source: "BenchmarkList",
        storage: {
          d1: db ? "ready" : "missing",
          r2: bucket ? "ready" : "missing",
        },
      },
      503,
    );
  }

  try {
    const [
      state,
      latestRun,
      latestScheduledRun,
      latestClockRun,
      detailCount,
      documentCount,
      attemptCount,
      refreshSummary,
    ] =
      await Promise.all([
        db.prepare(
          `SELECT cursor, total, last_success_at, lease_until, lease_owner,
                  last_error, catalog_r2_key, catalog_hash
           FROM refresh_state WHERE name = 'benchmarklist'`,
        ).first<RefreshState>(),
        db.prepare(
          `SELECT id, trigger, status, started_at, completed_at,
                  discovered_count, processed_count
           FROM scrape_runs ORDER BY started_at DESC LIMIT 1`,
        ).first<ScrapeRun>(),
        db.prepare(
          `SELECT id, trigger, status, started_at, completed_at,
                  discovered_count, processed_count
           FROM scrape_runs
           WHERE trigger = 'scheduled'
           ORDER BY started_at DESC LIMIT 1`,
        ).first<ScrapeRun>(),
        db.prepare(
          `SELECT id, trigger, status, started_at, completed_at,
                  discovered_count, processed_count
           FROM scrape_runs
           WHERE trigger = 'external-clock'
           ORDER BY started_at DESC LIMIT 1`,
        ).first<ScrapeRun>(),
        db.prepare(
          `SELECT COUNT(*) AS count
           FROM benchmark_details AS details
           INNER JOIN catalog_benchmark_membership AS membership
             ON membership.benchmark_id = details.benchmark_id
           INNER JOIN refresh_state AS state
             ON state.name = 'benchmarklist'
            AND state.catalog_hash = membership.catalog_hash`,
        ).first<CountRow>(),
        db.prepare(
          "SELECT COUNT(*) AS count FROM source_documents",
        ).first<CountRow>(),
        db.prepare(
          "SELECT COUNT(*) AS count FROM benchmark_fetch_attempts",
        ).first<CountRow>(),
        db.prepare(
          `SELECT COUNT(*) AS attempted,
                  COALESCE(SUM(CASE WHEN failure_count > 0 THEN 1 ELSE 0 END), 0) AS failed,
                  MIN(CASE WHEN next_attempt_at > ? THEN next_attempt_at END) AS next_retry_at
           FROM benchmark_refresh_status AS refresh
           INNER JOIN catalog_benchmark_membership AS membership
             ON membership.benchmark_id = refresh.benchmark_id
           INNER JOIN refresh_state AS state
             ON state.name = 'benchmarklist'
            AND state.catalog_hash = membership.catalog_hash`,
        ).bind(Date.now()).first<RefreshSummary>(),
      ]);

    const catalogObjectExists = state?.catalog_r2_key
      ? Boolean(await bucket.head(state.catalog_r2_key))
      : false;
    const indexed = detailCount?.count ?? 0;
    const total = state?.total ?? 0;
    const progress = total ? Math.min(1, indexed / total) : 0;
    const catalogReady = Boolean(state?.catalog_r2_key && catalogObjectExists);
    const backfillState = total > 0 && indexed >= total
      ? "complete"
      : latestRun?.status === "running"
        ? "running"
        : "backfilling";
    const recentCutoff = Date.now() - 2 * 60 * 60 * 1000;
    const verifiedRun = (run: ScrapeRun | null) => Boolean(
      run &&
      (run.status === "succeeded" || run.status === "partial") &&
      run.processed_count > 0 &&
      (run.completed_at ?? 0) >= recentCutoff,
    );
    const scheduledProcessingVerified = verifiedRun(latestScheduledRun ?? null);
    const clockProcessingVerified = verifiedRun(latestClockRun ?? null);
    const automationActive = scheduledProcessingVerified || clockProcessingVerified;

    return noStoreJson({
      status: catalogReady
        ? !automationActive
          ? "degraded"
          : backfillState === "complete" ? "ready" : "backfilling"
        : "warming",
      source: "BenchmarkList",
      sourceUrl: benchmarkListConfig.catalogUrl,
      parserVersion: benchmarkListConfig.parserVersion,
      storage: {
        d1: "ready",
        r2: "ready",
        catalogObject: catalogObjectExists ? "ready" : "missing",
        archivedDocuments: documentCount?.count ?? 0,
        fetchAttempts: attemptCount?.count ?? 0,
      },
      catalog: {
        catalogReady,
        lastSuccessfulRefresh: iso(state?.last_success_at),
        hash: state?.catalog_hash ?? null,
        indexedBenchmarks: indexed,
        discoveredBenchmarks: total,
        cursor: state?.cursor ?? 0,
        progress,
        lastError: state?.last_error ?? null,
      },
      backfill: {
        state: backfillState,
        indexedBenchmarks: indexed,
        discoveredBenchmarks: total,
        coverage: progress,
        attemptedBenchmarks: refreshSummary?.attempted ?? 0,
        failedBenchmarks: refreshSummary?.failed ?? 0,
        nextRetryAt: iso(refreshSummary?.next_retry_at),
        selection: "due-retry-reserved-then-unseen-then-oldest",
      },
      automation: {
        status: automationActive ? "active" : "unverified",
        freshnessWindowMs: 2 * 60 * 60 * 1000,
        scheduledProcessingVerified,
        clockProcessingVerified,
      },
      refresh: {
        leaseActive: Boolean(
          state?.lease_owner &&
            state.lease_until &&
            state.lease_until > Date.now(),
        ),
        leaseExpiresAt: iso(state?.lease_until),
        latestRun: latestRun
          ? {
              id: latestRun.id,
              trigger: latestRun.trigger,
              status: latestRun.status,
              startedAt: iso(latestRun.started_at),
              completedAt: iso(latestRun.completed_at),
              processed: latestRun.processed_count,
              discovered: latestRun.discovered_count,
            }
          : null,
        scheduledTriggerObserved: Boolean(latestScheduledRun),
        scheduledProcessingVerified,
        latestScheduledRun: latestScheduledRun
          ? {
              id: latestScheduledRun.id,
              status: latestScheduledRun.status,
              startedAt: iso(latestScheduledRun.started_at),
              completedAt: iso(latestScheduledRun.completed_at),
              processed: latestScheduledRun.processed_count,
            }
          : null,
        clockTriggerObserved: Boolean(latestClockRun),
        clockProcessingVerified,
        latestClockRun: latestClockRun
          ? {
              id: latestClockRun.id,
              status: latestClockRun.status,
              startedAt: iso(latestClockRun.started_at),
              completedAt: iso(latestClockRun.completed_at),
              processed: latestClockRun.processed_count,
            }
          : null,
      },
    });
  } catch {
    return noStoreJson(
      {
        status: "unavailable",
        source: "BenchmarkList",
        storage: { d1: "error", r2: "unknown" },
        error: "The persistence schema or storage bindings are unavailable.",
      },
      503,
    );
  }
}
