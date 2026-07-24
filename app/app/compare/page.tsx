import AppNavigation from "../app-navigation";
import ParetoChart from "./pareto-chart";
import { requireAppContext } from "../../../lib/app-context";
import { ensureControlPlaneTables, type CompiledArtifact } from "../../../lib/control-plane";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const { user, organization, db } = await requireAppContext("/app/compare");
  await ensureControlPlaneTables(db);
  const policy = await db.prepare(
    `SELECT p.name, p.stable_slug, pv.version, pv.artifact_json,
            pv.quality_floor, pv.maximum_cost, pv.maximum_p95_latency_ms,
            pv.evidence_version, es.name AS eval_name, es.version AS eval_version,
            es.notes AS eval_notes, es.designation
     FROM policies p
     JOIN policy_versions pv ON pv.policy_id = p.id
     JOIN eval_sets es ON es.id = pv.eval_set_id
     WHERE p.organization_id = ? AND pv.status = 'published'
     ORDER BY pv.published_at DESC LIMIT 1`,
  ).bind(organization.id).first<Record<string, unknown>>();
  const artifact = policy ? JSON.parse(String(policy.artifact_json)) as CompiledArtifact : null;
  return (
    <div className="app-shell">
      <AppNavigation active="compare" user={user.displayName} />
      <main className="app-main">
        <header><div><span>COMPARE</span><h1>Let the constraints choose.</h1></div><b>Conditional Pareto frontier</b></header>
        {!artifact || !policy ? (
          <section className="app-next"><span>NO PUBLISHED POLICY</span><h2>Import a held-out benchmark and publish a policy first.</h2></section>
        ) : (
          <>
            <section className="comparison-summary">
              <div><span>POLICY</span><h2>{String(policy.name)}</h2><p>{String(policy.stable_slug)}.{String(policy.version)} · {String(policy.eval_name)} v{String(policy.eval_version)}</p></div>
              <div><span>SELECTED</span><h2>{artifact.selected?.candidate_id ?? "Abstain"}</h2><p>{artifact.objective.replaceAll("_", " ")}</p></div>
              <div><span>EVIDENCE</span><h2>{String(policy.designation).replace("_", " ")}</h2><p>{artifact.candidates.length} comparable candidates</p></div>
            </section>
            {String(policy.eval_notes ?? "").toLowerCase().includes("illustrative") ? <p className="demo-warning">ILLUSTRATIVE DEMO EVIDENCE — this comparison demonstrates the workflow, not a production model claim.</p> : null}
            <section className="control-card compare-card">
              <div className="control-card-head"><div><span>QUALITY × COST</span><h2>Eligible operating frontier</h2></div><b>Every point is a stored aggregate result</b></div>
              <ParetoChart candidates={artifact.candidates} qualityFloor={artifact.quality_floor} maximumCost={artifact.maximum_cost} />
            </section>
            <section className="candidate-table-wrap">
              <table className="candidate-table">
                <thead><tr><th>Candidate</th><th>Type</th><th>Posterior</th><th>Lower bound</th><th>Cases</th><th>Mean cost</th><th>Cost / success</th><th>P95</th><th>Decision</th></tr></thead>
                <tbody>{artifact.candidates.map((candidate) => (
                  <tr className={artifact.selected?.candidate_id === candidate.candidate_id ? "selected" : ""} key={`${candidate.candidate_type}:${candidate.candidate_id}`}>
                    <td><b>{candidate.candidate_id}</b>{candidate.pareto ? <span>PARETO</span> : null}</td>
                    <td>{candidate.candidate_type.replaceAll("_", " ")}</td>
                    <td>{(candidate.posterior_mean * 100).toFixed(1)}%</td>
                    <td>{(candidate.quality_lower_bound * 100).toFixed(1)}%</td>
                    <td>{candidate.case_count}</td>
                    <td>{candidate.average_cost_per_case == null ? "Not measured" : `$${candidate.average_cost_per_case.toFixed(3)}`}</td>
                    <td>{candidate.expected_cost_per_success == null ? "Not measured" : `$${candidate.expected_cost_per_success.toFixed(3)}`}</td>
                    <td>{candidate.p95_latency_ms == null ? "Not measured" : `${Math.round(candidate.p95_latency_ms)} ms`}</td>
                    <td>{candidate.eligible ? (artifact.selected?.candidate_id === candidate.candidate_id ? "Selected" : "Eligible") : candidate.rejection_reasons.join("; ")}</td>
                  </tr>
                ))}</tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
