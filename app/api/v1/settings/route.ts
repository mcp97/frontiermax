import { apiError, getApiContext } from "../../../../lib/app-context";
import { ensureControlPlaneTables } from "../../../../lib/control-plane";

export const dynamic = "force-dynamic";

const ROLES = new Set(["owner", "admin", "editor", "viewer"]);
const SCOPES = new Set(["route:read", "manifest:read", "outcomes:write", "evals:write", "admin"]);

function randomHex(bytes: number) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return [...value].map((entry) => entry.toString(16).padStart(2, "0")).join("");
}

async function hashSecret(secret: string, salt: string, pepper: string) {
  const bytes = new TextEncoder().encode(`${salt}:${secret}:${pepper}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((entry) => entry.toString(16).padStart(2, "0")).join("");
}

async function pepper() {
  const { env } = await import("cloudflare:workers");
  return String((env as unknown as { FRONTIER_API_KEY_PEPPER?: string }).FRONTIER_API_KEY_PEPPER ?? "");
}

export async function GET() {
  const context = await getApiContext();
  if (!context) return apiError(401, "authentication_required", "Sign in to view settings.");
  const { db, organization } = context;
  await ensureControlPlaneTables(db);
  const [members, keys] = await Promise.all([
    db.prepare(
      `SELECT email, role, created_at FROM organization_members
       WHERE organization_id = ? ORDER BY created_at`,
    ).bind(organization.id).all(),
    db.prepare(
      `SELECT id, name, prefix, scopes_json, created_at, last_used_at, revoked_at
       FROM api_keys WHERE organization_id = ? ORDER BY created_at DESC`,
    ).bind(organization.id).all(),
  ]);
  return Response.json({ members: members.results, api_keys: keys.results });
}

export async function POST(request: Request) {
  const context = await getApiContext();
  if (!context) return apiError(401, "authentication_required", "Sign in to change settings.");
  const { db, organization, user } = context;
  if (!["owner", "admin"].includes(organization.role)) {
    return apiError(403, "insufficient_role", "Owner or admin access is required.");
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return apiError(400, "invalid_json", "Request body must be valid JSON.");
  }
  await ensureControlPlaneTables(db);
  const action = String(body.action ?? "");
  const now = Date.now();

  if (action === "add_member") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = String(body.role ?? "");
    if (!email.includes("@") || !ROLES.has(role) || role === "owner") {
      return apiError(422, "invalid_member", "Provide a valid email and admin, editor, or viewer role.");
    }
    await db.batch([
      db.prepare(
        `INSERT INTO organization_members (organization_id, email, role, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(organization_id, email) DO UPDATE SET role = excluded.role`,
      ).bind(organization.id, email, role, now),
      db.prepare(
        `INSERT INTO audit_events (
          id, organization_id, actor_email, action, target_type,
          target_id, metadata_json, created_at
        ) VALUES (?, ?, ?, 'member.upserted', 'member', ?, ?, ?)`,
      ).bind(
        `aud_${crypto.randomUUID().replaceAll("-", "")}`,
        organization.id,
        user.email,
        email,
        JSON.stringify({ role }),
        now,
      ),
    ]);
    return Response.json({ status: "saved", email, role }, { status: 201 });
  }

  if (action === "create_api_key") {
    const configuredPepper = await pepper();
    if (!configuredPepper) return apiError(503, "key_pepper_missing", "API-key creation is not configured.");
    const name = String(body.name ?? "").trim().slice(0, 100);
    const scopes = Array.isArray(body.scopes)
      ? [...new Set(body.scopes.map(String).filter((scope) => SCOPES.has(scope)))]
      : [];
    if (!name || !scopes.length) return apiError(422, "invalid_api_key", "Name and at least one valid scope are required.");
    const secret = randomHex(24);
    const prefix = `fmx_${randomHex(5)}`;
    const fullKey = `${prefix}_${secret}`;
    const salt = randomHex(16);
    const secretHash = await hashSecret(fullKey, salt, configuredPepper);
    const id = `key_${crypto.randomUUID().replaceAll("-", "")}`;
    await db.batch([
      db.prepare(
        `INSERT INTO api_keys (
          id, organization_id, name, prefix, salt, secret_hash,
          scopes_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(id, organization.id, name, prefix, salt, secretHash, JSON.stringify(scopes), now),
      db.prepare(
        `INSERT INTO audit_events (
          id, organization_id, actor_email, action, target_type,
          target_id, metadata_json, created_at
        ) VALUES (?, ?, ?, 'api_key.created', 'api_key', ?, ?, ?)`,
      ).bind(
        `aud_${crypto.randomUUID().replaceAll("-", "")}`,
        organization.id,
        user.email,
        id,
        JSON.stringify({ prefix, scopes }),
        now,
      ),
    ]);
    return Response.json({
      id,
      name,
      prefix,
      scopes,
      api_key: fullKey,
      warning: "Copy this key now. Frontier will not display it again.",
    }, { status: 201 });
  }

  if (action === "revoke_api_key") {
    const keyId = String(body.key_id ?? "");
    const changed = await db.prepare(
      `UPDATE api_keys SET revoked_at = ?
       WHERE id = ? AND organization_id = ? AND revoked_at IS NULL`,
    ).bind(now, keyId, organization.id).run();
    if (!changed.meta.changes) return apiError(404, "api_key_not_found", "Active API key not found.");
    await db.prepare(
      `INSERT INTO audit_events (
        id, organization_id, actor_email, action, target_type,
        target_id, metadata_json, created_at
      ) VALUES (?, ?, ?, 'api_key.revoked', 'api_key', ?, '{}', ?)`,
    ).bind(
      `aud_${crypto.randomUUID().replaceAll("-", "")}`,
      organization.id,
      user.email,
      keyId,
      now,
    ).run();
    return Response.json({ status: "revoked", key_id: keyId });
  }

  return apiError(422, "unsupported_action", "Unsupported settings action.");
}
