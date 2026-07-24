import { apiError, getApiContext } from "../../../../lib/app-context";
import {
  compileArtifact,
  ensureControlPlaneTables,
  sourceHash,
  type AggregateEvalRow,
  type PolicyInput,
} from "../../../../lib/control-plane";

export const dynamic = "force-dynamic";

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function policyInput(value: unknown): { data: PolicyInput | null; errors: string[] } {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const errors: string[] = [];
  const objective = String(input.objective ?? "minimize_expected_cost_per_success") as PolicyInput["objective"];
  if (!["minimize_estimated_cost", "minimize_expected_cost_per_success", "minimize_p95_latency", "maximize_quality_lower_bound"].includes(objective)) {
    errors.push("objective is unsupported.");
  }
  const qualityFloor = Number(input.quality_floor);
  const confidence = Number(input.confidence ?? 0.95);
  const minimumCases = Number(input.minimum_cases);
  if (!String(input.name ?? "").trim()) errors.push("name is required.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(input.stable_slug ?? ""))) errors.push("stable_slug must be lowercase kebab-case.");
  if (!String(input.workload_key ?? "").trim()) errors.push("workload_key is required.");
  if (!String(input.eval_set_id ?? "").trim()) errors.push("eval_set_id is required.");
  if (!Number.isFinite(qualityFloor) || qualityFloor <= 0 || qualityFloor >= 1) errors.push("quality_floor must be between 0 and 1.");
  if (!Number.isFinite(confidence) || confidence < 0.8 || confidence >= 1) errors.push("confidence must be at least 0.8 and below 1.");
  if (!Number.isInteger(minimumCases) || minimumCases < 1) errors.push("minimum_cases must be a positive integer.");
  const maximumCost = numberOrNull(input.maximum_cost);
  const maximumLatency = numberOrNull(input.maximum_p95_latency_ms);
  if (maximumCost != null && maximumCost < 0) errors.push("maximum_cost cannot be negative.");
  if (maximumLatency != null && maximumLatency < 0) errors.push("maximum_p95_latency_ms cannot be negative.");
  if (errors.length) return { data: null, errors };
  return {
    data: {
      name: String(input.name).trim().slice(0, 160),
      stable_slug: String(input.stable_slug).trim().slice(0, 100),
      workload_key: String(input.workload_key).trim().slice(0, 100),
      eval_set_id: String(input.eval_set_id).trim(),
      objective,
      quality_floor: qualityFloor,
      confidence,
      minimum_cases: minimumCases,
      maximum_cost: maximumCost,
      maximum_p95_latency_ms: maximumLatency,
    },
    errors: [],
  };
}

export async function GET() {
  const context = await getApiContext();
  if (!context) return apiError(401, "authentication_required", "Sign in to view policies.");
  const { db, organization } = context;
  await ensureControlPlaneTables(db);
  const result = await db.prepare(
    `SELECT p.id, p.name, p.stable_slug, p.status,
            v.id AS version_id, v.version, v.workload_key, v.objective,
            v.quality_floor, v.confidence, v.minimum_cases,
            v.maximum_cost, v.maximum_p95_latency_ms, v.eval_set_id,
            v.evidence_version, v.manifest_hash, v.published_at,
            json_extract(v.artifact_json, '$.selected.candidate_id') AS selected_candidate,
            json_extract(v.artifact_json, '$.selected.candidate_type') AS selected_type
     FROM policies p
     JOIN policy_versions v ON v.policy_id = p.id
     WHERE p.organization_id = ? AND v.status = 'published'
       AND v.version = (
         SELECT MAX(v2.version) FROM policy_versions v2 WHERE v2.policy_id = p.id
       )
     ORDER BY v.published_at DESC`,
  ).bind(organization.id).all();
  return Response.json({ policies: result.results }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const context = await getApiContext();
  if (!context) return apiError(401, "authentication_required", "Sign in to publish a policy.");
  const { db, organization, user } = context;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_json", "Request body must be valid JSON.");
  }
  const parsed = policyInput(body);
  if (!parsed.data) return apiError(422, "invalid_policy", "Fix the policy fields before publishing.", parsed.errors);
  await ensureControlPlaneTables(db);

  const evalSet = await db.prepare(
    `SELECT id, designation, status, source_hash
     FROM eval_sets WHERE id = ? AND organization_id = ?`,
  ).bind(parsed.data.eval_set_id, organization.id).first<{
    id: string;
    designation: string;
    status: string;
    source_hash: string;
  }>();
  if (!evalSet) return apiError(404, "eval_set_not_found", "The selected private benchmark version was not found.");
  if (evalSet.designation !== "held_out" || evalSet.status !== "locked") {
    return apiError(422, "held_out_evidence_required", "Published policies require a locked held-out benchmark version.");
  }
  const result = await db.prepare(
    `SELECT candidate_type, candidate_id, case_count, successes, failures,
            mean_rubric_score, average_cost, p50_latency_ms, p95_latency_ms,
            input_token_average, output_token_average
     FROM eval_results WHERE eval_set_id = ?`,
  ).bind(evalSet.id).all<Record<string, unknown>>();
  const rows: AggregateEvalRow[] = result.results.map((row) => ({
    candidate_type: String(row.candidate_type) as AggregateEvalRow["candidate_type"],
    candidate_id: String(row.candidate_id),
    case_count: Number(row.case_count),
    successes: Number(row.successes),
    failures: Number(row.failures),
    mean_rubric_score: numberOrNull(row.mean_rubric_score),
    average_cost_per_case: numberOrNull(row.average_cost),
    p50_latency_ms: numberOrNull(row.p50_latency_ms),
    p95_latency_ms: numberOrNull(row.p95_latency_ms),
    input_token_average: numberOrNull(row.input_token_average),
    output_token_average: numberOrNull(row.output_token_average),
  }));

  let policy = await db.prepare(
    "SELECT id FROM policies WHERE organization_id = ? AND stable_slug = ?",
  ).bind(organization.id, parsed.data.stable_slug).first<{ id: string }>();
  const policyId = policy?.id ?? `pol_${crypto.randomUUID().replaceAll("-", "")}`;
  const versionRow = await db.prepare(
    "SELECT COALESCE(MAX(version), 0) AS version FROM policy_versions WHERE policy_id = ?",
  ).bind(policyId).first<{ version: number }>();
  const version = Number(versionRow?.version ?? 0) + 1;
  const artifact = compileArtifact(parsed.data, version, rows);
  if (!artifact.selected) {
    return apiError(
      409,
      "policy_abstained",
      "No candidate clears the proposed quality, evidence, cost, and latency gates.",
      Object.fromEntries(
        artifact.candidates.map((candidate) => [
          candidate.candidate_id,
          candidate.rejection_reasons.join("; "),
        ]),
      ),
    );
  }

  const now = Date.now();
  const versionId = `pov_${crypto.randomUUID().replaceAll("-", "")}`;
  const evidenceVersion = sourceHash({
    eval_set: evalSet.source_hash,
    policy: parsed.data,
  });
  const manifestHash = sourceHash(artifact);
  const statements = [];
  if (!policy) {
    statements.push(
      db.prepare(
        `INSERT INTO policies (id, organization_id, stable_slug, name, status, created_at)
         VALUES (?, ?, ?, ?, 'published', ?)`,
      ).bind(policyId, organization.id, parsed.data.stable_slug, parsed.data.name, now),
    );
  } else {
    statements.push(
      db.prepare("UPDATE policies SET name = ?, status = 'published' WHERE id = ? AND organization_id = ?")
        .bind(parsed.data.name, policyId, organization.id),
      db.prepare("UPDATE policy_versions SET status = 'superseded' WHERE policy_id = ? AND status = 'published'")
        .bind(policyId),
    );
  }
  statements.push(
    db.prepare(
      `INSERT INTO policy_versions (
        id, policy_id, organization_id, version, workload_key, eval_set_id,
        objective, quality_floor, confidence, minimum_cases, maximum_cost,
        maximum_p95_latency_ms, allow_public_only, status, artifact_json,
        evidence_version, manifest_hash, created_at, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'published', ?, ?, ?, ?, ?)`,
    ).bind(
      versionId,
      policyId,
      organization.id,
      version,
      parsed.data.workload_key,
      parsed.data.eval_set_id,
      parsed.data.objective,
      parsed.data.quality_floor,
      parsed.data.confidence,
      parsed.data.minimum_cases,
      parsed.data.maximum_cost ?? null,
      parsed.data.maximum_p95_latency_ms ?? null,
      JSON.stringify(artifact),
      evidenceVersion,
      manifestHash,
      now,
      now,
    ),
    db.prepare(
      `INSERT INTO audit_events (
        id, organization_id, actor_email, action, target_type,
        target_id, metadata_json, created_at
      ) VALUES (?, ?, ?, 'policy.published', 'policy_version', ?, ?, ?)`,
    ).bind(
      `aud_${crypto.randomUUID().replaceAll("-", "")}`,
      organization.id,
      user.email,
      versionId,
      JSON.stringify({ policy_slug: parsed.data.stable_slug, version, selected: artifact.selected.candidate_id }),
      now,
    ),
  );
  await db.batch(statements);

  return Response.json({
    policy_id: policyId,
    policy_version_id: versionId,
    policy_slug: parsed.data.stable_slug,
    version,
    selected: artifact.selected,
    fallbacks: artifact.fallbacks,
    evidence_version: evidenceVersion,
    manifest_hash: manifestHash,
    status: "published",
  }, { status: 201 });
}
