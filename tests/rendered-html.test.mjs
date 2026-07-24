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
  for (const pathname of ["/", "/benchmarks", "/benchmarks/tau_bench", "/interpret", "/route", "/methodology", "/docs", "/audit"]) {
    const response = await render(pathname);
    const html = await response.text();

    assert.equal(response.status, 200, pathname);
    assert.match(html, /Frontier Max/, pathname);
    assert.doesNotMatch(html, />Agent Frontier</, pathname);
  }
});

test("keeps one primary header contract across every public product surface", async () => {
  for (const pathname of ["/", "/benchmarks", "/benchmarks/tau_bench", "/interpret", "/route", "/methodology", "/docs", "/audit"]) {
    const response = await render(pathname);
    const html = await response.text();
    const header = html.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0] ?? "";

    assert.equal(response.status, 200, pathname);
    assert.match(header, /aria-label="Primary navigation"/, pathname);
    assert.match(header, /href="\/benchmarks"[^>]*>Evidence<\//, pathname);
    assert.match(header, /href="\/methodology"[^>]*>Methodology<\//, pathname);
    assert.match(header, /href="\/route"[^>]*>Router Demo<\//, pathname);
    assert.match(header, /href="\/docs"[^>]*>Docs<\//, pathname);
    assert.match(header, /href="\/audit"[^>]*>Routing Audit<\//, pathname);
    assert.match(header, /signin-with-chatgpt[^>]*>Sign in/, pathname);
    assert.doesNotMatch(header, />Fund|>Reader|>Use</, pathname);
  }
});

test("renders the workload-aware 4D measurement space on the home page", async () => {
  const response = await render("/");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /Turn benchmarks/);
  assert.match(html, /into.*decisions/is);
  assert.match(html, /Interactive four-dimensional decision space/);
  assert.match(html, /Drag to rotate the cube/);
  assert.match(html, /X · Cost/);
  assert.match(html, /Y · Latency/);
  assert.match(html, /Z · Evidence/);
  assert.match(html, /4th · Quality/);
  assert.match(html, /aria-label="Workload lens"/);
  assert.match(html, /Public evidence.*Private benchmarks.*Runtime outcomes/is);
  assert.doesNotMatch(html, /Config [A-D]|SIMULATOR/i);
});

test("publishes a route-specific canonical URL on every public surface", async () => {
  const routes = ["/", "/benchmarks", "/benchmarks/tau_bench", "/interpret", "/route"];
  for (const pathname of routes) {
    const response = await render(pathname);
    const html = await response.text();
    const canonicalPath = pathname === "/" ? "/" : pathname;
    assert.match(
      html,
      new RegExp(`rel="canonical" href="https://agent-frontier\\.alignedai\\.chatgpt\\.site${canonicalPath.replaceAll("/", "\\/")}"`),
      pathname,
    );
  }
});

test("renders the BenchmarkList-backed evidence interpreter without an upload surface", async () => {
  const response = await render("/interpret");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(html, /INTERPRET/i);
  assert.match(html, /BenchmarkList/i);
  assert.match(html, /See what a benchmark/i);
  assert.match(html, /The view adapts to the dimensions/i);
  assert.doesNotMatch(html, /upload tool/i);
});

test("renders the source-backed benchmark index", async () => {
  const response = await render("/benchmarks");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(html, /BENCHMARKS/i);
  assert.match(html, /Find a.*benchmark/i);
  assert.match(html, /Search benchmarks, capabilities, or models/i);
  assert.match(html, /Missing fields stay missing/i);
});

test("renders a source-linked benchmark evidence route", async () => {
  const response = await render("/benchmarks/tau_bench");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(html, /BENCHMARK EVIDENCE/i);
  assert.match(html, /MEASURED DIMENSIONS/i);
  assert.match(html, /REPORTED COMPARISON SET/i);
  assert.match(html, /Source and caveat included/i);
  assert.doesNotMatch(html, /FRONTIER MAX FUNDING|No support attached to this record/i);
});

test("renders the structured provisional router without an execution runtime", async () => {
  const response = await render("/route");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(html, /Declare the workload/i);
  assert.match(html, /Public evidence only/i);
  assert.match(html, /01 \/ DECLARE/i);
  assert.match(html, /Simulate route/i);
  assert.match(html, /PROVISIONAL/i);
  assert.match(html, /concrete OpenRouter model and fallbacks/i);
  assert.match(html, /No prompt/i);
  assert.match(html, /Your gateway executes/i);
  assert.doesNotMatch(html, /OpenCode|Download CLI|Install the CLI|Describe the task/i);
});

test("documents the native metadata-only Rust CLI", async () => {
  const response = await render("/docs");
  const html = await response.text();

  assert.match(html, /RUST CLI/);
  assert.match(html, /frontier route/);
  assert.match(html, /FRONTIER_MAX_API_KEY/);
  assert.match(html, /does not accept prompts, model outputs, code, diffs/i);
});

test("redirects the retired Reader and Use routes", async () => {
  const reader = await render("/reader?benchmark=tau_bench");
  const use = await render("/use");

  assert.ok([301, 302, 307, 308].includes(reader.status));
  assert.equal(new URL(reader.headers.get("location"), "http://localhost").pathname, "/interpret");
  assert.ok([301, 302, 307, 308].includes(use.status));
  assert.equal(new URL(use.headers.get("location"), "http://localhost").pathname, "/route");
});

test("redirects the retired Fund route to the commercial audit", async () => {
  const response = await render("/fund");
  assert.ok([301, 302, 307, 308].includes(response.status));
  assert.equal(new URL(response.headers.get("location"), "http://localhost").pathname, "/audit");
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

test("keeps the homepage focused on evidence and routing", async () => {
  const response = await render("/");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /Three evidence layers/i);
  assert.match(html, /One versioned route/i);
  assert.match(html, /Missing evidence stays missing/i);
  assert.doesNotMatch(html, /RUN FUND DRAFT|No money moves here/i);
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
