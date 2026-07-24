import { createHash } from "node:crypto";

export const CANDIDATE_TYPES = [
  "concrete_model",
  "external_router",
  "static_policy",
  "cascade",
] as const;

export type CandidateType = (typeof CANDIDATE_TYPES)[number];

export type AggregateEvalRow = {
  candidate_type: CandidateType;
  candidate_id: string;
  case_count: number;
  successes: number;
  failures: number;
  mean_rubric_score?: number | null;
  average_cost_per_case?: number | null;
  p50_latency_ms?: number | null;
  p95_latency_ms?: number | null;
  input_token_average?: number | null;
  output_token_average?: number | null;
};

export type EvalImport = {
  workload_key: string;
  name: string;
  version: number;
  designation: "held_out" | "development";
  outcome_definition: string;
  grader_version: string;
  scaffold_version: string;
  evaluated_at: string;
  notes?: string;
  rows: AggregateEvalRow[];
};

export type ComparedCandidate = AggregateEvalRow & {
  posterior_mean: number;
  quality_lower_bound: number;
  expected_cost_per_success: number | null;
  eligible: boolean;
  rejection_reasons: string[];
  pareto: boolean;
};

export type PolicyInput = {
  name: string;
  stable_slug: string;
  workload_key: string;
  eval_set_id: string;
  objective:
    | "minimize_estimated_cost"
    | "minimize_expected_cost_per_success"
    | "minimize_p95_latency"
    | "maximize_quality_lower_bound";
  quality_floor: number;
  confidence: number;
  minimum_cases: number;
  maximum_cost?: number | null;
  maximum_p95_latency_ms?: number | null;
};

export type CompiledArtifact = {
  schema_version: "frontier-policy-artifact.1";
  policy_slug: string;
  policy_version: number;
  workload_key: string;
  eval_set_id: string;
  objective: PolicyInput["objective"];
  evidence_mode: "private_aggregate";
  quality_floor: number;
  confidence: number;
  minimum_cases: number;
  maximum_cost: number | null;
  maximum_p95_latency_ms: number | null;
  candidates: ComparedCandidate[];
  selected: ComparedCandidate | null;
  fallbacks: string[];
  abstained: boolean;
  compiled_at: string;
};

