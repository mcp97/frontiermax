import { apiError, getApiContext } from "../../../../../lib/app-context";
import {
  ensureControlPlaneTables,
  sourceHash,
  validateEvalImport,
} from "../../../../../lib/control-plane";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getApiContext();
  if (!context) return apiError(401, "authentication_required", "Sign in to view private benchmarks.");
  const { db, organization } = context;
  await ensureControlPlaneTables(db);
  const result = await db.prepare(
    `SELECT e.id, e.workload_key, e.name, e.version, e.designation,
            e.outcome_definition, e.evaluated_at, e.status, e.source_hash,
            e.created_at, COUNT(r.id) AS candidate_count
     FROM eval_sets e
     LEFT JOIN eval_results r ON r.eval_set_id = e.id
     WHERE e.organization_id = ?
     GROUP BY e.id
     ORDER BY e.created_at DESC`,
  ).bind(organization.id).all();
  return Response.json({ eval_sets: result.results }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const context = await getApiContext();
  if (!context) return apiError(401, "authentication_required", "Sign in to import private benchmarks.");
  const { db, organization, user } = context;
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return apiError(400, "invalid_json", "Request body must be valid JSON.");
  }
  const validation = validateEvalImport(body.data ?? body);
  if (!validation.data) {
    return apiError(422, "invalid_eval_import", "Fix the aggregate benchmark rows before importing.", validation.errors);
  }
  if (body.preview === true) {
    return Response.json({
      valid: true,
      candidate_count: validation.data.rows.length,
      case_count: validation.data.rows.reduce((sum, row) => sum + row.case_count, 0),
      source_hash: sourceHash(validation.data),
      normalized: validation.data,
    });
  }

  await ensureControlPlaneTables(db);
  const id = `eval_${crypto.randomUUID().replaceAll("-", "")}`;
  const now = Date.now();
  const hash = sourceHash(validation.data);
  try {
    await db.batch([
      db.prepare(
        `INSERT INTO eval_sets (
          id, organization_id, workload_key, name, version, designation,
          outcome_definition, grader_version, scaffold_version, evaluated_at,
          notes, status, source_hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'locked', ?, ?)`,
      ).bind(
        id,
        organization.id,
        validation.data.workload_key,
        validation.data.name,
        validation.data.version,
        validation.data.designation,
        validation.data.outcome_definition,
        validation.data.grader_version,
        validation.data.scaffold_version,
        validation.data.evaluated_at,
        validation.data.notes ?? "",
        hash,
        now,
      ),
      ...validation.data.rows.map((row) =>
        db.prepare(
          `INSERT INTO eval_results (
            id, eval_set_id, candidate_type, candidate_id, case_count,
            successes, failures, mean_rubric_score, average_cost,
            p50_latency_ms, p95_latency_ms, input_token_average,
            output_token_average, evaluator_version, scaffold_version,
            evaluated_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          `evr_${crypto.randomUUID().replaceAll("-", "")}`,
          id,
          row.candidate_type,
          row.candidate_id,
          row.case_count,
          row.successes,
          row.failures,
          row.mean_rubric_score ?? null,
          row.average_cost_per_case ?? null,
          row.p50_latency_ms ?? null,
          row.p95_latency_ms ?? null,
          row.input_token_average ?? null,
          row.output_token_average ?? null,
          validation.data!.grader_version,
          validation.data!.scaffold_version,
          validation.data!.evaluated_at,
          now,
        ),
      ),
      db.prepare(
        `INSERT INTO audit_events (
          id, organization_id, actor_email, action, target_type,
          target_id, metadata_json, created_at
        ) VALUES (?, ?, ?, 'private_eval.imported', 'eval_set', ?, ?, ?)`,
      ).bind(
        `aud_${crypto.randomUUID().replaceAll("-", "")}`,
        organization.id,
        user.email,
        id,
        JSON.stringify({ source_hash: hash, candidate_count: validation.data.rows.length }),
        now,
      ),
    ]);
  } catch {
    return apiError(409, "eval_version_conflict", "That benchmark name and version already exists.");
  }

  return Response.json({
    eval_set_id: id,
    status: "locked",
    source_hash: hash,
    candidate_count: validation.data.rows.length,
  }, { status: 201 });
}
