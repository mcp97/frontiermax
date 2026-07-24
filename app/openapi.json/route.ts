export const dynamic = "force-static";

const document = {
  openapi: "3.1.0",
  info: {
    title: "Frontier Max API",
    version: "0.1.0",
    description:
      "Structured-metadata model routing. Raw prompts, outputs, code, documents, and provider credentials are not accepted.",
  },
  servers: [{ url: "https://agent-frontier.alignedai.chatgpt.site" }],
  paths: {
    "/api/health": {
      get: {
        summary: "Read non-sensitive service health",
        responses: {
          "200": { description: "Service is ready or operating in a degraded mode" },
          "503": { description: "Service is unavailable" },
        },
      },
    },
    "/api/v1/models": {
      get: {
        summary: "List current concrete OpenRouter model evidence",
        responses: {
          "200": { description: "Model registry snapshot" },
          "503": { description: "Upstream and cached evidence unavailable" },
        },
      },
    },
    "/api/benchmarks": {
      get: {
        summary: "Search the public BenchmarkList catalog",
        responses: {
          "200": { description: "Paginated benchmark records" },
          "503": { description: "Upstream and cached evidence unavailable" },
        },
      },
    },
    "/api/benchmarks/{slug}": {
      get: {
        summary: "Read one benchmark evidence snapshot",
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Benchmark evidence with provenance" },
          "404": { description: "Benchmark not found" },
        },
      },
    },
    "/api/v1/route": {
      post: {
        summary: "Return a provisional public route or certified private-policy route",
        security: [{}, { frontierApiKey: [] }],
        description:
          "Accepts structured workload metadata only. Private policy routes require a scoped API key and active certification. The caller executes the returned concrete model, fallbacks, or certified external router through OpenRouter.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RouteRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Concrete route plan and receipt hash",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RouteResponse" },
              },
            },
          },
          "409": { description: "No candidate clears the declared gates" },
          "422": { description: "Invalid metadata or raw-input field rejected" },
          "503": { description: "Public evidence unavailable" },
        },
      },
    },
    "/api/v1/evals/import": {
      post: {
        summary: "Preview or commit aggregate private benchmark results",
        security: [{ frontierApiKey: [] }],
        responses: {
          "200": { description: "Validated preview" },
          "201": { description: "Locked private benchmark version" },
          "422": { description: "Row-level validation errors" }
        }
      }
    },
    "/api/v1/policies": {
      get: { summary: "List published organization policies", security: [{ frontierApiKey: [] }], responses: { "200": { description: "Published policies" } } },
      post: { summary: "Compile and publish an immutable policy version", security: [{ frontierApiKey: [] }], responses: { "201": { description: "Published policy" }, "409": { description: "No candidate clears the gates" } } }
    },
    "/api/v1/manifests/{slug}/current": {
      get: {
        summary: "Read the current compiled policy artifact",
        security: [{ frontierApiKey: [] }],
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Compiled policy artifact" }, "404": { description: "Policy not found" } }
      }
    },
    "/api/v1/certifications": {
      get: { summary: "List certifications", security: [{ frontierApiKey: [] }], responses: { "200": { description: "Certification ledger" } } },
      post: { summary: "Certify the selected policy candidate", security: [{ frontierApiKey: [] }], responses: { "201": { description: "Certification created" }, "409": { description: "Certification gate failed" } } }
    },
    "/api/v1/receipts": {
      get: { summary: "List content-free route receipts", security: [{ frontierApiKey: [] }], responses: { "200": { description: "Route receipts" } } }
    },
    "/api/v1/outcomes": {
      post: { summary: "Append metadata-only execution outcome", security: [{ frontierApiKey: [] }], responses: { "201": { description: "Outcome recorded" }, "422": { description: "Raw inference content rejected" } } }
    },
    "/api/leads": {
      post: {
        summary: "Request a routing audit",
        responses: {
          "201": { description: "Request stored" },
          "422": { description: "Required fields or consent missing" },
          "503": { description: "Lead storage unavailable" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      frontierApiKey: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "fmx_...",
      },
    },
    schemas: {
      RouteRequest: {
        oneOf: [
          { $ref: "#/components/schemas/PublicRouteRequest" },
          { $ref: "#/components/schemas/PrivateRouteRequest" },
        ],
      },
      PrivateRouteRequest: {
        type: "object",
        required: ["policy", "features"],
        properties: {
          policy: { type: "string" },
          session_id: { type: ["string", "null"] },
          features: {
            $ref: "#/components/schemas/PublicRouteRequest/properties/features",
          },
        },
        additionalProperties: false,
      },
      PublicRouteRequest: {
        type: "object",
        required: ["profile", "objective", "features"],
        properties: {
          profile: {
            type: "string",
            enum: [
              "chat.fast",
              "reasoning.deep",
              "research.synthesis",
              "extraction.structured",
              "long_context.analysis",
              "code.text",
              "tool_use",
              "multimodal.understanding",
            ],
          },
          objective: {
            type: "string",
            enum: [
              "minimize_estimated_cost",
              "maximize_public_quality",
              "balanced",
            ],
          },
          minimum_public_score: { type: ["number", "null"] },
          maximum_estimated_cost_usd: { type: ["number", "null"] },
          features: {
            type: "object",
            required: [
              "input_tokens_estimate",
              "output_tokens_estimate",
              "input_modalities",
              "output_modalities",
              "requires_tools",
              "requires_structured_output",
              "required_context_tokens",
              "complexity_hint",
              "risk_class",
            ],
            properties: {
              input_tokens_estimate: { type: "integer", minimum: 1 },
              output_tokens_estimate: { type: "integer", minimum: 1 },
              input_modalities: {
                type: "array",
                items: { type: "string" },
              },
              output_modalities: {
                type: "array",
                items: { type: "string" },
              },
              requires_tools: { type: "boolean" },
              requires_structured_output: { type: "boolean" },
              required_context_tokens: { type: "integer", minimum: 1 },
              complexity_hint: {
                type: "string",
                enum: ["low", "medium", "high"],
              },
              risk_class: {
                type: "string",
                enum: ["standard", "sensitive", "high"],
              },
            },
          },
        },
        additionalProperties: false,
      },
      RouteResponse: {
        type: "object",
        required: [
          "route_id",
          "route_type",
          "model",
          "fallbacks",
          "policy_version",
          "evidence_version",
          "router_engine_version",
          "manifest_hash",
          "expires_at",
        ],
        properties: {
          route_id: { type: "string" },
          route_type: {
            type: "string",
            enum: ["concrete_model", "certified_external_router"],
          },
          model: { type: ["string", "null"] },
          external_router: { type: ["string", "null"] },
          fallbacks: { type: "array", items: { type: "string" } },
          policy_version: { type: "string" },
          evidence_version: { type: "string" },
          router_engine_version: { type: "string" },
          manifest_hash: { type: "string" },
          expires_at: { type: "string", format: "date-time" },
          receipt_persisted: { type: "boolean" },
        },
      },
    },
  },
} as const;

export function GET() {
  return Response.json(document, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
