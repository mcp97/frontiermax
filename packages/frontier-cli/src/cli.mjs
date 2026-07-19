import { accessSync, constants, existsSync, readFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { loadManifest, resolveProfile } from "./manifest.mjs";
import {
  createDecisionRecord,
  findLastReceipt,
  receiptById,
  updateDecisionRecord,
} from "./storage.mjs";

const APP_URL = "https://agent-frontier.monilpat.chatgpt.site";
const APP_TITLE = "Frontier Max";
const APP_CATEGORIES = "cli-agent,programming-app";

const HELP = `Frontier Max CLI — policy-neutral routing for OpenCode

Usage
  frontier route [--profile code.interactive|code.delegated] [--json]
  frontier opencode [--profile PROFILE] [--dry-run] [--no-attribution]
  frontier opencode [--profile PROFILE] [--] run "Task"
  frontier outcome accepted|reverted|abandoned [--tests passed|failed|not-run] [--receipt ID]
  frontier why [--profile PROFILE] [--json]
  frontier doctor [--json]
  frontier --version

Examples
  frontier route --profile code.interactive
  frontier opencode --profile code.interactive
  frontier opencode --profile code.delegated -- run "Fix the failing test"
  frontier outcome accepted --tests passed

The wrapper requests a sticky route for the active OpenCode session; OpenRouter
may re-resolve it after five idle minutes or a routing error. Frontier Max does
not read or proxy prompts, code, diffs, API keys, or model responses. OpenRouter
and the provider OpenRouter routes to still receive the content required to run the model.`;

function write(value, stream = process.stdout) {
  stream.write(`${value}\n`);
}

function parseOptions(args) {
  const options = {
    profile: "code.interactive",
    json: false,
    dryRun: false,
    attribution: true,
    passthrough: [],
    seen: new Set(),
  };

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--") {
      options.passthrough.push(...args.slice(index + 1));
      break;
    }
    if (token === "--profile" || token === "-p") {
      const value = args[index + 1];
      if (!value) throw new Error(`${token} requires a value.`);
      options.profile = value;
      options.seen.add("profile");
      index += 1;
      continue;
    }
    if (token.startsWith("--profile=")) {
      options.profile = token.slice("--profile=".length);
      options.seen.add("profile");
      continue;
    }
    if (token === "--json") {
      options.json = true;
      options.seen.add("json");
      continue;
    }
    if (token === "--dry-run") {
      options.dryRun = true;
      options.seen.add("dryRun");
      continue;
    }
    if (token === "--no-attribution") {
      options.attribution = false;
      options.seen.add("attribution");
      continue;
    }
    options.passthrough.push(token);
  }

  return options;
}

function allowOnly(options, command, allowed) {
  const unsupported = [...options.seen].find((name) => !allowed.has(name));
  if (unsupported) {
    const printable = unsupported === "dryRun" ? "--dry-run" : unsupported === "attribution" ? "--no-attribution" : `--${unsupported}`;
    throw new Error(`${printable} is not valid for ${command}.`);
  }
}

function routeSummary(profile, manifest) {
  return {
    manifest_version: manifest.version,
    cli_version: manifest.cli_version,
    profile: profile.id,
    label: profile.label,
    objective: profile.objective,
    requested_route: profile.openrouter_model,
    opencode_model_argument: profile.opencode_model,
    concrete_model_observed: false,
    concrete_model: null,
    selection_scope: manifest.selection_scope,
    selection_contract: manifest.selection_contract,
    router_parameters: profile.router_parameters,
    evidence: manifest.evidence,
    limitations: profile.limitations,
  };
}

function printRoute(profile, manifest) {
  write(`Selected  ${profile.label}`);
  write(`Request   ${profile.openrouter_model}`);
  write(`Objective ${profile.objective}`);
  write("Scope     requested route is sticky while active; underlying model may re-resolve");
  write("");
  write(`Why       ${profile.router_behavior}`);
  write(`Caveat    ${profile.limitations[0]}`);
  write("Observed  concrete underlying model is not observed by Frontier Max");
  write(`Evidence  ${manifest.evidence[0].url}`);
}

function deepMerge(base, overlay) {
  if (!base || typeof base !== "object" || Array.isArray(base)) return overlay;
  if (!overlay || typeof overlay !== "object" || Array.isArray(overlay)) return overlay;
  const output = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    output[key] = key in output ? deepMerge(output[key], value) : value;
  }
  return output;
}

