import { apiError, getApiContext } from "../../../../lib/app-context";
import { ensureControlPlaneTables } from "../../../../lib/control-plane";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await getApiContext();
  if (!context) return apiError(401, "authentication_required", "Sign in to view private receipts.");
  const { db, organization } = context;
  await ensureControlPlaneTables(db);
  const limit = Math.min(100, Math.max(1, Number(new URL(request.url).searchParams.get("limit") ?? 30)));
  const result = await db.prepare(
    `SELECT r.*, o.application_outcome, o.actual_model, o.actual_provider,
            o.actual_cost, o.total_latency_ms, o.created_at AS outcome_created_at
     FROM route_decisions r
     LEFT JOIN execution_outcomes o ON o.route_id = r.id
     WHERE r.organization_id = ?
     ORDER BY r.created_at DESC
     LIMIT ?`,
  ).bind(organization.id, limit).all<Record<string, unknown>>();
  return Response.json({
    receipts: result.results.map((row) => ({
      route_id: row.id,
      policy_version: row.policy_version,
      evidence_version: row.evidence_version,
      router_engine_version: row.engine_version,
      structured_request: JSON.parse(String(row.request_features_json)),
      candidates: JSON.parse(String(row.candidate_set_json)),
      selected_candidate: row.selected_candidate,
      manifest_hash: row.manifest_hash,
      created_at: new Date(Number(row.created_at)).toISOString(),
      expires_at: new Date(Number(row.expires_at)).toISOString(),
      privacy: {
        prompt_captured: false,
        output_captured: false,
        code_captured: false,
        diff_captured: false,
        credentials_captured: false,
      },
      outcome: row.application_outcome ? {
        application_outcome: row.application_outcome,
        actual_model: row.actual_model,
        actual_provider: row.actual_provider,
        actual_cost: row.actual_cost,
        total_latency_ms: row.total_latency_ms,
        created_at: new Date(Number(row.outcome_created_at)).toISOString(),
      } : null,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
