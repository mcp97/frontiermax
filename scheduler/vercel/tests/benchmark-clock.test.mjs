import assert from "node:assert/strict";
import test from "node:test";

import {
  currentCycle,
  currentCycleKey,
  previousCycleKey,
} from "../workflows/benchmark-clock.ts";

test("aligns all timestamps in a three-day window to one stable cycle key", () => {
  const first = Date.parse("2026-07-18T00:00:00.000Z");

  assert.equal(currentCycleKey(first), "2026-07-18T00:00:00.000Z");
  assert.equal(
    currentCycleKey(first + (3 * 24 * 60 * 60 * 1_000) - 1),
    "2026-07-18T00:00:00.000Z",
  );
  assert.equal(
    currentCycleKey(first + (3 * 24 * 60 * 60 * 1_000)),
    "2026-07-21T00:00:00.000Z",
  );
});

test("rejects an invalid clock value", () => {
  assert.throws(() => currentCycleKey(Number.NaN), /must be finite/);
});

test("identifies the preceding cycle at a watchdog boundary", () => {
  assert.equal(
    previousCycleKey("2026-07-18T00:00:00.000Z"),
    "2026-07-15T00:00:00.000Z",
  );
});

test("starts at the current 15-minute slot instead of replaying elapsed work", () => {
  assert.deepEqual(currentCycle(Date.parse("2026-07-18T02:37:00.000Z")), {
    cycleKey: "2026-07-18T00:00:00.000Z",
    startingSlot: 10,
  });
});
