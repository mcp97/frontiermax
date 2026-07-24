import assert from "node:assert/strict";
import test from "node:test";
import {
  FrontierClient,
  MemoryRouteCache,
  assertMetadataOnly,
  compileOpenRouterRequest,
} from "../src/index.mjs";

test("rejects raw inference content before a network request", async () => {
  const client = new FrontierClient({
    baseUrl: "https://frontier.test",
    fetchImpl() {
      throw new Error("network must not run");
    },
  });
  await assert.rejects(
    () => client.route({ policy: "coding-prod", messages: [{ role: "user", content: "secret" }] }),
    /messages/,
  );
});

test("compiles concrete Frontier decisions into OpenRouter model fallback arrays", () => {
  const request = compileOpenRouterRequest(
    {
      route_type: "concrete_model",
      model: "provider/model-a",
      fallbacks: ["provider/model-b"],
      provider: { data_collection: "deny", zdr: true },
    },
    { messages: [{ role: "user", content: "stays local" }] },
  );
  assert.deepEqual(request.model, ["provider/model-a", "provider/model-b"]);
  assert.equal(request.messages[0].content, "stays local");
  assert.equal(request.provider.zdr, true);
});

test("compiles an explicitly certified external router without disguising it", () => {
  const request = compileOpenRouterRequest(
    {
      route_type: "certified_external_router",
      external_router: "openrouter/auto-beta",
      provider: { data_collection: "deny" },
    },
    { messages: [] },
  );
  assert.equal(request.model, "openrouter/auto-beta");
});

test("provides a pluggable memory cache", async () => {
  const cache = new MemoryRouteCache();
  await cache.set("route:test", { route_id: "rt_1" });
  assert.deepEqual(await cache.get("route:test"), { route_id: "rt_1" });
});

test("metadata validator allows structured routing features", () => {
  assert.doesNotThrow(() =>
    assertMetadataOnly({
      policy: "coding-prod",
      features: { input_tokens_estimate: 8000, requires_tools: true },
    }),
  );
});
