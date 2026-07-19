import assert from "node:assert/strict";
import { linkSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { attributedOpenCodeEnv, internals, openCodeRuntimeEnv, run } from "../src/cli.mjs";
import { loadManifest, resolveProfile } from "../src/manifest.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("resolves workload profiles and aliases", () => {
  const manifest = loadManifest();
  assert.equal(resolveProfile("interactive", manifest).id, "code.interactive");
  assert.equal(resolveProfile("delegated", manifest).id, "code.delegated");
  assert.throws(() => resolveProfile("mystery", manifest), /Unknown profile/);
});

test("package ships the test harness used by its npm test script", () => {
  const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  assert.equal(packageJson.scripts.test, "node --test test/*.test.mjs");
  assert.ok(packageJson.files.includes("test"));
});

test("builds OpenCode arguments without allowing model override", () => {
  const profile = resolveProfile("code.interactive");
  assert.deepEqual(internals.buildOpenCodeArgs(profile, ["run", "Fix it"]), [
    "run",
    "--model",
    "openrouter/openrouter/pareto-code:nitro",
    "Fix it",
  ]);
  assert.throws(
    () => internals.buildOpenCodeArgs(profile, ["--model", "another/model"]),
    /policy owns --model/,
  );
});

test("merges attribution into existing inline OpenCode config", () => {
  const env = attributedOpenCodeEnv({
    PATH: "/bin",
    OPENCODE_CONFIG_CONTENT: JSON.stringify({ autoupdate: false, share: "manual", provider: { openrouter: { options: { timeout: 10 } } } }),
  });
  const config = JSON.parse(env.OPENCODE_CONFIG_CONTENT);
  assert.equal(config.autoupdate, false);
  assert.equal(config.provider.openrouter.options.timeout, 10);
  assert.equal(
    config.provider.openrouter.options.headers["HTTP-Referer"],
    "https://agent-frontier.monilpat.chatgpt.site",
  );
  assert.equal(config.provider.openrouter.options.headers["X-OpenRouter-Title"], "Frontier Max");
  assert.equal(config.share, "manual");
});

test("injects an explicit Pareto tier and session without requiring attribution", () => {
  const profile = resolveProfile("code.delegated");
  const env = openCodeRuntimeEnv({}, { profile, sessionId: "session_test", attribution: false });
  const config = JSON.parse(env.OPENCODE_CONFIG_CONTENT);
  const model = config.provider.openrouter.models["openrouter/pareto-code"];
  assert.equal(model.options.session_id, "session_test");
  assert.deepEqual(model.options.plugins, [{
    id: profile.router_parameters.plugin_id,
    min_coding_score: profile.router_parameters.min_coding_score,
  }]);
  assert.equal(config.provider.openrouter.options.headers, undefined);
});

test("dry run has no filesystem or process side effects", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "frontier-dry-"));
  let spawned = false;
  const code = await run(
    ["opencode", "--profile", "code.delegated", "--dry-run", "--", "run", "Fix it"],
    { cwd, env: {}, spawn: () => { spawned = true; } },
  );
  assert.equal(code, 0);
  assert.equal(spawned, false);
  assert.throws(() => readFileSync(join(cwd, ".frontier.lock"), "utf8"));
});

test("launch writes a content-free receipt and lock", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "frontier-run-"));
  let invocation;
  const code = await run(
    ["opencode", "--profile", "code.interactive", "--", "run", "Fix it"],
    {
      cwd,
      env: { PATH: "/bin" },
      spawn: (command, args, options) => {
        invocation = { command, args, options };
        return { status: 0 };
      },
    },
  );

  assert.equal(code, 0);
  assert.equal(invocation.command, "opencode");
  assert.deepEqual(invocation.args.slice(0, 3), [
    "run",
    "--model",
    "openrouter/openrouter/pareto-code:nitro",
  ]);
  const config = JSON.parse(invocation.options.env.OPENCODE_CONFIG_CONTENT);
  assert.equal(config.provider.openrouter.options.headers["X-OpenRouter-Title"], "Frontier Max");
  assert.equal(
    config.provider.openrouter.models["openrouter/pareto-code:nitro"].options.session_id,
    readFileSync(join(cwd, ".frontier", "last-receipt"), "utf8").trim(),
  );

  const lock = JSON.parse(readFileSync(join(cwd, ".frontier.lock"), "utf8"));
  assert.equal(lock.profile, "code.interactive");
  assert.equal(lock.requested_openrouter_route, "openrouter/pareto-code:nitro");
  assert.equal(lock.concrete_model_observed, false);
  assert.equal("openrouter_model" in lock, false);
  const receiptId = readFileSync(join(cwd, ".frontier", "last-receipt"), "utf8").trim();
  const receipt = JSON.parse(
    readFileSync(join(cwd, ".frontier", "receipts", `${receiptId}.json`), "utf8"),
  );
  assert.equal(receipt.privacy.prompt_captured, false);
  assert.equal(receipt.privacy.code_captured, false);
  assert.equal(receipt.route.requested_openrouter_route, "openrouter/pareto-code:nitro");
  assert.equal(receipt.route.resolution.observed_by_frontier_max, false);
  assert.equal(receipt.route.resolution.concrete_model, null);
  assert.match(receipt.route.resolution.statement, /requested route, not the concrete model/i);
  assert.equal("requested_model" in receipt.route, false);
  assert.equal(receipt.execution.exit_code, 0);
  assert.equal(typeof receipt.execution.duration_ms, "number");
  assert.equal(JSON.stringify(receipt).includes("Fix it"), false);
});

