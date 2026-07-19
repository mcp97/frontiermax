import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const scrapeRuns = sqliteTable("scrape_runs", {
  id: text("id").primaryKey(),
  trigger: text("trigger").notNull(),
  status: text("status").notNull(),
  startedAt: integer("started_at").notNull(),
  completedAt: integer("completed_at"),
  discoveredCount: integer("discovered_count").notNull().default(0),
  processedCount: integer("processed_count").notNull().default(0),
  error: text("error"),
});

export const sourceDocuments = sqliteTable(
  "source_documents",
  {
    id: text("id").primaryKey(),
    sourceUrl: text("source_url").notNull(),
    contentHash: text("content_hash").notNull(),
    r2Key: text("r2_key").notNull(),
    contentType: text("content_type").notNull(),
    fetchedAt: integer("fetched_at").notNull(),
    etag: text("etag"),
    lastModified: text("last_modified"),
    httpStatus: integer("http_status").notNull(),
    parserVersion: text("parser_version").notNull(),
    recordCount: integer("record_count").notNull().default(0),
    previousHash: text("previous_hash"),
  },
  (table) => [
    uniqueIndex("source_documents_url_hash_idx").on(
      table.sourceUrl,
      table.contentHash,
    ),
  ],
);

export const refreshState = sqliteTable("refresh_state", {
  name: text("name").primaryKey(),
  cursor: integer("cursor").notNull().default(0),
  total: integer("total").notNull().default(0),
  lastSuccessAt: integer("last_success_at"),
  leaseUntil: integer("lease_until"),
  leaseOwner: text("lease_owner"),
  lastError: text("last_error"),
  catalogR2Key: text("catalog_r2_key"),
  catalogHash: text("catalog_hash"),
});

export const catalogBenchmarkMembership = sqliteTable(
  "catalog_benchmark_membership",
  {
    catalogHash: text("catalog_hash").notNull(),
    benchmarkId: text("benchmark_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.catalogHash, table.benchmarkId] }),
    index("catalog_benchmark_membership_id_idx").on(table.benchmarkId),
  ],
);

export const benchmarkDetails = sqliteTable("benchmark_details", {
  benchmarkId: text("benchmark_id").primaryKey(),
  title: text("title").notNull(),
  category: text("category"),
  description: text("description"),
  datePublished: text("date_published"),
  dateModified: text("date_modified"),
  sourceUrl: text("source_url").notNull(),
  parsedR2Key: text("parsed_r2_key").notNull(),
  sourceHash: text("source_hash").notNull(),
  fetchedAt: integer("fetched_at").notNull(),
  lastCheckedAt: integer("last_checked_at").notNull().default(0),
  resultCount: integer("result_count").notNull().default(0),
});

export const benchmarkRefreshStatus = sqliteTable(
  "benchmark_refresh_status",
  {
    benchmarkId: text("benchmark_id").primaryKey(),
    lastAttemptAt: integer("last_attempt_at").notNull().default(0),
    lastSuccessAt: integer("last_success_at"),
    nextAttemptAt: integer("next_attempt_at").notNull().default(0),
    failureCount: integer("failure_count").notNull().default(0),
    lastError: text("last_error"),
  },
  (table) => [
    index("benchmark_refresh_status_due_idx").on(
      table.nextAttemptAt,
      table.lastSuccessAt,
    ),
  ],
);

export const benchmarkFetchAttempts = sqliteTable(
  "benchmark_fetch_attempts",
  {
    id: text("id").primaryKey(),
    runId: text("run_id"),
    trigger: text("trigger").notNull(),
    benchmarkId: text("benchmark_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    startedAt: integer("started_at").notNull(),
    completedAt: integer("completed_at"),
    httpStatus: integer("http_status"),
    outcome: text("outcome").notNull(),
    durationMs: integer("duration_ms"),
    contentHash: text("content_hash"),
    error: text("error"),
  },
  (table) => [
    index("benchmark_fetch_attempts_benchmark_idx").on(
      table.benchmarkId,
      table.startedAt,
    ),
    index("benchmark_fetch_attempts_run_idx").on(table.runId),
  ],
);
