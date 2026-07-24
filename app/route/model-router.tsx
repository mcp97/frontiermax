"use client";

import { useMemo, useState } from "react";
import SiteHeader from "../site-header";

type Profile =
  | "chat.fast"
  | "reasoning.deep"
  | "research.synthesis"
  | "extraction.structured"
  | "long_context.analysis"
  | "code.text"
  | "tool_use"
  | "multimodal.understanding";

type Candidate = {
  id: string;
  name: string;
  quality: number | null;
  qualityMetric: string;
  estimatedCostUsd: number | null;
  contextLength: number;
  eligible: boolean;
  rejectionReasons: string[];
  pareto: boolean;
};

type RouteResponse = {
  route_id: string;
  route_type: "concrete_model";
  model: string;
  fallbacks: string[];
  reasons: string[];
  binding_constraints: string[];
  public_evidence: {
    fit: number | null;
    metric: string;
    source: string;
  };
  cost: {
    estimated_usd: number | null;
    assumptions: string[];
  };
  policy_version: string;
  evidence_version: string;
  router_engine_version: string;
  manifest_hash: string;
  expires_at: string;
  candidates: Candidate[];
  privacy: Record<string, boolean>;
};

const PROFILES: Array<{ id: Profile; label: string; note: string }> = [
  { id: "code.text", label: "Code", note: "Coding quality under a request budget" },
  { id: "chat.fast", label: "Fast chat", note: "Low-cost conversational turns" },
  { id: "reasoning.deep", label: "Deep reasoning", note: "Quality-first analytical work" },
  { id: "research.synthesis", label: "Research", note: "Long-form evidence synthesis" },
  { id: "extraction.structured", label: "Extraction", note: "Schema-constrained output" },
  { id: "tool_use", label: "Tool use", note: "Agentic capability with tools" },
  { id: "long_context.analysis", label: "Long context", note: "Large-context analysis" },
  { id: "multimodal.understanding", label: "Multimodal", note: "Text plus image input" },
];

function money(value: number | null) {
  if (value == null) return "Not measured";
  if (value < 0.001) return `$${value.toFixed(6)}`;
  return `$${value.toFixed(4)}`;
}

