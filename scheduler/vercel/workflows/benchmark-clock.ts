import { getVercelOidcToken } from "@vercel/oidc";
import {
  createHook,
  FatalError,
  getStepMetadata,
  RetryableError,
  sleep,
} from "workflow";
import { start } from "workflow/api";

const DEFAULT_CLOCK_URL =
  "https://agent-frontier.monilpat.chatgpt.site/api/benchmarklist/clock";
const SLOT_INTERVAL = "15m";
const SLOT_INTERVAL_MS = 15 * 60 * 1_000;
const CYCLE_DURATION_MS = 3 * 24 * 60 * 60 * 1_000;
const SLOTS_PER_CYCLE = 3 * 24 * 4;
const CLOCK_STEP_RETRIES = 2;
const RENEWAL_STEP_RETRIES = 5;
const RENEWAL_ROUNDS = 24;
const UPSTREAM_TIMEOUT_MS = 20_000;
const MAX_RETRY_DELAY_MS = 5 * 60_000;

type ClockWorkflowResult =
  | { status: "duplicate"; ownerRunId: string }
  | {
      status: "renewed";
      cycleKey: string;
      nextCycleKey: string;
      nextRunId: string;
      accepted: number;
      exhausted: number;
    }
  | {
      status: "renewal_exhausted";
      cycleKey: string;
      nextCycleKey: string;
      accepted: number;
      exhausted: number;
    };

export function currentCycleKey(now = Date.now()) {
  if (!Number.isFinite(now)) throw new Error("Clock time must be finite");
  const boundary = Math.floor(now / CYCLE_DURATION_MS) * CYCLE_DURATION_MS;
  return new Date(boundary).toISOString();
}

export function previousCycleKey(cycleKey: string) {
  const startedAt = Date.parse(cycleKey);
  if (!Number.isFinite(startedAt)) throw new Error("Clock cycle key is invalid");
  return new Date(startedAt - CYCLE_DURATION_MS).toISOString();
}

export function currentCycle(now = Date.now()) {
  const cycleKey = currentCycleKey(now);
  const boundary = Date.parse(cycleKey);
  return {
    cycleKey,
    startingSlot: Math.min(
      Math.floor((now - boundary) / SLOT_INTERVAL_MS),
      SLOTS_PER_CYCLE - 1,
    ),
  };
}

function followingCycleKey(cycleKey: string) {
  const startedAt = Date.parse(cycleKey);
  if (!Number.isFinite(startedAt)) throw new FatalError("Clock cycle key is invalid");
  return new Date(startedAt + CYCLE_DURATION_MS).toISOString();
}

export async function benchmarkClockWorkflow(
  cycleKey: string,
  startingSlot = 0,
): Promise<ClockWorkflowResult> {
  "use workflow";

  if (
    !Number.isInteger(startingSlot)
    || startingSlot < 0
    || startingSlot >= SLOTS_PER_CYCLE
  ) {
    throw new FatalError("Clock starting slot is invalid");
  }

  using owner = createHook<never>({
    token: `agent-frontier-clock:${cycleKey}`,
  });
  const conflict = await owner.getConflict();

  if (conflict) {
    return { status: "duplicate", ownerRunId: conflict.runId };
  }

  let accepted = 0;
  let exhausted = 0;

  for (let slot = startingSlot; slot < SLOTS_PER_CYCLE; slot += 1) {
    const outcome = await callFrontierMaxClock(cycleKey, slot);
    if (outcome.status === "accepted") accepted += 1;
    else exhausted += 1;
    // Sleeping after the final slot keeps the successor's first call exactly
    // one interval after this cycle's last call.
    await sleep(SLOT_INTERVAL);
  }

  const nextCycleKey = followingCycleKey(cycleKey);
  for (let round = 0; round < RENEWAL_ROUNDS; round += 1) {
    const renewal = await startNextClockCycle(nextCycleKey, round);
    if (renewal.status === "started") {
      return {
        status: "renewed",
        cycleKey,
        nextCycleKey,
        nextRunId: renewal.runId,
        accepted,
        exhausted,
      };
    }
    if (round < RENEWAL_ROUNDS - 1) await sleep(SLOT_INTERVAL);
  }

  return {
    status: "renewal_exhausted",
    cycleKey,
    nextCycleKey,
    accepted,
    exhausted,
  };
}