export function openCodeRuntimeEnv(
  existingEnv = process.env,
  {
    profile = resolveProfile("code.interactive"),
    sessionId = `frontier_${Date.now()}`,
    attribution = true,
  } = {},
) {
  let existingInline = {};
  if (existingEnv.OPENCODE_CONFIG_CONTENT) {
    try {
      existingInline = JSON.parse(existingEnv.OPENCODE_CONFIG_CONTENT);
    } catch {
      throw new Error("OPENCODE_CONFIG_CONTENT exists but is not valid JSON.");
    }
  }

  const runtime = {
    provider: {
      openrouter: {
        options: {
          ...(attribution
            ? {
                headers: {
                  "HTTP-Referer": APP_URL,
                  "X-OpenRouter-Title": APP_TITLE,
                  "X-OpenRouter-Categories": APP_CATEGORIES,
                },
              }
            : {}),
        },
        models: {
          [profile.openrouter_model]: {
            options: {
              session_id: sessionId,
              plugins: [
                {
                  id: profile.router_parameters.plugin_id,
                  min_coding_score: profile.router_parameters.min_coding_score,
                },
              ],
            },
          },
        },
      },
    },
  };

  return {
    ...existingEnv,
    OPENCODE_CLIENT: "frontier-max",
    OPENCODE_CONFIG_CONTENT: JSON.stringify(deepMerge(existingInline, runtime)),
  };
}

export function attributedOpenCodeEnv(existingEnv = process.env) {
  return openCodeRuntimeEnv(existingEnv, { attribution: true });
}

function buildOpenCodeArgs(profile, passthrough) {
  if (passthrough.some((token) => token === "--model" || token === "-m" || token.startsWith("--model="))) {
    throw new Error("The selected policy owns --model. Run OpenCode directly to choose a fixed model.");
  }

  const unsupportedSessionFlags = new Set(["--attach", "--continue", "-c", "--session", "-s"]);
  const unsupported = passthrough.find((token) => unsupportedSessionFlags.has(token) || token.startsWith("--attach=") || token.startsWith("--session="));
  if (unsupported) {
    throw new Error(`${unsupported} is not supported by the routing preview because it can separate or resume a session without a stable Frontier route.`);
  }

  if (passthrough[0] === "run") {
    return ["run", "--model", profile.opencode_model, ...passthrough.slice(1)];
  }

  if (passthrough.length) {
    throw new Error("The routing preview supports the OpenCode TUI with no extra arguments, or `-- run \"Task\"`.");
  }

  return ["--model", profile.opencode_model, ...passthrough];
}

function shellQuote(token) {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(token)) return token;
  return `'${token.replaceAll("'", `'\\''`)}'`;
}

function executableInPath(command, env = process.env) {
  const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const directory of (env.PATH ?? "").split(delimiter)) {
    if (!directory) continue;
    for (const extension of extensions) {
      const candidate = join(directory, `${command}${extension}`);
      try {
        accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
        // Keep looking.
      }
    }
  }
  return null;
}

function authStoreExists(env = process.env) {
  if (env.OPENROUTER_API_KEY) return true;
  const dataHome = env.XDG_DATA_HOME ?? join(homedir(), ".local", "share");
  const candidates = [
    join(dataHome, "opencode", "auth.json"),
    join(homedir(), "Library", "Application Support", "opencode", "auth.json"),
    ...(env.APPDATA ? [join(env.APPDATA, "opencode", "auth.json")] : []),
  ];
  return candidates.some((path) => {
    if (!existsSync(path)) return false;
    try {
      const auth = JSON.parse(readFileSync(path, "utf8"));
      if (!auth || typeof auth !== "object") return false;
      return Object.keys(auth).some((key) => key.toLowerCase() === "openrouter");
    } catch {
      return false;
    }
  });
}

function doctorResult(env = process.env) {
  return {
    opencode: {
      ok: Boolean(executableInPath("opencode", env)),
      detail: executableInPath("opencode", env) ? "found in PATH" : "not found in PATH",
    },
    openrouter_auth: {
      ok: authStoreExists(env),
      detail: authStoreExists(env)
        ? "environment key or OpenCode auth store detected"
        : "not detected; run OpenCode and use /connect → OpenRouter",
    },
    content_capture: {
      ok: true,
      detail: "not captured by Frontier Max; OpenRouter and the provider it routes to still receive model input",
    },
  };
}

function handleOutcome(args, cwd) {
  const status = args[0];
  const allowed = new Set(["accepted", "reverted", "abandoned"]);
  if (!allowed.has(status)) {
    throw new Error("Outcome must be accepted, reverted, or abandoned.");
  }

  let tests = "not-run";
  let receiptId = null;
  for (let index = 1; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--tests" || token === "--receipt") {
      const value = args[index + 1];
      if (!value) throw new Error(`${token} requires a value.`);
      if (token === "--tests") tests = value;
      else receiptId = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown outcome option "${token}".`);
  }
  if (!new Set(["passed", "failed", "not-run"]).has(tests)) {
    throw new Error("--tests must be passed, failed, or not-run.");
  }

  const receiptPath = receiptId ? receiptById(cwd, receiptId) : findLastReceipt(cwd);
  if (!receiptPath) throw new Error("No local decision receipt found in this project.");
  const receipt = updateDecisionRecord(receiptPath, (current) => ({
    ...current,
    outcome: {
      status,
      tests,
      recorded_at: new Date().toISOString(),
      capture: "local-only",
    },
  }));

  write(`Recorded ${receipt.outcome.status} · tests ${receipt.outcome.tests}`);
  write(`Receipt  ${receipt.id}`);
  write("No code, prompt, diff, or model response was captured.");
}

