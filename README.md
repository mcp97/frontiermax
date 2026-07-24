# Frontier Max

**Independent model decision infrastructure.**

Frontier Max makes benchmark evidence interpretable and turns declared workload
requirements into inspectable model routes. Gateways move AI traffic; Frontier
Max proves where it should go.

- Live site: <https://agent-frontier.alignedai.chatgpt.site>
- Current release: public and private benchmark evidence, immutable routing
  policies, certification, receipts, organization controls, SDK, and native CLI
- License: MIT; third-party data retains its original terms

## Product boundary

Frontier accepts structured request metadata, not inference content. It does not
proxy prompts or responses, store provider credentials, execute code, or
inspect repositories.

The intended production path is:

```text
Customer application
  -> Frontier route API (structured metadata only)
  -> Concrete model route and fallbacks
  -> Customer application calls OpenRouter directly
  -> Optional metadata-only outcome report
```

Public-evidence routes remain labeled provisional. Organization routes require
a locked held-out aggregate evaluation, an immutable published policy, and an
active certification. Public scores are never presented as private pass
probabilities.

## What works

- `/benchmarks` reads the versioned BenchmarkList API server-side and preserves
  source, metric direction, subject type, sampling date, and missing values.
- `/interpret` applies one honest frame to a source benchmark and renders only
  the dimensions that its evidence actually reports.
- `/route` filters concrete OpenRouter model records by workload, capability,
  context, public quality evidence, and estimated request cost. It calculates a
  deterministic conditional Pareto set and returns a concrete model plus
  concrete fallbacks.
- `POST /api/v1/route` rejects prompt-bearing fields and returns versions,
  reasons, candidate exclusions, privacy flags, expiry, and a deterministic
  manifest hash.
- Route decisions are stored as content-free receipts when D1 is available.
- `/app/evals` imports aggregate private benchmark results as immutable,
  held-out evidence. It accepts counts and timing/cost aggregates, never prompts
  or model outputs.
- `/app/policies` compiles versioned routing artifacts with deterministic
  quality gates and objectives. `/app/compare` shows the actual candidate set
  and conditional Pareto frontier.
- `/app/certifications` certifies concrete models or external routers against a
  frozen evidence snapshot. Certifications are hash-verified and explicitly
  unsigned.
- `/app/receipts` exposes content-free route receipts and accepts metadata-only
  outcomes. Session IDs are hashed and provide bounded route stickiness.
- `/app/settings` manages organization members and scoped API keys. Stored keys
  are salted, peppered, hashed, rate-limited, and shown only once at creation.
- `packages/frontier-sdk` is a standalone TypeScript-friendly source SDK for
  routing, manifest retrieval, metadata-only outcomes, caching, and compiling
  an OpenRouter request without exposing inference content to Frontier Max.
- `packages/frontier-rust-cli` builds the native `frontier` binary for
  certified routes, immutable manifests, OpenRouter handoff fragments, session
  stickiness, and metadata-only outcomes.
- `/methodology`, `/docs`, and `/audit` explain the method, expose the API
  contract, and capture non-sensitive routing-audit requests.
- `/app` uses platform-provided authenticated-user headers server-side and
  scopes every private record to an organization.
- `/api/health` exposes non-sensitive runtime status.
- `/openapi.json` documents the implemented public endpoints.

## Data sources

The server uses:

- BenchmarkList’s versioned JSON API for benchmark metadata and evidence.
- OpenRouter’s Models API for canonical model slugs, capabilities, context, and
  current pricing.

External responses are cached in D1. When refresh fails, a valid cached snapshot
is served with stale status rather than being represented as an empty result.
Missing measurements remain null or “Not measured.”

## Local development

Requirements: Node.js `>=22.13.0`.

```bash
cp .env.example .env.local
npm run install:ci
npm run dev
```

Build the native CLI:

```bash
cargo build --release --locked \
  --manifest-path packages/frontier-rust-cli/Cargo.toml
```

The Rust CLI builds as a native binary. The current source release is verified
on Linux; automated cross-platform binary releases are intentionally not enabled.

The Sites runtime binds:

- `DB` — D1 structured storage
- `BUCKET` — R2 source snapshots

Set `NEXT_PUBLIC_SITE_URL` to the origin used for canonical links. Production
API-key verification also requires the secret `FRONTIER_API_KEY_PEPPER`.

## Verification

```bash
npm run typecheck
npm test
```

The test suite builds and validates the Sites artifact, type-checks the source,
renders public pages, verifies benchmark provenance, exercises the deterministic
router, checks D1 migrations and cached-coverage behavior, and validates retained
release artifacts.

## Legacy compatibility

`packages/frontier-cli`, `/api/interpret`, and archived Run Fund artifacts are
retained only for compatibility with the earlier prototype. They are not linked
from the primary navigation and are not part of the current Frontier Max
decision-control-plane product.

## Repository map

- `app/` — public product, authenticated shell, and API routes
- `lib/public-evidence.ts` — upstream evidence retrieval and stale cache
- `lib/router-engine.ts` — capability gates, cost estimates, and Pareto routing
- `lib/organizations.ts` and `lib/app-context.ts` — authenticated organization,
  scoped API-key, and rate-limit foundation
- `lib/control-plane.ts` — aggregate evidence validation, conservative quality
  bounds, Pareto comparison, and immutable artifact compilation
- `db/` and `drizzle/` — D1 schema and migrations
- `tests/` — rendered, provenance, routing, migration, and release checks
- `packages/frontier-cli/` — legacy compatibility package
- `packages/frontier-sdk/` — source SDK for the private control plane
- `packages/frontier-rust-cli/` — native metadata-only routing CLI

## Current limitations

The current release is a demoable control plane, not a claim of production
readiness. Private imports are JSON aggregate data only; illustrative demo data
is visibly labeled and cannot substantiate a real model-performance claim.
Certifications are hash-verified but not cryptographically signed. Model
identity review is exact-match and read-only; manual overrides are not yet
implemented. External routers can be evaluated and certified, but Frontier Max does
not execute or observe the router’s downstream model choice. Outcome metadata
is recorded but does not yet automatically recalibrate certifications.
