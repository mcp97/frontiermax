import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

test("run request schema requires scope, timing, identity, rights, and an honest handoff state", async () => {
  const schema = await readJson("public/run-fund/v2/run-request.schema.json");

  for (const field of ["submission", "applicant", "model_scope", "schedule", "rights_and_permissions"]) {
    assert.ok(schema.required.includes(field), `${field} must be required`);
  }

  assert.equal(schema.properties.status.const, "portable_draft");
  assert.equal(schema.properties.schema.const, "frontier-max/run-request/v2");
  assert.equal(schema.properties.completeness.const, "ready_to_export");
  assert.equal(schema.properties.submission.properties.state.const, "not_submitted");
  assert.equal(schema.properties.submission.properties.delivery_method.const, "copy_or_download_only");
  assert.equal(schema.properties.submission.properties.intake_url.const, null);
  assert.equal(schema.properties.applicant.properties.contact_email.format, "email");
  assert.equal(schema.properties.model_scope.properties.requested_models.minItems, 1);
  assert.equal(schema.properties.schedule.properties.requested_completion_deadline.format, "date");
  assert.deepEqual(
    schema.properties.rights_and_permissions.properties.artifact_publication.enum,
    ["permitted", "conditional", "not_permitted"],
  );
  assert.match(schema.properties.benchmark.properties.source_url.pattern, /https/);
  assert.ok(schema.properties.benchmark.required.includes("version_or_harness"));
  assert.ok(schema.properties.budget.required.includes("non_cash_provider_or_compute_source"));
  assert.ok(schema.properties.budget.required.includes("non_cash_restrictions"));
});

test("support offer schema remains non-binding and never claims a collection rail", async () => {
  const schema = await readJson("public/run-fund/v2/support-offer.schema.json");

  assert.equal(schema.properties.status.const, "non_binding_portable_draft");
  assert.equal(schema.properties.schema.const, "frontier-max/support-offer/v2");
  assert.equal(schema.properties.completeness.const, "ready_to_export");
  assert.equal(schema.properties.submission.properties.state.const, "not_submitted");
  assert.equal(schema.properties.submission.properties.intake_url.const, null);
  assert.ok(schema.required.includes("supporter"));
  assert.equal(schema.properties.supporter.properties.contact_email.format, "email");
  assert.equal(schema.properties.ranking_influence.const, false);
});

test("local builder exposes only copy and download handoff", async () => {
  const source = await readFile(new URL("app/fund/run-fund-builder.tsx", root), "utf8");

  assert.match(source, /PORTABLE · NOT SUBMITTED/);
  assert.match(source, /copy_or_download_only/);
  assert.match(source, /There is no intake form, payment rail, or funding commitment yet/);
  assert.match(source, /isWebUrl/);
  assert.match(source, /isRealDate/);
  assert.match(source, /\/run-fund\/v2\/run-request\.schema\.json/);
  assert.match(source, /\/run-fund\/v2\/support-offer\.schema\.json/);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /<form[^>]+action=/);
});
