import assert from "node:assert/strict";
import test from "node:test";
import {
  betaLowerBound,
  compareAggregateRows,
  compileArtifact,
  sourceHash,
  validateEvalImport,
} from "../lib/control-plane.ts";

const policy = {
  name: "Coding production",
  stable_slug: "coding-prod",
  workload_key: "code.text",
  eval_set_id: "eval_1",
  objective: "minimize_expected_cost_per_success",
  quality_floor: 0.65,
  confidence: 0.95,
  minimum_cases: 50,
  maximum_cost: 1,
  maximum_p95_latency_ms: 10000,
};

const rows = [
  {
    candidate_type: "concrete_model",
    candidate_id: "provider/model-a",
    case_count: 100,
    successes: 90,
    failures: 10,
    average_cost_per_case: 0.5,
    p95_latency_ms: 5000,
  },
  {
    candidate_type: "external_router",
    candidate_id: "router/auto",
    case_count: 100,
    successes: 84,
    failures: 16,
    average_cost_per_case: 0.2,
    p95_latency_ms: 6000,
  },
];

test("uses a one-sided Beta posterior lower bound", () => {
  const lower = betaLowerBound(90, 10, 0.95);
  assert.ok(lower > 0.82 && lower < 0.86);
});

test("validates aggregate rows and rejects inconsistent counts", () => {
  const result = validateEvalImport({
    workload_key: "code.text",
    name: "Coding",
    version: 1,
    designation: "held_out",
    outcome_definition: "Accepted",
    grader_version: "1",
    scaffold_version: "1",
    evaluated_at: "2026-07-23T00:00:00.000Z",
    rows: [{ ...rows[0], case_count: 99 }],
  });
  assert.equal(result.data, null);
  assert.match(result.errors.join(" "), /successes \+ failures/);
});

test("external routers and fixed models compete under the same private evidence", () => {
  const comparison = compareAggregateRows(rows, policy);
  assert.equal(comparison.selected?.candidate_id, "router/auto");
  assert.equal(comparison.selected?.candidate_type, "external_router");
  assert.ok(comparison.candidates.every((candidate) => typeof candidate.quality_lower_bound === "number"));
});

test("a fixed concrete model is allowed to win", () => {
  const comparison = compareAggregateRows(
    rows.map((row) =>
      row.candidate_id === "provider/model-a"
        ? { ...row, average_cost_per_case: 0.1 }
        : row,
    ),
    policy,
  );
  assert.equal(comparison.selected?.candidate_id, "provider/model-a");
});

test("private evidence changes can change the selected candidate", () => {
  const first = compareAggregateRows(rows, policy);
  const changed = compareAggregateRows(
    rows.map((row) =>
      row.candidate_id === "router/auto"
        ? { ...row, successes: 70, failures: 30 }
        : row,
    ),
    policy,
  );
  assert.notEqual(first.selected?.candidate_id, changed.selected?.candidate_id);
  assert.equal(changed.selected?.candidate_id, "provider/model-a");
});

test("compiled artifacts are deterministic apart from compile time", () => {
  const artifact = compileArtifact(policy, 1, rows);
  const normalized = { ...artifact, compiled_at: "frozen" };
  assert.equal(sourceHash(normalized), sourceHash({ ...artifact, compiled_at: "frozen" }));
  assert.equal(artifact.policy_version, 1);
  assert.equal(artifact.evidence_mode, "private_aggregate");
});
