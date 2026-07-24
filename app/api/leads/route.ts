export const dynamic = "force-dynamic";

async function runtimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env as unknown as { DB?: D1Database };
}

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ message: "Request body must be valid JSON." }, { status: 400 });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const company = clean(body.company, 160);
  const role = clean(body.role, 160);
  if (!name || !email.includes("@") || !company || !role || body.consent !== "yes") {
    return Response.json({ message: "Complete the required fields and consent." }, { status: 422 });
  }

  const env = await runtimeEnv();
  if (!env.DB) {
    return Response.json({ message: "Lead storage is not configured." }, { status: 503 });
  }

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS lead_requests (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT NOT NULL,
      role TEXT NOT NULL,
      spend_range TEXT,
      provider_summary TEXT,
      workload_count TEXT,
      private_evals TEXT,
      primary_concern TEXT,
      description TEXT,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'new'
    )`,
  ).run();

  await env.DB.prepare(
    `INSERT INTO lead_requests
      (id, name, email, company, role, spend_range, provider_summary,
       workload_count, private_evals, primary_concern, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      `lead_${crypto.randomUUID().replaceAll("-", "")}`,
      name,
      email,
      company,
      role,
      clean(body.spend, 80),
      clean(body.providers, 240),
      clean(body.workloads, 80),
      clean(body.private_evals, 80),
      clean(body.concern, 80),
      clean(body.description, 1200),
      Date.now(),
    )
    .run();

  return Response.json({ message: "Routing audit request received." }, { status: 201 });
}
