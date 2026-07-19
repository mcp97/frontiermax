export const GEMINI_POLICY_MODEL = "gemini-3.5-flash";

export const GEMINI_PROFILE_IDS = [
  "code.interactive",
  "code.delegated",
] as const;

export type GeminiProfileId = (typeof GEMINI_PROFILE_IDS)[number];
export type GeminiConfidence = "high" | "medium" | "low";

export type GeminiPolicyDecision = {
  profile: GeminiProfileId;
  summary: string;
  explanation: string;
  confidence: GeminiConfidence;
  signals: string[];
  caveat: string;
};

function isProfile(value: unknown): value is GeminiProfileId {
  return typeof value === "string" && GEMINI_PROFILE_IDS.includes(value as GeminiProfileId);
}

function isConfidence(value: unknown): value is GeminiConfidence {
  return value === "high" || value === "medium" || value === "low";
}

function boundedString(value: unknown, label: string, maximum: number) {
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error(`${label} must not be empty.`);
  return normalized.slice(0, maximum);
}

export function parseGeminiPolicyDecision(value: unknown): GeminiPolicyDecision {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Gemini returned an invalid policy decision.");
  }
  const candidate = value as Record<string, unknown>;
  if (!isProfile(candidate.profile)) throw new Error("Gemini returned an unsupported workload profile.");
  if (!isConfidence(candidate.confidence)) throw new Error("Gemini returned an invalid confidence level.");
  if (!Array.isArray(candidate.signals)) throw new Error("Gemini returned invalid decision signals.");

  const signals = candidate.signals
    .slice(0, 3)
    .map((signal) => boundedString(signal, "Decision signal", 100));
  if (!signals.length) throw new Error("Gemini did not return a decision signal.");

  return {
    profile: candidate.profile,
    summary: boundedString(candidate.summary, "Summary", 160),
    explanation: boundedString(candidate.explanation, "Explanation", 420),
    confidence: candidate.confidence,
    signals,
    caveat: boundedString(candidate.caveat, "Caveat", 220),
  };
}

