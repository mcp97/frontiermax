import AppNavigation from "../app-navigation";
import SettingsConsole from "./settings-console";
import { requireAppContext } from "../../../lib/app-context";
import { ensureControlPlaneTables } from "../../../lib/control-plane";
import { getOpenRouterModels } from "../../../lib/public-evidence";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user, organization, db } = await requireAppContext("/app/settings");
  await ensureControlPlaneTables(db);
  const [members, keys, audits, candidateIds] = await Promise.all([
    db.prepare("SELECT email, role, created_at FROM organization_members WHERE organization_id = ? ORDER BY created_at").bind(organization.id).all<Record<string, unknown>>(),
    db.prepare("SELECT id, name, prefix, scopes_json, created_at, revoked_at FROM api_keys WHERE organization_id = ? ORDER BY created_at DESC").bind(organization.id).all<Record<string, unknown>>(),
    db.prepare("SELECT action, target_type, target_id, actor_email, created_at FROM audit_events WHERE organization_id = ? ORDER BY created_at DESC LIMIT 12").bind(organization.id).all<Record<string, unknown>>(),
    db.prepare(
      `SELECT DISTINCT r.candidate_id
       FROM eval_results r JOIN eval_sets e ON e.id = r.eval_set_id
       WHERE e.organization_id = ? AND r.candidate_type = 'concrete_model'
       ORDER BY r.candidate_id`,
    ).bind(organization.id).all<{ candidate_id: string }>(),
  ]);
  let modelIdentities: Array<{ id: string; status: "exact" | "unmatched" }> = [];
  try {
    const registry = await getOpenRouterModels({ DB: db });
    const openRouterIds = new Set(registry.data.data.map((model) => model.id));
    modelIdentities = candidateIds.results.map((candidate) => ({
      id: candidate.candidate_id,
      status: openRouterIds.has(candidate.candidate_id) ? "exact" : "unmatched",
    }));
  } catch {
    modelIdentities = candidateIds.results.map((candidate) => ({
      id: candidate.candidate_id,
      status: "unmatched",
    }));
  }
  return (
    <div className="app-shell">
      <AppNavigation active="settings" user={user.displayName} />
      <main className="app-main">
        <header><div><span>SETTINGS</span><h1>Control the control plane.</h1></div><b>{organization.role}</b></header>
        <SettingsConsole
          canAdmin={["owner", "admin"].includes(organization.role)}
          apiKeys={keys.results.map((entry) => ({
            id: String(entry.id),
            name: String(entry.name),
            prefix: String(entry.prefix),
            revoked: Boolean(entry.revoked_at),
          }))}
        />
        <section className="settings-ledgers">
          <div><div className="section-heading"><span>MEMBERS</span><h2>Organization access</h2></div>{members.results.map((entry) => <article key={String(entry.email)}><b>{String(entry.email)}</b><span>{String(entry.role)}</span></article>)}</div>
          <div><div className="section-heading"><span>API KEYS</span><h2>Visible prefixes</h2></div>{keys.results.length ? keys.results.map((entry) => <article key={String(entry.id)}><b>{String(entry.name)}</b><span>{String(entry.prefix)} · {entry.revoked_at ? "revoked" : "active"}</span></article>) : <p>No server API keys.</p>}</div>
          <div><div className="section-heading"><span>AUDIT LOG</span><h2>Immutable actions</h2></div>{audits.results.length ? audits.results.map((entry, index) => <article key={`${String(entry.created_at)}-${index}`}><b>{String(entry.action)}</b><span>{new Date(Number(entry.created_at)).toLocaleString()} · {String(entry.actor_email)}</span></article>) : <p>No audited changes yet.</p>}</div>
        </section>
        <section className="control-list identity-review">
          <div className="section-heading"><span>MODEL IDENTITY</span><h2>Canonical OpenRouter matches</h2></div>
          {modelIdentities.length ? modelIdentities.map((entry) => <article key={entry.id}><div><span>{entry.status === "exact" ? "EXACT CANONICAL ID" : "REVIEW REQUIRED"}</span><h3>{entry.id}</h3><p>{entry.status === "exact" ? "Safe for a concrete OpenRouter route." : "Not used in a production concrete-model policy until resolved."}</p></div><div className="metric-stack"><b>{entry.status}</b></div></article>) : <div className="control-empty">Import concrete-model benchmark rows to review identity matches.</div>}
        </section>
      </main>
    </div>
  );
}
