import { apiError, getApiContext } from "../../../../lib/app-context";
import {
  ensureControlPlaneTables,
  sourceHash,
  type CompiledArtifact,
} from "../../../../lib/control-plane";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getApiContext();
  if (!context) return apiError(401, "authentication_required", "Sign in to view certifications.");
  const { db, organization } = context;
  await ensureControlPlaneTables(db);
  const now = Date.now();
  const result = await db.prepare(
    `SELECT c.*, p.stable_slug AS policy_slug, pv.version AS policy_version,
            pv.evidence_version
     FROM certifications c
     JOIN policy_versions pv ON pv.id = c.policy_version_id
     JOIN policies p ON p.id = pv.policy_id
     WHERE c.organization_id = ?
     ORDER BY c.created_at DESC`,
  ).bind(organization.id).all<Record<string, unknown>>();
  return Response.json({
    certifications: result.results.map((row) => ({
      ...row,
      effective_status:
        row.status === "revoked"
          ? "revoked"
          : Number(row.valid_until) <= now
            ? "expired"
            : row.status,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const context = await getApiContext();
  if (!context) return apiError(401, "authentication_required", "Sign in to create a certification.");
  const { db, organization, user } = context;
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return apiError(400, "invalid_json", "Request body must be valid JSON.");
  }
  const policyVersionId = String(body.policy_version_id ?? "").trim();
  if (!policyVersionId) return apiError(422, "policy_version_required", "policy_version_id is required.");
  await ensureControlPlaneTables(db);
  const policy = await db.prepare(
    `SELECT pv.*, es.designation, es.status AS eval_status, es.evaluated_at,
            es.notes
     FROM policy_versions pv
     JOIN eval_sets es ON es.id = pv.eval_set_id
     WHERE pv.id = ? AND pv.organization_id = ? AND pv.status = 'published'`,
  ).bind(policyVersionId, organization.id).first<Record<string, unknown>>();
  if (!policy) return apiError(404, "policy_version_not_found", "Published policy version not found.");
  if (policy.designation !== "held_out" || policy.eval_status !== "locked") {
    return apiError(422, "held_out_evidence_required", "Certification requires a locked held-out benchmark version.");
  }
  const artifact = JSON.parse(String(policy.artifact_json)) as CompiledArtifact;
  const selected = artifact.selected;
  if (!selected || !selected.eligible) {
    return apiError(409, "certification_abstained", "The policy has no eligible selected candidate.");
  }
  if (
    selected.case_count < Number(policy.minimum_cases) ||
    selected.quality_lower_bound < Number(policy.quality_floor)
  ) {
    return apiError(409, "certification_gate_failed", "The selected candidate no longer clears the private-evidence gate.");
  }

  const now = Date.now();
  const validUntil = now + 30 * 24 * 60 * 60 * 1000;
  const id = `cert_${crypto.randomUUID().replaceAll("-", "")}`;
  const demoEvidence = String(policy.notes ?? "").toLowerCase().includes("illustrative");
  const limitations =
    `${demoEvidence ? "ILLUSTRATIVE DEMO EVIDENCE — not valid for a production model claim. " : ""}` +
    "Valid only for the declared workload, held-out benchmark version, scaffold, grader, and policy constraints. It is statistical evidence, not a correctness guarantee.";
  const manifestHash = sourceHash({
    certification_id: id,
    policy_version_id: policyVersionId,
    evidence_version: policy.evidence_version,
    selected,
    valid_from: now,
    valid_until: validUntil,
  });
  await db.batch([
    db.prepare(
      `INSERT INTO certifications (
        id, organization_id, policy_version_id, workload_key, candidate_type,
        candidate_id, eval_set_id, posterior_mean, quality_lower_bound,
        case_count, average_cost, p95_latency_ms, status, manifest_hash,
        limitations, valid_from, valid_until, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'certified', ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      organization.id,
      policyVersionId,
      policy.workload_key,
      selected.candidate_type,
      selected.candidate_id,
      policy.eval_set_id,
      selected.posterior_mean,
      selected.quality_lower_bound,
      selected.case_count,
      selected.average_cost_per_case ?? null,
      selected.p95_latency_ms ?? null,
      manifestHash,
      limitations,
      now,
      validUntil,
      now,
    ),
    db.prepare(
      `INSERT INTO audit_events (
        id, organization_id, actor_email, action, target_type,
        target_id, metadata_json, created_at
      ) VALUES (?, ?, ?, 'certification.created', 'certification', ?, ?, ?)`,
    ).bind(
      `aud_${crypto.randomUUID().replaceAll("-", "")}`,
      organization.id,
      user.email,
      id,
      JSON.stringify({ candidate_id: selected.candidate_id, policy_version_id: policyVersionId }),
      now,
    ),
  ]);
  return Response.json({
    certification_id: id,
    status: "certified",
    candidate_type: selected.candidate_type,
    candidate_id: selected.candidate_id,
    posterior_mean: selected.posterior_mean,
    quality_lower_bound: selected.quality_lower_bound,
    case_count: selected.case_count,
    manifest_hash: manifestHash,
    valid_until: new Date(validUntil).toISOString(),
    signature_status: "Hash verified, unsigned",
    limitations,
  }, { status: 201 });
}
