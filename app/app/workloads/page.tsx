import { listWorkloads } from "../../../lib/organizations";
import { requireAppContext } from "../../../lib/app-context";
import AppNavigation from "../app-navigation";

export const dynamic = "force-dynamic";

export default async function WorkloadsPage() {
  const { user, organization, db } = await requireAppContext("/app/workloads");
  const workloads = await listWorkloads(db, organization.id);
  return (
    <div className="app-shell">
      <AppNavigation active="workloads" user={user.displayName} />
      <main className="app-main">
        <header><div><span>WORKLOADS</span><h1>Decision profiles</h1></div><b>{workloads.results.length} active</b></header>
        <section className="workload-list">{workloads.results.map((workload) => <article key={workload.id}><div><span>{workload.stable_key}</span><h2>{workload.name}</h2><p>{workload.description}</p></div><b>{workload.objective.replaceAll("_", " ")}</b></article>)}</section>
        <section className="app-next"><span>PROFILE CONTRACT</span><h2>Workloads declare requirements. Policies decide which evidence and candidates can satisfy them.</h2></section>
      </main>
    </div>
  );
}
