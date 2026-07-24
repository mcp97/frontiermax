# Frontier Max TypeScript SDK source

This source package is not published to npm.

The SDK sends only policy and structured request metadata to Frontier Max. It
returns a concrete route, applies that route to an OpenRouter request locally,
and leaves the prompt and OpenRouter key in the customer application.

```js
import {
  FrontierClient,
  compileOpenRouterRequest,
} from "@frontier-max/sdk";

const frontier = new FrontierClient({
  baseUrl: "https://agent-frontier.alignedai.chatgpt.site",
  apiKey: process.env.FRONTIER_API_KEY,
});

const decision = await frontier.route({
  policy: "coding-prod",
  features: {
    input_tokens_estimate: 8000,
    output_tokens_estimate: 2000,
    input_modalities: ["text"],
    output_modalities: ["text"],
    requires_tools: true,
    requires_structured_output: false,
    required_context_tokens: 16000,
    complexity_hint: "medium",
    risk_class: "standard",
  },
});

const openRouterRequest = compileOpenRouterRequest(decision, {
  messages,
});

// Send openRouterRequest directly to OpenRouter with OPENROUTER_API_KEY.
```

Never expose the Frontier API key or OpenRouter key in browser code.
