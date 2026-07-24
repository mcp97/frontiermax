import type { Metadata } from "next";
import SiteHeader from "../site-header";
import AuditForm from "./audit-form";

export const metadata: Metadata = {
  title: "Model Router Audit - Frontier Max",
  description:
    "Compare fixed models, workload-specific policies, and dynamic routers on private workloads.",
};

export default function AuditPage() {
  return (
    <div className="audit-page">
      <SiteHeader active="audit" />
      <main className="audit-main">
        <section className="audit-hero"><p className="reader-eyebrow"><span>MODEL ROUTER AUDIT</span> Initial paid wedge</p><h1>Does your router<br /><em>actually win?</em></h1><p>Compare a fixed model, workload policy, and dynamic router on the same held-out private benchmarks.</p></section>
        <section className="audit-scope">
          <article><span>01</span><h2>Three workloads</h2><p>Representative production decisions, not a generic leaderboard.</p></article>
          <article><span>02</span><h2>Comparable baselines</h2><p>Fixed models, your current router, and eligible alternatives.</p></article>
          <article><span>03</span><h2>Certified manifest</h2><p>Quality, cost, latency, policy, limitations, and expiry.</p></article>
        </section>
        <section className="audit-request"><div><span>START THE AUDIT</span><h2>Bring aggregate evidence.<br /><em>Keep the prompts.</em></h2><p>We do not request private prompts, outputs, repositories, credentials, or production data through this form.</p></div><AuditForm /></section>
      </main>
    </div>
  );
}
