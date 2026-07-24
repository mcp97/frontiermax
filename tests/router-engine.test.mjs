import assert from "node:assert/strict";
import test from "node:test";

import { routePublicModels } from "../lib/router-engine.ts";

function model(id, quality, prompt, completion, overrides = {}) {
  return {
    id,
    name: id,
    context_length: 128_000,
    architecture: {
      input_modalities: ["text"],
      output_modalities: ["text"],
    },
    pricing: { prompt: String(prompt), completion: String(completion) },
    supported_parameters: ["tools", "structured_outputs"],
    benchmarks: {
      artificial_analysis: {
        coding_index: quality,
        intelligence_index: quality,
        agentic_index: quality,
      },
    },
    ...overrides,
  };
}

const request = {
  profile: "code.text",
  objective: "balanced",
  minimum_public_score: 50,
  maximum_estimated_cost_usd: 1,
  features: {
    input_tokens_estimate: 1_000,
    output_tokens_estimate: 1_000,
    input_modalities: ["text"],
    output_modalities: ["text"],
    requires_tools: true,
    requires_structured_output: false,
    required_context_tokens: 8_000,
    complexity_hint: "medium",
    risk_class: "standard",
  },
};

test("hard quality gates run before optimization", () => {
  const decision = routePublicModels(
    [
      model("provider/cheap", 40, 0.0000001, 0.0000001),
      model("provider/qualified", 60, 0.000001, 0.000001),
    ],
    request,
  );
  assert.equal(decision.selected?.id, "provider/qualified");
  assert.deepEqual(
    decision.candidates.find((entry) => entry.id === "provider/cheap")
      ?.rejectionReasons,
    ["Public quality floor not met"],
  );
});

test("missing quality is missing, never zero", () => {
  const candidate = model("provider/unmeasured", 60, 0.000001, 0.000001);
  candidate.benchmarks = {};
  const decision = routePublicModels([candidate], request);
  assert.equal(decision.selected, null);
  assert.match(
    decision.candidates[0].rejectionReasons.join(" "),
    /not measured/i,
  );
});

test("generic external routers are not treated as concrete models", () => {
  const decision = routePublicModels(
    [
      model("openrouter/auto-beta", 99, 0, 0),
      model("provider/concrete", 70, 0.000001, 0.000001),
    ],
    request,
  );
  assert.equal(decision.selected?.id, "provider/concrete");
  assert.equal(
    decision.candidates.some((entry) => entry.id === "openrouter/auto-beta"),
    false,
  );
});

test("the Pareto set removes dominated candidates", () => {
  const decision = routePublicModels(
    [
      model("provider/frontier", 80, 0.000001, 0.000001),
      model("provider/dominated", 70, 0.000002, 0.000002),
      model("provider/cheap", 60, 0.0000002, 0.0000002),
    ],
    request,
  );
  assert.equal(
    decision.candidates.find((entry) => entry.id === "provider/dominated")
      ?.pareto,
    false,
  );
  assert.equal(
    decision.candidates.find((entry) => entry.id === "provider/frontier")
      ?.pareto,
    true,
  );
});
