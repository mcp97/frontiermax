# Frontier Max

**From benchmark to runtime.**

Frontier Max makes third-party AI benchmark evidence legible, then turns an
explicit workload policy into a reproducible model route. It consumes data; it
does not create benchmark questions, alter source scores, or sell placement.

- Live prototype: <https://agent-frontier.monilpat.chatgpt.site>
- Source repository: <https://github.com/mcp97/frontiermax>
- Product status: public preview
- License: MIT (third-party benchmark data retains its original terms)

## Why it exists

A leaderboard answers who won one evaluation contract. Production teams need a
different answer: which policy should run this task under a quality gate and a
real constraint such as waiting time, price, context, privacy, or reliability?

Frontier Max separates that decision into four inspectable layers:

1. **Read** — preserve the source, configuration, version, and caveat.
2. **Decide** — identify the workload and binding resource.
3. **Route** — resolve only to a checked-in, allowed policy.
4. **Prove** — write a content-free local decision receipt.

## What works today

- `/benchmarks` indexes public BenchmarkList records with source provenance.
- `/reader` is an advanced local-import tool for validating one comparable,
  versioned cohort and producing a conditional frontier plus analysis receipt.
- `/use` exposes two honest coding policies: interactive and delegated.
- `/api/gemini` uses Gemini 3.5 Flash to map a short task brief onto one of those
  policies when `GEMINI_API_KEY` is configured. It fails closed when it is not.
- `packages/frontier-cli` launches the requested OpenRouter Pareto Code route in
  OpenCode and keeps prompts, code, keys, diffs, and model responses out of
  Frontier Max.
- `/fund` prepares portable Run Fund drafts. It has no intake or payment rail.

The executable preview does **not** claim that arbitrary BenchmarkList rows
directly select arbitrary models. Its current evidence-backed wedge uses
OpenRouter's high Artificial Analysis coding tier:

- `code.interactive` requests the fastest available option by p50 throughput.
- `code.delegated` requests the cheapest available option in the same tier.

OpenRouter may re-resolve the underlying model after five idle minutes or a
routing error. Frontier Max records the requested route, not a concrete model it
cannot observe.

## Judge demo

1. Open `/benchmarks` and inspect one source-linked benchmark record.
2. Open `/use` and submit an interactive task: “Fix a flaky authentication test
   while I pair.”
3. Submit a delegated task: “Migrate thirty endpoints overnight and open a
   verified PR.”
4. Show the validated profile, requested route, and local CLI receipt.

Gemini interprets task meaning. Deterministic manifest validation owns the
executable choice.

## Local development

Requirements: Node.js `>=22.13.0`, Linux, `flock`, `curl`, and GNU `timeout`.

```bash
cp .env.example .env.local
npm run install:ci
npm run dev
```

Set `GEMINI_API_KEY` only in the server environment. The key is never sent to
the browser. Set `NEXT_PUBLIC_SITE_URL` to the public origin used for canonical
and benchmark share URLs.

## CLI preview

The package has not been published to npm yet. Run it from source or download
the versioned tarball from `/use`.

```bash
node packages/frontier-cli/bin/frontier.mjs route --profile code.interactive
node packages/frontier-cli/bin/frontier.mjs opencode --profile code.interactive --dry-run
npm --prefix packages/frontier-cli test
```

OpenCode and an authenticated OpenRouter account are required for a live route.
App attribution is explicit and enabled by default; pass `--no-attribution` to
disable it. Receipts remain local unless a future product makes an upload
separately visible and opt-in.

## Verification

```bash
npm run lint
npm test
```

The test suite builds the application, type-checks it, renders all public
surfaces, validates benchmark provenance and Run Fund schemas, exercises the
Gemini policy parser, checks scheduler identity, tests the CLI, and verifies the
downloadable CLI and source archives.

## Deployment

The repository supports source deployment to Cloud Run. Follow
[`hackathon/CLOUD_RUN.md`](hackathon/CLOUD_RUN.md) and provide the Gemini key
through Secret Manager. The static BenchmarkList catalog remains available
without Cloudflare storage; stored benchmark-detail snapshots require the
deployed D1/R2 bindings and are not reproduced by a plain Cloud Run instance.

The deployed ChatGPT Sites origin, the `agent-frontier-clock` Vercel OIDC
identity, and versioned `agent-frontier/*` v0/v1 schema IDs remain in source as
compatibility identifiers. New user-facing artifacts use the Frontier Max
namespace.

## Repository map

- `app/` — product routes and server endpoints
- `lib/` — BenchmarkList ingestion, Gemini policy validation, and clock identity
- `packages/frontier-cli/` — dependency-free Node.js CLI
- `public/frontier/v1/` — current Frontier Max policy manifest
- `public/run-fund/v2/` — current portable Run Fund export schemas
- `scheduler/vercel/` — optional independent refresh clock
- `hackathon/` — Google-track deployment notes and submission artifacts
- `tests/` — product, provenance, routing, and release verification

## Release truth boundary

Before a public submission, complete these account-bound runtime checks:

1. configure and verify the production Gemini key;
2. run one authenticated OpenCode/OpenRouter smoke test.

The reviewer-accessible source is published at
<https://github.com/mcp97/frontiermax>. Everything else in the preview is
designed to remain useful without claiming a
learned universal router or a benchmark result that the source did not report.
