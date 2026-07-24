import AppNavigation from "../app-navigation";
import PolicyBuilder from "./policy-builder";
import { requireAppContext } from "../../../lib/app-context";
import { ensureControlPlaneTables } from "../../../lib/control-plane";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const { user, organization, db } = await requireAppContext("/app/policies");
  await ensureControlPlaneTables(db);
  const [evalSets, policies] = await Promise.all([
    db.prepare(`SELECT id, name, version, workload_key FROM eval_sets WHERE organization_id = ? AND designation = 'held_out' AND status = 'locked' ORDER BY created_at DESC`).bind(organization.id).all<{ id: string; name: string; version: number; workload_key: string }>(),
    db.prepare(
      `SELECT p.stable_slug, p.name, pv.id AS version_id, pv.version,
              pv.objective, pv.quality_floor, pv.minimum_cases,
              pv.manifest_hash, pv.published_at, pv.artifact_json
       FROM policies p JOIN policy_versions pv ON pv.policy_id = p.id
       WHERE p.organization_id = ? AND pv.status = 'published'
       ORDER BY pv.published_at DESC`,
    ).bind(organization.id).all<Record<string, unknown>>(),
  ]);
  return (
    <div className="app-shell">
      <AppNavigation active="policies" user={user.displayName} />
      <main className="app-main">
        <header><div><span>POLICIES</span><h1>Publish the decision.</h1></div><b>Versioned · auditable</b></header>
        <PolicyBuilder evalSets={evalSets.results} />
        <section className="control-list">
          <div className="section-heading"><span>PUBLISHED CONTRACTS</span><h2>Current routes</h2></div>
          {policies.results.length ? policies.results.map((entry) => {
            const artifact = JSON.parse(String(entry.artifact_json));
            return <article key={String(entry.version_id)}><div><span>{String(entry.stable_slug)}.{String(entry.version)}</span><h3>{String(entry.name)}</h3><p>{String(entry.objective).replaceAll("_", " ")} · quality floor {(Number(entry.quality_floor) * 100).toFixed(1)}% · {String(entry.minimum_cases)} cases</p></div><div className="metric-stack"><b>{artifact.selected?.candidate_id ?? "Abstained"}</b><span>{artifact.selected?.candidate_type?.replaceAll("_", " ")}</span><i>{String(entry.manifest_hash).slice(0, 18)}…</i></div></article>;
          }) : <div className="control-empty">No published policy yet.</div>}
        </section>
      </main>
    </div>
  );
}
