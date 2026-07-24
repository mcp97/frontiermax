import { apiError, getApiContext } from "../../../../../lib/app-context";
import { ensureControlPlaneTables } from "../../../../../lib/control-plane";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getApiContext();
  if (!context) return apiError(401, "authentication_required", "Sign in to view private benchmarks.");
  const { id } = await params;
  const { db, organization } = context;
  await ensureControlPlaneTables(db);
  const evalSet = await db.prepare(
    `SELECT * FROM eval_sets WHERE id = ? AND organization_id = ?`,
  ).bind(id, organization.id).first();
  if (!evalSet) return apiError(404, "eval_set_not_found", "Private benchmark version not found.");
  const results = await db.prepare(
    `SELECT * FROM eval_results WHERE eval_set_id = ? ORDER BY candidate_id`,
  ).bind(id).all();
  return Response.json({ eval_set: evalSet, results: results.results }, {
    headers: { "Cache-Control": "no-store" },
  });
}