export async function ensureControlPlaneTables(db: D1Database) {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS eval_sets (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        workload_key TEXT NOT NULL,
        name TEXT NOT NULL,
        version INTEGER NOT NULL,
        designation TEXT NOT NULL,
        outcome_definition TEXT NOT NULL,
        grader_version TEXT NOT NULL,
        scaffold_version TEXT NOT NULL,
        evaluated_at TEXT NOT NULL,
        notes TEXT,
        status TEXT NOT NULL,
        source_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE (organization_id, name, version)
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS eval_results (
        id TEXT PRIMARY KEY,
        eval_set_id TEXT NOT NULL,
        candidate_type TEXT NOT NULL,
        candidate_id TEXT NOT NULL,
        case_count INTEGER NOT NULL,
        successes INTEGER NOT NULL,
        failures INTEGER NOT NULL,
        mean_rubric_score REAL,
        average_cost REAL,
        p50_latency_ms REAL,
        p95_latency_ms REAL,
        input_token_average REAL,
        output_token_average REAL,
        evaluator_version TEXT NOT NULL,
        scaffold_version TEXT NOT NULL,
        evaluated_at TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE (eval_set_id, candidate_type, candidate_id)
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS policies (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        stable_slug TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE (organization_id, stable_slug)
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS policy_versions (
        id TEXT PRIMARY KEY,
        policy_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        workload_key TEXT NOT NULL,
        eval_set_id TEXT NOT NULL,
        objective TEXT NOT NULL,
        quality_floor REAL NOT NULL,
        confidence REAL NOT NULL,
        minimum_cases INTEGER NOT NULL,
        maximum_cost REAL,
        maximum_p95_latency_ms REAL,
        allow_public_only INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        artifact_json TEXT NOT NULL,
        evidence_version TEXT NOT NULL,
        manifest_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        published_at INTEGER NOT NULL,
        UNIQUE (policy_id, version)
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS certifications (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        policy_version_id TEXT NOT NULL,
        workload_key TEXT NOT NULL,
        candidate_type TEXT NOT NULL,
        candidate_id TEXT NOT NULL,
        eval_set_id TEXT NOT NULL,
        posterior_mean REAL NOT NULL,
        quality_lower_bound REAL NOT NULL,
        case_count INTEGER NOT NULL,
        average_cost REAL,
        p95_latency_ms REAL,
        status TEXT NOT NULL,
        manifest_hash TEXT NOT NULL,
        limitations TEXT NOT NULL,
        valid_from INTEGER NOT NULL,
        valid_until INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        revoked_at INTEGER,
        revocation_reason TEXT
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS execution_outcomes (
        id TEXT PRIMARY KEY,
        route_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        actual_model TEXT,
        actual_provider TEXT,
        generation_id TEXT,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        cached_tokens INTEGER,
        reasoning_tokens INTEGER,
        actual_cost REAL,
        time_to_first_token_ms REAL,
        total_latency_ms REAL,
        operational_error_type TEXT,
        application_outcome TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS session_assignments (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        policy_version_id TEXT NOT NULL,
        session_hash TEXT NOT NULL,
        candidate_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        UNIQUE (policy_version_id, session_hash)
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        prefix TEXT NOT NULL UNIQUE,
        salt TEXT NOT NULL,
        secret_hash TEXT NOT NULL,
        scopes_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_used_at INTEGER,
        revoked_at INTEGER
      )`,
    ),
  ]);
}

function finiteOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function validateEvalImport(value: unknown): {
  data: EvalImport | null;
  errors: string[];
} {
  const errors: string[] = [];
  if (!value || typeof value !== "object") {
    return { data: null, errors: ["Import must be a JSON object."] };
  }
  const input = value as Record<string, unknown>;
  const rows = Array.isArray(input.rows) ? input.rows : [];
  if (!String(input.workload_key ?? "").trim()) errors.push("workload_key is required.");
  if (!String(input.name ?? "").trim()) errors.push("name is required.");
  if (!Number.isInteger(Number(input.version)) || Number(input.version) < 1) {
    errors.push("version must be a positive integer.");
  }
  if (!["held_out", "development"].includes(String(input.designation))) {
    errors.push("designation must be held_out or development.");
  }
  if (!String(input.outcome_definition ?? "").trim()) {
    errors.push("outcome_definition is required.");
  }
  if (!String(input.grader_version ?? "").trim()) errors.push("grader_version is required.");
  if (!String(input.scaffold_version ?? "").trim()) errors.push("scaffold_version is required.");
  if (!String(input.evaluated_at ?? "").trim() || Number.isNaN(Date.parse(String(input.evaluated_at)))) {
    errors.push("evaluated_at must be an ISO-8601 date.");
  }
  if (!rows.length) errors.push("At least one aggregate result row is required.");

  const seen = new Set<string>();
  const normalizedRows: AggregateEvalRow[] = [];
  for (const [index, raw] of rows.entries()) {
    if (!raw || typeof raw !== "object") {
      errors.push(`rows[${index}] must be an object.`);
      continue;
    }
    const row = raw as Record<string, unknown>;
    const candidateType = String(row.candidate_type ?? "") as CandidateType;
    const candidateId = String(row.candidate_id ?? "").trim();
    const caseCount = Number(row.case_count);
    const successes = Number(row.successes);
    const failures = Number(row.failures);
    if (!CANDIDATE_TYPES.includes(candidateType)) {
      errors.push(`rows[${index}].candidate_type is unsupported.`);
    }
    if (!candidateId || candidateId.length > 200) {
      errors.push(`rows[${index}].candidate_id is required.`);
    }
    if (
      !Number.isInteger(caseCount) ||
      !Number.isInteger(successes) ||
      !Number.isInteger(failures) ||
      caseCount < 1 ||
      successes < 0 ||
      failures < 0 ||
      successes + failures !== caseCount
    ) {
      errors.push(`rows[${index}] counts must be nonnegative integers and successes + failures must equal case_count.`);
    }
    const key = `${candidateType}:${candidateId}`;
    if (seen.has(key)) errors.push(`rows[${index}] duplicates ${key}.`);
    seen.add(key);

    for (const field of [
      "mean_rubric_score",
      "average_cost_per_case",
      "p50_latency_ms",
      "p95_latency_ms",
      "input_token_average",
      "output_token_average",
    ]) {
      const number = finiteOrNull(row[field]);
      if (number != null && number < 0) errors.push(`rows[${index}].${field} cannot be negative.`);
    }
    const p50 = finiteOrNull(row.p50_latency_ms);
    const p95 = finiteOrNull(row.p95_latency_ms);
    if (p50 != null && p95 != null && p95 < p50) {
      errors.push(`rows[${index}].p95_latency_ms cannot be below p50_latency_ms.`);
    }
    normalizedRows.push({
      candidate_type: candidateType,
      candidate_id: candidateId,
      case_count: caseCount,
      successes,
      failures,
      mean_rubric_score: finiteOrNull(row.mean_rubric_score),
      average_cost_per_case: finiteOrNull(row.average_cost_per_case),
      p50_latency_ms: p50,
      p95_latency_ms: p95,
      input_token_average: finiteOrNull(row.input_token_average),
      output_token_average: finiteOrNull(row.output_token_average),
    });
  }

  if (errors.length) return { data: null, errors };
  return {
    data: {
      workload_key: String(input.workload_key).trim().slice(0, 100),
      name: String(input.name).trim().slice(0, 160),
      version: Number(input.version),
      designation: String(input.designation) as EvalImport["designation"],
      outcome_definition: String(input.outcome_definition).trim().slice(0, 500),
      grader_version: String(input.grader_version).trim().slice(0, 100),
      scaffold_version: String(input.scaffold_version).trim().slice(0, 100),
      evaluated_at: new Date(String(input.evaluated_at)).toISOString(),
      notes: String(input.notes ?? "").trim().slice(0, 1000),
      rows: normalizedRows,
    },
    errors: [],
  };
}

function logGamma(value: number): number {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];
  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  }
  let x = 0.9999999999998099;
  const z = value - 1;
  for (let i = 0; i < coefficients.length; i += 1) x += coefficients[i] / (z + i + 1);
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaContinuedFraction(a: number, b: number, x: number) {
  const maxIterations = 200;
  const epsilon = 3e-12;
  const tiny = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIterations; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }
  return h;
}

function regularizedBeta(x: number, a: number, b: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) +
      a * Math.log(x) + b * Math.log(1 - x),
  );
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betaContinuedFraction(a, b, x)) / a;
  }
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

export function betaLowerBound(
  successes: number,
  failures: number,
  confidence = 0.95,
) {
  const alpha = 1 + successes;
  const beta = 1 + failures;
  const target = 1 - confidence;
  let low = 0;
  let high = alpha / (alpha + beta);
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const middle = (low + high) / 2;
    if (regularizedBeta(middle, alpha, beta) < target) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

export function compareAggregateRows(
  rows: AggregateEvalRow[],
  policy: Pick<
    PolicyInput,
    "objective" | "quality_floor" | "confidence" | "minimum_cases" | "maximum_cost" | "maximum_p95_latency_ms"
  >,
) {
  const compared: ComparedCandidate[] = rows.map((row) => {
    const posteriorMean = (1 + row.successes) / (2 + row.successes + row.failures);
    const lowerBound = betaLowerBound(row.successes, row.failures, policy.confidence);
    const rejectionReasons: string[] = [];
    if (row.case_count < policy.minimum_cases) rejectionReasons.push("Minimum private case count not met");
    if (lowerBound < policy.quality_floor) rejectionReasons.push("Conservative quality floor not met");
    if (
      policy.maximum_cost != null &&
      (row.average_cost_per_case == null || row.average_cost_per_case > policy.maximum_cost)
    ) {
      rejectionReasons.push(row.average_cost_per_case == null ? "Cost not measured" : "Cost ceiling exceeded");
    }
    if (
      policy.maximum_p95_latency_ms != null &&
      (row.p95_latency_ms == null || row.p95_latency_ms > policy.maximum_p95_latency_ms)
    ) {
      rejectionReasons.push(row.p95_latency_ms == null ? "P95 latency not measured" : "P95 latency ceiling exceeded");
    }
    return {
      ...row,
      posterior_mean: posteriorMean,
      quality_lower_bound: lowerBound,
      expected_cost_per_success:
        row.average_cost_per_case == null ? null : row.average_cost_per_case / posteriorMean,
      eligible: rejectionReasons.length === 0,
      rejection_reasons: rejectionReasons,
      pareto: false,
    };
  });

  const eligible = compared.filter((candidate) => candidate.eligible);
  for (const candidate of eligible) {
    candidate.pareto = !eligible.some((other) => {
      if (other.candidate_id === candidate.candidate_id) return false;
      const otherCost = other.average_cost_per_case;
      const candidateCost = candidate.average_cost_per_case;
      if (otherCost == null || candidateCost == null) return false;
      return (
        other.quality_lower_bound >= candidate.quality_lower_bound &&
        otherCost <= candidateCost &&
        (other.quality_lower_bound > candidate.quality_lower_bound || otherCost < candidateCost)
      );
    });
  }

  const ranked = [...eligible].sort((a, b) => {
    let primary = 0;
    if (policy.objective === "maximize_quality_lower_bound") {
      primary = b.quality_lower_bound - a.quality_lower_bound;
    } else if (policy.objective === "minimize_p95_latency") {
      primary = (a.p95_latency_ms ?? Infinity) - (b.p95_latency_ms ?? Infinity);
    } else if (policy.objective === "minimize_expected_cost_per_success") {
      primary =
        (a.expected_cost_per_success ?? Infinity) -
        (b.expected_cost_per_success ?? Infinity);
    } else {
      primary =
        (a.average_cost_per_case ?? Infinity) -
        (b.average_cost_per_case ?? Infinity);
    }
    return (
      primary ||
      b.quality_lower_bound - a.quality_lower_bound ||
      b.case_count - a.case_count ||
      a.candidate_id.localeCompare(b.candidate_id)
    );
  });

  return {
    candidates: compared.sort(
      (a, b) =>
        Number(b.eligible) - Number(a.eligible) ||
        Number(b.pareto) - Number(a.pareto) ||
        b.quality_lower_bound - a.quality_lower_bound ||
        a.candidate_id.localeCompare(b.candidate_id),
    ),
    selected: ranked[0] ?? null,
    fallbacks: ranked.slice(1, 3).map((candidate) => candidate.candidate_id),
  };
}

export function sourceHash(value: unknown) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

export function compileArtifact(
  input: PolicyInput,
  version: number,
  rows: AggregateEvalRow[],
): CompiledArtifact {
  const comparison = compareAggregateRows(rows, input);
  return {
    schema_version: "frontier-policy-artifact.1",
    policy_slug: input.stable_slug,
    policy_version: version,
    workload_key: input.workload_key,
    eval_set_id: input.eval_set_id,
    objective: input.objective,
    evidence_mode: "private_aggregate",
    quality_floor: input.quality_floor,
    confidence: input.confidence,
    minimum_cases: input.minimum_cases,
    maximum_cost: input.maximum_cost ?? null,
    maximum_p95_latency_ms: input.maximum_p95_latency_ms ?? null,
    candidates: comparison.candidates,
    selected: comparison.selected,
    fallbacks: comparison.fallbacks,
    abstained: comparison.selected == null,
    compiled_at: new Date().toISOString(),
  };
}
