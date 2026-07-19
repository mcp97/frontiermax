"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import sitePackage from "../../package.json";
import policyManifest from "../../packages/frontier-cli/manifest.json";

type ProfileId = "code.interactive" | "code.delegated";

type Profile = {
  id: ProfileId;
  number: string;
  label: string;
  question: string;
  objective: string;
  model: string;
  route: string;
  signal: string;
  caveat: string;
  command: string;
};

type GeminiResult = {
  decision: {
    profile: ProfileId;
    summary: string;
    explanation: string;
    confidence: "high" | "medium" | "low";
    signals: string[];
    caveat: string;
  };
  policy: {
    label: string;
    objective: string;
    route: string;
    manifestVersion: string;
  };
  provenance: {
    provider: string;
    requestedModel: string;
    modelVersion: string | null;
  };
};

const PROFILES: Profile[] = policyManifest.profiles.map((candidate, index) => ({
  id: candidate.id as ProfileId,
  number: String(index + 1).padStart(2, "0"),
  label: candidate.label,
  question: candidate.question,
  objective: candidate.objective,
  model: candidate.openrouter_model,
  route: candidate.router_behavior,
  signal: candidate.primary_signal,
  caveat: candidate.limitations[0],
  command: `frontier opencode --profile ${candidate.id}`,
}));

const cliPackage = `frontier-max-${policyManifest.cli_version}.tgz`;
const sourcePackage = `frontier-max-source-${sitePackage.version}.tar.gz`;

const TASK_EXAMPLES = [
  "Pair with me while I repair a failing authentication flow and review each change.",
  "Upgrade twelve repositories overnight, run every test suite, and leave the results for tomorrow.",
];

function Brand() {
  return (
    <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
  );
}

