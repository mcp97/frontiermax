export const D1_MAX_BOUND_PARAMETERS = 100;
export const CATALOG_MEMBERSHIP_CHUNK_SIZE = 40;

/**
 * Pick refresh work independently of catalog order.
 *
 * Priority is:
 * 1. benchmarks that have never been attempted;
 * 2. attempted benchmarks without a successful snapshot whose retry is due;
 * 3. successful benchmarks, oldest success first.
 *
 * Multi-item batches reserve their first slot for the oldest due retry when
 * unseen work also exists. This keeps failures moving during a long backfill,
 * and putting the retry first prevents a runtime budget from stranding it.
 *
 * @param {Array<string | { id: string }>} catalog
 * @param {Array<{
 *   benchmark_id: string,
 *   last_attempt_at?: number | null,
 *   last_success_at?: number | null,
 *   next_attempt_at?: number | null,
 * }>} refreshRows
 * @param {number} now
 * @param {number} batchSize
 * @returns {string[]}
 */
export function selectDueBenchmarkIds(catalog, refreshRows, now, batchSize) {
  if (!Number.isFinite(batchSize) || batchSize <= 0) return [];
  const capacity = Math.floor(batchSize);

  const states = new Map(
    refreshRows.map((row) => [row.benchmark_id, row]),
  );
  const uniqueIds = new Set(
    catalog
      .map((benchmark) =>
        typeof benchmark === "string" ? benchmark : benchmark.id,
      )
      .filter(Boolean),
  );

  const ranked = [...uniqueIds]
    .map((id) => ({ id, state: states.get(id) }))
    .filter(({ state }) =>
      !state || (state.next_attempt_at ?? 0) <= now,
    )
    .sort(compareCandidates);
  const hasUnseen = ranked.some(({ state }) => priorityBucket(state) === 0);
  const oldestDueRetry = ranked.find(
    ({ state }) => priorityBucket(state) === 1,
  );

  if (capacity > 1 && hasUnseen && oldestDueRetry) {
    return [
      oldestDueRetry,
      ...ranked
        .filter((candidate) => candidate !== oldestDueRetry)
        .slice(0, capacity - 1),
    ].map(({ id }) => id);
  }

  return ranked
    .slice(0, capacity)
    .map(({ id }) => id);
}

/**
 * Count stored detail rows that still belong to the current catalog. Historical
 * rows remain useful provenance but must not inflate current backfill coverage.
 *
 * @param {Array<string | { id?: string }>} catalog
 * @param {Array<string | { benchmark_id?: string }>} indexedRows
 */
export function countCurrentCatalogCoverage(catalog, indexedRows) {
  const catalogIds = new Set(
    catalog
      .map((entry) => typeof entry === "string" ? entry : entry.id)
      .filter(Boolean),
  );
  const indexedIds = new Set(
    indexedRows
      .map((entry) => typeof entry === "string" ? entry : entry.benchmark_id)
      .filter((id) => id && catalogIds.has(id)),
  );

  return {
    indexed: indexedIds.size,
    total: catalogIds.size,
  };
}

/**
 * @param {{ id: string, state?: Record<string, number | string | null> }} left
 * @param {{ id: string, state?: Record<string, number | string | null> }} right
 */
function compareCandidates(left, right) {
  const bucketDifference = priorityBucket(left.state) - priorityBucket(right.state);
  if (bucketDifference !== 0) return bucketDifference;

  const bucket = priorityBucket(left.state);
  if (bucket === 1) {
    const attemptDifference = numericTimestamp(left.state?.last_attempt_at) -
      numericTimestamp(right.state?.last_attempt_at);
    if (attemptDifference !== 0) return attemptDifference;

    const dueDifference = numericTimestamp(left.state?.next_attempt_at) -
      numericTimestamp(right.state?.next_attempt_at);
    if (dueDifference !== 0) return dueDifference;
  }

  if (bucket === 2) {
    const successDifference = numericTimestamp(left.state?.last_success_at) -
      numericTimestamp(right.state?.last_success_at);
    if (successDifference !== 0) return successDifference;

    const attemptDifference = numericTimestamp(left.state?.last_attempt_at) -
      numericTimestamp(right.state?.last_attempt_at);
    if (attemptDifference !== 0) return attemptDifference;
  }

  return stableIdCompare(left.id, right.id);
}

function priorityBucket(state) {
  if (!state) return 0;
  if (state.last_success_at == null) return 1;
  return 2;
}

function numericTimestamp(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stableIdCompare(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
