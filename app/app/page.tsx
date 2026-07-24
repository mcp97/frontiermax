import Link from "next/link";
import { listWorkloads } from "../../lib/organizations";
import { requireAppContext } from "../../lib/app-context";
import { ensureControlPlaneTables } from "../../lib/control-plane";
import AppNavigation from "./app-navigation";

export const dynamic = "force-dynamic";

export default async function ApplicationPage() {
  const { user, organization, db } = await requireAppContext("/app");
  await ensureControlPlaneTables(db);
  const workloads = await listWorkloads(db, organization.id);
  const [evalCount, policyCount, certificationCount, receiptCount] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM eval_sets WHERE organization_id = ?").bind(organization.id).first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM policy_versions WHERE organization_id = ? AND status = 'published'").bind(organization.id).first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM certifications WHERE organization_id = ? AND status = 'certified' AND valid_until > ?").bind(organization.id, Date.now()).first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM route_decisions WHERE organization_id = ?").bind(organization.id).first<{ count: number }>(),
  ]);

  return (
    <div className="app-shell">
      <AppNavigation active="overview" user={user.displayName} />
      <main className="app-main">
        <header><div><span>ORGANIZATION</span><h1>{organization.name}</h1></div><b>{organization.role}</b></header>
        <section className="app-status">
          <article><span>PRIVATE BENCHMARKS</span><b>{evalCount?.count ?? 0}</b><p>Aggregate, versioned evidence</p></article>
          <article><span>PUBLISHED POLICIES</span><b>{policyCount?.count ?? 0}</b><p>Immutable route contracts</p></article>
          <article><span>ACTIVE CERTIFICATIONS</span><b>{certificationCount?.count ?? 0}</b><p>Evidence-backed selections</p></article>
          <article><span>RECEIPTS</span><b>{receiptCount?.count ?? 0}</b><p>Inspectable route decisions</p></article>
        </section>
        <section className="app-pipeline">
          <div><span>DECISION PIPELINE</span><h2>Evidence to route.<br /><em>One inspectable chain.</em></h2></div>
          <ol>
            <li><b>01</b><div><strong>Import</strong><span>Aggregate private benchmark results</span></div><Link href="/app/evals">Open →</Link></li>
            <li><b>02</b><div><strong>Publish</strong><span>Quality, cost, and latency gates</span></div><Link href="/app/policies">Open →</Link></li>
            <li><b>03</b><div><strong>Compare</strong><span>Concrete models and external routers</span></div><Link href="/app/compare">Open →</Link></li>
            <li><b>04</b><div><strong>Certify</strong><span>Freeze the evidence-backed winner</span></div><Link href="/app/certifications">Open →</Link></li>
          </ol>
        </section>
        <section className="app-workloads"><div><span>WORKLOAD PROFILES</span><h2>Start with the decision,<br /><em>not the model.</em></h2></div><div>{workloads.results.map((workload) => <article key={workload.id}><span>{workload.stable_key}</span><h3>{workload.name}</h3><p>{workload.description}</p><b>{workload.objective.replaceAll("_", " ")}</b></article>)}</div></section>
        <section className="app-next"><span>TRUTH BOUNDARY</span><h2>Public evidence shortlists. Held-out private benchmarks certify.</h2><p>No public percentile is presented as a private pass probability.</p></section>
      </main>
    </div>
  );
}
