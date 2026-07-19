import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEvidenceCard,
  buildSnapshotShareUrl,
  buildXIntentUrl,
  buildXShareText,
  readSharedReference,
} from "../app/benchmarks/[slug]/share.ts";

const hash = "a".repeat(64);
const checkedAt = "2026-07-18T01:25:33.027Z";

test("snapshot share URLs preserve source identity and immutable reference", () => {
  const value = buildSnapshotShareUrl("example_benchmark", hash, checkedAt);
  const url = new URL(value);
  assert.equal(url.pathname, "/benchmarks/example_benchmark");
  assert.equal(url.searchParams.get("source"), "benchmarklist");
  assert.equal(url.searchParams.get("snapshot"), hash);
  assert.equal(url.searchParams.get("checked"), checkedAt);
  assert.equal(url.hash, "#provenance");
  assert.deepEqual(readSharedReference(url.search), {
    source: "benchmarklist",
    snapshot: hash,
    checkedAt,
  });
});

test("untrusted snapshot parameters are ignored", () => {
  assert.equal(
    readSharedReference("?source=benchmarklist&snapshot=not-a-content-hash"),
    null,
  );
  const url = new URL(buildSnapshotShareUrl("example", "not-a-hash", "unknown"));
  assert.equal(url.searchParams.has("snapshot"), false);
  assert.equal(url.searchParams.has("checked"), false);
});

test("X copy carries scope, caveat, and provenance without claiming a winner", () => {
  const text = buildXShareText({
    title: "A deliberately long benchmark title ".repeat(10),
    reportedCoverage: 2,
    sourceHash: hash,
  });
  assert.ok(text.length <= 240);
  assert.match(text, /2\/4 core dimensions reported/);
  assert.match(text, /not a universal “best model/);
  assert.match(text, /Discovery index: BenchmarkList/);
  assert.match(text, /snapshot aaaaaaaaaa…aaaaaaaa/);
  const intent = new URL(buildXIntentUrl(text, "https://example.com/evidence"));
  assert.equal(intent.origin, "https://x.com");
  assert.equal(intent.pathname, "/intent/post");
  assert.equal(intent.searchParams.get("text"), text);
});

test("copied evidence cards include source and snapshot-aware interpretation", () => {
  const card = buildEvidenceCard({
    slug: "example",
    title: "Example",
    description: "An indexed benchmark.",
    reportedCoverage: 1,
    sourceUrl: "https://benchmarklist.com/benchmarks/example/",
    sourceHash: hash,
    checkedAt,
  });
  assert.match(card, /What it can inform:/);
  assert.match(card, /What it does not establish:/);
  assert.match(card, /Discovery index: BenchmarkList/);
  assert.match(card, /Indexed record: https:\/\/benchmarklist\.com/);
  assert.match(card, /reuse rights remain with the linked benchmark publisher/i);
  assert.match(card, new RegExp(`snapshot=${hash}`));
});
