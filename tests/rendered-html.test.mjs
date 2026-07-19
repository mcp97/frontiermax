import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function render(pathname) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("does not publish development-only preview metadata", async () => {
  const response = await render("/");

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.doesNotMatch(await response.text(), developmentPreviewMeta);
});

test("renders Frontier Max branding across every public product surface", async () => {
  for (const pathname of ["/", "/benchmarks", "/benchmarks/tau_bench", "/reader", "/use", "/fund"]) {
    const response = await render(pathname);
    const html = await response.text();

    assert.equal(response.status, 200, pathname);
    assert.match(html, /Frontier Max/, pathname);
    assert.doesNotMatch(html, />Agent Frontier</, pathname);
  }
});

test("renders the strict, source-preserving benchmark reader", async () => {
  const response = await render("/reader");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(html, /BENCHMARK READER/i);
  assert.match(html, /frontier_schema_version/i);
  assert.match(html, /commercial_use_status/i);
  assert.match(html, /Illustrative sample/i);
  assert.match(html, /Download receipt/i);
});

test("renders the source-backed benchmark catalog", async () => {
  const response = await render("/benchmarks");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(html, /LIVE EVIDENCE CATALOG/i);
  assert.match(html, /Public.*benchmarks/i);
  assert.match(html, /Search benchmarks, capabilities, or models/i);
  assert.match(html, /Backfill status/i);
  assert.match(html, /Detail snapshots stored on demand/i);
  assert.match(html, /Missing cost, completion time, and token use remain unavailable/i);
});

test("renders a benchmark nutrition label route", async () => {
  const response = await render("/benchmarks/tau_bench");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(html, /BENCHMARK NUTRITION LABEL/i);
  assert.match(html, /MEASUREMENT COVERAGE/i);
  assert.match(html, /REPORTED COMPARISON SET/i);
  assert.match(html, /One claim\. One caveat\. One source\./i);
  assert.match(html, /Funding should explain the run/i);
});

test("renders the OpenRouter and OpenCode activation route", async () => {
  const response = await render("/use");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(html, /Choose the frontier/i);
  assert.match(html, /OpenRouter × OpenCode/i);
  assert.match(html, /Gemini 3\.5 Flash/i);
  assert.match(html, /Interpret task with Gemini/i);
  assert.match(html, /Content-free receipts/i);
  assert.match(html, /policy-neutral by design/i);
  assert.match(html, /Sticky while active/i);
  assert.match(html, /Nothing is uploaded/i);
  assert.match(html, /Download CLI preview/i);
  assert.match(html, /Download MIT source/i);
});

test("renders the neutral Run Fund formation flow", async () => {
  const response = await render("/fund");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(html, /Benchmarks are public infrastructure/i);
  assert.match(html, /Founder outreach pending/i);
  assert.match(html, /Minimum to evidence work/i);
  assert.match(html, /Review OSC Fund structure/i);
  assert.match(html, /Preregistration does not guarantee prepayment/i);
  assert.match(html, /No checkout is active/i);
  assert.match(html, /Prepare a draft/i);
  assert.match(html, /Money can create evidence/i);
});

test("keeps the Run Fund closed until the selected host approves the public rail", async () => {
  const policy = JSON.parse(
    await readFile(new URL("../public/run-fund/v1/funding-policy.json", import.meta.url), "utf8"),
  );

  assert.equal(policy.accepting_money, false);
  assert.equal(policy.cash_held_usd, 0);
  assert.equal(policy.awards_or_expenses_paid, 0);
  assert.equal(policy.rail_under_review.selection_status, "not_selected");
  assert.equal(policy.rail_under_review.preferred_fiscal_host, "Open Source Collective");
  assert.equal(policy.rail_under_review.host_status, "structure_drafted");
  assert.equal(policy.rail_under_review.payment_url, null);
  assert.equal(policy.rail_under_review.tax_deductibility_claimed, false);
  assert.equal(policy.allocation.eligible_evidence_work_minimum_percent, 80);
  assert.equal(policy.allocation.fiscal_host.expected_percent, 10);
  assert.equal(policy.allocation.frontier_max_program_operations.maximum_percent_during_pilot, 0);
  assert.equal(policy.allocation.payment_processing.markup, false);
  assert.equal(policy.payout_and_failure.preregistration_does_not_guarantee_prepayment, true);
  assert.equal(policy.payout_and_failure.host_rules_control_prepayment_vs_reimbursement, true);
  assert.ok(policy.required_before_payments.includes("written host guidance on OSC Fund versus hosted-project program"));
});

