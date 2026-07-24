import {
  ApiRateLimitError,
  apiError,
  getApiContext,
  rateLimitResponse,
} from "../../../../lib/app-context";
import { ensureControlPlaneTables } from "../../../../lib/control-plane";

export const dynamic = "force-dynamic";

const RAW_FIELDS = new Set(["prompt", "messages", "raw_input", "document", "code", "content", "output", "response"]);
const OUTCOMES = new Set(["accepted", "rejected", "retried", "escalated", "abandoned", "unknown"]);

function hasRawField(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    if (RAW_FIELDS.has(key)) return key;
    const nested = hasRawField(child);
    if (nested) return nested;
  }
  return null;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export async function POST(request: Request) {
  let context;
  try {
    context = await getApiContext("outcomes:write");
  } catch (error) {
    if (error instanceof ApiRateLimitError) return rateLimitResponse(error);
    throw error;
  }
  if (!context) return apiError(401, "authentication_required", "Sign in to report an outcome.");
  const { db, organization } = context;
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return apiError(400, "invalid_json", "Request body must be valid JSON.");
  }
  const rawField = hasRawField(body);
  if (rawField) return apiError(422, "raw_input_rejected", "Outcome callbacks accept operational metadata only.", { [rawField]: "Raw inference content is not accepted." });
  const routeId = String(body.route_id ?? "").trim();
  const outcome = String(body.application_outcome ?? "");
  if (!routeId || !OUTCOMES.has(outcome)) {
    return apiError(422, "invalid_outcome", "route_id and a supported application_outcome are required.");
  }
  await ensureControlPlaneTables(db);
  const route = await db.prepare(
    "SELECT id FROM route_decisions WHERE id = ? AND organization_id = ?",
  ).bind(routeId, organization.id).first();
  if (!route) return apiError(404, "receipt_not_found", "Route receipt not found.");
  const id = `out_${crypto.randomUUID().replaceAll("-", "")}`;
  await db.prepare(
    `INSERT INTO execution_outcomes (
      id, route_id, organization_id, actual_model, actual_provider,
      generation_id, prompt_tokens, completion_tokens, cached_tokens,
      reasoning_tokens, actual_cost, time_to_first_token_ms,
      total_latency_ms, operational_error_type, application_outcome, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id,
    routeId,
    organization.id,
    String(body.actual_model ?? "").trim() || null,
    String(body.actual_provider ?? "").trim() || null,
    String(body.generation_id ?? "").trim() || null,
    optionalNumber(body.prompt_tokens),
    optionalNumber(body.completion_tokens),
    optionalNumber(body.cached_tokens),
    optionalNumber(body.reasoning_tokens),
    optionalNumber(body.actual_cost),
    optionalNumber(body.time_to_first_token_ms),
    optionalNumber(body.total_latency_ms),
    String(body.operational_error_type ?? "").trim() || null,
    outcome,
    Date.now(),
  ).run();
  return Response.json({ outcome_id: id, route_id: routeId, status: "recorded" }, { status: 201 });
}
