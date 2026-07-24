import type { Metadata } from "next";
import SiteHeader from "../site-header";

export const metadata: Metadata = {
  title: "Docs - Frontier Max",
  description: "Frontier Max public route API and OpenRouter handoff.",
};

const requestExample = `POST /api/v1/route
{
  "profile": "code.text",
  "objective": "balanced",
  "minimum_public_score": 35,
  "maximum_estimated_cost_usd": 0.25,
  "features": {
    "input_tokens_estimate": 8000,
    "output_tokens_estimate": 2000,
    "input_modalities": ["text"],
    "output_modalities": ["text"],
    "requires_tools": true,
    "requires_structured_output": false,
    "required_context_tokens": 16000,
    "complexity_hint": "medium",
    "risk_class": "standard"
  }
}`;

const handoffExample = `const decision = await frontier.route(metadata);

const response = await openrouter.chat.completions.create({
  model: [decision.model, ...decision.fallbacks],
  provider: decision.provider,
  messages // sent to OpenRouter, never Frontier
});`;

const privateExample = `const decision = await frontier.route({
  policy: "coding-prod",
  session_id: "session-9f2",
  features: {
    input_tokens_estimate: 8000,
    output_tokens_estimate: 2000,
    input_modalities: ["text"],
    output_modalities: ["text"],
    requires_tools: true,
    requires_structured_output: false,
    required_context_tokens: 16000,
    complexity_hint: "medium",
    risk_class: "standard"
  }
});`;

const rustExample = `export FRONTIER_MAX_API_KEY="fmx_..."

frontier route \\
  --policy coding-prod \\
  --session coding-session-42 \\
  --input-tokens 8000 \\
  --output-tokens 2000 \\
  --context-tokens 16000 \\
  --tools`;

export default function DocsPage() {
  return (
    <div className="docs-page">
      <SiteHeader active="docs" />
      <main className="docs-main">
        <aside>
          <span>DOCUMENTATION</span>
          <a href="#quickstart">Quickstart</a>
          <a href="#route-api">Route API</a>
          <a href="#private-evidence">Private benchmarks</a>
          <a href="#sdk">TypeScript SDK</a>
          <a href="#rust-cli">Rust CLI</a>
          <a href="#handoff">OpenRouter handoff</a>
          <a href="#privacy">Privacy model</a>
          <a href="/api/v1/models">Model registry ↗</a>
        </aside>
        <div className="docs-content">
          <section id="quickstart"><p className="reader-eyebrow"><span>DOCS</span> Public demo API</p><h1>Decision metadata in.<br /><em>Concrete route out.</em></h1><p>Frontier evaluates declared workload requirements. Your application retains the prompt and provider key, then calls OpenRouter directly.</p></section>
          <section id="route-api"><span>ROUTE API</span><h2>Compute a provisional public route</h2><pre><code>{requestExample}</code></pre><p>The public endpoint is intended for simulation. Production policies require authenticated organization scope and private evidence.</p></section>
          <section id="private-evidence"><span>PRIVATE BENCHMARKS</span><h2>Certify before routing</h2><p>Import aggregate successes, failures, cost, and measured latency. Frontier calculates a Beta posterior, applies the conservative lower-bound gate, publishes an immutable policy, and certifies the selected candidate.</p><pre><code>{privateExample}</code></pre></section>
          <section id="handoff"><span>OPENROUTER HANDOFF</span><h2>Execution stays in your application</h2><pre><code>{handoffExample}</code></pre></section>
          <section id="sdk"><span>TYPESCRIPT SDK</span><h2>Source included, not published</h2><p>The repository includes <code>@frontier-max/sdk</code> source with route, manifest, outcome, local cache, and OpenRouter compilation helpers. Frontier and OpenRouter keys remain separate.</p></section>
          <section id="rust-cli"><span>RUST CLI</span><h2>Native routing, metadata only</h2><p>The <code>frontier</code> binary resolves certified policies, preserves bounded session stickiness, prints an OpenRouter handoff, reads immutable manifests, and reports content-free outcomes.</p><pre><code>{rustExample}</code></pre><p>It does not accept prompts, model outputs, code, diffs, repositories, or provider credentials.</p></section>
          <section id="privacy"><span>PRIVACY MODEL</span><h2>Rejected fields</h2><p>The route API rejects <code>prompt</code>, <code>messages</code>, <code>raw_input</code>, <code>document</code>, <code>code</code>, <code>content</code>, <code>output</code>, and <code>response</code>. Frontier does not need them to route a declared workload.</p></section>
        </div>
      </main>
    </div>
  );
}
