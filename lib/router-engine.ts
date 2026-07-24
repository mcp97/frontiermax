import type { OpenRouterModel } from "./public-evidence";

export type WorkloadProfile =
  | "chat.fast"
  | "reasoning.deep"
  | "research.synthesis"
  | "extraction.structured"
  | "long_context.analysis"
  | "code.text"
  | "tool_use"
  | "multimodal.understanding";

export type RouteFeatures = {
  input_tokens_estimate: number;
  output_tokens_estimate: number;
  input_modalities: string[];
  output_modalities: string[];
  requires_tools: boolean;
  requires_structured_output: boolean;
  required_context_tokens: number;
  complexity_hint: "low" | "medium" | "high";
  risk_class: "standard" | "sensitive" | "high";
};

export type PublicRouteRequest = {
  profile: WorkloadProfile;
  objective:
    | "minimize_estimated_cost"
    | "maximize_public_quality"
    | "balanced";
  minimum_public_score?: number | null;
  maximum_estimated_cost_usd?: number | null;
  features: RouteFeatures;
};

export type CandidateScore = {
  id: string;
  name: string;
  quality: number | null;
  qualityMetric: string;
  estimatedCostUsd: number | null;
  contextLength: number;
  eligible: boolean;
  rejectionReasons: string[];
  supportedParameters: string[];
  inputModalities: string[];
  outputModalities: string[];
  pareto: boolean;
};

const PROFILE_SIGNAL: Record<
  WorkloadProfile,
  { key: "coding_index" | "intelligence_index" | "agentic_index"; label: string }
> = {
  "chat.fast": { key: "intelligence_index", label: "AA Intelligence Index" },
  "reasoning.deep": {
    key: "intelligence_index",
    label: "AA Intelligence Index",
  },
  "research.synthesis": {
    key: "intelligence_index",
    label: "AA Intelligence Index",
  },
  "extraction.structured": {
    key: "intelligence_index",
    label: "AA Intelligence Index",
  },
  "long_context.analysis": {
    key: "intelligence_index",
    label: "AA Intelligence Index",
  },
  "code.text": { key: "coding_index", label: "AA Coding Index" },
  tool_use: { key: "agentic_index", label: "AA Agentic Index" },
  "multimodal.understanding": {
    key: "intelligence_index",
    label: "AA Intelligence Index",
  },
};

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isConcreteModel(model: OpenRouterModel) {
  if (!model.id || model.id.startsWith("openrouter/")) return false;
  const prompt = finiteNumber(model.pricing?.prompt);
  const completion = finiteNumber(model.pricing?.completion);
  return prompt != null && completion != null && prompt >= 0 && completion >= 0;
}

function estimateCost(model: OpenRouterModel, features: RouteFeatures) {
  const prompt = finiteNumber(model.pricing?.prompt);
  const completion = finiteNumber(model.pricing?.completion);
  if (prompt == null || completion == null || prompt < 0 || completion < 0) {
    return null;
  }
  return (
    prompt * features.input_tokens_estimate +
    completion * features.output_tokens_estimate
  );
}

function dominates(a: CandidateScore, b: CandidateScore) {
  if (
    !a.eligible ||
    !b.eligible ||
    a.quality == null ||
    b.quality == null ||
    a.estimatedCostUsd == null ||
    b.estimatedCostUsd == null
  ) {
    return false;
  }
  return (
    a.quality >= b.quality &&
    a.estimatedCostUsd <= b.estimatedCostUsd &&
    (a.quality > b.quality || a.estimatedCostUsd < b.estimatedCostUsd)
  );
}

