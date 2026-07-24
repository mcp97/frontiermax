import AppNavigation from "../app-navigation";
import CertificationActions from "./certification-actions";
import { requireAppContext } from "../../../lib/app-context";
import { ensureControlPlaneTables } from "../../../lib/control-plane";

export const dynamic = "force-dynamic";

export default async function CertificationsPage() {
  const { user, organization, db } = await requireAppContext("/app/certifications");
  await ensureControlPlaneTables(db);
  const now = Date.now();
  const [policy, certifications] = await Promise.all([
    db.prepare(
      `SELECT p.stable_slug, pv.id AS policy_version_id
       FROM policies p JOIN policy_versions pv ON pv.policy_id = p.id
       WHERE p.organization_id = ? AND pv.status = 'published'
       ORDER BY pv.published_at DESC LIMIT 1`,
    ).bind(organization.id).first<{ stable_slug: string; policy_version_id: string }>(),
    db.prepare(
      `SELECT c.*, p.stable_slug AS policy_slug, pv.version AS policy_version,
              pv.evidence_version, es.notes AS eval_notes
       FROM certifications c
       JOIN policy_versions pv ON pv.id = c.policy_version_id
       JOIN policies p ON p.id = pv.policy_id
       JOIN eval_sets es ON es.id = c.eval_set_id
       WHERE c.organization_id = ?
       ORDER BY c.created_at DESC`,
    ).bind(organization.id).all<Record<string, unknown>>(),
  ]);
  const active = certifications.results.some(
    (entry) =>
      entry.status === "certified" &&
      Number(entry.valid_until) > now &&
      entry.policy_version_id === policy?.policy_version_id,
  );
  return (
    <div className="app-shell">
      <AppNavigation active="certifications" user={user.displayName} />
      <main className="app-main">
        <header><div><span>CERTIFICATIONS</span><h1>Prove the route.</h1></div><b>Statistical evidence · scoped validity</b></header>
        <CertificationActions policyVersionId={policy?.policy_version_id ?? null} policySlug={policy?.stable_slug ?? null} hasCertification={active} />
        <section className="control-list certifications-list">
          <div className="section-heading"><span>CERTIFICATION LEDGER</span><h2>Frozen decisions</h2></div>
          {certifications.results.length ? certifications.results.map((entry) => {
            const effectiveStatus = entry.status === "revoked" ? "revoked" : Number(entry.valid_until) <= now ? "expired" : String(entry.status);
            const isDemo = String(entry.eval_notes ?? "").toLowerCase().includes("illustrative");
            return <article key={String(entry.id)}><div><span>{String(entry.id)} · {effectiveStatus}</span><h3>{String(entry.candidate_id)}</h3><p>{String(entry.candidate_type).replaceAll("_", " ")} · {String(entry.policy_slug)}.{String(entry.policy_version)}{isDemo ? " · ILLUSTRATIVE DEMO EVIDENCE" : ""}</p></div><div className="metric-stack"><b>{(Number(entry.quality_lower_bound) * 100).toFixed(1)}% lower bound</b><span>{String(entry.case_count)} held-out cases</span><i>Valid to {new Date(Number(entry.valid_until)).toLocaleDateString()}</i></div></article>;
          }) : <div className="control-empty">No certification yet. Certify the latest published policy above.</div>}
        </section>
      </main>
    </div>
  );
}
