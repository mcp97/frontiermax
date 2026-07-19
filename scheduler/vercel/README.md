# Frontier Max clock

This small Vercel Workflow project gives Frontier Max an independent clock
without asking a browser visit to advance the BenchmarkList backfill.

One authorized invocation joins the current durable three-day clock cycle and
calls Frontier Max once per remaining 15-minute slot. At the end of the cycle
it starts its successor on the latest production deployment. Starting mid-cycle
does not replay elapsed slots. The daily Vercel Cron is an optional watchdog
when `CRON_SECRET` is configured; a cycle-level hook, plus the Site's D1 lease
and cooldown, discard duplicate work safely.

The Hobby configuration is suitable only for a personal, non-commercial
canary. Before Frontier Max is used commercially, run this clock on Vercel Pro
or Enterprise (or another scheduler whose terms permit commercial use); Vercel
documents Hobby as non-commercial personal use only:
https://vercel.com/docs/limits/fair-use-guidelines

## Production environment

The workflow's privileged request uses Vercel's short-lived OIDC workload
identity, so it does not need a copied Site credential. Its audience is pinned
to the exact Frontier Max clock endpoint and redirects are refused. Frontier Max
accepts only the production `agent-frontier-clock` project in this
Vercel team.

Required variable:

- `CRON_SECRET`: a long random secret. Vercel automatically sends it as
  `Authorization: Bearer <CRON_SECRET>` when invoking the daily route.

When `CRON_SECRET` is unavailable, the route fails closed with `503`; cron
headers and user-agent strings are not treated as authentication. An already
running cycle still renews itself without this route. The active-cycle hook and
the Site's D1 lease/cooldown make authorized starts idempotent and bounded.
Never commit the secret; `openssl rand -hex 32` generates a suitable value.

## Build, deploy, and verify

```bash
npm install
npm run typecheck
npm run build
```

Deploy this directory as its own Vercel project. Cron jobs run only on
production deployments. Set the Vercel project's Root Directory to
`scheduler/vercel` when deploying from this repository.

After deployment:

1. Confirm `/api/cron/clock` returns `401` without the bearer secret, or `503`
   before `CRON_SECRET` is configured.
2. Trigger one authorized invocation or wait for the first configured daily run.
3. Confirm the route returns `202` and a workflow run ID.
4. Check the Site's `/api/status`; `clockProcessingVerified` should become
   `true`, with the latest clock run using the `external-clock` trigger.

The route and workflow logs never return either secret or the upstream body.
Each three-day cycle stays below Vercel Workflow's per-run event and step limits;
the shorter cycle also keeps replay overhead bounded while allowing indefinite
self-renewal.
