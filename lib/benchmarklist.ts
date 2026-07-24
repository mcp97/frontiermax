import {
  CATALOG_MEMBERSHIP_CHUNK_SIZE,
  selectDueBenchmarkIds,
} from "./refresh-selection.mjs";

const BENCHMARKLIST_ORIGIN = "https://benchmarklist.com";
const CATALOG_URL = `${BENCHMARKLIST_ORIGIN}/search-index.json`;
const PARSER_VERSION = "benchmarklist-jsonld-v0.3.0";
const PARSER_KEY = PARSER_VERSION.replace(/[^a-z0-9.-]+/gi, "-");
const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;
const DETAIL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CRAWL_BATCH_SIZE = 8;
const REQUEST_CRAWL_BATCH_SIZE = 3;
const CRAWL_DELAY_MS = 2_000;
const REQUEST_CRAWL_COOLDOWN_MS = 10 * 60 * 1000;
const REQUEST_STALE_RUN_MS = 2 * 60 * 1000;
const REQUEST_RUN_BUDGET_MS = 18_000;
const REQUEST_FETCH_TIMEOUT_MS = 6_000;
const ON_DEMAND_FETCH_TIMEOUT_MS = 8_000;
const FETCH_TIMEOUT_MS = 30_000;
const DETAIL_SINGLE_FLIGHT_MS = 60_000;
const FETCH_ATTEMPT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const BENCHMARK_ID_PATTERN = /^[a-z0-9_][a-z0-9_-]{0,199}$/i;
const REFRESH_LEASE_MS = 14 * 60 * 1000;
const REQUEST_REFRESH_LEASE_MS = 2 * 60 * 1000;

const REQUEST_HEADERS = {
  Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
  "User-Agent":
    "FrontierMaxBenchmarkIndexer/0.2 (+https://agent-frontier.alignedai.chatgpt.site; source-attributed research index)",
};

export type ScrapeEnv = {
  DB: D1Database;
  BUCKET: R2Bucket;
  BENCHMARK_SYNC_TOKEN?: string;
};

export class RefreshDeferredError extends Error {
  retryAfterSeconds = 15;

  constructor() {
    super("Benchmark detail refresh is already running or waiting for its retry window.");
    this.name = "RefreshDeferredError";
  }
}

export type CatalogBenchmark = {
  id: string;
  title: string;
  description: string;
  category: string;
  url: string;
  search: string;
  priority: number;
};

export type CatalogSnapshot = {
  source: "BenchmarkList";
  sourceUrl: string;
  fetchedAt: string;
  parserVersion: string;
  rawRecordCount: number;
  benchmarks: CatalogBenchmark[];
};

export type BenchmarkResult = {
  rank: number | null;
  name: string;
  metrics: Array<{
    name: string;
    value: string | number | null;
    displayValue?: string;
    direction?: "higher" | "lower" | "unknown";
  }>;
  sourceUrl?: string | null;
  sampledAt?: string | null;
  snapshotId?: string;
};

export type BenchmarkSnapshot = {
  id: string;
  results: BenchmarkResult[];
};

export type BenchmarkDetail = {
  id: string;
  title: string;
  description: string;
  category: string | null;
  datePublished: string | null;
  dateModified: string | null;
  primaryMetric: string | null;
  metricDirection: "higher" | "lower" | "unknown";
  variables: string[];
  relatedUrls: string[];
  distributions: Array<{ name: string; url: string }>;
  results: BenchmarkResult[];
  snapshots: BenchmarkSnapshot[];
  sourceUrl: string;
  fetchedAt: string;
  checkedAt?: string;
  sourceHash: string;
  parserVersion: string;
};

type RefreshTrigger = "scheduled" | "manual" | "request" | "external-clock" | "on-demand";

type DetailRefreshOptions = {
  timeoutMs?: number;
  runId?: string | null;
  trigger?: RefreshTrigger;
};

type RefreshStateRow = {
  name: string;
  cursor: number;
  total: number;
  last_success_at: number | null;
  lease_until: number | null;
  lease_owner: string | null;
  last_error: string | null;
  catalog_r2_key: string | null;
  catalog_hash: string | null;
};

type SourceDocumentRow = {
  content_hash: string;
  etag: string | null;
  last_modified: string | null;
};

type BenchmarkRefreshStatusRow = {
  benchmark_id: string;
  last_attempt_at: number;
  last_success_at: number | null;
  next_attempt_at: number;
  failure_count: number;
  last_error: string | null;
};

function absoluteSourceUrl(pathOrUrl: string) {
  const url = new URL(pathOrUrl, BENCHMARKLIST_ORIGIN);
  if (url.origin !== BENCHMARKLIST_ORIGIN) {
    throw new Error("BenchmarkList source URL must stay on benchmarklist.com");
  }
  if (!url.pathname.startsWith("/benchmarks/")) {
    throw new Error("BenchmarkList detail URL must stay under /benchmarks/");
  }
  return url.toString();
}

function normalizeCategory(value: unknown) {
  return String(value ?? "Uncategorized")
    .replace(/\s*\/\s*\d[\d,]*\s+rows?\s*$/i, "")
    .trim() || "Uncategorized";
}

function compactSearchText(...values: string[]) {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const token of values
    .join(" ")
    .toLowerCase()
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .split(/\s+/)) {
    const normalized = token.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    tokens.push(normalized);
    if (tokens.length >= 240) break;
  }
  return tokens.join(" ");
}

