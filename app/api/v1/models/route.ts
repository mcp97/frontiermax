import { getOpenRouterModels } from "../../../../lib/public-evidence";

export const dynamic = "force-dynamic";

async function runtimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env as unknown as { DB?: D1Database };
}

export async function GET() {
  try {
    const result = await getOpenRouterModels(await runtimeEnv());
    return Response.json(
      {
        source: "OpenRouter Models API",
        source_url: result.sourceUrl,
        fetched_at: result.fetchedAt,
        stale: result.stale,
        count: result.data.data.length,
        models: result.data.data,
      },
      {
        headers: {
          "Cache-Control":
            "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error: "The OpenRouter model registry is temporarily unavailable.",
        detail: error instanceof Error ? error.message : "Unknown source error",
      },
      { status: 503 },
    );
  }
}
