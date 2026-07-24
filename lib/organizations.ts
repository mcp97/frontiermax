export type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "editor" | "viewer";
};

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "frontier-team"
  );
}

async function ensureOrganizationTables(db: D1Database) {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS organization_members (
        organization_id TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (organization_id, email),
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS workload_profiles (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        stable_key TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        objective TEXT NOT NULL,
        config_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (organization_id, stable_key),
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
      )`,
    ),
  ]);
}

export async function ensureOrganization(
  db: D1Database,
  user: { email: string; displayName: string },
): Promise<OrganizationRecord> {
  await ensureOrganizationTables(db);
  const existing = await db.prepare(
    `SELECT o.id, o.name, o.slug, m.role
     FROM organization_members m
     JOIN organizations o ON o.id = m.organization_id
     WHERE m.email = ?
     ORDER BY o.created_at ASC
     LIMIT 1`,
  )
    .bind(user.email)
    .first<OrganizationRecord>();
  if (existing) return existing;

  const id = `org_${crypto.randomUUID().replaceAll("-", "")}`;
  const name = `${user.displayName.split("@")[0]}'s Frontier`;
  const slug = `${slugify(user.displayName.split("@")[0])}-${id.slice(-6)}`;
  const now = Date.now();
  await db.batch([
    db.prepare(
      "INSERT INTO organizations (id, name, slug, created_at) VALUES (?, ?, ?, ?)",
    ).bind(id, name, slug, now),
    db.prepare(
      `INSERT INTO organization_members
        (organization_id, email, role, created_at)
       VALUES (?, ?, 'owner', ?)`,
    ).bind(id, user.email, now),
  ]);

  const defaults = [
    ["code.text", "Code", "Text-only code generation and review", "balanced"],
    ["chat.fast", "Fast chat", "Latency-sensitive conversational turns", "minimize_estimated_cost"],
    ["reasoning.deep", "Deep reasoning", "Quality-first analytical work", "maximize_public_quality"],
  ] as const;
  await db.batch(
    defaults.map(([key, title, description, objective]) =>
      db.prepare(
        `INSERT INTO workload_profiles
          (id, organization_id, stable_key, name, description, objective,
           config_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, '{}', ?, ?)`,
      ).bind(
        `wrk_${crypto.randomUUID().replaceAll("-", "")}`,
        id,
        key,
        title,
        description,
        objective,
        now,
        now,
      ),
    ),
  );

  return { id, name, slug, role: "owner" };
}

export async function listWorkloads(db: D1Database, organizationId: string) {
  await ensureOrganizationTables(db);
  return db.prepare(
    `SELECT id, stable_key, name, description, objective, updated_at
     FROM workload_profiles
     WHERE organization_id = ?
     ORDER BY name`,
  )
    .bind(organizationId)
    .all<{
      id: string;
      stable_key: string;
      name: string;
      description: string;
      objective: string;
      updated_at: number;
    }>();
}
