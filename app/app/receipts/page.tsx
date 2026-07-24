import AppNavigation from "../app-navigation";
import OutcomeForm from "./outcome-form";
import { requireAppContext } from "../../../lib/app-context";
import { ensureControlPlaneTables } from "../../../lib/control-plane";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage() {
  const { user, organization, db } = await requireAppContext("/app/receipts");
  await ensureControlPlaneTables(db);
  const receipts = await db.prepare(
    `SELECT r.*, o.application_outcome, o.actual_model, o.actual_provider,
            o.actual_cost, o.total_latency_ms
     FROM route_decisions r
     LEFT JOIN execution_outcomes o ON o.route_id = r.id
     WHERE r.organization_id = ?
     ORDER BY r.created_at DESC LIMIT 50`,
  ).bind(organization.id).all<Record<string, unknown>>();
  return (
    <div className="app-shell">
      <AppNavigation active="receipts" user={user.displayName} />
      <main className="app-main">
        <header><div><span>RECEIPTS</span><h1>Every route explains itself.</h1></div><b>Content-free decision log</b></header>
        <section className="privacy-strip"><span>No prompt</span><span>No output</span><span>No code</span><span>No provider key</span></section>
        <section className="receipt-list">
          {receipts.results.length ? receipts.results.map((receipt) => {
            const candidates = JSON.parse(String(receipt.candidate_set_json)) as Array<{ candidate_id?: string; id?: string; rejection_reasons?: string[]; rejectionReasons?: string[] }>;
            const rejected = candidates.filter((candidate) => (candidate.rejection_reasons ?? candidate.rejectionReasons ?? []).length).length;
            return <article key={String(receipt.id)}>
              <div className="receipt-head"><div><span>{new Date(Number(receipt.created_at)).toLocaleString()}</span><h2>{String(receipt.selected_candidate)}</h2></div><b>{String(receipt.application_outcome ?? "decision only")}</b></div>
              <div className="receipt-grid"><div><span>ROUTE ID</span><b>{String(receipt.id)}</b></div><div><span>POLICY</span><b>{String(receipt.policy_version)}</b></div><div><span>CANDIDATES</span><b>{candidates.length} considered · {rejected} rejected</b></div><div><span>MANIFEST</span><b>{String(receipt.manifest_hash).slice(0, 26)}…</b></div></div>
              <details><summary>Inspect structured decision</summary><pre>{JSON.stringify({ request: JSON.parse(String(receipt.request_features_json)), candidates, privacy: { prompt_captured: false, output_captured: false, code_captured: false, diff_captured: false, credentials_captured: false } }, null, 2)}</pre></details>
              {!receipt.application_outcome ? <OutcomeForm routeId={String(receipt.id)} /> : null}
            </article>;
          }) : <div className="control-empty">No private route receipts yet. Simulate a certified route from Certifications.</div>}
        </section>
      </main>
    </div>
  );
}
