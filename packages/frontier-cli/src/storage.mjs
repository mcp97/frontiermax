import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const FRONTIER_DIR = ".frontier";
const RECEIPT_DIR = join(FRONTIER_DIR, "receipts");
const LAST_RECEIPT = join(FRONTIER_DIR, "last-receipt");
const LOCK_FILE = ".frontier.lock";

function refuseSymlink(path, label) {
  if (!existsSync(path)) return;
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) {
    throw new Error(`${label} must not be a symbolic link.`);
  }
}

function requireDirectory(path, label) {
  refuseSymlink(path, label);
  if (existsSync(path) && !lstatSync(path).isDirectory()) {
    throw new Error(`${label} must be a directory.`);
  }
}

function ensureSafeStorage(cwd) {
  const frontierPath = join(cwd, FRONTIER_DIR);
  const receiptDirectory = join(cwd, RECEIPT_DIR);
  requireDirectory(frontierPath, FRONTIER_DIR);
  mkdirSync(frontierPath, { recursive: true, mode: 0o700 });
  requireDirectory(receiptDirectory, RECEIPT_DIR);
  mkdirSync(receiptDirectory, { recursive: true, mode: 0o700 });
  refuseSymlink(join(cwd, LAST_RECEIPT), LAST_RECEIPT);
  refuseSymlink(join(cwd, LOCK_FILE), LOCK_FILE);
  return { frontierPath, receiptDirectory };
}

function writeJsonAtomic(path, value) {
  refuseSymlink(path, path);
  const tempPath = `${path}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  renameSync(tempPath, path);
}

function writeTextAtomic(path, value) {
  refuseSymlink(path, path);
  const tempPath = `${path}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
  writeFileSync(tempPath, value, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  renameSync(tempPath, path);
}

export function createDecisionRecord({ cwd, manifest, profile, attribution }) {
  const { frontierPath } = ensureSafeStorage(cwd);
  const ignorePath = join(frontierPath, ".gitignore");
  refuseSymlink(ignorePath, `${FRONTIER_DIR}/.gitignore`);
  if (!existsSync(ignorePath)) {
    writeFileSync(ignorePath, "*\n!.gitignore\n", { encoding: "utf8", mode: 0o600, flag: "wx" });
  }

  const id = `fr_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const createdAt = new Date().toISOString();
  const receiptPath = join(cwd, RECEIPT_DIR, `${id}.json`);
  const receipt = {
    schema: "frontier-max/decision-receipt/v2",
    id,
    created_at: createdAt,
    cli_version: manifest.cli_version,
    manifest_version: manifest.version,
    policy: {
      profile: profile.id,
      objective: profile.objective,
      quality_tier: profile.quality_tier,
      primary_signal: profile.primary_signal,
    },
    route: {
      runtime: "OpenCode",
      transport: "OpenRouter",
      requested_openrouter_route: profile.openrouter_model,
      opencode_model_argument: profile.opencode_model,
      openrouter_session_id: id,
      scope: manifest.selection_scope,
      selection_contract: manifest.selection_contract,
      resolution: {
        observed_by_frontier_max: false,
        concrete_model: null,
        statement: "This receipt records the requested route, not the concrete model resolved by OpenRouter.",
      },
    },
    attribution,
    privacy: {
      prompt_captured: false,
      code_captured: false,
      diff_captured: false,
    },
    execution: {
      started: false,
      exit_code: null,
    },
    outcome: null,
  };

  const lock = {
    schema: "frontier-max/lock/v2",
    created_at: createdAt,
    cli_version: manifest.cli_version,
    manifest_version: manifest.version,
    profile: profile.id,
    requested_openrouter_route: profile.openrouter_model,
    opencode_model_argument: profile.opencode_model,
    openrouter_session_id: id,
    concrete_model_observed: false,
    objective: profile.objective,
    selection_contract: manifest.selection_contract,
    evidence: manifest.evidence.map(({ publisher, title, url }) => ({
      publisher,
      title,
      url,
    })),
  };

  writeJsonAtomic(receiptPath, receipt);
  writeTextAtomic(join(cwd, LAST_RECEIPT), `${id}\n`);
  writeJsonAtomic(join(cwd, LOCK_FILE), lock);

  return { id, receipt, receiptPath };
}

export function updateDecisionRecord(path, mutate) {
  refuseSymlink(path, "decision receipt");
  const current = JSON.parse(readFileSync(path, "utf8"));
  const updated = mutate(current);
  writeJsonAtomic(path, updated);
  return updated;
}

export function findLastReceipt(cwd) {
  ensureSafeStorage(cwd);
  try {
    const id = readFileSync(join(cwd, LAST_RECEIPT), "utf8").trim();
    if (/^fr_[a-zA-Z0-9_-]+$/.test(id)) {
      const path = join(cwd, RECEIPT_DIR, `${id}.json`);
      if (existsSync(path)) return path;
    }
  } catch {
    // Fall through to a directory scan for older or manually copied receipts.
  }

  let candidates = [];
  try {
    candidates = readdirSync(join(cwd, RECEIPT_DIR))
      .filter((name) => /^fr_[a-zA-Z0-9_-]+\.json$/.test(name))
      .sort()
      .reverse();
  } catch {
    return null;
  }

  return candidates[0] ? join(cwd, RECEIPT_DIR, candidates[0]) : null;
}

export function receiptById(cwd, id) {
  ensureSafeStorage(cwd);
  if (!/^fr_[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error("Receipt ID is invalid.");
  }
  const path = join(cwd, RECEIPT_DIR, `${id}.json`);
  refuseSymlink(path, "decision receipt");
  if (!existsSync(path)) throw new Error(`Receipt ${id} was not found in this project.`);
  return path;
}
