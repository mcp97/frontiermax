import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  GEMINI_POLICY_MODEL,
  parseGeminiPolicyDecision,
} from "../lib/gemini-policy.ts";

test("pins the hackathon interpreter to a Gemini model", () => {
  assert.match(GEMINI_POLICY_MODEL, /^gemini-/);
});

test("accepts and bounds a structured Gemini policy decision", () => {
  const decision = parseGeminiPolicyDecision({
    profile: "code.interactive",
    summary: "  A human is waiting for rapid iteration.  ",
    explanation: "Use the interactive policy because feedback-loop speed is the binding resource.",
    confidence: "high",
    signals: ["human waiting", "rapid iteration"],
    caveat: "No explicit deadline was supplied.",
  });

  assert.equal(decision.profile, "code.interactive");
  assert.equal(decision.summary, "A human is waiting for rapid iteration.");
  assert.deepEqual(decision.signals, ["human waiting", "rapid iteration"]);
});

test("rejects unsupported routes instead of trusting model output", () => {
  assert.throws(() => parseGeminiPolicyDecision({
    profile: "arbitrary.expensive-model",
    summary: "Use an unsupported route.",
    explanation: "This should never pass validation.",
    confidence: "high",
    signals: ["unsupported"],
    caveat: "None.",
  }), /unsupported workload profile/i);
});

test("uses the generateContent response format enum for JSON output", () => {
  const routeSource = readFileSync(new URL("../app/api/gemini/route.ts", import.meta.url), "utf8");
  assert.match(routeSource, /maxOutputTokens:\s*1_200/);
  assert.match(routeSource, /mimeType:\s*"APPLICATION_JSON"/);
  assert.match(routeSource, /Return only one minified JSON object/);
  assert.doesNotMatch(routeSource, /mimeType:\s*"application\/json"/);
});