export default function UseFrontier() {
  const [profileId, setProfileId] = useState<ProfileId>("code.interactive");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [task, setTask] = useState(TASK_EXAMPLES[0]);
  const [geminiState, setGeminiState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [geminiResult, setGeminiResult] = useState<GeminiResult | null>(null);
  const [geminiError, setGeminiError] = useState("");
  const requestVersion = useRef(0);
  const profile = useMemo(
    () => PROFILES.find((candidate) => candidate.id === profileId)!,
    [profileId],
  );

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(profile.command);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("failed");
    }
  }

  async function interpretTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const version = ++requestVersion.current;
    setGeminiState("loading");
    setGeminiError("");
    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });
      const payload = await response.json() as GeminiResult & { error?: string; action?: string };
      if (!response.ok) throw new Error([payload.error, payload.action].filter(Boolean).join(" "));
      if (version !== requestVersion.current) return;
      setGeminiResult(payload);
      setProfileId(payload.decision.profile);
      setGeminiState("ready");
    } catch (error) {
      if (version !== requestVersion.current) return;
      setGeminiResult(null);
      setGeminiError(error instanceof Error ? error.message : "Gemini could not interpret this task.");
      setGeminiState("error");
    }
  }

  function clearGeminiDecision() {
    requestVersion.current += 1;
    setGeminiState("idle");
    setGeminiResult(null);
    setGeminiError("");
  }

  function editTask(value: string) {
    setTask(value);
    clearGeminiDecision();
  }

  function chooseProfile(nextProfile: ProfileId) {
    setProfileId(nextProfile);
    clearGeminiDecision();
  }

  return (
    <div className="use-shell">
      <a className="skip-link" href="#use-content">Skip to content</a>
      <header className="use-header">
        <Link className="brand" href="/" aria-label="Frontier Max home"><Brand />Frontier Max</Link>
        <nav aria-label="Primary navigation">
          <Link href="/benchmarks">Benchmarks</Link>
          <Link href="/reader">Reader</Link>
          <Link href="/use" aria-current="page">Use</Link>
          <Link href="/fund">Fund</Link>
          <a href="/frontier/v1/manifest.json">Manifest</a>
        </nav>
        <Link className="use-back" href="/">Back to atlas <span>↗</span></Link>
      </header>

      <main id="use-content">
        <section className="use-hero">
          <div className="use-hero-copy">
            <p className="eyebrow"><span>ACTIONABILITY LAYER</span> OpenRouter × OpenCode</p>
            <h1>Choose the frontier.<br /><em>Start coding.</em></h1>
            <p className="use-lede">
              Frontier Max turns one evidence-backed coding policy and an explicit workload choice into a reproducible route—without proxying your prompts, code, keys, or model responses.
            </p>
            <div className="use-proof-row">
              <span><i /> Sticky while active</span>
              <span><i /> Content-free receipts</span>
              <span><i /> No sponsored rank</span>
            </div>
          </div>

          <div className="route-console" aria-live="polite">
            <div className="console-top">
              <span><i /><i /><i /></span>
              <b>frontier route</b>
              <small>manifest {policyManifest.version}</small>
            </div>
            <div className="console-body">
              <span className="console-kicker">SELECTED POLICY</span>
              <h2>{profile.label}</h2>
              <dl>
                <div><dt>Route</dt><dd>{profile.model}</dd></div>
                <div><dt>Objective</dt><dd>{profile.objective}</dd></div>
                <div><dt>Signal</dt><dd>{profile.signal}</dd></div>
                <div><dt>Scope</dt><dd>may re-resolve after 5m idle or routing errors</dd></div>
              </dl>
              <div className="console-caveat"><span>!</span><p><b>Honest boundary</b>{profile.caveat}</p></div>
              <button type="button" onClick={copyCommand}>
                <code>$ {profile.command}</code>
                <span>{copyState === "copied" ? "Copied" : copyState === "failed" ? "Select text" : "Copy"}</span>
              </button>
              {copyState === "failed" && <textarea className="command-fallback" aria-label="Frontier command for manual copy" readOnly value={profile.command} />}
            </div>
          </div>
        </section>

        <section className="gemini-router" id="gemini-router">
          <div className="section-index">01 / GEMINI TASK INTERPRETER</div>
          <div className="gemini-router-grid">
            <div className="gemini-router-copy">
              <p className="action-kicker">Powered by Gemini 3.5 Flash</p>
              <h2>Describe the work.<br /><em>Make the policy explicit.</em></h2>
              <p>Gemini interprets a short task description and maps it onto an allowed workload policy. Frontier Max validates the answer against its versioned manifest before any route can change.</p>
              <div className="gemini-boundary"><b>Gemini owns meaning.</b><span>The deterministic policy owns the executable route.</span></div>
            </div>

            <form className="gemini-task-form" onSubmit={interpretTask}>
              <label htmlFor="gemini-task">What are you asking the agent to do?</label>
              <textarea
                id="gemini-task"
                value={task}
                onChange={(event) => editTask(event.target.value)}
                minLength={12}
                maxLength={800}
                required
              />
              <div className="gemini-examples" aria-label="Task examples">
                {TASK_EXAMPLES.map((example, index) => (
                  <button key={example} type="button" onClick={() => editTask(example)}>Example 0{index + 1}</button>
                ))}
              </div>
              <button className="gemini-submit" type="submit" disabled={geminiState === "loading"}>
                {geminiState === "loading" ? "Interpreting with Gemini…" : "Interpret task with Gemini"}<span>→</span>
              </button>

              <div className={`gemini-result ${geminiState}`} aria-live="polite">
                {geminiState === "idle" && <p>One task description in. One inspectable policy out.</p>}
                {geminiState === "loading" && <p>Gemini is identifying the binding resource and operating regime.</p>}
                {geminiState === "error" && <p><b>{geminiError.includes("not activated") ? "Not activated" : "Could not interpret"}</b>{geminiError}</p>}
                {geminiState === "ready" && geminiResult && (
                  <>
                    <div className="gemini-result-head"><span>{geminiResult.decision.confidence} confidence</span><b>{geminiResult.policy.label}</b></div>
                    <h3>{geminiResult.decision.summary}</h3>
                    <p>{geminiResult.decision.explanation}</p>
                    <ul>{geminiResult.decision.signals.map((signal) => <li key={signal}>{signal}</li>)}</ul>
                    <dl>
                      <div><dt>Validated route</dt><dd>{geminiResult.policy.route}</dd></div>
                      <div><dt>Caveat</dt><dd>{geminiResult.decision.caveat}</dd></div>
                      <div><dt>Provenance</dt><dd>{geminiResult.provenance.provider} · {geminiResult.provenance.modelVersion || geminiResult.provenance.requestedModel}</dd></div>
                    </dl>
                  </>
                )}
              </div>
            </form>
          </div>
        </section>

        <section className="policy-studio">
          <div className="section-index">02 / CHOOSE THE OPERATING REGIME</div>
          <div className="policy-heading">
            <h2>Same requested tier.<br /><em>Different job to be done.</em></h2>
            <p>There is no permanent model winner. Start with whether a human is waiting, then let the workload decide which resource matters. If the requested tier is completely unavailable, OpenRouter may use a neighboring tier.</p>
          </div>
          <div className="policy-grid" role="group" aria-label="Coding workload policy">
            {PROFILES.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className={profileId === candidate.id ? "active" : ""}
                aria-pressed={profileId === candidate.id}
                onClick={() => chooseProfile(candidate.id)}
              >
                <span>{candidate.number}</span>
                <small>{candidate.question}</small>
                <h3>{candidate.label}</h3>
                <p>{candidate.objective}</p>
                <b>{profileId === candidate.id ? "Selected" : "Choose policy"} <i>→</i></b>
              </button>
            ))}
          </div>
        </section>

        <section className="execution-flow">
          <div className="section-index">03 / FROM EVIDENCE TO EXECUTION</div>
          <div className="execution-heading">
            <h2>A very thin wrapper.<br /><em>A very explicit contract.</em></h2>
            <p>OpenRouter remains the transport. OpenCode remains the agent. Frontier Max owns only the inspectable decision policy and its provenance.</p>
          </div>
          <div className="execution-rail">
            <article><span>01</span><b>Evidence</b><h3>Keep the source intact.</h3><p>OpenRouter’s Pareto Code tier is currently grounded in Artificial Analysis coding percentiles.</p></article>
            <i>→</i>
            <article><span>02</span><b>Policy</b><h3>State the objective.</h3><p>Your workload selects speed or price. No hidden score and no provider-margin objective.</p></article>
            <i>→</i>
            <article><span>03</span><b>Execution</b><h3>Launch where you work.</h3><p>The Pareto alias is passed to OpenCode and requested to stay sticky while active.</p></article>
            <i>→</i>
            <article><span>04</span><b>Outcome</b><h3>Record what happened.</h3><p>Accepted, reverted, abandoned, and test status remain local in this preview. Nothing is uploaded.</p></article>
          </div>
        </section>

        <section className="try-frontier">
          <div className="try-copy">
            <div className="section-index light">04 / TRY THE PREVIEW</div>
            <h2>Three commands.<br /><em>One visible decision.</em></h2>
            <p>The package is ready for source testing before a public registry launch. OpenCode keeps your OpenRouter credentials; Frontier Max never sees them.</p>
            <div className="try-downloads">
              <a href={`/downloads/${cliPackage}`}>Download CLI preview <span>↓</span></a>
              <a href={`/downloads/${sourcePackage}`}>Download MIT source <span>↓</span></a>
            </div>
          </div>
          <ol className="command-steps">
            <li><span>01</span><div><b>Install the preview package</b><code>npm install -g ./{cliPackage}</code></div></li>
            <li><span>02</span><div><b>Connect OpenRouter in OpenCode</b><code>opencode</code><small>Then run /connect → OpenRouter.</small></div></li>
            <li><span>03</span><div><b>Inspect, then launch</b><code>frontier route --profile {profile.id}</code><code>frontier opencode --profile {profile.id}</code><small>Attribution is enabled by default. Opt out with <code>frontier opencode --profile {profile.id} --no-attribution</code>.</small></div></li>
          </ol>
        </section>

        <section className="receipt-section">
          <div className="receipt-copy">
            <div className="section-index">05 / DECISION RECEIPT</div>
            <h2>The route should<br /><em>explain itself.</em></h2>
            <p>Every launch writes a local lock and a content-free receipt. It records the policy, route, evidence version, attribution state, and optional outcome—not the work itself.</p>
            <div className="receipt-principles">
              <span><i>×</i> No prompt</span><span><i>×</i> No code</span><span><i>×</i> No diff</span><span><i>✓</i> Route + outcome</span>
            </div>
          </div>
          <pre className="receipt-code" aria-label="Example decision receipt"><code>{`{
  "profile": "${profile.id}",
  "requested_openrouter_route": "${profile.model}",
  "resolution": {
    "observed_by_frontier_max": false,
    "concrete_model": null
  },
  "objective": "${profile.signal}",
  "manifest_version": "${policyManifest.version}",
  "selection_scope": "${policyManifest.selection_scope}",
  "attribution": {
    "enabled": true,
    "disable_with": "--no-attribution"
  },
  "prompt_captured": false,
  "code_captured": false,
  "outcome": null
}`}</code></pre>
        </section>

        <section className="neutral-contract">
          <p>POLICY-NEUTRAL BY DESIGN</p>
          <h2>We can recommend the route<br />without owning the <em>road.</em></h2>
          <div>
            <span><b>01</b> Source measurements remain unchanged.</span>
            <span><b>02</b> Sponsored placement cannot change order.</span>
            <span><b>03</b> Provider margin is not an optimization objective.</span>
            <span><b>04</b> Attribution is disclosed and can be disabled.</span>
          </div>
        </section>
      </main>

      <footer className="use-footer">
        <Link className="brand" href="/"><Brand />Frontier Max</Link>
        <p>Interpret the benchmark. Act on the decision.</p>
        <div><Link href="/benchmarks">Benchmarks</Link><Link href="/reader">Reader</Link><Link href="/fund">Run Fund</Link><a href={`/downloads/${sourcePackage}`}>Source</a><a href="/frontier/v1/manifest.json">Manifest</a><Link href="/">Atlas</Link></div>
      </footer>
    </div>
  );
}
