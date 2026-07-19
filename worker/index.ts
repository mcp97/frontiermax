/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  refreshClockBatchIfDue,
  refreshDetailBatchIfDue,
  type ScrapeEnv,
} from "../lib/benchmarklist";
import { verifyVercelClockToken } from "../lib/vercel-clock-oidc";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  BUCKET: R2Bucket;
  BENCHMARK_SYNC_TOKEN?: string;
  VERCEL_CLOCK_TEAM_SLUG?: string;
  VERCEL_CLOCK_TEAM_ID?: string;
  VERCEL_CLOCK_PROJECT_NAME?: string;
  VERCEL_CLOCK_PROJECT_ID?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

function sameSecret(left: string, right: string) {
  if (left.length !== right.length || !left.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function clockTokenIsAuthorized(
  configured: string,
  supplied: string,
  oidcIdentity: {
    teamSlug?: string;
    teamId?: string;
    projectName?: string;
    projectId?: string;
  },
) {
  if (configured && sameSecret(configured, supplied)) return true;
  return verifyVercelClockToken(supplied, oidcIdentity);
}

async function observeClockRun(
  run: Promise<unknown>,
  trigger: "scheduled" | "external-clock",
) {
  try {
    const result = await run;
    const summary = result && typeof result === "object"
      ? result as Record<string, unknown>
      : {};
    console.info(JSON.stringify({
      event: "benchmarklist-clock",
      trigger,
      outcome: "fulfilled",
      skipped: summary.skipped === true,
      reason: typeof summary.reason === "string" ? summary.reason : null,
      processed: typeof summary.processed === "number" ? summary.processed : null,
    }));
    return result;
  } catch (error) {
    console.error(JSON.stringify({
      event: "benchmarklist-clock",
      trigger,
      outcome: "rejected",
      error: error instanceof Error
        ? error.message.slice(0, 500)
        : "Unknown scheduled refresh error",
    }));
    throw error;
  }
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/benchmarklist/tick" && request.method === "POST") {
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin) {
        return Response.json(
          { error: "Cross-origin refresh requests are not accepted." },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        );
      }
      ctx.waitUntil(
        refreshDetailBatchIfDue(env as unknown as ScrapeEnv),
      );
      return Response.json(
        { accepted: true, mode: "bounded-background-refresh" },
        { status: 202, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (url.pathname === "/api/benchmarklist/clock" && request.method === "POST") {
      const configured = env.BENCHMARK_SYNC_TOKEN ?? "";
      const authorization = request.headers.get("authorization") ?? "";
      const supplied = authorization.startsWith("Bearer ")
        ? authorization.slice("Bearer ".length)
        : "";
      if (!(await clockTokenIsAuthorized(configured, supplied, {
        teamSlug: env.VERCEL_CLOCK_TEAM_SLUG,
        teamId: env.VERCEL_CLOCK_TEAM_ID,
        projectName: env.VERCEL_CLOCK_PROJECT_NAME,
        projectId: env.VERCEL_CLOCK_PROJECT_ID,
      }))) {
        return Response.json(
          { error: "Unauthorized." },
          { status: 401, headers: { "Cache-Control": "no-store" } },
        );
      }
      ctx.waitUntil(
        observeClockRun(
          refreshClockBatchIfDue(env as unknown as ScrapeEnv, "external-clock"),
          "external-clock",
        ),
      );
      return Response.json(
        { accepted: true, mode: "external-clock-refresh" },
        { status: 202, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      observeClockRun(
        refreshClockBatchIfDue(
          env as unknown as ScrapeEnv,
          "scheduled",
        ),
        "scheduled",
      ),
    );
  },
};

export default worker;
