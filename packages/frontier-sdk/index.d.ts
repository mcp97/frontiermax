export type FrontierRouteMetadata = {
  policy: string;
  session_id?: string | null;
  features: {
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
};

export interface RouteCache {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
}

export declare class FrontierClient {
  constructor(options: {
    baseUrl: string;
    apiKey?: string;
    fetchImpl?: typeof fetch;
    cache?: RouteCache | null;
  });
  route(metadata: FrontierRouteMetadata): Promise<any>;
  getManifest(policySlug: string): Promise<any>;
  reportOutcome(outcome: Record<string, unknown>): Promise<any>;
}

export declare function assertMetadataOnly(value: unknown): void;
export declare function compileOpenRouterRequest(
  decision: Record<string, any>,
  inferenceRequest: Record<string, any>,
): Record<string, any>;
export declare class MemoryRouteCache implements RouteCache {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
}