export default function ModelRouter() {
  const [profile, setProfile] = useState<Profile>("code.text");
  const [objective, setObjective] = useState<
    "minimize_estimated_cost" | "maximize_public_quality" | "balanced"
  >("balanced");
  const [inputTokens, setInputTokens] = useState(8_000);
  const [outputTokens, setOutputTokens] = useState(2_000);
  const [contextTokens, setContextTokens] = useState(16_000);
  const [qualityFloor, setQualityFloor] = useState(35);
  const [costCeiling, setCostCeiling] = useState(0.25);
  const [tools, setTools] = useState(true);
  const [structured, setStructured] = useState(false);
  const [imageInput, setImageInput] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedProfile = useMemo(
    () => PROFILES.find((candidate) => candidate.id === profile)!,
    [profile],
  );

  async function simulate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setError("");
    setRoute(null);
    try {
      const response = await fetch("/api/v1/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          objective,
          minimum_public_score: qualityFloor,
          maximum_estimated_cost_usd: costCeiling,
          features: {
            input_tokens_estimate: inputTokens,
            output_tokens_estimate: outputTokens,
            input_modalities: imageInput ? ["text", "image"] : ["text"],
            output_modalities: ["text"],
            requires_tools: tools,
            requires_structured_output: structured,
            required_context_tokens: contextTokens,
            complexity_hint: "medium",
            risk_class: "standard",
          },
        }),
      });
      const payload = await response.json() as RouteResponse & {
        message?: string;
      };
      if (!response.ok) throw new Error(payload.message || "No route qualified.");
      setRoute(payload);
      setState("ready");
    } catch (routeError) {
      setError(routeError instanceof Error ? routeError.message : "The route could not be computed.");
      setState("error");
    }
  }

  async function copyManifest() {
    if (!route) return;
    await navigator.clipboard.writeText(JSON.stringify(route, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="router-page">
      <a className="skip-link" href="#router-content">Skip to router</a>
      <SiteHeader active="route" />

      <main id="router-content" className="router-main">
        <section className="router-hero">
          <div>
            <p className="reader-eyebrow"><span>ROUTER DEMO</span> Public evidence only</p>
            <h1>Declare the workload.<br /><em>Inspect the route.</em></h1>
          </div>
          <div className="router-hero-note">
            <p>Frontier returns a concrete OpenRouter model and fallbacks from structured metadata—never the prompt.</p>
            <div><span>No prompt</span><span>No output</span><span>No provider key</span></div>
          </div>
        </section>

        <section className="router-workspace">
          <form className="router-controls" onSubmit={simulate}>
            <div className="router-control-head">
              <span>01 / DECLARE</span>
              <h2>{selectedProfile.label}</h2>
              <p>{selectedProfile.note}</p>
            </div>

            <label>
              <span>Workload</span>
              <select value={profile} onChange={(event) => setProfile(event.target.value as Profile)}>
                {PROFILES.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.label}</option>)}
              </select>
            </label>
            <label>
              <span>Objective</span>
              <select value={objective} onChange={(event) => setObjective(event.target.value as typeof objective)}>
                <option value="balanced">Balance quality and cost</option>
                <option value="minimize_estimated_cost">Minimize estimated cost</option>
                <option value="maximize_public_quality">Maximize public quality</option>
              </select>
            </label>

            <div className="router-number-grid">
              <label><span>Input tokens</span><input type="number" min="1" max="1000000" value={inputTokens} onChange={(event) => setInputTokens(Number(event.target.value))} /></label>
              <label><span>Output tokens</span><input type="number" min="1" max="250000" value={outputTokens} onChange={(event) => setOutputTokens(Number(event.target.value))} /></label>
              <label><span>Context required</span><input type="number" min="1" max="2000000" value={contextTokens} onChange={(event) => setContextTokens(Number(event.target.value))} /></label>
              <label><span>Max request cost</span><input type="number" min="0" step="0.01" value={costCeiling} onChange={(event) => setCostCeiling(Number(event.target.value))} /></label>
              <label><span>Public score floor</span><input type="number" min="0" max="100" step="1" value={qualityFloor} onChange={(event) => setQualityFloor(Number(event.target.value))} /></label>
            </div>

            <div className="router-checks">
              <label><input type="checkbox" checked={tools} onChange={(event) => setTools(event.target.checked)} /><span>Tools</span></label>
              <label><input type="checkbox" checked={structured} onChange={(event) => setStructured(event.target.checked)} /><span>Structured output</span></label>
              <label><input type="checkbox" checked={imageInput} onChange={(event) => setImageInput(event.target.checked)} /><span>Image input</span></label>
            </div>

            <button className="primary-button router-submit" type="submit" disabled={state === "loading"}>
              {state === "loading" ? "Computing route…" : "Simulate route"} <span>→</span>
            </button>
          </form>

          <div className={`router-decision ${state}`} aria-live="polite">
            <div className="router-decision-head"><span>02 / DECIDE</span><b>{state === "ready" ? "PROVISIONAL" : "WAITING"}</b></div>
            {state === "idle" && <div className="router-empty"><h2>No route yet.</h2><p>Set the gates, then compute against the live OpenRouter model registry.</p></div>}
            {state === "loading" && <div className="router-empty"><h2>Computing the frontier.</h2><p>Loading current model metadata, applying hard gates, then selecting from the nondominated set.</p></div>}
            {state === "error" && <div className="router-empty error"><h2>No qualified route.</h2><p>{error}</p></div>}
            {state === "ready" && route && (
              <>
                <div className="router-selected">
                  <span>CONCRETE PRIMARY MODEL</span>
                  <h2>{route.model}</h2>
                  <p>{route.reasons[0]}</p>
                </div>
                <div className="router-metrics">
                  <div><span>Public signal</span><b>{route.public_evidence.fit?.toFixed(1) ?? "—"}</b><small>{route.public_evidence.metric}</small></div>
                  <div><span>Estimated cost</span><b>{money(route.cost.estimated_usd)}</b><small>declared token estimate</small></div>
                  <div><span>Fallbacks</span><b>{route.fallbacks.length}</b><small>concrete models</small></div>
                </div>
                <div className="router-constraints">
                  <span>BINDING CONSTRAINTS</span>
                  <ul>{route.binding_constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}</ul>
                </div>
                <div className="router-fallbacks"><span>FALLBACK ORDER</span>{route.fallbacks.length ? route.fallbacks.map((fallback) => <code key={fallback}>{fallback}</code>) : <p>No additional frontier candidates qualified.</p>}</div>
                <button className="router-copy" type="button" onClick={copyManifest}>{copied ? "Copied" : "Copy route JSON"} <span>↗</span></button>
              </>
            )}
          </div>
        </section>

        {route && (
          <section className="router-candidates">
            <div className="router-section-head"><div><span>03 / EXPLAIN</span><h2>Every inclusion.<br /><em>Every exclusion.</em></h2></div><p>Missing evidence is a rejection reason, not a zero.</p></div>
            <div className="router-table-wrap">
              <table>
                <thead><tr><th>Candidate</th><th>Public quality</th><th>Est. cost</th><th>Context</th><th>Decision</th></tr></thead>
                <tbody>{route.candidates.map((candidate) => (
                  <tr key={candidate.id} className={candidate.id === route.model ? "selected" : ""}>
                    <td><b>{candidate.id}</b><small>{candidate.name}</small></td>
                    <td>{candidate.quality?.toFixed(1) ?? "Not measured"}</td>
                    <td>{money(candidate.estimatedCostUsd)}</td>
                    <td>{candidate.contextLength.toLocaleString()}</td>
                    <td>{candidate.id === route.model ? <strong>Selected</strong> : candidate.eligible ? candidate.pareto ? "Pareto set" : "Eligible" : candidate.rejectionReasons.join(" · ")}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        )}

        <section className="router-boundary">
          <div><span>EXECUTION BOUNDARY</span><h2>Frontier decides.<br /><em>Your gateway executes.</em></h2></div>
          <div className="router-flow"><span>Structured metadata</span><i>→</i><strong>Frontier route</strong><i>→</i><span>Your app calls OpenRouter</span></div>
        </section>
      </main>
    </div>
  );
}
