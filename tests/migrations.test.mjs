import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrations = [
  "0000_motionless_wendell_vaughn.sql",
  "0001_puzzling_nocturne.sql",
  "0002_wandering_squadron_sinister.sql",
  "0003_loud_wendell_rand.sql",
];

async function migration(name) {
  return readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
}

test("migrations preserve existing details and create current-catalog provenance", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(await migration(migrations[0]));
  db.exec(await migration(migrations[1]));
  db.prepare(
    `INSERT INTO benchmark_details
      (benchmark_id, title, source_url, parsed_r2_key, source_hash, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run("current", "Current", "https://example.com", "detail.json", "hash", 1234);

  db.exec(await migration(migrations[2]));
  db.exec(await migration(migrations[3]));

  const detail = db.prepare(
    `SELECT last_checked_at FROM benchmark_details WHERE benchmark_id = ?`,
  ).get("current");
  assert.equal(detail.last_checked_at, 1234);
  const refresh = db.prepare(
    `SELECT last_attempt_at, last_success_at, failure_count
     FROM benchmark_refresh_status WHERE benchmark_id = ?`,
  ).get("current");
  assert.equal(refresh.last_attempt_at, 1234);
  assert.equal(refresh.last_success_at, 1234);
  assert.equal(refresh.failure_count, 0);

  db.prepare(
    `INSERT INTO refresh_state (name, total, catalog_hash)
     VALUES ('benchmarklist', 1, 'catalog-current')`,
  ).run();
  db.prepare(
    `INSERT INTO catalog_benchmark_membership (catalog_hash, benchmark_id)
     VALUES ('catalog-current', 'current')`,
  ).run();
  db.prepare(
    `INSERT INTO benchmark_details
      (benchmark_id, title, source_url, parsed_r2_key, source_hash, fetched_at, last_checked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run("removed", "Removed", "https://example.com", "removed.json", "old", 100, 100);

  const coverage = db.prepare(
    `SELECT COUNT(*) AS count
     FROM benchmark_details AS details
     INNER JOIN catalog_benchmark_membership AS membership
       ON membership.benchmark_id = details.benchmark_id
     INNER JOIN refresh_state AS state
       ON state.name = 'benchmarklist'
      AND state.catalog_hash = membership.catalog_hash`,
  ).get();
  assert.equal(coverage.count, 1);
  db.close();
});
