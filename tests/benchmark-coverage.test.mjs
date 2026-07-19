import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyMetricName,
  coverageByRow,
  hasReportedValue,
  tableMetricNames,
} from "../lib/benchmark-coverage.mjs";

test("normalizes unavailable metric values without turning zero into missing", () => {
  for (const value of ["", "—", "N/A", "not reported", null, undefined]) {
    assert.equal(hasReportedValue(value), false);
  }
  assert.equal(hasReportedValue(0), true);
  assert.equal(hasReportedValue("0"), true);
});

test("classifies one explicit dimension per metric", () => {
  assert.equal(classifyMetricName("Task success rate"), "score");
  assert.equal(classifyMetricName("Output tokens"), "tokens");
  assert.equal(classifyMetricName("Context window"), null);
  assert.equal(classifyMetricName("Response rate"), null);
  assert.equal(classifyMetricName("Cost and latency (USD)"), "cost");
  assert.equal(classifyMetricName("Primary result", "Primary result"), "score");
});

test("requires distinct same-row measurements for four-dimensional coverage", () => {
  const rows = coverageByRow([
    {
      metrics: [
        { name: "Accuracy", value: 92 },
        { name: "Cost USD", value: 1.2 },
        { name: "Wall-clock seconds", value: 18 },
        { name: "Output tokens", value: 1200 },
        { name: "Context window", value: 128000 },
      ],
    },
    {
      metrics: [
        { name: "Accuracy", value: "N/A" },
        { name: "Cost and latency USD", value: 2 },
        { name: "Output tokens", value: "—" },
      ],
    },
  ]);
  assert.deepEqual([...rows[0]].sort(), ["cost", "score", "time", "tokens"]);
  assert.deepEqual([...rows[1]], ["cost"]);
});

test("keeps every reported metric column and moves the primary metric first", () => {
  const names = tableMetricNames([
    { metrics: ["A", "B", "C", "D", "E", "F", "G", "H"].map((name) => ({ name, value: 1 })) },
  ], "H");
  assert.equal(names.length, 8);
  assert.equal(names[0], "H");
});