test("labels the synthetic frontier as a concept simulator and links the Run Fund", async () => {
  const response = await render("/");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /THE RUN FUND/i);
  assert.match(html, /CONCEPT SIMULATOR/i);
  assert.match(html, /taxonomy only/i);
});

test("accepts a same-origin bounded refresh tick and rejects cross-origin triggers", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("tick-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  let backgroundWork;
  const runtime = {
    DB: {
      prepare(sql) {
        assert.match(sql, /FROM scrape_runs/i);
        return {
          async first() {
            return { started_at: Date.now() };
          },
        };
      },
    },
  };
  const context = {
    waitUntil(promise) {
      backgroundWork = promise;
    },
    passThroughOnException() {},
  };

  const accepted = await worker.fetch(
    new Request("http://localhost/api/benchmarklist/tick", {
      method: "POST",
      headers: { origin: "http://localhost" },
    }),
    runtime,
    context,
  );
  assert.equal(accepted.status, 202);
  assert.deepEqual(await accepted.json(), {
    accepted: true,
    mode: "bounded-background-refresh",
  });
  assert.ok(backgroundWork instanceof Promise);
  assert.equal((await backgroundWork).reason, "cooldown");

  const rejected = await worker.fetch(
    new Request("http://localhost/api/benchmarklist/tick", {
      method: "POST",
      headers: { origin: "https://example.com" },
    }),
    runtime,
    {
      waitUntil() {
        assert.fail("Cross-origin requests must not start background work");
      },
      passThroughOnException() {},
    },
  );
  assert.equal(rejected.status, 403);
});

test("protects the external clock and starts an authenticated cooldown-aware refresh", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("clock-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const request = (authorization) =>
    new Request("http://localhost/api/benchmarklist/clock", {
      method: "POST",
      headers: authorization ? { authorization } : undefined,
    });
  const rejectingContext = {
    waitUntil() {
      assert.fail("Rejected clock requests must not start background work");
    },
    passThroughOnException() {},
  };

  const missingBearer = await worker.fetch(
    request(),
    {},
    rejectingContext,
  );
  assert.equal(missingBearer.status, 401);
  assert.deepEqual(await missingBearer.json(), { error: "Unauthorized." });

  const wrongBearer = await worker.fetch(
    request("Bearer wrong-secret"),
    { BENCHMARK_SYNC_TOKEN: "sync-secret" },
    rejectingContext,
  );
  assert.equal(wrongBearer.status, 401);
  assert.deepEqual(await wrongBearer.json(), { error: "Unauthorized." });

  let backgroundWork;
  const accepted = await worker.fetch(
    request("Bearer sync-secret"),
    {
      BENCHMARK_SYNC_TOKEN: "sync-secret",
      DB: {
        prepare(sql) {
          if (/FROM refresh_state/i.test(sql)) {
            return {
              async first() {
                return {
                  name: "benchmarklist",
                  last_success_at: Date.now(),
                  catalog_r2_key: "benchmarklist/catalog.json",
                };
              },
            };
          }
          assert.match(sql, /FROM scrape_runs/i);
          return {
            async first() {
              return {
                id: "recent-request-run",
                trigger: "request",
                status: "succeeded",
                started_at: Date.now(),
              };
            },
          };
        },
      },
      BUCKET: {
        async get(key) {
          assert.equal(key, "benchmarklist/catalog.json");
          return {
            async text() {
              return JSON.stringify({ benchmarks: [] });
            },
          };
        },
      },
    },
    {
      waitUntil(promise) {
        backgroundWork = promise;
      },
      passThroughOnException() {},
    },
  );

  assert.equal(accepted.status, 202);
  assert.deepEqual(await accepted.json(), {
    accepted: true,
    mode: "external-clock-refresh",
  });
  assert.ok(backgroundWork instanceof Promise);
  assert.equal((await backgroundWork).reason, "cooldown");
});