function retryDelay(attempt: number, retryAfter: string | null) {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(
        Math.max(seconds * 1000, 1_000),
        MAX_RETRY_DELAY_MS,
      );
    }

    const timestamp = Date.parse(retryAfter);
    if (Number.isFinite(timestamp)) {
      return Math.min(
        Math.max(timestamp - Date.now(), 1_000),
        MAX_RETRY_DELAY_MS,
      );
    }
  }

  return Math.min(15_000 * (2 ** Math.max(attempt - 1, 0)), MAX_RETRY_DELAY_MS);
}

function retryOrRecordExhaustion(
  message: string,
  attempt: number,
  retryAfter: string | null = null,
) {
  if (attempt > CLOCK_STEP_RETRIES) {
    console.error("Frontier Max clock slot exhausted retries", {
      message,
      attempt,
    });
    return { status: "exhausted" as const, message };
  }

  throw new RetryableError(message, {
    retryAfter: retryDelay(attempt, retryAfter),
  });
}

async function callFrontierMaxClock(cycleKey: string, slot: number) {
  "use step";

  const metadata = getStepMetadata();
  console.info("Frontier Max clock step started", {
    cycleKey,
    slot,
    attempt: metadata.attempt,
  });

  const endpoint = new URL(DEFAULT_CLOCK_URL);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    let oidcToken: string;
    try {
      oidcToken = await getVercelOidcToken({ audience: DEFAULT_CLOCK_URL });
    } catch {
      return retryOrRecordExhaustion(
        "Vercel workload identity could not be loaded",
        metadata.attempt,
      );
    }
    if (!oidcToken) {
      return retryOrRecordExhaustion(
        "Vercel workload identity is unavailable",
        metadata.attempt,
      );
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${oidcToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": metadata.stepId,
          "User-Agent": "frontier-max-workflow-clock/1.0",
        },
        body: "{}",
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
    } catch {
      return retryOrRecordExhaustion(
        "Frontier Max clock transport failed",
        metadata.attempt,
      );
    }

    if (!response.ok) {
      const message = `Frontier Max rejected the clock: ${response.status}`;
      if (
        response.status === 408
        || response.status === 425
        || response.status === 429
        || response.status >= 500
      ) {
        return retryOrRecordExhaustion(
          message,
          metadata.attempt,
          response.headers.get("retry-after"),
        );
      }
      if (response.status >= 400 && response.status < 500) {
        throw new FatalError(`${message}; stop the cycle until identity or request configuration is corrected`);
      }
      return retryOrRecordExhaustion(message, metadata.attempt);
    }

    console.info("Frontier Max clock step completed", {
      cycleKey,
      slot,
      upstreamStatus: response.status,
    });
    return {
      status: "accepted" as const,
      cycleKey,
      slot,
      upstreamStatus: response.status,
    };
  } finally {
    clearTimeout(timeout);
  }
}

callFrontierMaxClock.maxRetries = CLOCK_STEP_RETRIES;

async function startNextClockCycle(cycleKey: string, round: number) {
  "use step";

  const metadata = getStepMetadata();
  let run: { runId: string };
  try {
    run = await start(benchmarkClockWorkflow, [cycleKey, 0], {
      deploymentId: "latest",
    });
  } catch {
    if (metadata.attempt > RENEWAL_STEP_RETRIES) {
      console.error("Frontier Max clock renewal round exhausted", {
        cycleKey,
        round,
      });
      return { status: "exhausted" as const };
    }
    throw new RetryableError("The next clock cycle could not be started", {
      retryAfter: retryDelay(metadata.attempt, null),
    });
  }
  console.info("Frontier Max clock cycle renewed", {
    cycleKey,
    round,
    runId: run.runId,
  });
  return { status: "started" as const, runId: run.runId };
}

startNextClockCycle.maxRetries = RENEWAL_STEP_RETRIES;
