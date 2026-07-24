export class FrontierClient {
  constructor({ baseUrl, apiKey, fetchImpl = fetch, cache = null }) {
    if (!baseUrl) throw new Error("baseUrl is required");
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.cache = cache;
  }

  async request(path, init = {}) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        ...init.headers,
      },
    });
    const body = await response.json();
    if (!response.ok) {
      const error = new Error(body.message ?? `Frontier request failed: ${response.status}`);
      error.code = body.error_code;
      error.requestId = body.request_id;
      throw error;
    }
    return body;
  }

  async route(metadata) {
    assertMetadataOnly(metadata);
    const cacheKey = metadata.session_id
      ? `route:${metadata.policy}:${metadata.session_id}`
      : null;
    if (cacheKey && this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached && Date.parse(cached.expires_at) > Date.now()) return cached;
    }
    const route = await this.request("/api/v1/route", {
      method: "POST",
      body: JSON.stringify(metadata),
    });
    if (cacheKey && this.cache) await this.cache.set(cacheKey, route);
    return route;
  }

  getManifest(policySlug) {
    return this.request(`/api/v1/manifests/${encodeURIComponent(policySlug)}/current`);
  }

  reportOutcome(outcome) {
    assertMetadataOnly(outcome);
    return this.request("/api/v1/outcomes", {
      method: "POST",
      body: JSON.stringify(outcome),
    });
  }
}

const RAW_FIELDS = new Set([
  "prompt",
  "messages",
  "raw_input",
  "document",
  "code",
  "content",
  "output",
  "response",
]);

export function assertMetadataOnly(value) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (RAW_FIELDS.has(key)) {
      throw new Error(`Frontier metadata cannot contain ${key}`);
    }
    assertMetadataOnly(child);
  }
}

export function compileOpenRouterRequest(decision, inferenceRequest) {
  if (!decision || !inferenceRequest) throw new Error("decision and inferenceRequest are required");
  if (decision.route_type === "certified_external_router") {
    return {
      ...inferenceRequest,
      model: decision.external_router,
      provider: decision.provider,
    };
  }
  if (!decision.model) throw new Error("Concrete Frontier route has no model");
  return {
    ...inferenceRequest,
    model: [decision.model, ...(decision.fallbacks ?? [])],
    provider: decision.provider,
  };
}

export class MemoryRouteCache {
  constructor() {
    this.values = new Map();
  }
  async get(key) {
    return this.values.get(key) ?? null;
  }
  async set(key, value) {
    this.values.set(key, value);
  }
}
