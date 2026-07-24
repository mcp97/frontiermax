import { createHash } from "node:crypto";
import { getOpenRouterModels } from "../../../../lib/public-evidence.ts";
import {
  routePublicModels,
  type PublicRouteRequest,
} from "../../../../lib/router-engine.ts";
import {
  ensureControlPlaneTables,
  sourceHash,
  type CompiledArtifact,
} from "../../../../lib/control-plane.ts";

export const dynamic = "force-dynamic";

const RAW_INPUT_FIELDS = new Set([
  "prompt",
  "messages",
  "raw_input",
  "document",
  "code",
  "content",
  "output",
  "response",
]);

function containsRawInput(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    if (RAW_INPUT_FIELDS.has(key)) return key;
    const nested = containsRawInput(child);
    if (nested) return nested;
  }
  return null;
}

async function runtimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env as unknown as { DB?: D1Database };
}

async function persistReceipt(
  db: D1Database,
  input: {
    routeId: string;
    request: unknown;
    candidates: unknown[];
    selectedCandidate: string;
    organizationId?: string | null;
    policyVersion: string;
    evidenceVersion: string;
    engineVersion: string;
    manifestHash: string;
    createdAt: number;
    expiresAt: number;
  },
) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS route_decisions (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      policy_version TEXT NOT NULL,
      evidence_version TEXT NOT NULL,
      engine_version TEXT NOT NULL,
      request_features_json TEXT NOT NULL,
      candidate_set_json TEXT NOT NULL,
      selected_candidate TEXT,
      manifest_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`,
  ).run();
  await db.prepare(
    `INSERT INTO route_decisions (
      id, organization_id, policy_version, evidence_version, engine_version,
      request_features_json, candidate_set_json, selected_candidate,
      manifest_hash, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      input.routeId,
      input.organizationId ?? null,
      input.policyVersion,
      input.evidenceVersion,
      input.engineVersion,
      JSON.stringify(input.request),
      JSON.stringify(input.candidates),
      input.selectedCandidate,
      input.manifestHash,
      input.createdAt,
      input.expiresAt,
    )
    .run();
}