test("the executable propagates an unhealthy doctor status", () => {
  const home = mkdtempSync(join(tmpdir(), "frontier-doctor-"));
  const result = spawnSync(process.execPath, [join(packageRoot, "bin", "frontier.mjs"), "doctor"], {
    encoding: "utf8",
    env: { HOME: home, XDG_DATA_HOME: join(home, "data"), PATH: "" },
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /openrouter auth/i);
});

test("prints the package version from the policy manifest", () => {
  const manifest = loadManifest();
  const result = spawnSync(process.execPath, [join(packageRoot, "bin", "frontier.mjs"), "--version"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), manifest.cli_version);
});

test("rejects session modes that cannot preserve the routing contract", async () => {
  await assert.rejects(
    run(["opencode", "--", "run", "--continue", "Fix it"], { cwd: tmpdir(), env: {}, spawn: () => ({ status: 0 }) }),
    /not supported by the routing preview/,
  );
  await assert.rejects(
    run(["opencode", "--", "serve"], { cwd: tmpdir(), env: {}, spawn: () => ({ status: 0 }) }),
    /supports the OpenCode TUI/,
  );
});

test("records an outcome against an explicit receipt", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "frontier-outcome-"));
  await run(["opencode", "--profile", "code.interactive"], {
    cwd,
    env: { PATH: "/bin" },
    spawn: () => ({ status: 0 }),
  });
  const receiptId = readFileSync(join(cwd, ".frontier", "last-receipt"), "utf8").trim();
  await run(["outcome", "accepted", "--tests", "passed", "--receipt", receiptId], { cwd });
  const receipt = JSON.parse(readFileSync(join(cwd, ".frontier", "receipts", `${receiptId}.json`), "utf8"));
  assert.equal(receipt.outcome.status, "accepted");
  assert.equal(receipt.outcome.tests, "passed");
});

test("refuses repository-controlled symlink storage targets", async () => {
  const outside = mkdtempSync(join(tmpdir(), "frontier-outside-"));

  const linkedRoot = mkdtempSync(join(tmpdir(), "frontier-link-root-"));
  symlinkSync(outside, join(linkedRoot, ".frontier"), "dir");
  await assert.rejects(
    run(["opencode"], { cwd: linkedRoot, env: {}, spawn: () => ({ status: 0 }) }),
    /must not be a symbolic link/,
  );

  const linkedReceipts = mkdtempSync(join(tmpdir(), "frontier-link-receipts-"));
  mkdirSync(join(linkedReceipts, ".frontier"));
  symlinkSync(outside, join(linkedReceipts, ".frontier", "receipts"), "dir");
  await assert.rejects(
    run(["opencode"], { cwd: linkedReceipts, env: {}, spawn: () => ({ status: 0 }) }),
    /must not be a symbolic link/,
  );

  const linkedLock = mkdtempSync(join(tmpdir(), "frontier-link-lock-"));
  const outsideFile = join(outside, "lock.json");
  writeFileSync(outsideFile, "outside");
  symlinkSync(outsideFile, join(linkedLock, ".frontier.lock"));
  await assert.rejects(
    run(["opencode"], { cwd: linkedLock, env: {}, spawn: () => ({ status: 0 }) }),
    /must not be a symbolic link/,
  );
  assert.equal(readFileSync(outsideFile, "utf8"), "outside");
});

test("ignores a traversal value in the last-receipt pointer", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "frontier-pointer-traversal-"));
  const victim = join(cwd, "victim.json");
  writeFileSync(victim, '{"safe":true}\n');
  mkdirSync(join(cwd, ".frontier", "receipts"), { recursive: true });
  writeFileSync(join(cwd, ".frontier", "last-receipt"), "../../victim\n");

  await assert.rejects(
    run(["outcome", "accepted"], { cwd }),
    /No local decision receipt found/i,
  );
  assert.equal(readFileSync(victim, "utf8"), '{"safe":true}\n');
});

test("atomically replaces a hard-linked last-receipt pointer", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "frontier-pointer-hardlink-"));
  const outside = mkdtempSync(join(tmpdir(), "frontier-pointer-outside-"));
  const victim = join(outside, "same-user-file");
  writeFileSync(victim, "unchanged\n");
  mkdirSync(join(cwd, ".frontier", "receipts"), { recursive: true });
  linkSync(victim, join(cwd, ".frontier", "last-receipt"));

  await run(["opencode"], {
    cwd,
    env: { PATH: "/bin" },
    spawn: () => ({ status: 0 }),
  });
  assert.equal(readFileSync(victim, "utf8"), "unchanged\n");
});
