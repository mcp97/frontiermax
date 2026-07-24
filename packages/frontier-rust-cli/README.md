# Frontier Max Rust CLI

Fast, native, metadata-only access to certified Frontier Max routing policies.
The CLI never accepts a prompt, model output, source file, diff, repository, or
provider credential.

Build:

```bash
cargo build --release --manifest-path packages/frontier-rust-cli/Cargo.toml
```

Configure a scoped key created in Frontier Max Settings:

```bash
export FRONTIER_MAX_API_KEY="fmx_..."
```

Resolve a sticky coding route:

```bash
frontier route \
  --policy coding-prod \
  --session coding-session-42 \
  --input-tokens 8000 \
  --output-tokens 2000 \
  --context-tokens 16000 \
  --tools
```

Print the OpenRouter handoff fragment:

```bash
frontier route --policy coding-prod --openrouter
```

Inspect a compiled policy:

```bash
frontier manifest coding-prod --json
```

Report operational metadata:

```bash
frontier outcome \
  --route-id rt_... \
  --result accepted \
  --actual-model moonshotai/kimi-k3 \
  --total-latency-ms 8400 \
  --actual-cost 0.018
```

The inference request and `OPENROUTER_API_KEY` remain in the customer
application. The default service is:

```text
https://agent-frontier.alignedai.chatgpt.site
```

