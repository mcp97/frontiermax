import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export const publicApiCache = sqliteTable("public_api_cache", {
  cacheKey: text("cache_key").primaryKey(),
  sourceUrl: text("source_url").notNull(),
  body: text("body").notNull(),
  fetchedAt: integer("fetched_at").notNull(),
  status: text("status").notNull().default("ready"),
  lastError: text("last_error"),
});

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: integer("created_at").notNull(),
});

export const organizationMembers = sqliteTable(
  "organization_members",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    email: text("email").notNull(),
    role: text("role").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.email] }),
    index("organization_members_email_idx").on(table.email),
  ],
);

export const workloadProfiles = sqliteTable(
  "workload_profiles",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    stableKey: text("stable_key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    objective: text("objective").notNull(),
    configJson: text("config_json").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("workload_profiles_org_key_idx").on(
      table.organizationId,
      table.stableKey,
    ),
  ],
);

export const routeDecisions = sqliteTable(
  "route_decisions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id),
    policyVersion: text("policy_version").notNull(),
    evidenceVersion: text("evidence_version").notNull(),
    engineVersion: text("engine_version").notNull(),
    requestFeaturesJson: text("request_features_json").notNull(),
    candidateSetJson: text("candidate_set_json").notNull(),
    selectedCandidate: text("selected_candidate"),
    manifestHash: text("manifest_hash").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [
    index("route_decisions_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
  ],
);

export const leadRequests = sqliteTable(
  "lead_requests",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    company: text("company").notNull(),
    role: text("role").notNull(),
    spendRange: text("spend_range"),
    providerSummary: text("provider_summary"),
    workloadCount: text("workload_count"),
    privateEvals: text("private_evals"),
    primaryConcern: text("primary_concern"),
    description: text("description"),
    createdAt: integer("created_at").notNull(),
    status: text("status").notNull().default("new"),
  },
  (table) => [
    index("lead_requests_created_idx").on(table.createdAt),
    index("lead_requests_email_idx").on(table.email),
  ],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("audit_events_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
  ],
);

export const evalSets = sqliteTable(
  "eval_sets",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    workloadKey: text("workload_key").notNull(),
    name: text("name").notNull(),
    version: integer("version").notNull(),
    designation: text("designation").notNull(),
    outcomeDefinition: text("outcome_definition").notNull(),
    graderVersion: text("grader_version").notNull(),
    scaffoldVersion: text("scaffold_version").notNull(),
    evaluatedAt: text("evaluated_at").notNull(),
    notes: text("notes"),
    status: text("status").notNull(),
    sourceHash: text("source_hash").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("eval_sets_org_name_version_idx").on(
      table.organizationId,
      table.name,
      table.version,
    ),
    index("eval_sets_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
  ],
);

export const evalResults = sqliteTable(
  "eval_results",
  {
    id: text("id").primaryKey(),
    evalSetId: text("eval_set_id")
      .notNull()
      .references(() => evalSets.id),
    candidateType: text("candidate_type").notNull(),
    candidateId: text("candidate_id").notNull(),
    caseCount: integer("case_count").notNull(),
    successes: integer("successes").notNull(),
    failures: integer("failures").notNull(),
    meanRubricScore: real("mean_rubric_score"),
    averageCost: real("average_cost"),
    p50LatencyMs: real("p50_latency_ms"),
    p95LatencyMs: real("p95_latency_ms"),
    inputTokenAverage: real("input_token_average"),
    outputTokenAverage: real("output_token_average"),
    evaluatorVersion: text("evaluator_version").notNull(),
    scaffoldVersion: text("scaffold_version").notNull(),
    evaluatedAt: text("evaluated_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("eval_results_set_candidate_idx").on(
      table.evalSetId,
      table.candidateType,
      table.candidateId,
    ),
    index("eval_results_set_idx").on(table.evalSetId),
  ],
);

export const policies = sqliteTable(
  "policies",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    stableSlug: text("stable_slug").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("policies_org_slug_idx").on(
      table.organizationId,
      table.stableSlug,
    ),
  ],
);