export async function run(args, context = {}) {
  const cwd = context.cwd ?? process.cwd();
  const env = context.env ?? process.env;
  const spawn = context.spawn ?? spawnSync;
  const command = args[0] ?? "help";
  const rest = args.slice(1);
  const manifest = loadManifest();

  if (command === "--version" || command === "version" || command === "-v") {
    write(manifest.cli_version);
    return 0;
  }

  if (command === "help" || command === "--help" || command === "-h") {
    write(HELP);
    return 0;
  }

  if (command === "route" || command === "why") {
    const options = parseOptions(rest);
    allowOnly(options, command, new Set(["profile", "json"]));
    const unknownOption = options.passthrough.find((token) => token.startsWith("-"));
    if (unknownOption) throw new Error(`Unknown ${command} option "${unknownOption}".`);
    if (options.passthrough.length > 1) throw new Error(`${command} accepts at most one profile name.`);
    const positionalProfile = options.passthrough[0];
    const profile = resolveProfile(positionalProfile ?? options.profile, manifest);
    if (options.json) write(JSON.stringify(routeSummary(profile, manifest), null, 2));
    else printRoute(profile, manifest);
    return 0;
  }

  if (command === "doctor") {
    const options = parseOptions(rest);
    allowOnly(options, command, new Set(["json"]));
    if (options.passthrough.length) throw new Error(`Unknown doctor option "${options.passthrough[0]}".`);
    const result = doctorResult(env);
    if (options.json) {
      write(JSON.stringify(result, null, 2));
    } else {
      for (const [name, check] of Object.entries(result)) {
        write(`${check.ok ? "✓" : "×"} ${name.replaceAll("_", " ")} — ${check.detail}`);
      }
    }
    return Object.values(result).every((check) => check.ok) ? 0 : 1;
  }

  if (command === "outcome") {
    handleOutcome(rest, cwd);
    return 0;
  }

  if (command !== "opencode") {
    throw new Error(`Unknown command "${command}". Run frontier help.`);
  }

  const options = parseOptions(rest);
  allowOnly(options, command, new Set(["profile", "dryRun", "attribution"]));
  const profile = resolveProfile(options.profile, manifest);
  const openCodeArgs = buildOpenCodeArgs(profile, options.passthrough);

  if (options.dryRun) {
    printRoute(profile, manifest);
    write("");
    write(`Command   opencode ${openCodeArgs.map(shellQuote).join(" ")}`);
    write(`Headers   ${options.attribution ? "Frontier Max attribution enabled" : "attribution disabled"}`);
    write("Writes    none (dry run)");
    return 0;
  }

  const attribution = options.attribution
    ? { enabled: true, url: APP_URL, title: APP_TITLE, categories: APP_CATEGORIES.split(",") }
    : { enabled: false };
  const { id, receiptPath } = createDecisionRecord({ cwd, manifest, profile, attribution });
  const startedAt = Date.now();
  updateDecisionRecord(receiptPath, (current) => ({
    ...current,
    execution: { ...current.execution, started: true, started_at: new Date().toISOString() },
  }));

  const childEnv = openCodeRuntimeEnv(env, {
    profile,
    sessionId: id,
    attribution: options.attribution,
  });
  write(`Attribution ${options.attribution ? "enabled (use --no-attribution to disable)" : "disabled"}`);
  write("Privacy     Frontier Max does not capture content; OpenRouter and the provider it routes to receive model input.");
  const result = spawn("opencode", openCodeArgs, {
    cwd,
    env: childEnv,
    stdio: "inherit",
  });
  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  updateDecisionRecord(receiptPath, (current) => ({
    ...current,
    execution: {
      ...current.execution,
      completed_at: new Date().toISOString(),
      exit_code: exitCode,
      duration_ms: Math.max(0, Date.now() - startedAt),
      signal: result.signal ?? null,
      error: result.error?.message ?? null,
    },
  }));

  if (result.error) throw result.error;
  return exitCode;
}

export const internals = {
  buildOpenCodeArgs,
  doctorResult,
  parseOptions,
  routeSummary,
};
