# Frontier Max — Submission Copy

Re-test every completed link while signed out before pasting this into a submission form. Lines marked as not yet created are explicit owner/account actions and must not be represented as complete.

## Project title

**Frontier Max**

## Tagline

**From benchmark to runtime.**

## Category sentence

**The decision and provenance layer for AI model selection.**

## 25-word description

Frontier Max turns benchmark evidence and task intent into transparent, workload-specific model policies, then launches reproducible OpenCode routes without proxying a user’s code or prompts.

## 50-word description

Frontier Max is the decision and provenance layer for AI model selection. It preserves source-linked benchmark evidence, uses Gemini to interpret task intent, validates one allowed workload policy, and requests a reproducible OpenCode route through OpenRouter—fastest high-tier coding option for interactive work, cheapest high-tier option for delegated coding work today.

## 150-word description

Frontier Max turns AI benchmark results into decisions a team can inspect and use. It preserves source-linked evidence from BenchmarkList, makes each evaluation contract legible, and rejects the idea of one universal model winner. Instead, users describe the work. Gemini 3.5 Flash maps that intent onto an allowed workload policy, while deterministic code validates the choice against a versioned manifest before any route changes. The current coding wedge distinguishes interactive sessions, where waiting time matters, from delegated jobs, where model price matters after a high quality threshold is met. Frontier Max then requests the corresponding OpenRouter Pareto Code route for OpenCode and writes a content-free local receipt. It never proxies prompts, repositories, diffs, API keys, or model responses. The free catalog and CLI establish trust; paid team policies, APIs, controls, and auditability create a path to revenue. Frontier Max makes benchmarks interpretable, actionable, and accountable for real production decisions today.

## Problem statement

AI teams are surrounded by benchmark charts but still choose models by reputation, screenshots, or a single aggregate score. A benchmark result is conditional on its task set, harness, date, configuration, and measurement contract. Even a valid winner does not answer the operating question: which model policy best meets this workload’s quality bar, waiting-time tolerance, budget, context requirement, and risk constraints?

The missing product is not another benchmark. It is the layer that makes existing evidence legible and converts it into an explicit, reproducible decision.

## Insight

There is no permanent “best model.” Quality, cost, latency, throughput, tokens, context, privacy, and reliability bind differently by operating regime.

- In **interactive coding**, a human is waiting; p50 model throughput is a useful first proxy after quality is gated.
- In **delegated coding**, the job can run in the background; model price can be optimized inside the same quality tier.
- In future policies for real-time, batch, continuous, privacy-bound, or long-horizon work, different constraints will bind.

Tokens remain measured, but they should become an active optimization objective only when context capacity, token cost, or transfer time is actually binding.

## Product

Frontier Max connects four layers:

1. **Evidence** — Preserve source-linked public benchmark records and the evaluation contract behind each number.
2. **Interpretation** — Apply workload-specific constraints and conditional Pareto reasoning instead of publishing one universal rank.
3. **Action** — Convert a task brief into an inspectable routing policy and launch OpenCode through OpenRouter.
4. **Accountability** — Record the requested policy, route, and manifest version in a content-free local receipt.

The current public prototype is live on ChatGPT Sites. Its Gemini integration is deployed in code, but runtime activation requires a server-side `GEMINI_API_KEY` and signed-out verification. The Google-track Cloud Run deployment and AI Studio share link remain final owner/account tasks.

## Technical feasibility

- Full-stack TypeScript/React application using the Vinext runtime, with a source-linked BenchmarkList catalog, reader, and provenance records.
- Server-side Gemini endpoint with structured output and a strict `code.interactive` / `code.delegated` schema.
- Versioned manifest validation prevents a model-generated answer from inventing an executable route.
- Dependency-free local CLI requests a sticky OpenRouter session for OpenCode and writes a content-free decision receipt.
- Server-side key handling: the Gemini key is never returned to the browser.
- Frontier Max does not proxy downstream prompts, repository contents, diffs, API keys, or model responses.
- Source-based Cloud Run deployment guide is checked in; public Cloud Run deployment must be completed and verified before submission.

## How Gemini is used

Humans describe a task semantically: “pair with me on this flaky test” or “finish this migration overnight.” They should not need to understand routing taxonomy.

Gemini 3.5 Flash acts as a constrained intent-to-policy compiler. It reads only the short task brief, returns structured JSON, selects one allowed workload profile, explains the visible signals, and states uncertainty. Gemini does **not** create benchmark results or own the final route. Frontier Max validates the profile against a checked-in manifest; deterministic policy code owns the executable decision.

This division makes Gemini useful and visible without giving generated text authority over unbounded runtime configuration.

## Innovation and novelty

- Reframes benchmarks from static rankings into conditional decisions.
- Combines evidence provenance, workload semantics, routing policy, and local receipts in one closed loop.
- Makes the objective function visible: users can see which resource binds and why.
- Separates semantic interpretation from deterministic execution.
- Starts with an honest two-policy coding wedge rather than claiming a universal learned router before outcome data exists.

## Real-world applicability

The immediate user is a developer or AI platform team choosing a model for interactive or delegated coding. The same architecture can support customer-support latency budgets, offline document processing, continuous agents, regulated workloads, long-context research, and privacy-constrained execution by changing the permitted policy set and evidence requirements.

## Market potential and fundability

Frontier Max can use an open-core distribution model:

- **Free:** benchmark catalog, source provenance, local reader, and CLI.
- **Team:** shared policy workspace, approved-model lists, budget/latency guardrails, API, and decision history.
- **Enterprise:** SSO, governance, private evaluation connectors, audit exports, provider controls, and support.

The buyer is an AI platform, engineering productivity, or FinOps leader who needs repeatable model decisions across teams and providers. The compounding asset is the provenance graph plus workload policies and outcome-linked receipts—not a static leaderboard.

## Team

**Monil Patel** — seven years at Meta; Staff-level applied AI experience spanning evaluation, post-training, and coding agents. Frontier Max is built from a practitioner’s need to convert noisy model evidence into trustworthy operating decisions.

Current documented team: Monil Patel.

## Ask

We are looking for:

- Five design partners operating multi-model coding or agent workflows
- Google Cloud support to harden the Gemini and Cloud Run path
- Investor conversations around the model-decision and governance category

## Required links

- Live ChatGPT Sites mirror: <https://agent-frontier.monilpat.chatgpt.site>
- Public Cloud Run prototype: **Not yet created — owner/account action; add only after signed-out verification.**
- Google AI Studio project: **Not yet created — owner/account action; add only after reviewer-access verification.**
- Code repository: **Not yet created — owner/account action; add only after repository visibility and signed-out access are verified.**
- Two-minute pitch video: **Not yet created — owner/account action; add only after upload and signed-out verification.**
- One-minute public YouTube demo: **Not yet created — owner/account action; add only after public upload and signed-out verification.**
- Public one-pager URL: **Not yet created — owner/account action; add only after upload and signed-out verification. The local PDF is complete.**

## Disclosure / provenance note

Frontier Max consumes and interprets third-party benchmark evidence; it does not create benchmark questions, alter source scores, sell placement, or claim that unrelated benchmark rows directly control arbitrary model routes. The current executable policy uses OpenRouter Pareto Code’s high Artificial Analysis coding tier: interactive requests the fastest available tier model by p50 throughput; delegated requests the cheapest available tier model. The requested route may be re-resolved by OpenRouter, and Frontier Max does not claim to observe the concrete serving model.