export const policyVersions = sqliteTable(
  "policy_versions",
  {
    id: text("id").primaryKey(),
    policyId: text("policy_id")
      .notNull()
      .references(() => policies.id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    version: integer("version").notNull(),
    workloadKey: text("workload_key").notNull(),
    evalSetId: text("eval_set_id")
      .notNull()
      .references(() => evalSets.id),
    objective: text("objective").notNull(),
    qualityFloor: real("quality_floor").notNull(),
    confidence: real("confidence").notNull(),
    minimumCases: integer("minimum_cases").notNull(),
    maximumCost: real("maximum_cost"),
    maximumP95LatencyMs: real("maximum_p95_latency_ms"),
    allowPublicOnly: integer("allow_public_only", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status").notNull(),
    artifactJson: text("artifact_json").notNull(),
    evidenceVersion: text("evidence_version").notNull(),
    manifestHash: text("manifest_hash").notNull(),
    createdAt: integer("created_at").notNull(),
    publishedAt: integer("published_at").notNull(),
  },
  (table) => [
    uniqueIndex("policy_versions_policy_version_idx").on(
      table.policyId,
      table.version,
    ),
    index("policy_versions_org_published_idx").on(
      table.organizationId,
      table.publishedAt,
    ),
  ],
);

export const certifications = sqliteTable(
  "certifications",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    policyVersionId: text("policy_version_id")
      .notNull()
      .references(() => policyVersions.id),
    workloadKey: text("workload_key").notNull(),
    candidateType: text("candidate_type").notNull(),
    candidateId: text("candidate_id").notNull(),
    evalSetId: text("eval_set_id")
      .notNull()
      .references(() => evalSets.id),
    posteriorMean: real("posterior_mean").notNull(),
    qualityLowerBound: real("quality_lower_bound").notNull(),
    caseCount: integer("case_count").notNull(),
    averageCost: real("average_cost"),
    p95LatencyMs: real("p95_latency_ms"),
    status: text("status").notNull(),
    manifestHash: text("manifest_hash").notNull(),
    limitations: text("limitations").notNull(),
    validFrom: integer("valid_from").notNull(),
    validUntil: integer("valid_until").notNull(),
    createdAt: integer("created_at").notNull(),
    revokedAt: integer("revoked_at"),
    revocationReason: text("revocation_reason"),
  },
  (table) => [
    index("certifications_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
  ],
);

export const executionOutcomes = sqliteTable(
  "execution_outcomes",
  {
    id: text("id").primaryKey(),
    routeId: text("route_id")
      .notNull()
      .references(() => routeDecisions.id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    actualModel: text("actual_model"),
    actualProvider: text("actual_provider"),
    generationId: text("generation_id"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    cachedTokens: integer("cached_tokens"),
    reasoningTokens: integer("reasoning_tokens"),
    actualCost: real("actual_cost"),
    timeToFirstTokenMs: real("time_to_first_token_ms"),
    totalLatencyMs: real("total_latency_ms"),
    operationalErrorType: text("operational_error_type"),
    applicationOutcome: text("application_outcome").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("execution_outcomes_route_idx").on(table.routeId),
    index("execution_outcomes_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
  ],
);

export const sessionAssignments = sqliteTable(
  "session_assignments",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    policyVersionId: text("policy_version_id")
      .notNull()
      .references(() => policyVersions.id),
    sessionHash: text("session_hash").notNull(),
    candidateId: text("candidate_id").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [
    uniqueIndex("session_assignments_policy_session_idx").on(
      table.policyVersionId,
      table.sessionHash,
    ),
  ],
);

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    salt: text("salt").notNull(),
    secretHash: text("secret_hash").notNull(),
    scopesJson: text("scopes_json").notNull(),
    createdAt: integer("created_at").notNull(),
    lastUsedAt: integer("last_used_at"),
    revokedAt: integer("revoked_at"),
  },
  (table) => [
    uniqueIndex("api_keys_prefix_idx").on(table.prefix),
    index("api_keys_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
  ],
);

export const apiKeyRateLimits = sqliteTable(
  "api_key_rate_limits",
  {
    apiKeyId: text("api_key_id")
      .notNull()
      .references(() => apiKeys.id),
    hourBucket: integer("hour_bucket").notNull(),
    requestCount: integer("request_count").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.apiKeyId, table.hourBucket] }),
  ],
);
