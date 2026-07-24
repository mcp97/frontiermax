import AppNavigation from "../app-navigation";
import PrivateEvalImporter from "./private-eval-importer";
import { requireAppContext } from "../../../lib/app-context";
import { ensureControlPlaneTables } from "../../../lib/control-plane";

export const dynamic = "force-dynamic";

export default async function PrivateEvalsPage() {
  const { user, organization, db } = await requireAppContext("/app/evals");
  await ensureControlPlaneTables(db);
  const evalSets = await db.prepare(
    `SELECT e.*, COUNT(r.id) AS candidate_count,
            COALESCE(SUM(r.case_count), 0) AS total_cases
     FROM eval_sets e
     LEFT JOIN eval_results r ON r.eval_set_id = e.id
     WHERE e.organization_id = ?
     GROUP BY e.id
     ORDER BY e.created_at DESC`,
  ).bind(organization.id).all<Record<string, unknown>>();

  return (
    <div className="app-shell">
      <AppNavigation active="evals" user={user.displayName} />
      <main className="app-main">
        <header><div><span>PRIVATE BENCHMARKS</span><h1>Bring your evidence.</h1></div><b>Aggregate measurements only</b></header>
        <PrivateEvalImporter />
        <section className="control-list">
          <div className="section-heading"><span>LOCKED VERSIONS</span><h2>Reproducible evidence</h2></div>
          {evalSets.results.length ? evalSets.results.map((entry) => (
            <article key={String(entry.id)}>
              <div><span>{String(entry.workload_key)} · v{String(entry.version)}</span><h3>{String(entry.name)}</h3><p>{String(entry.outcome_definition)}</p></div>
              <div className="metric-stack"><b>{String(entry.candidate_count)} candidates</b><span>{String(entry.total_cases)} aggregate cases</span><i>{String(entry.designation).replace("_", " ")}</i></div>
            </article>
          )) : <div className="control-empty">No private benchmark versions yet. Validate and lock the aggregate example above.</div>}
        </section>
      </main>
    </div>
  );
}