export function routePublicModels(
  models: OpenRouterModel[],
  request: PublicRouteRequest,
) {
  const signal = PROFILE_SIGNAL[request.profile];
  const candidates: CandidateScore[] = models
    .filter(isConcreteModel)
    .map((model) => {
      const inputModalities = model.architecture?.input_modalities ?? ["text"];
      const outputModalities = model.architecture?.output_modalities ?? ["text"];
      const supportedParameters = model.supported_parameters ?? [];
      const contextLength =
        model.top_provider?.context_length ??
        model.context_length ??
        0;
      const quality =
        finiteNumber(
          model.benchmarks?.artificial_analysis?.[signal.key],
        );
      const estimatedCostUsd = estimateCost(model, request.features);
      const rejectionReasons: string[] = [];

      if (contextLength < request.features.required_context_tokens) {
        rejectionReasons.push("Context requirement not met");
      }
      for (const modality of request.features.input_modalities) {
        if (!inputModalities.includes(modality)) {
          rejectionReasons.push(`Missing ${modality} input`);
        }
      }
      for (const modality of request.features.output_modalities) {
        if (!outputModalities.includes(modality)) {
          rejectionReasons.push(`Missing ${modality} output`);
        }
      }
      if (
        request.features.requires_tools &&
        !supportedParameters.includes("tools")
      ) {
        rejectionReasons.push("Tool use not supported");
      }
      if (
        request.features.requires_structured_output &&
        !supportedParameters.some((parameter) =>
          ["structured_outputs", "response_format"].includes(parameter),
        )
      ) {
        rejectionReasons.push("Structured output not supported");
      }
      if (quality == null) {
        rejectionReasons.push(`${signal.label} not measured`);
      }
      if (
        quality != null &&
        request.minimum_public_score != null &&
        quality < request.minimum_public_score
      ) {
        rejectionReasons.push("Public quality floor not met");
      }
      if (
        estimatedCostUsd != null &&
        request.maximum_estimated_cost_usd != null &&
        estimatedCostUsd > request.maximum_estimated_cost_usd
      ) {
        rejectionReasons.push("Cost ceiling exceeded");
      }

      return {
        id: model.id,
        name: model.name,
        quality,
        qualityMetric: signal.label,
        estimatedCostUsd,
        contextLength,
        eligible: rejectionReasons.length === 0,
        rejectionReasons,
        supportedParameters,
        inputModalities,
        outputModalities,
        pareto: false,
      };
    });

  const eligible = candidates.filter((candidate) => candidate.eligible);
  for (const candidate of eligible) {
    candidate.pareto = !eligible.some(
      (other) => other.id !== candidate.id && dominates(other, candidate),
    );
  }

  const frontier = eligible.filter((candidate) => candidate.pareto);
  frontier.sort((a, b) => {
    if (request.objective === "maximize_public_quality") {
      return (
        (b.quality ?? -Infinity) - (a.quality ?? -Infinity) ||
        (a.estimatedCostUsd ?? Infinity) -
          (b.estimatedCostUsd ?? Infinity) ||
        a.id.localeCompare(b.id)
      );
    }
    if (request.objective === "minimize_estimated_cost") {
      return (
        (a.estimatedCostUsd ?? Infinity) -
          (b.estimatedCostUsd ?? Infinity) ||
        (b.quality ?? -Infinity) - (a.quality ?? -Infinity) ||
        a.id.localeCompare(b.id)
      );
    }
    const maxQuality = Math.max(...frontier.map((entry) => entry.quality ?? 0), 1);
    const maxCost = Math.max(
      ...frontier.map((entry) => entry.estimatedCostUsd ?? 0),
      0.000001,
    );
    const utility = (candidate: CandidateScore) =>
      (candidate.quality ?? 0) / maxQuality -
      (candidate.estimatedCostUsd ?? maxCost) / maxCost;
    return utility(b) - utility(a) || a.id.localeCompare(b.id);
  });

  const selected = frontier[0] ?? null;
  const fallbacks = frontier
    .filter((candidate) => candidate.id !== selected?.id)
    .slice(0, 2)
    .map((candidate) => candidate.id);

  return {
    selected,
    fallbacks,
    candidates: candidates.sort(
      (a, b) =>
        Number(b.eligible) - Number(a.eligible) ||
        Number(b.pareto) - Number(a.pareto) ||
        (b.quality ?? -Infinity) - (a.quality ?? -Infinity) ||
        a.id.localeCompare(b.id),
    ),
    signal,
  };
}
