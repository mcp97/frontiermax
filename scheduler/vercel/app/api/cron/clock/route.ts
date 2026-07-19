import { HookNotFoundError } from "workflow/errors";
import { getHookByToken, start } from "workflow/api";

import {
  benchmarkClockWorkflow,
  currentCycle,
  previousCycleKey,
} from "../../../../workflows/benchmark-clock";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return Response.json(
      { ok: false, error: "clock_not_configured" },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { cycleKey, startingSlot } = currentCycle();
  const candidateCycleKeys = [cycleKey];
  if (startingSlot <= 1) candidateCycleKeys.push(previousCycleKey(cycleKey));

  for (const candidateCycleKey of candidateCycleKeys) {
    try {
      const active = await getHookByToken(
        `agent-frontier-clock:${candidateCycleKey}`,
      );

      return Response.json({ ok: true, started: false, runId: active.runId });
    } catch (error) {
      if (!HookNotFoundError.is(error)) throw error;
    }
  }

  const run = await start(benchmarkClockWorkflow, [cycleKey, startingSlot]);

  return Response.json(
    { ok: true, started: true, runId: run.runId },
    { status: 202 },
  );
}
