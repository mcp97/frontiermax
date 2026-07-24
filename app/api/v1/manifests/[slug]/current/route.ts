import {
  ApiRateLimitError,
  apiError,
  getApiContext,
  rateLimitResponse,
} from "../../../../../../lib/app-context";
import { ensureControlPlaneTables } from "../../../../../../lib/control-plane";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  let context;
  try {
    context = await getApiContext("manifest:read");
  } catch (error) {
    if (error instanceof ApiRateLimitError) return rateLimitResponse(error);
    throw error;
  }
  if (!context) return apiError(401, "authentication_required", "Sign in to read private route manifests.");
  const { slug } = await params;
  const { db, organization } = context;
  await ensureControlPlaneTables(db);
  const row = await db.prepare(
    `SELECT p.stable_slug, p.name, v.id AS policy_version_id, v.version,
            v.artifact_json, v.evidence_version, v.manifest_hash, v.published_at
     FROM policies p
     JOIN policy_versions v ON v.policy_id = p.id
     WHERE p.organization_id = ? AND p.stable_slug = ?
       AND v.status = 'published'
     ORDER BY v.version DESC LIMIT 1`,
  ).bind(organization.id, slug).first<Record<string, unknown>>();
  if (!row) return apiError(404, "manifest_not_found", "Published policy manifest not found.");
  return Response.json({
    policy_slug: row.stable_slug,
    policy_name: row.name,
    policy_version_id: row.policy_version_id,
    version: row.version,
    evidence_version: row.evidence_version,
    manifest_hash: row.manifest_hash,
    published_at: new Date(Number(row.published_at)).toISOString(),
    artifact: JSON.parse(String(row.artifact_json)),
  }, { headers: { "Cache-Control": "no-store" } });
}
