import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../app/api/v1/route/route.ts";

function routeRequest(body) {
  return new Request("https://frontier.test/api/v1/route", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validMetadata = {
  profile: "code.text",
  objective: "balanced",
  features: {
    input_tokens_estimate: 8000,
    output_tokens_estimate: 2000,
    input_modalities: ["text"],
    output_modalities: ["text"],
    requires_tools: true,
    requires_structured_output: false,
    required_context_tokens: 16000,
    complexity_hint: "medium",
    risk_class: "standard",
  },
};

for (const field of [
  "prompt",
  "messages",
  "raw_input",
  "document",
  "code",
  "content",
  "output",
  "response",
]) {
  test(`rejects raw inference field: ${field}`, async () => {
    const response = await POST(
      routeRequest({ ...validMetadata, metadata: { [field]: "sensitive" } }),
    );
    const body = await response.json();

    assert.equal(response.status, 422);
    assert.equal(body.error_code, "raw_input_rejected");
    assert.equal(body.field_errors[field], "Raw prompts, outputs, code, and documents are not accepted.");
  });
}

test("returns the documented error envelope for invalid JSON", async () => {
  const response = await POST(
    new Request("https://frontier.test/api/v1/route", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.request_id, /^req_/);
  assert.equal(body.error_code, "invalid_json");
  assert.equal(body.field_errors, null);
});