function normalizeHttpUrl(value: string, base = BENCHMARKLIST_ORIGIN) {
  try {
    const url = new URL(decodeHtml(value), base);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readJsonObject<T>(bucket: R2Bucket, key: string) {
  const object = await bucket.get(key);
  if (!object) return null;
  return JSON.parse(await object.text()) as T;
}

async function latestSourceDocument(env: ScrapeEnv, sourceUrl: string) {
  return env.DB.prepare(
    `SELECT content_hash, etag, last_modified
     FROM source_documents
     WHERE source_url = ?
     ORDER BY fetched_at DESC
     LIMIT 1`,
  )
    .bind(sourceUrl)
    .first<SourceDocumentRow>();
}

async function archiveSourceDocument(
  env: ScrapeEnv,
  input: {
    sourceUrl: string;
    body: string;
    contentType: string;
    extension: "json" | "html" | "xml";
    response: Response;
    recordCount: number;
  },
) {
  const contentHash = await sha256(input.body);
  const r2Key = `benchmarklist/raw/${contentHash}.${input.extension}`;
  const existing = await env.BUCKET.head(r2Key);
  if (!existing) {
    await env.BUCKET.put(r2Key, input.body, {
      httpMetadata: { contentType: input.contentType },
      customMetadata: {
        sourceUrl: input.sourceUrl,
        fetchedAt: new Date().toISOString(),
        parserVersion: PARSER_VERSION,
      },
    });
  }

  const previous = await latestSourceDocument(env, input.sourceUrl);
  const id = await sha256(`${input.sourceUrl}:${contentHash}`);
  await env.DB.prepare(
    `INSERT INTO source_documents
      (id, source_url, content_hash, r2_key, content_type, fetched_at, etag,
       last_modified, http_status, parser_version, record_count, previous_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       fetched_at = excluded.fetched_at,
       etag = excluded.etag,
       last_modified = excluded.last_modified,
       http_status = excluded.http_status,
       parser_version = excluded.parser_version`,
  )
    .bind(
      id,
      input.sourceUrl,
      contentHash,
      r2Key,
      input.contentType,
      Date.now(),
      input.response.headers.get("etag"),
      input.response.headers.get("last-modified"),
      input.response.status,
      PARSER_VERSION,
      input.recordCount,
      previous?.content_hash ?? null,
    )
    .run();

  return { id, contentHash, r2Key };
}

async function updateSourceDocumentRecordCount(
  env: ScrapeEnv,
  id: string,
  recordCount: number,
) {
  await env.DB.prepare(
    `UPDATE source_documents SET record_count = ? WHERE id = ?`,
  )
    .bind(recordCount, id)
    .run();
}

async function fetchSource(
  sourceUrl: string,
  previous?: SourceDocumentRow | null,
  conditional = true,
  timeoutMs = FETCH_TIMEOUT_MS,
) {
  const headers = new Headers(REQUEST_HEADERS);
  if (conditional && previous?.etag) headers.set("If-None-Match", previous.etag);
  if (conditional && previous?.last_modified) {
    headers.set("If-Modified-Since", previous.last_modified);
  }
  const response = await fetch(sourceUrl, {
    headers,
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const finalUrl = new URL(response.url || sourceUrl);
  if (finalUrl.origin !== BENCHMARKLIST_ORIGIN) {
    throw new Error("BenchmarkList redirected outside benchmarklist.com");
  }
  return response;
}

function normalizeCatalog(raw: unknown, fetchedAt: string): CatalogSnapshot {
  if (!Array.isArray(raw)) throw new Error("BenchmarkList search index is not an array");
  const benchmarks = raw
    .filter((entry) => entry && typeof entry === "object" && (entry as { kind?: unknown }).kind === "benchmark")
    .map((entry) => {
      const item = entry as Record<string, unknown>;
      const id = String(item.id ?? "").trim();
      const title = String(item.title ?? "").trim();
      if (!BENCHMARK_ID_PATTERN.test(id) || !title) return null;
      const description = String(item.subtitle ?? "").trim().slice(0, 480);
      const category = normalizeCategory(item.meta);
      const sourceSearch = typeof item.search === "string" ? item.search : "";
      return {
        id,
        title,
        description,
        category,
        url: absoluteSourceUrl(String(item.url ?? `/benchmarks/${id}/`)),
        search: compactSearchText(
          id,
          title,
          category,
          description,
          sourceSearch,
        ),
        priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : 0,
      } satisfies CatalogBenchmark;
    })
    .filter((entry): entry is CatalogBenchmark => entry !== null)
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    source: "BenchmarkList",
    sourceUrl: CATALOG_URL,
    fetchedAt,
    parserVersion: PARSER_VERSION,
    rawRecordCount: raw.length,
    benchmarks,
  };
}

async function catalogState(env: ScrapeEnv) {
  return env.DB.prepare(
    `SELECT name, cursor, total, last_success_at, lease_until, lease_owner, last_error,
            catalog_r2_key, catalog_hash
     FROM refresh_state WHERE name = 'benchmarklist'`,
  ).first<RefreshStateRow>();
}

async function writeCatalogSnapshot(
  env: ScrapeEnv,
  snapshot: CatalogSnapshot,
  sourceHash: string,
) {
  const body = JSON.stringify(snapshot);
  const key = `benchmarklist/normalized/catalog-${PARSER_KEY}-${sourceHash}.json`;
  if (!(await env.BUCKET.head(key))) {
    await env.BUCKET.put(key, body, {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: {
        sourceUrl: CATALOG_URL,
        fetchedAt: snapshot.fetchedAt,
        parserVersion: PARSER_VERSION,
      },
    });
  }
  const membershipStatements = [];
  // D1 allows at most 100 bound parameters per statement. Each membership row
  // uses two, so keep each insert comfortably below that ceiling.
  for (
    let offset = 0;
    offset < snapshot.benchmarks.length;
    offset += CATALOG_MEMBERSHIP_CHUNK_SIZE
  ) {
    const chunk = snapshot.benchmarks.slice(
      offset,
      offset + CATALOG_MEMBERSHIP_CHUNK_SIZE,
    );
    const placeholders = chunk.map(() => "(?, ?)").join(", ");
    membershipStatements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO catalog_benchmark_membership
          (catalog_hash, benchmark_id)
         VALUES ${placeholders}`,
      ).bind(
        ...chunk.flatMap((benchmark) => [sourceHash, benchmark.id]),
      ),
    );
  }
  const stateStatement = env.DB.prepare(
    `INSERT INTO refresh_state
      (name, cursor, total, last_success_at, lease_until, last_error,
       catalog_r2_key, catalog_hash)
     VALUES ('benchmarklist', 0, ?, ?, NULL, NULL, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       total = excluded.total,
       last_success_at = excluded.last_success_at,
       last_error = NULL,
       catalog_r2_key = excluded.catalog_r2_key,
       catalog_hash = excluded.catalog_hash,
       cursor = CASE
         WHEN excluded.total > 0 THEN refresh_state.cursor % excluded.total
         ELSE 0
       END`,
  ).bind(snapshot.benchmarks.length, Date.now(), key, sourceHash);
  await env.DB.batch([
    ...membershipStatements,
    stateStatement,
    env.DB.prepare(
      `DELETE FROM catalog_benchmark_membership WHERE catalog_hash != ?`,
    ).bind(sourceHash),
  ]);
  return snapshot;
}

export async function refreshCatalog(
  env: ScrapeEnv,
  timeoutMs = FETCH_TIMEOUT_MS,
) {
  try {
    // Only send conditional headers when the normalized object is still present.
    // A prior write may have archived the response before D1/R2 state finished;
    // accepting a 304 in that state would leave the catalog impossible to serve.
    const cached = await getCachedCatalog(env);
    const parserCurrent = cached?.parserVersion === PARSER_VERSION;
    const previous = parserCurrent
      ? await latestSourceDocument(env, CATALOG_URL)
      : null;
    const response = await fetchSource(CATALOG_URL, previous, true, timeoutMs);
    if (response.status === 304) {
      await env.DB.prepare(
        `UPDATE refresh_state
         SET last_success_at = ?, last_error = NULL
         WHERE name = 'benchmarklist'`,
      )
        .bind(Date.now())
        .run();
      return cached;
    }
    if (!response.ok) {
      throw new Error(`BenchmarkList catalog returned ${response.status}`);
    }

    const body = await response.text();
    const fetchedAt = new Date().toISOString();
    const archived = await archiveSourceDocument(env, {
      sourceUrl: CATALOG_URL,
      body,
      contentType: "application/json; charset=utf-8",
      extension: "json",
      response,
      recordCount: 0,
    });
    const raw = JSON.parse(body) as unknown;
    const snapshot = normalizeCatalog(raw, fetchedAt);
    await updateSourceDocumentRecordCount(
      env,
      archived.id,
      snapshot.benchmarks.length,
    );
    return writeCatalogSnapshot(env, snapshot, archived.contentHash);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Unknown catalog refresh error";
    try {
      await env.DB.prepare(
        `UPDATE refresh_state SET last_error = ? WHERE name = 'benchmarklist'`,
      ).bind(message.slice(0, 2000)).run();
    } catch {
      // Preserve the original source error if status persistence also fails.
    }
    throw error;
  }
}

export async function getCachedCatalog(env: ScrapeEnv) {
  const state = await catalogState(env);
  if (!state?.catalog_r2_key) return null;
  return readJsonObject<CatalogSnapshot>(env.BUCKET, state.catalog_r2_key);
}

export async function getCatalog(env: ScrapeEnv) {
  const state = await catalogState(env);
  const cached = state?.catalog_r2_key
    ? await readJsonObject<CatalogSnapshot>(env.BUCKET, state.catalog_r2_key)
    : null;
  const stale =
    !state?.last_success_at ||
    Date.now() - state.last_success_at > CATALOG_TTL_MS ||
    cached?.parserVersion !== PARSER_VERSION;
  if (!cached || stale) {
    try {
      return (await refreshCatalog(env)) ?? cached;
    } catch (error) {
      if (cached) return cached;
      throw error;
    }
  }
  return cached;
}

function jsonLdScripts(html: string) {
  const scripts: unknown[] = [];
  const pattern = /<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      scripts.push(JSON.parse(match[1]));
    } catch {
      // A malformed optional JSON-LD block should not discard the source snapshot.
    }
  }
  return scripts;
}

function propertyValues(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => item as Record<string, unknown>);
}

function decodeHtml(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    quot: '"',
    lt: "<",
    gt: ">",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
  };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, body: string) => {
    if (body[0] === "#") {
      const hexadecimal = body[1]?.toLowerCase() === "x";
      const point = Number.parseInt(body.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
    }
    return named[body.toLowerCase()] ?? entity;
  });
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function attribute(tag: string, name: string) {
  const pattern = new RegExp(`${name}=["']([^"']*)["']`, "i");
  return decodeHtml(tag.match(pattern)?.[1] ?? "");
}

function parseNumberOrText(value: string) {
  if (!value.trim()) return null;
  const number = Number(value.replace(/,/g, ""));
  return Number.isFinite(number) ? number : value;
}

function parseSnapshotTables(html: string): BenchmarkSnapshot[] {
  const snapshots: BenchmarkSnapshot[] = [];
  const sectionPattern = /<section\b([^>]*data-snapshot-panel=["'][^"']+["'][^>]*)>([\s\S]*?)<\/section>/gi;
  for (const sectionMatch of html.matchAll(sectionPattern)) {
    const sectionTag = sectionMatch[1];
    const sectionBody = sectionMatch[2];
    const snapshotId = attribute(sectionTag, "data-snapshot-panel") || "current";
    const table = sectionBody.match(/<table\b[^>]*results-table[^>]*>([\s\S]*?)<\/table>/i)?.[1];
    if (!table) continue;
    const head = table.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] ?? "";
    const headerMatches = [...head.matchAll(/<th\b([^>]*)>([\s\S]*?)<\/th>/gi)];
    const headers = headerMatches.map((match) => {
      const title = attribute(match[1], "title").toLowerCase();
      return {
        label: stripHtml(match[2]),
        direction: title.includes("higher is better")
          ? ("higher" as const)
          : title.includes("lower is better")
            ? ("lower" as const)
            : ("unknown" as const),
        className: attribute(match[1], "class"),
      };
    });
    const body = table.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] ?? "";
    const results: BenchmarkResult[] = [];
    for (const rowMatch of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cellMatches = [...rowMatch[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)];
      if (!cellMatches.length) continue;
      const cells = cellMatches.map((match) => ({
        tag: match[1],
        body: match[2],
        className: attribute(match[1], "class"),
        sortValue: attribute(match[1], "data-sort-value"),
        text: stripHtml(match[2]),
      }));
      const subjectIndex = cells.findIndex((cell) => cell.className.includes("subject-cell"));
      const rankIndex = cells.findIndex((cell) => cell.className.includes("rank-cell"));
      const sourceIndex = cells.findIndex((cell) => cell.className.includes("source-cell"));
      const sampledIndex = cells.findIndex((cell) => cell.className.includes("sampled-cell"));
      const name = cells[subjectIndex]?.sortValue || cells[subjectIndex]?.text;
      if (!name) continue;
      const metrics = headers.flatMap((header, index) => {
        const cell = cells[index];
        if (!cell || !header.className.includes("metric-heading")) return [];
        return [{
          name: header.label,
          value: parseNumberOrText(cell.sortValue),
          displayValue: cell.text || undefined,
          direction: header.direction,
        }];
      });
      const sourceCell = cells[sourceIndex];
      const sourceHref = sourceCell?.body.match(/<a\b[^>]*href=["']([^"']+)["']/i)?.[1];
      const rankValue = cells[rankIndex]?.sortValue?.trim();
      results.push({
        rank: rankValue && Number.isFinite(Number(rankValue))
          ? Number(rankValue)
          : null,
        name,
        metrics,
        sourceUrl: sourceHref ? normalizeHttpUrl(sourceHref) : null,
        sampledAt: cells[sampledIndex]?.sortValue || null,
        snapshotId,
      });
    }
    if (results.length) snapshots.push({ id: snapshotId, results });
  }
  return snapshots;
}

export function parseBenchmarkListDetail(
  benchmarkId: string,
  sourceUrl: string,
  html: string,
  sourceHash: string,
  fetchedAt: string,
): BenchmarkDetail {
  const scripts = jsonLdScripts(html) as Array<Record<string, unknown>>;
  const dataset = scripts.find((item) => item["@type"] === "Dataset");
  if (!dataset) throw new Error("BenchmarkList detail page has no Dataset JSON-LD");
  const itemList = scripts.find((item) => item["@type"] === "ItemList");
  const additional = propertyValues(dataset.additionalProperty);
  const primaryMetric = additional.find((item) => item.name === "Primary metric")?.value;
  const category = additional.find((item) => item.name === "Benchmark category")?.value;
  const variables = propertyValues(dataset.variableMeasured)
    .map((item) => String(item.name ?? "").trim())
    .filter(Boolean);
  const distributions = propertyValues(dataset.distribution)
    .map((item) => ({
      name: String(item.name ?? "Source").trim(),
      url: normalizeHttpUrl(String(item.contentUrl ?? "").trim()),
    }))
    .filter((item): item is { name: string; url: string } => Boolean(item.url));
  const sameAs = Array.isArray(dataset.sameAs)
    ? dataset.sameAs.map(String)
    : dataset.sameAs
      ? [String(dataset.sameAs)]
      : [];
  const jsonLdResults = propertyValues(itemList?.itemListElement).map((row) => {
    const item = row.item && typeof row.item === "object"
      ? (row.item as Record<string, unknown>)
      : row;
    const metrics = propertyValues(item.additionalProperty).map((metric) => ({
      name: String(metric.name ?? "Metric"),
      value:
        typeof metric.value === "number" || typeof metric.value === "string"
          ? metric.value
          : null,
    }));
    return {
      rank: Number.isFinite(Number(row.position)) ? Number(row.position) : null,
      name: String(row.name ?? item.name ?? "Unknown configuration"),
      metrics,
    } satisfies BenchmarkResult;
  });
  const snapshots = parseSnapshotTables(html);
  const currentSnapshot = snapshots.find((snapshot) => snapshot.id === "current") ?? snapshots[0];
  const results: BenchmarkResult[] = currentSnapshot?.results.length
    ? currentSnapshot.results
    : jsonLdResults;
  const metricName = String(primaryMetric ?? variables[0] ?? "");
  const escapedMetric = metricName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const higherPattern = new RegExp(
    `title=["']Higher is better["'][^>]*>[\\s\\S]{0,160}?${escapedMetric}`,
    "i",
  );
  const lowerPattern = new RegExp(
    `title=["']Lower is better["'][^>]*>[\\s\\S]{0,160}?${escapedMetric}`,
    "i",
  );
  const tableMetricDirection = results
    .flatMap((result) => result.metrics)
    .find((metric) => metric.name === metricName)?.direction;
  const metricDirection = tableMetricDirection && tableMetricDirection !== "unknown"
    ? tableMetricDirection
    : higherPattern.test(html)
    ? "higher"
    : lowerPattern.test(html)
      ? "lower"
      : "unknown";

  return {
    id: String(dataset.identifier ?? benchmarkId),
    title: String(dataset.name ?? benchmarkId).replace(/ benchmark$/i, ""),
    description: String(dataset.description ?? ""),
    category: category ? normalizeCategory(category) : null,
    datePublished: dataset.datePublished ? String(dataset.datePublished) : null,
    dateModified: dataset.dateModified ? String(dataset.dateModified) : null,
    primaryMetric: primaryMetric ? String(primaryMetric) : variables[0] ?? null,
    metricDirection,
    variables,
    relatedUrls: sameAs
      .map((url) => normalizeHttpUrl(url))
      .filter((url): url is string => Boolean(url)),
    distributions,
    results,
    snapshots,
    sourceUrl,
    fetchedAt,
    sourceHash,
    parserVersion: PARSER_VERSION,
  };
}

async function cachedDetail(env: ScrapeEnv, benchmarkId: string) {
  const row = await env.DB.prepare(
    `SELECT parsed_r2_key, fetched_at, last_checked_at
     FROM benchmark_details WHERE benchmark_id = ?`,
  )
    .bind(benchmarkId)
    .first<{
      parsed_r2_key: string;
      fetched_at: number;
      last_checked_at: number;
    }>();
  if (!row) return null;
  const detail = await readJsonObject<BenchmarkDetail>(env.BUCKET, row.parsed_r2_key);
  const lastCheckedAt = row.last_checked_at || row.fetched_at;
  return detail
    ? {
        detail: {
          ...detail,
          checkedAt: new Date(lastCheckedAt).toISOString(),
        },
        fetchedAt: row.fetched_at,
        lastCheckedAt,
      }
    : null;
}

function fetchAttemptId() {
  return `fetch-${Date.now()}-${crypto.randomUUID().slice(0, 12)}`;
}

function successfulRefreshStatusStatement(
  env: ScrapeEnv,
  benchmarkId: string,
  checkedAt: number,
) {
  return env.DB.prepare(
    `INSERT INTO benchmark_refresh_status
      (benchmark_id, last_attempt_at, last_success_at, next_attempt_at,
       failure_count, last_error)
     VALUES (?, ?, ?, 0, 0, NULL)
     ON CONFLICT(benchmark_id) DO UPDATE SET
       last_attempt_at = excluded.last_attempt_at,
       last_success_at = excluded.last_success_at,
       next_attempt_at = 0,
       failure_count = 0,
       last_error = NULL`,
  ).bind(benchmarkId, checkedAt, checkedAt);
}

function failedRefreshStatusStatement(
  env: ScrapeEnv,
  benchmarkId: string,
  checkedAt: number,
  message: string,
) {
  return env.DB.prepare(
    `INSERT INTO benchmark_refresh_status
      (benchmark_id, last_attempt_at, last_success_at, next_attempt_at,
       failure_count, last_error)
     VALUES (?, ?, NULL, ?, 1, ?)
     ON CONFLICT(benchmark_id) DO UPDATE SET
       last_attempt_at = excluded.last_attempt_at,
       next_attempt_at = CASE
         WHEN benchmark_refresh_status.failure_count >= 6
           THEN excluded.last_attempt_at + 21600000
         ELSE excluded.last_attempt_at +
           (300000 << benchmark_refresh_status.failure_count)
       END,
       failure_count = benchmark_refresh_status.failure_count + 1,
       last_error = excluded.last_error`,
  ).bind(
    benchmarkId,
    checkedAt,
    checkedAt + 300_000,
    message.slice(0, 1000),
  );
}

function completedFetchAttemptStatement(
  env: ScrapeEnv,
  input: {
    id: string;
    completedAt: number;
    httpStatus: number | null;
    outcome: "changed" | "not-modified" | "failed";
    startedAt: number;
    contentHash: string | null;
    error: string | null;
  },
) {
  return env.DB.prepare(
    `UPDATE benchmark_fetch_attempts
     SET completed_at = ?, http_status = ?, outcome = ?, duration_ms = ?,
         content_hash = ?, error = ?
     WHERE id = ?`,
  ).bind(
    input.completedAt,
    input.httpStatus,
    input.outcome,
    Math.max(0, input.completedAt - input.startedAt),
    input.contentHash,
    input.error?.slice(0, 1000) ?? null,
    input.id,
  );
}

export async function refreshBenchmarkDetail(
  env: ScrapeEnv,
  benchmarkId: string,
  pathOrUrl = `/benchmarks/${benchmarkId}/`,
  options: DetailRefreshOptions = {},
) {
  const sourceUrl = absoluteSourceUrl(pathOrUrl);
  const startedAt = Date.now();
  const attemptId = fetchAttemptId();
  const trigger = options.trigger ?? "on-demand";
  let httpStatus: number | null = null;
  const claim = await env.DB.prepare(
    `INSERT INTO benchmark_fetch_attempts
      (id, run_id, trigger, benchmark_id, source_url, started_at, outcome)
     SELECT ?, ?, ?, ?, ?, ?, 'running'
     WHERE NOT EXISTS (
       SELECT 1 FROM benchmark_fetch_attempts
       WHERE benchmark_id = ? AND outcome = 'running' AND started_at > ?
     )
     AND NOT EXISTS (
       SELECT 1 FROM benchmark_refresh_status
       WHERE benchmark_id = ? AND next_attempt_at > ?
     )`,
  ).bind(
    attemptId,
    options.runId ?? null,
    trigger,
    benchmarkId,
    sourceUrl,
    startedAt,
    benchmarkId,
    startedAt - DETAIL_SINGLE_FLIGHT_MS,
    benchmarkId,
    startedAt,
  ).run();
  if (Number(claim.meta.changes ?? 0) === 0) {
    throw new RefreshDeferredError();
  }

  try {
    // Only ask for a 304 when the parsed object it refers to is still readable.
    const cached = await cachedDetail(env, benchmarkId);
    const parserCurrent = cached?.detail.parserVersion === PARSER_VERSION;
    const previous = parserCurrent
      ? await latestSourceDocument(env, sourceUrl)
      : null;
    const response = await fetchSource(
      sourceUrl,
      previous,
      true,
      options.timeoutMs ?? FETCH_TIMEOUT_MS,
    );
    httpStatus = response.status;
    if (response.status === 304) {
      const checkedAt = Date.now();
      await env.DB.batch([
        env.DB.prepare(
          `UPDATE benchmark_details SET last_checked_at = ?
           WHERE benchmark_id = ?`,
        ).bind(checkedAt, benchmarkId),
        completedFetchAttemptStatement(env, {
          id: attemptId,
          completedAt: checkedAt,
          httpStatus,
          outcome: "not-modified",
          startedAt,
          contentHash: cached!.detail.sourceHash,
          error: null,
        }),
        successfulRefreshStatusStatement(env, benchmarkId, checkedAt),
      ]);
      return {
        ...cached!.detail,
        checkedAt: new Date(checkedAt).toISOString(),
      };
    }
    if (!response.ok) {
      throw new Error(`BenchmarkList detail returned ${response.status}`);
    }
    const html = await response.text();
    const fetchedAt = new Date().toISOString();
    // Archive first so parser drift does not discard the exact response needed
    // to repair and replay the parser.
    const archived = await archiveSourceDocument(env, {
      sourceUrl,
      body: html,
      contentType: "text/html; charset=utf-8",
      extension: "html",
      response,
      recordCount: 0,
    });
    if (parserCurrent && cached?.detail.sourceHash === archived.contentHash) {
      const checkedAt = Date.now();
      await env.DB.batch([
        env.DB.prepare(
          `UPDATE benchmark_details SET last_checked_at = ?
           WHERE benchmark_id = ?`,
        ).bind(checkedAt, benchmarkId),
        completedFetchAttemptStatement(env, {
          id: attemptId,
          completedAt: checkedAt,
          httpStatus,
          outcome: "not-modified",
          startedAt,
          contentHash: archived.contentHash,
          error: null,
        }),
        successfulRefreshStatusStatement(env, benchmarkId, checkedAt),
      ]);
      return {
        ...cached.detail,
        checkedAt: new Date(checkedAt).toISOString(),
      };
    }
    const detail = {
      ...parseBenchmarkListDetail(
        benchmarkId,
        sourceUrl,
        html,
        archived.contentHash,
        fetchedAt,
      ),
      checkedAt: fetchedAt,
    };
    await updateSourceDocumentRecordCount(env, archived.id, detail.results.length);
    const parsedBody = JSON.stringify(detail);
    const parsedKey = `benchmarklist/normalized/details/${benchmarkId}-${PARSER_KEY}-${archived.contentHash}.json`;
    if (!(await env.BUCKET.head(parsedKey))) {
      await env.BUCKET.put(parsedKey, parsedBody, {
        httpMetadata: { contentType: "application/json; charset=utf-8" },
        customMetadata: {
          sourceUrl,
          fetchedAt,
          parserVersion: PARSER_VERSION,
        },
      });
    }
    const checkedAt = Date.now();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO benchmark_details
          (benchmark_id, title, category, description, date_published,
           date_modified, source_url, parsed_r2_key, source_hash, fetched_at,
           last_checked_at, result_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(benchmark_id) DO UPDATE SET
           title = excluded.title,
           category = excluded.category,
           description = excluded.description,
           date_published = excluded.date_published,
           date_modified = excluded.date_modified,
           source_url = excluded.source_url,
           parsed_r2_key = excluded.parsed_r2_key,
           fetched_at = CASE
             WHEN benchmark_details.source_hash = excluded.source_hash
               THEN benchmark_details.fetched_at
             ELSE excluded.fetched_at
           END,
           source_hash = excluded.source_hash,
           last_checked_at = excluded.last_checked_at,
           result_count = excluded.result_count`,
      ).bind(
        benchmarkId,
        detail.title,
        detail.category,
        detail.description,
        detail.datePublished,
        detail.dateModified,
        detail.sourceUrl,
        parsedKey,
        detail.sourceHash,
        checkedAt,
        checkedAt,
        detail.results.length,
      ),
      completedFetchAttemptStatement(env, {
        id: attemptId,
        completedAt: checkedAt,
        httpStatus,
        outcome: "changed",
        startedAt,
        contentHash: archived.contentHash,
        error: null,
      }),
      successfulRefreshStatusStatement(env, benchmarkId, checkedAt),
    ]);
    return detail;
  } catch (error) {
    const completedAt = Date.now();
    const message = error instanceof Error ? error.message : "Unknown detail refresh error";
    await env.DB.batch([
      completedFetchAttemptStatement(env, {
        id: attemptId,
        completedAt,
        httpStatus,
        outcome: "failed",
        startedAt,
        contentHash: null,
        error: message,
      }),
      failedRefreshStatusStatement(env, benchmarkId, completedAt, message),
    ]);
    throw error;
  }
}

export async function getBenchmarkDetail(
  env: ScrapeEnv,
  benchmarkId: string,
  sourceUrl?: string,
) {
  if (!BENCHMARK_ID_PATTERN.test(benchmarkId)) {
    throw new Error("Invalid benchmark identifier");
  }
  const cached = await cachedDetail(env, benchmarkId);
  const stale =
    !cached ||
    cached.detail.parserVersion !== PARSER_VERSION ||
    Date.now() - cached.lastCheckedAt > DETAIL_TTL_MS;
  if (!stale) return cached.detail;
  try {
    return await refreshBenchmarkDetail(env, benchmarkId, sourceUrl, {
      timeoutMs: ON_DEMAND_FETCH_TIMEOUT_MS,
      trigger: "on-demand",
    });
  } catch (error) {
    if (cached) return cached.detail;
    throw error;
  }
}

function runId(prefix: string) {
  return `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

async function selectRefreshBatch(
  env: ScrapeEnv,
  catalog: CatalogSnapshot,
  batchSize: number,
) {
  const result = await env.DB.prepare(
    `SELECT benchmark_id, last_attempt_at, last_success_at, next_attempt_at,
            failure_count, last_error
     FROM benchmark_refresh_status`,
  ).all<BenchmarkRefreshStatusRow>();
  const selected = new Set(
    selectDueBenchmarkIds(
      catalog.benchmarks,
      result.results ?? [],
      Date.now(),
      batchSize,
    ),
  );
  const benchmarks = new Map(
    catalog.benchmarks.map((benchmark) => [benchmark.id, benchmark]),
  );
  return [...selected]
    .map((benchmarkId) => benchmarks.get(benchmarkId))
    .filter((benchmark): benchmark is CatalogBenchmark => Boolean(benchmark));
}

export async function refreshDetailBatch(
  env: ScrapeEnv,
  trigger: Exclude<RefreshTrigger, "on-demand"> = "scheduled",
) {
  const id = runId("benchmarklist");
  const startedAt = Date.now();
  let leaseAcquired = false;
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE benchmark_fetch_attempts
       SET completed_at = ?, outcome = 'failed',
           duration_ms = ? - started_at,
           error = 'Background invocation ended before completion.'
       WHERE outcome = 'running' AND started_at < ?`,
    ).bind(startedAt, startedAt, startedAt - REQUEST_STALE_RUN_MS),
    env.DB.prepare(
      `INSERT INTO scrape_runs
        (id, trigger, status, started_at, discovered_count, processed_count)
       VALUES (?, ?, 'running', ?, 0, 0)`,
    ).bind(id, trigger, startedAt),
  ]);

  try {
    const boundedRequest = trigger !== "manual";
    const deadline = boundedRequest
      ? startedAt + REQUEST_RUN_BUDGET_MS
      : Number.POSITIVE_INFINITY;
    const catalog = boundedRequest
      ? (await getCachedCatalog(env)) ??
        (await refreshCatalog(env, REQUEST_FETCH_TIMEOUT_MS))
      : await getCatalog(env);
    if (!catalog) throw new Error("BenchmarkList catalog is unavailable");

    const lease = await env.DB.prepare(
      `UPDATE refresh_state
       SET lease_until = ?, lease_owner = ?
       WHERE name = 'benchmarklist'
         AND (lease_until IS NULL OR lease_until < ?)`,
    )
      .bind(
        Date.now() + (boundedRequest ? REQUEST_REFRESH_LEASE_MS : REFRESH_LEASE_MS),
        id,
        Date.now(),
      )
      .run();
    leaseAcquired = Number(lease.meta.changes ?? 0) > 0;
    if (!leaseAcquired) {
      await env.DB.prepare(
        `UPDATE scrape_runs
         SET status = 'skipped', completed_at = ?, discovered_count = ?,
             error = 'Another refresh owns the active lease.'
         WHERE id = ?`,
      )
        .bind(Date.now(), catalog.benchmarks.length, id)
        .run();
      return {
        id,
        processed: 0,
        total: catalog.benchmarks.length,
        nextCursor: null,
        errors: [],
        skipped: true,
      };
    }

    const state = await catalogState(env);
    const cursor = state?.cursor ?? 0;
    const batchSize = trigger === "request"
      ? REQUEST_CRAWL_BATCH_SIZE
      : CRAWL_BATCH_SIZE;
    const batch = await selectRefreshBatch(env, catalog, batchSize);
    let processed = 0;
    let attempted = 0;
    let budgetLimited = false;
    const errors: string[] = [];
    for (const [index, benchmark] of batch.entries()) {
      if (
        boundedRequest &&
        Date.now() + REQUEST_FETCH_TIMEOUT_MS + 1_000 > deadline
      ) {
        budgetLimited = true;
        break;
      }
      attempted += 1;
      try {
        await refreshBenchmarkDetail(
          env,
          benchmark.id,
          benchmark.url,
          {
            timeoutMs: boundedRequest ? REQUEST_FETCH_TIMEOUT_MS : FETCH_TIMEOUT_MS,
            runId: id,
            trigger,
          },
        );
        processed += 1;
      } catch (error) {
        errors.push(`${benchmark.id}: ${error instanceof Error ? error.message : "unknown error"}`);
      }
      if (index < batch.length - 1) {
        if (
          boundedRequest &&
          Date.now() + CRAWL_DELAY_MS + REQUEST_FETCH_TIMEOUT_MS + 1_000 > deadline
        ) {
          budgetLimited = true;
          break;
        }
        await delay(CRAWL_DELAY_MS);
      }
    }
    const runMessages = budgetLimited
      ? [...errors, `Request admission budget reached after ${attempted} of ${batch.length} pages.`]
      : errors;
    const nextCursor = catalog.benchmarks.length
      ? (cursor + attempted) % catalog.benchmarks.length
      : 0;
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE refresh_state
         SET cursor = ?, total = ?, lease_until = NULL, lease_owner = NULL,
             last_error = ?
         WHERE name = 'benchmarklist' AND lease_owner = ?`,
      ).bind(
        nextCursor,
        catalog.benchmarks.length,
        runMessages.join("; ").slice(0, 2000) || null,
        id,
      ),
      env.DB.prepare(
        `UPDATE scrape_runs
         SET status = ?, completed_at = ?, discovered_count = ?,
             processed_count = ?, error = ?
         WHERE id = ? AND status = 'running'`,
      ).bind(
        runMessages.length ? "partial" : "succeeded",
        Date.now(),
        catalog.benchmarks.length,
        processed,
        runMessages.join("; ").slice(0, 2000) || null,
        id,
      ),
      env.DB.prepare(
        `DELETE FROM benchmark_fetch_attempts
         WHERE completed_at IS NOT NULL AND completed_at < ?`,
      ).bind(Date.now() - FETCH_ATTEMPT_RETENTION_MS),
    ]);
    return {
      id,
      processed,
      total: catalog.benchmarks.length,
      nextCursor,
      errors,
      budgetLimited,
      skipped: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown refresh error";
    const statements = [
      env.DB.prepare(
        `UPDATE scrape_runs
         SET status = 'failed', completed_at = ?, error = ?
         WHERE id = ? AND status = 'running'`,
      ).bind(Date.now(), message.slice(0, 2000), id),
    ];
    if (leaseAcquired) {
      statements.push(
        env.DB.prepare(
          `UPDATE refresh_state
           SET lease_until = NULL, lease_owner = NULL, last_error = ?
           WHERE name = 'benchmarklist' AND lease_owner = ?`,
        ).bind(message.slice(0, 2000), id),
      );
    }
    await env.DB.batch(statements);
    throw error;
  }
}

export async function refreshDetailBatchIfDue(
  env: ScrapeEnv,
  trigger: "request" | "external-clock" | "scheduled" = "request",
) {
  const recent = await env.DB.prepare(
    `SELECT id, trigger, status, started_at
     FROM scrape_runs
     WHERE status != 'skipped'
     ORDER BY started_at DESC
     LIMIT 1`,
  ).first<{
    id: string;
    trigger: string;
    status: string;
    started_at: number;
  }>();
  const elapsed = recent?.started_at ? Date.now() - recent.started_at : Infinity;
  if (
    (recent?.trigger === "request" ||
      recent?.trigger === "external-clock" ||
      recent?.trigger === "scheduled") &&
    recent.status === "running" &&
    elapsed > REQUEST_STALE_RUN_MS
  ) {
    const [staleRun] = await env.DB.batch([
      env.DB.prepare(
        `UPDATE scrape_runs
         SET status = 'failed', completed_at = ?,
             error = 'Background invocation ended before completion.'
         WHERE id = ? AND status = 'running'`,
      ).bind(Date.now(), recent.id),
      env.DB.prepare(
        `UPDATE refresh_state
         SET lease_until = NULL, lease_owner = NULL,
             last_error = 'Background invocation ended before completion.'
         WHERE name = 'benchmarklist' AND lease_owner = ?`,
      ).bind(recent.id),
      env.DB.prepare(
        `UPDATE benchmark_fetch_attempts
         SET completed_at = ?, outcome = 'failed',
             duration_ms = ? - started_at,
             error = 'Background invocation ended before completion.'
         WHERE run_id = ? AND outcome = 'running'`,
      ).bind(Date.now(), Date.now(), recent.id),
    ]);
    if (Number(staleRun.meta.changes ?? 0) > 0) {
      return refreshDetailBatch(env, trigger);
    }
    return {
      skipped: true,
      reason: "stale-run-recovery-raced",
      retryAfterMs: REQUEST_CRAWL_COOLDOWN_MS,
    };
  }
  if (elapsed < REQUEST_CRAWL_COOLDOWN_MS) {
    return {
      skipped: true,
      reason: "cooldown",
      retryAfterMs: REQUEST_CRAWL_COOLDOWN_MS - elapsed,
    };
  }
  return refreshDetailBatch(env, trigger);
}

export async function refreshClockBatchIfDue(
  env: ScrapeEnv,
  trigger: "scheduled" | "external-clock" = "external-clock",
) {
  const state = await catalogState(env);
  const cached = state?.catalog_r2_key
    ? await readJsonObject<CatalogSnapshot>(env.BUCKET, state.catalog_r2_key)
    : null;
  const catalogStale =
    !state?.last_success_at ||
    Date.now() - state.last_success_at > CATALOG_TTL_MS ||
    cached?.parserVersion !== PARSER_VERSION;

  if (!cached || catalogStale) {
    try {
      await refreshCatalog(env, REQUEST_FETCH_TIMEOUT_MS);
    } catch (error) {
      if (!cached) throw error;
    }
  }

  return refreshDetailBatchIfDue(env, trigger);
}

export const benchmarkListConfig = {
  origin: BENCHMARKLIST_ORIGIN,
  catalogUrl: CATALOG_URL,
  parserVersion: PARSER_VERSION,
  catalogTtlMs: CATALOG_TTL_MS,
  detailTtlMs: DETAIL_TTL_MS,
  crawlBatchSize: CRAWL_BATCH_SIZE,
  requestCrawlBatchSize: REQUEST_CRAWL_BATCH_SIZE,
  crawlDelayMs: CRAWL_DELAY_MS,
  requestCrawlCooldownMs: REQUEST_CRAWL_COOLDOWN_MS,
  requestStaleRunMs: REQUEST_STALE_RUN_MS,
  requestRunBudgetMs: REQUEST_RUN_BUDGET_MS,
  requestFetchTimeoutMs: REQUEST_FETCH_TIMEOUT_MS,
  onDemandFetchTimeoutMs: ON_DEMAND_FETCH_TIMEOUT_MS,
  detailSingleFlightMs: DETAIL_SINGLE_FLIGHT_MS,
  fetchAttemptRetentionMs: FETCH_ATTEMPT_RETENTION_MS,
  refreshLeaseMs: REFRESH_LEASE_MS,
  requestRefreshLeaseMs: REQUEST_REFRESH_LEASE_MS,
};