async function privatePolicyRoute(
  body: Record<string, unknown>,
  requestIdentifier: string,
) {
  const {
    ApiRateLimitError,
    getApiContext,
    rateLimitResponse,
  } = await import("../../../../lib/app-context.ts");
  let context;
  try {
    context = await getApiContext("route:read");
  } catch (error) {
    if (error instanceof ApiRateLimitError) return rateLimitResponse(error);
    throw error;
  }
  if (!context) {
    return errorResponse(401, requestIdentifier, "authentication_required", "Sign in to use a private routing policy.");
  }
  const { db, organization } = context;
  await ensureControlPlaneTables(db);
  const policySlug = String(body.policy ?? "").trim();
  const policy = await db.prepare(
    `SELECT p.stable_slug, pv.id AS policy_version_id, pv.version,
            pv.artifact_json, pv.evidence_version, pv.manifest_hash
     FROM policies p
     JOIN policy_versions pv ON pv.policy_id = p.id
     WHERE p.organization_id = ? AND p.stable_slug = ?
       AND pv.status = 'published'
     ORDER BY pv.version DESC LIMIT 1`,
  ).bind(organization.id, policySlug).first<Record<string, unknown>>();
  if (!policy) {
    return errorResponse(404, requestIdentifier, "policy_not_found", "Published policy not found.");
  }
  const artifact = JSON.parse(String(policy.artifact_json)) as CompiledArtifact;
  let selected = artifact.selected;
  if (!selected) {
    return errorResponse(409, requestIdentifier, "policy_abstained", "The policy has no eligible route.");
  }

  const sessionId = String(body.session_id ?? "").trim();
  const now = Date.now();
  const expiresAt = now + 60 * 60 * 1000;
  const assignmentExpiresAt = now + 4 * 60 * 60 * 1000;
  if (sessionId) {
    const sessionHash = sourceHash(sessionId);
    const assignment = await db.prepare(
      `SELECT candidate_id FROM session_assignments
       WHERE organization_id = ? AND policy_version_id = ?
         AND session_hash = ? AND expires_at > ?`,
    ).bind(
      organization.id,
      policy.policy_version_id,
      sessionHash,
      now,
    ).first<{ candidate_id: string }>();
    if (assignment) {
      const stickyCandidate = artifact.candidates.find(
        (candidate) => candidate.candidate_id === assignment.candidate_id && candidate.eligible,
      );
      if (stickyCandidate) selected = stickyCandidate;
    } else {
      await db.prepare(
        `INSERT INTO session_assignments (
          id, organization_id, policy_version_id, session_hash,
          candidate_id, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(policy_version_id, session_hash)
        DO UPDATE SET candidate_id = excluded.candidate_id,
                      created_at = excluded.created_at,
                      expires_at = excluded.expires_at`,
      ).bind(
        `ses_${crypto.randomUUID().replaceAll("-", "")}`,
        organization.id,
        policy.policy_version_id,
        sessionHash,
        selected.candidate_id,
        now,
        assignmentExpiresAt,
      ).run();
    }
  }

  const certification = await db.prepare(
    `SELECT id, manifest_hash, valid_until FROM certifications
     WHERE organization_id = ? AND policy_version_id = ?
       AND candidate_id = ? AND status = 'certified' AND valid_until > ?
     ORDER BY created_at DESC LIMIT 1`,
  ).bind(
    organization.id,
    policy.policy_version_id,
    selected.candidate_id,
    now,
  ).first<{ id: string; manifest_hash: string; valid_until: number }>();
  if (!certification) {
    return errorResponse(
      409,
      requestIdentifier,
      "certification_required",
      "Certify the selected candidate before publishing this private route.",
    );
  }

  const routeId = `rt_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
  const concreteFallbacks = artifact.candidates
    .filter(
      (candidate) =>
        candidate.eligible &&
        candidate.candidate_type === "concrete_model" &&
        candidate.candidate_id !== selected?.candidate_id,
    )
    .slice(0, 2)
    .map((candidate) => candidate.candidate_id);
  const isExternalRouter = selected.candidate_type === "external_router";
  const response = {
    route_id: routeId,
    route_type: isExternalRouter ? "certified_external_router" : "concrete_model",
    model: isExternalRouter ? null : selected.candidate_id,
    external_router: isExternalRouter ? selected.candidate_id : null,
    fallbacks: isExternalRouter ? [] : concreteFallbacks,
    execution_target: "openrouter",
    provider: {
      sort: "latency",
      allow_fallbacks: true,
      require_parameters: true,
      data_collection: "deny",
      zdr: true,
    },
    selection_scope: sessionId ? "session" : "request",
    session_assignment_expires_at: sessionId
      ? new Date(assignmentExpiresAt).toISOString()
      : null,
    reasons: isExternalRouter
      ? [
          "Frontier certified this router.",
          "Concrete model selection is delegated to the external router.",
        ]
      : [
          "Clears the held-out private quality gate and declared policy constraints.",
          `Selected by ${artifact.objective.replaceAll("_", " ")} from the eligible conditional Pareto set.`,
        ],
    binding_constraints: [
      `Conservative quality ≥ ${(artifact.quality_floor * 100).toFixed(1)}%`,
      `Private cases ≥ ${artifact.minimum_cases}`,
      artifact.maximum_cost == null ? null : `Mean cost ≤ $${artifact.maximum_cost}`,
      artifact.maximum_p95_latency_ms == null
        ? null
        : `P95 latency ≤ ${artifact.maximum_p95_latency_ms} ms`,
    ].filter(Boolean),
    quality: {
      posterior_mean: selected.posterior_mean,
      lower_bound: selected.quality_lower_bound,
      confidence: artifact.confidence,
      private_cases: selected.case_count,
      evidence_mode: "private_aggregate",
    },
    public_evidence: {
      fit: null,
      benchmark_count: null,
    },
    cost: {
      estimated_usd: selected.average_cost_per_case,
      expected_cost_per_success_usd: selected.expected_cost_per_success,
      assumptions: ["Held-out aggregate benchmark average"],
    },
    latency: {
      p50_ms: selected.p50_latency_ms,
      p95_ms: selected.p95_latency_ms,
      source: selected.p95_latency_ms == null ? null : "Held-out aggregate benchmark",
    },
    policy_version: `${policy.stable_slug}.${policy.version}`,
    policy_version_id: policy.policy_version_id,
    evidence_version: policy.evidence_version,
    router_engine_version: "0.2.0",
    certification_id: certification.id,
    expires_at: new Date(expiresAt).toISOString(),
    candidates: artifact.candidates,
    privacy: {
      prompt_captured: false,
      output_captured: false,
      code_captured: false,
      diff_captured: false,
      credentials_captured: false,
    },
  };
  const manifestHash = sourceHash(response);
  await persistReceipt(db, {
    routeId,
    request: body,
    candidates: artifact.candidates,
    selectedCandidate: selected.candidate_id,
    organizationId: organization.id,
    policyVersion: response.policy_version,
    evidenceVersion: String(policy.evidence_version),
    engineVersion: response.router_engine_version,
    manifestHash,
    createdAt: now,
    expiresAt,
  });
  return Response.json(
    { ...response, manifest_hash: manifestHash, receipt_persisted: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function requestId() {
  return `req_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

function errorResponse(
  status: number,
  id: string,
  errorCode: string,
  message: string,
  fieldErrors?: Record<string, string>,
) {
  return Response.json(
    {
      request_id: id,
      error_code: errorCode,
      message,
      field_errors: fieldErrors ?? null,
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const id = requestId();
  let body: PublicRouteRequest & Record<string, unknown>;
  try {
    body = (await request.json()) as PublicRouteRequest;
  } catch {
    return errorResponse(400, id, "invalid_json", "Request body must be valid JSON.");
  }

  const rawField = containsRawInput(body);
  if (rawField) {
    return errorResponse(
      422,
      id,
      "raw_input_rejected",
      "Frontier accepts structured request metadata only.",
      { [rawField]: "Raw prompts, outputs, code, and documents are not accepted." },
    );
  }
  if (typeof body.policy === "string" && body.policy.trim()) {
    return privatePolicyRoute(body, id);
  }
  if (!body.profile || !body.objective || !body.features) {
    return errorResponse(
      422,
      id,
      "missing_fields",
      "Profile, objective, and features are required.",
    );
  }

  try {
    const env = await runtimeEnv();
    const registry = await getOpenRouterModels(env);
    const decision = routePublicModels(registry.data.data, body);
    if (!decision.selected) {
      return errorResponse(
        409,
        id,
        "no_eligible_candidate",
        "No concrete model clears the declared evidence and capability gates.",
      );
    }

    const routeId = `rt_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
    const createdAt = Date.now();
    const expiresAt = createdAt + 60 * 60 * 1000;
    const evidenceVersion = createHash("sha256")
      .update(`${registry.fetchedAt}:${decision.candidates.length}`)
      .digest("hex");
    const manifest = {
      route_id: routeId,
      route_type: "concrete_model",
      model: decision.selected.id,
      fallbacks: decision.fallbacks,
      execution_target: "openrouter",
      provider: {
        sort: "latency",
        allow_fallbacks: true,
        require_parameters: true,
        data_collection: "deny",
        zdr: true,
      },
      selection_scope: "request",
      reasons: [
        `Clears the declared capability, context, cost, and ${decision.signal.label} gates.`,
        `Selected from the ${decision.candidates.filter((candidate) => candidate.pareto).length}-candidate conditional Pareto set.`,
      ],
      binding_constraints: [
        body.minimum_public_score != null
          ? `${decision.signal.label} ≥ ${body.minimum_public_score}`
          : null,
        body.maximum_estimated_cost_usd != null
          ? `Estimated request cost ≤ $${body.maximum_estimated_cost_usd}`
          : null,
        `Context ≥ ${body.features.required_context_tokens.toLocaleString()} tokens`,
      ].filter(Boolean),
      quality: {
        posterior_mean: null,
        lower_bound: null,
        confidence: null,
        private_cases: 0,
        evidence_mode: "provisional_public_only",
      },
      public_evidence: {
        fit: decision.selected.quality,
        metric: decision.selected.qualityMetric,
        source: "OpenRouter model metadata / Artificial Analysis",
        benchmark_count: 1,
      },
      cost: {
        estimated_usd: decision.selected.estimatedCostUsd,
        expected_cost_per_success_usd: null,
        assumptions: [
          `${body.features.input_tokens_estimate.toLocaleString()} estimated input tokens`,
          `${body.features.output_tokens_estimate.toLocaleString()} estimated output tokens`,
          "Current OpenRouter list pricing",
        ],
      },
      policy_version: "public-demo.1",
      evidence_version: `sha256:${evidenceVersion}`,
      router_engine_version: "0.1.0",
      certification_id: null,
      expires_at: new Date(expiresAt).toISOString(),
      candidates: decision.candidates.slice(0, 40),
      privacy: {
        prompt_captured: false,
        output_captured: false,
        code_captured: false,
        diff_captured: false,
        credentials_captured: false,
      },
    };
    const manifestHash = createHash("sha256")
      .update(JSON.stringify(manifest))
      .digest("hex");
    const qualifiedManifestHash = `sha256:${manifestHash}`;

    let receiptPersisted = false;
    if (env.DB) {
      await persistReceipt(env.DB, {
        routeId,
        request: body,
        candidates: decision.candidates.slice(0, 40),
        selectedCandidate: decision.selected.id,
        policyVersion: manifest.policy_version,
        evidenceVersion: manifest.evidence_version,
        engineVersion: manifest.router_engine_version,
        manifestHash: qualifiedManifestHash,
        createdAt,
        expiresAt,
      });
      receiptPersisted = true;
    }

    return Response.json(
      {
        ...manifest,
        manifest_hash: qualifiedManifestHash,
        receipt_persisted: receiptPersisted,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(
      503,
      id,
      "source_unavailable",
      error instanceof Error
        ? error.message
        : "Public model evidence is temporarily unavailable.",
    );
  }
}
