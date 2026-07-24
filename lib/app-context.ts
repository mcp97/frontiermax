import { getChatGPTUser, requireChatGPTUser } from "../app/chatgpt-auth.ts";
import { ensureOrganization } from "./organizations.ts";
import { headers } from "next/headers";

export class ApiRateLimitError extends Error {
  retryAfter: number;
  constructor(retryAfter: number) {
    super("API key rate limit exceeded.");
    this.retryAfter = retryAfter;
  }
}

export async function runtimeDatabase() {
  const { env } = await import("cloudflare:workers");
  return (env as unknown as { DB?: D1Database }).DB ?? null;
}

export async function requireAppContext(returnTo: string) {
  const user = await requireChatGPTUser(returnTo);
  const db = await runtimeDatabase();
  if (!db) throw new Error("Frontier organization storage is not configured.");
  const organization = await ensureOrganization(db, user);
  return { user, organization, db };
}

async function apiKeyContext(
  db: D1Database,
  requiredScope: string,
) {
  const requestHeaders = await headers();
  const authorization = requestHeaders.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer fmx_")) return null;
  const fullKey = authorization.slice("Bearer ".length);
  const separator = fullKey.indexOf("_", 4);
  if (separator < 0) return null;
  const prefix = fullKey.slice(0, separator);
  const row = await db.prepare(
    `SELECT k.id, k.organization_id, k.salt, k.secret_hash, k.scopes_json,
            o.name, o.slug
     FROM api_keys k
     JOIN organizations o ON o.id = k.organization_id
     WHERE k.prefix = ? AND k.revoked_at IS NULL`,
  ).bind(prefix).first<{
    id: string;
    organization_id: string;
    salt: string;
    secret_hash: string;
    scopes_json: string;
    name: string;
    slug: string;
  }>();
  if (!row) return null;
  const { env } = await import("cloudflare:workers");
  const pepper = String(
    (env as unknown as { FRONTIER_API_KEY_PEPPER?: string }).FRONTIER_API_KEY_PEPPER ?? "",
  );
  if (!pepper) return null;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${row.salt}:${fullKey}:${pepper}`),
  );
  const candidateHash = [...new Uint8Array(digest)]
    .map((entry) => entry.toString(16).padStart(2, "0"))
    .join("");
  if (candidateHash !== row.secret_hash) return null;
  const scopes = JSON.parse(row.scopes_json) as string[];
  if (!scopes.includes(requiredScope) && !scopes.includes("admin")) return null;
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS api_key_rate_limits (
      api_key_id TEXT NOT NULL,
      hour_bucket INTEGER NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (api_key_id, hour_bucket)
    )`,
  ).run();
  const hourBucket = Math.floor(Date.now() / 3_600_000);
  await db.prepare(
    `INSERT INTO api_key_rate_limits (api_key_id, hour_bucket, request_count)
     VALUES (?, ?, 1)
     ON CONFLICT(api_key_id, hour_bucket)
     DO UPDATE SET request_count = request_count + 1`,
  ).bind(row.id, hourBucket).run();
  const usage = await db.prepare(
    `SELECT request_count FROM api_key_rate_limits
     WHERE api_key_id = ? AND hour_bucket = ?`,
  ).bind(row.id, hourBucket).first<{ request_count: number }>();
  if (Number(usage?.request_count ?? 0) > 600) {
    throw new ApiRateLimitError(
      Math.max(1, 3600 - Math.floor((Date.now() % 3_600_000) / 1000)),
    );
  }
  await db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?")
    .bind(Date.now(), row.id)
    .run();
  return {
    user: {
      displayName: `API key ${prefix}`,
      email: `api-key:${prefix}`,
      fullName: null,
    },
    organization: {
      id: row.organization_id,
      name: row.name,
      slug: row.slug,
      role: "admin" as const,
    },
    db,
  };
}

export async function getApiContext(apiKeyScope?: string) {
  const user = await getChatGPTUser();
  const db = await runtimeDatabase();
  if (!db) return null;
  if (!user) {
    return apiKeyScope ? apiKeyContext(db, apiKeyScope) : null;
  }
  const organization = await ensureOrganization(db, user);
  return { user, organization, db };
}

export function apiError(
  status: number,
  errorCode: string,
  message: string,
  fieldErrors?: Record<string, string> | string[] | null,
) {
  return Response.json(
    {
      request_id: `req_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
      error_code: errorCode,
      message,
      field_errors: fieldErrors ?? null,
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function rateLimitResponse(error: ApiRateLimitError) {
  return Response.json(
    {
      request_id: `req_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
      error_code: "rate_limit_exceeded",
      message: error.message,
      field_errors: null,
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(error.retryAfter),
      },
    },
  );
}
