export const dynamic = "force-dynamic";

type RuntimeEnv = {
  DB?: D1Database;
  BUCKET?: R2Bucket;
};

async function runtimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env as unknown as RuntimeEnv;
}

export async function GET() {
  const checkedAt = new Date().toISOString();
  try {
    const env = await runtimeEnv();
    let database: "ready" | "missing" | "unavailable" = env.DB
      ? "ready"
      : "missing";

    if (env.DB) {
      try {
        await env.DB.prepare("SELECT 1 AS ok").first();
      } catch {
        database = "unavailable";
      }
    }

    const status =
      database === "ready" ? "ready" : database === "missing" ? "degraded" : "unavailable";

    return Response.json(
      {
        status,
        checked_at: checkedAt,
        services: {
          database,
          object_storage: env.BUCKET ? "ready" : "missing",
        },
      },
      {
        status: status === "unavailable" ? 503 : 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return Response.json(
      {
        status: "unavailable",
        checked_at: checkedAt,
        services: {
          database: "unavailable",
          object_storage: "unavailable",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
