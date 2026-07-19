# Frontier Max CLI

An open, policy-neutral launcher that turns a workload choice into a reproducible OpenCode route through OpenRouter.

This preview deliberately does two things only:

- `code.interactive` uses `openrouter/pareto-code:nitro`, which asks OpenRouter for the fastest available model in its current high Artificial Analysis coding tier.
- `code.delegated` uses `openrouter/pareto-code`, which asks OpenRouter for the cheapest available model in that same tier.

It passes an explicit OpenRouter `session_id`, writes a local `.frontier.lock`, and creates a content-free decision receipt. OpenRouter keeps the requested Pareto route sticky while the session is active, but may re-resolve the concrete underlying model after five idle minutes or a routing error; if the requested quality tier is entirely unavailable, it may use a neighboring tier.

The lock and receipt record the policy and requested OpenRouter route. Frontier Max does not currently observe or claim to record the concrete model that OpenRouter resolves behind that route. A receipt is therefore evidence of the routing request—not proof that a particular underlying model served the run.

Frontier Max does not proxy or inspect prompts, repository content, diffs, API keys, or model responses. OpenRouter and the provider it routes to still receive the content required to run the model under their own data policies.
The wrapper preserves the user's existing OpenCode sharing setting; it does not
silently enable or disable sharing.

## Install after registry publication

```bash
npm install --global frontier-max
frontier doctor
```

Until the first registry release, use the versioned tarball on the Frontier Max `/use` page or run directly from this repository.

OpenCode and an authenticated OpenRouter account are required for live routes. The router itself has no Frontier Max account and keeps content-free receipts on your machine.

## Try from this repository

```bash
node packages/frontier-cli/bin/frontier.mjs route --profile code.interactive
node packages/frontier-cli/bin/frontier.mjs opencode --profile code.interactive --dry-run
```

Before launching, install OpenCode and connect OpenRouter inside OpenCode with `/connect`.

```bash
node packages/frontier-cli/bin/frontier.mjs opencode --profile code.interactive
```

For a delegated run:

```bash
node packages/frontier-cli/bin/frontier.mjs opencode \
  --profile code.delegated -- run "Fix the failing integration test"
```

After reviewing the result, optionally record a local outcome:

```bash
node packages/frontier-cli/bin/frontier.mjs outcome accepted --tests passed
```

For concurrent runs, target the receipt printed at launch:

```bash
node packages/frontier-cli/bin/frontier.mjs outcome accepted \
  --tests passed --receipt fr_123_example
```

Receipts inside `.frontier/` are ignored by the package-created nested `.gitignore`. Add `.frontier.lock` to your repository's root `.gitignore` if you do not want to version the policy lock.

## Transparency

The wrapper injects OpenRouter's documented app-attribution headers so aggregate usage can be attributed to Frontier Max. Disable this with `--no-attribution`. The headers contain the public app URL, title, and marketplace categories—not task content. The runtime config also explicitly sets the Pareto quality tier and a session ID; this OpenCode/OpenRouter option path should receive one authenticated smoke test before registry publication.

This is not yet a learned router. It exposes OpenRouter Pareto Code's current behavior and its limitations without pretending model price is verified cost per success, p50 throughput is time to accepted change, or a requested route identifies the concrete model that served a run. Outcomes remain local; the preview does not upload them.
