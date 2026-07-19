import assert from "node:assert/strict";
import test from "node:test";
import {
  CATALOG_MEMBERSHIP_CHUNK_SIZE,
  D1_MAX_BOUND_PARAMETERS,
  countCurrentCatalogCoverage,
  selectDueBenchmarkIds,
} from "../lib/refresh-selection.mjs";

const NOW = 1_000_000;

test("catalog membership writes stay below D1's parameter limit", () => {
  assert.ok(CATALOG_MEMBERSHIP_CHUNK_SIZE > 0);
  assert.ok(
    CATALOG_MEMBERSHIP_CHUNK_SIZE * 2 <= D1_MAX_BOUND_PARAMETERS,
    "each membership row binds catalog hash and benchmark ID",
  );
});

test("catalog reshuffles cannot starve benchmarks that have never been attempted", () => {
  const refreshRows = [
    successful("alpha", 100),
    successful("bravo", 200),
  ];

  const original = selectDueBenchmarkIds(
    ["alpha", "bravo", "charlie", "delta"],
    refreshRows,
    NOW,
    2,
  );
  const reorderedWithNewEntry = selectDueBenchmarkIds(
    ["echo", "delta", "bravo", "charlie", "alpha"],
    refreshRows,
    NOW,
    3,
  );

  assert.deepEqual(original, ["charlie", "delta"]);
  assert.deepEqual(reorderedWithNewEntry, ["charlie", "delta", "echo"]);
});

test("backoff hides failed work until its retry time, then prioritizes it", () => {
  const catalog = ["failed", "fresh", "healthy"];
  const refreshRows = [
    {
      benchmark_id: "failed",
      last_attempt_at: 900_000,
      last_success_at: null,
      next_attempt_at: NOW + 1,
    },
    successful("healthy", 10),
  ];

  assert.deepEqual(
    selectDueBenchmarkIds(catalog, refreshRows, NOW, 3),
    ["fresh", "healthy"],
  );
  assert.deepEqual(
    selectDueBenchmarkIds(catalog, refreshRows, NOW + 1, 3),
    ["failed", "fresh", "healthy"],
  );
});

test("a large unseen backfill reserves a batch slot for the oldest due failure", () => {
  const catalog = [
    "unseen-juliet",
    "retry-newer",
    "unseen-alpha",
    "unseen-hotel",
    "unseen-bravo",
    "retry-oldest",
    "unseen-charlie",
  ];
  const refreshRows = [
    failed("retry-newer", 800, 100),
    failed("retry-oldest", 100, 900),
  ];

  assert.deepEqual(
    selectDueBenchmarkIds(catalog, refreshRows, NOW, 3),
    ["retry-oldest", "unseen-alpha", "unseen-bravo"],
  );
  assert.deepEqual(
    selectDueBenchmarkIds(catalog, refreshRows, NOW, 1),
    ["unseen-alpha"],
  );
});

test("due failed attempts precede successful snapshots and use stable ties", () => {
  const refreshRows = [
    failed("retry-zulu", 300, 250),
    failed("retry-alpha", 300, 250),
    failed("retry-older", 200, 150),
    successful("success-old", 100),
  ];

  assert.deepEqual(
    selectDueBenchmarkIds(
      ["success-old", "retry-zulu", "retry-older", "retry-alpha"],
      refreshRows,
      NOW,
      4,
    ),
    ["retry-older", "retry-alpha", "retry-zulu", "success-old"],
  );
});

test("successful snapshots refresh oldest-first regardless of catalog order", () => {
  const refreshRows = [
    successful("newest", 900),
    successful("oldest", 100),
    successful("middle", 500),
  ];

  assert.deepEqual(
    selectDueBenchmarkIds(
      ["newest", "middle", "oldest"],
      refreshRows,
      NOW,
      2,
    ),
    ["oldest", "middle"],
  );
});

test("historical detail rows cannot inflate current catalog coverage", () => {
  assert.deepEqual(
    countCurrentCatalogCoverage(
      [{ id: "alpha" }, { id: "new-entry" }],
      [
        { benchmark_id: "alpha" },
        { benchmark_id: "removed-entry" },
        { benchmark_id: "removed-entry" },
      ],
    ),
    { indexed: 1, total: 2 },
  );
});

function successful(benchmarkId, lastSuccessAt) {
  return {
    benchmark_id: benchmarkId,
    last_attempt_at: lastSuccessAt,
    last_success_at: lastSuccessAt,
    next_attempt_at: 0,
  };
}

function failed(benchmarkId, lastAttemptAt, nextAttemptAt) {
  return {
    benchmark_id: benchmarkId,
    last_attempt_at: lastAttemptAt,
    last_success_at: null,
    next_attempt_at: nextAttemptAt,
  };
}
