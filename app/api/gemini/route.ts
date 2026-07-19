import policyManifest from "../../../packages/frontier-cli/manifest.json";
import {
  GEMINI_POLICY_MODEL,
  parseGeminiPolicyDecision,
} from "../../../lib/gemini-policy";

export const dynamic = "force-dynamic";

type GeminiRuntimeEnv = { GEMINI_API_KEY?: string };

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  modelVersion?: string;
  responseId?: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string };
};

type RateBucket = { count: number; resetAt: number };

const GEMINI_RATE_WINDOW_MS = 60_000;
const GEMINI_RATE_LIMIT = 8;
const geminiRateBuckets = new Map<string, RateBucket>();

function noStoreJson(body: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("cf-connecting-ip")?.trim() || forwarded || "unidentified-client";
}

function rateLimit(request: Request) {
  const now = Date.now();
  if (geminiRateBuckets.size > 2_000) {
    for (const [key, bucket] of geminiRateBuckets) {
      if (bucket.resetAt <= now) geminiRateBuckets.delete(key);
    }
    while (geminiRateBuckets.size > 2_000) {
      const oldest = geminiRateBuckets.keys().next().value as string | undefined;
      if (!oldest) break;
      geminiRateBuckets.delete(oldest);
    }
  }
  const key = clientKey(request);
  const current = geminiRateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    geminiRateBuckets.set(key, { count: 1, resetAt: now + GEMINI_RATE_WINDOW_MS });
    return null;
  }
  if (current.count >= GEMINI_RATE_LIMIT) {
    return Math.max(1, Math.ceil((current.resetAt - now) / 1_000));
  }
  current.count += 1;
  return null;
}

async function geminiApiKey() {
  const processKey = typeof process !== "undefined"
    ? process.env.GEMINI_API_KEY?.trim()
    : undefined;
  if (processKey) return processKey;
  try {
    const { env } = await import("cloudflare:workers");
    return (env as unknown as GeminiRuntimeEnv).GEMINI_API_KEY?.trim() || null;
  } catch {
    return null;
  }
}

function promptFor(task: string) {
  const profiles = policyManifest.profiles.map((profile) => ({
    id: profile.id,
    question: profile.question,
    objective: profile.objective,
    signal: profile.primary_signal,
    route: profile.openrouter_model,
    limitations: profile.limitations,
  }));
  return [
    "You are the semantic policy interpreter for Frontier Max.",
    "Classify one coding task into exactly one supplied workload profile.",
    "Choose code.interactive when a person is actively waiting and iteration speed matters.",
    "Choose code.delegated when the job can run in the background and inference price matters more than model throughput.",
    "Do not invent benchmark results, model names, prices, latency measurements, or routes.",
    "Return only one minified JSON object. Keep every string short. Do not use markdown.",
    "Explain the decision briefly using only the task and policy facts below. State uncertainty in the caveat.",
    `Task: ${task}`,
    `Allowed policies: ${JSON.stringify(profiles)}`,
  ].join("\n\n");
}

export async function POST(request: Request) {
  let task = "";
  try {
    const body = await request.json() as { task?: unknown };
    task = typeof body.task === "string" ? body.task.replace(/\s+/g, " ").trim() : "";
  } catch {
    return noStoreJson({ error: "Send a JSON body with a task description." }, 400);
  }

  if (task.length < 12 || task.length > 800) {
    return noStoreJson({ error: "Describe the task in 12–800 characters." }, 400);
  }

  const apiKey = await geminiApiKey();
  if (!apiKey) {
    return noStoreJson({
      error: "Gemini is not activated on this deployment yet.",
      action: "Add GEMINI_API_KEY from Google AI Studio to enable task interpretation.",
    }, 503);
  }

  const retryAfter = rateLimit(request);
  if (retryAfter !== null) {
    return noStoreJson(
      { error: "Gemini demo limit reached for this minute. Try again shortly." },
      429,
      { "Retry-After": String(retryAfter) },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_POLICY_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: promptFor(task) }] }],
          generationConfig: {
            maxOutputTokens: 1_200,
            responseFormat: {
              text: {
                mimeType: "APPLICATION_JSON",
                schema: {
                  type: "object",
                  properties: {
                    profile: { type: "string", enum: ["code.interactive", "code.delegated"] },
                    summary: { type: "string", description: "One sentence naming the operating regime." },
                    explanation: { type: "string", description: "A concise decision explanation, not hidden reasoning." },
                    confidence: { type: "string", enum: ["high", "medium", "low"] },
                    signals: {
                      type: "array",
                      minItems: 1,
                      maxItems: 3,
                      items: { type: "string" },
                    },
                    caveat: { type: "string", description: "The most important uncertainty or missing fact." },
                  },
                  required: ["profile", "summary", "explanation", "confidence", "signals", "caveat"],
                },
              },
            },
          },
        }),
        signal: AbortSignal.timeout(18_000),
      },
    );
  } catch {
    return noStoreJson({ error: "Gemini did not respond in time. Try again." }, 504);
  }

  const upstreamText = await upstream.text();
  let payload: GeminiResponse;
  try {
    payload = JSON.parse(upstreamText) as GeminiResponse;
  } catch {
    return noStoreJson({
      error: upstream.ok
        ? "Gemini returned a response Frontier Max could not read."
        : "Gemini could not interpret this task.",
      detail: `Upstream status ${upstream.status}`,
    }, 502);
  }
  if (!upstream.ok) {
    return noStoreJson({
      error: "Gemini could not interpret this task.",
      detail: (payload.error?.message || `Upstream status ${upstream.status}`).slice(0, 240),
    }, 502);
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!text) return noStoreJson({ error: "Gemini returned no policy decision." }, 502);

  try {
    const decision = parseGeminiPolicyDecision(JSON.parse(text));
    const profile = policyManifest.profiles.find((candidate) => candidate.id === decision.profile)!;
    return noStoreJson({
      decision,
      policy: {
        label: profile.label,
        objective: profile.objective,
        route: profile.openrouter_model,
        manifestVersion: policyManifest.version,
      },
      provenance: {
        provider: "Google",
        requestedModel: GEMINI_POLICY_MODEL,
        modelVersion: payload.modelVersion || null,
        responseId: payload.responseId || null,
        usage: payload.usageMetadata || null,
      },
    });
  } catch {
    return noStoreJson({ error: "Gemini returned a decision that failed Frontier Max validation." }, 502);
  }
}
