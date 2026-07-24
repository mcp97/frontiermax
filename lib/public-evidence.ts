const BENCHMARKLIST_ORIGIN = "https://benchmarklist.com";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type CacheEnv = {
  DB?: D1Database;
};

type ApiCacheRow = {
  body: string;
  fetched_at: number;
  source_url: string;
};

export type BenchmarkMetric = {
  key: string;
  label: string;
  unit: string | null;
  higher_is_better: boolean | null;
};

export type PublicBenchmark = {
  benchmark_id: string;
  name: string;
  description: string;
  category: string;
  benchmark_type: string;
  model_type: string;
  review_state: string;
  primary_metric: string | null;
  metrics: BenchmarkMetric[];
  source: string;
  source_updated_at: string | null;
  stats: {
    snapshot_count: number;
    latest_snapshot_at: string | null;
    result_count: number;
    subject_count: number;
    model_count: number;
  };
  urls: {
    page: string;
    api: string;
    results: string;
  };
  [key: string]: unknown;
};

export type PublicResult = {
  display_name: string;
  model_id?: string | null;
  subject_id: string;
  subject_type: "model" | "model_variant" | "agent" | "system" | string;
  rank: number | null;
  source_url: string | null;
  metrics: Record<
    string,
    {
      label?: string;
      unit?: string | null;
      value: string | number | null;
      higher_is_better?: boolean;
    }
  >;
  metadata?: Record<string, unknown>;
};

export type PublicSnapshot = {
  sampled_at?: string | null;
  source_type?: string | null;
  notes?: string | null;
  provenance?: {
    url?: string;
    publisher?: string;
    publisher_kind?: string;
    self_reported?: boolean;
    source_hash?: string;
  };
  results: PublicResult[];
};

export type OpenRouterModel = {
  id: string;
  canonical_slug?: string | null;
  name: string;
  description?: string;
  context_length: number | null;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  supported_parameters?: string[];
  top_provider?: {
    context_length?: number | null;
  };
  benchmarks?: {
    artificial_analysis?: {
      intelligence_index?: number;
      coding_index?: number;
      agentic_index?: number;
    };
  };
  [key: string]: unknown;
};

function isAllowedSource(url: string) {
  const parsed = new URL(url);
  return (
    (parsed.origin === BENCHMARKLIST_ORIGIN &&
      parsed.pathname.startsWith("/api/v1/")) ||
    url === OPENROUTER_MODELS_URL
  );
}

async function ensureCacheTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS public_api_cache (
        cache_key TEXT PRIMARY KEY,
        source_url TEXT NOT NULL,
        body TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'ready',
        last_error TEXT
      )`,
    )
    .run();
}

export async function cachedPublicJson<T>(
  env: CacheEnv,
  cacheKey: string,
  sourceUrl: string,
  options: { maxAgeMs?: number; timeoutMs?: number } = {},
): Promise<{ data: T; fetchedAt: string; stale: boolean; sourceUrl: string }> {
  if (!isAllowedSource(sourceUrl)) {
    throw new Error("Unsupported public evidence source.");
  }

  const maxAgeMs = options.maxAgeMs ?? CACHE_TTL_MS;
  const timeoutMs = options.timeoutMs ?? 20_000;
  let cached: ApiCacheRow | null = null;

  if (env.DB) {
    try {
      await ensureCacheTable(env.DB);
      cached = await env.DB.prepare(
        "SELECT body, fetched_at, source_url FROM public_api_cache WHERE cache_key = ?",
      )
        .bind(cacheKey)
        .first<ApiCacheRow>();
      if (cached && Date.now() - cached.fetched_at < maxAgeMs) {
        return {
          data: JSON.parse(cached.body) as T,
          fetchedAt: new Date(cached.fetched_at).toISOString(),
          stale: false,
          sourceUrl: cached.source_url,
        };
      }
    } catch {
      cached = null;
    }
  }

  try {
    const response = await fetch(sourceUrl, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent":
          "FrontierMaxEvidenceClient/1.0 (+https://agent-frontier.alignedai.chatgpt.site)",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Source returned ${response.status}.`);
    }
    const body = await response.text();
    const data = JSON.parse(body) as T;
    const fetchedAt = Date.now();

    if (env.DB) {
      try {
        await ensureCacheTable(env.DB);
        await env.DB.prepare(
          `INSERT INTO public_api_cache
            (cache_key, source_url, body, fetched_at, status, last_error)
           VALUES (?, ?, ?, ?, 'ready', NULL)
           ON CONFLICT(cache_key) DO UPDATE SET
             source_url = excluded.source_url,
             body = excluded.body,
             fetched_at = excluded.fetched_at,
             status = 'ready',
             last_error = NULL`,
        )
          .bind(cacheKey, sourceUrl, body, fetchedAt)
          .run();
      } catch {
        // The live response is still usable when persistence is unavailable.
      }
    }

    return {
      data,
      fetchedAt: new Date(fetchedAt).toISOString(),
      stale: false,
      sourceUrl,
    };
  } catch (error) {
    if (cached) {
      return {
        data: JSON.parse(cached.body) as T,
        fetchedAt: new Date(cached.fetched_at).toISOString(),
        stale: true,
        sourceUrl: cached.source_url,
      };
    }
    throw error;
  }
}

export async function getBenchmarkCatalog(env: CacheEnv) {
  return cachedPublicJson<{
    api_version: string;
    count: number;
    benchmarks: PublicBenchmark[];
  }>(
    env,
    "benchmarklist:benchmarks:v1",
    `${BENCHMARKLIST_ORIGIN}/api/v1/benchmarks.json`,
  );
}

export async function getBenchmarkRecord(env: CacheEnv, benchmarkId: string) {
  if (!/^[a-z0-9_][a-z0-9_-]{0,199}$/i.test(benchmarkId)) {
    throw new Error("Invalid benchmark ID.");
  }
  return cachedPublicJson<{
    api_version: string;
    benchmark: PublicBenchmark;
    latest_snapshots: PublicSnapshot[];
  }>(
    env,
    `benchmarklist:benchmark:${benchmarkId}:v1`,
    `${BENCHMARKLIST_ORIGIN}/api/v1/benchmarks/${encodeURIComponent(benchmarkId)}.json`,
    { maxAgeMs: 24 * 60 * 60 * 1000 },
  );
}

export async function getOpenRouterModels(env: CacheEnv) {
  return cachedPublicJson<{ data: OpenRouterModel[] }>(
    env,
    "openrouter:models:v1",
    OPENROUTER_MODELS_URL,
    { maxAgeMs: 60 * 60 * 1000 },
  );
}
