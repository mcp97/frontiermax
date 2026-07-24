import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "../site-header";

export const metadata: Metadata = {
  title: "Methodology - Frontier Max",
  description:
    "How Frontier Max turns public evidence, private benchmarks, and runtime outcomes into auditable model routes.",
};

const RULES = [
  {
    number: "01",
    title: "Never average unrelated raw scores.",
    body: "Each benchmark keeps its own metric, direction, unit, subject type, snapshot, and harness. Public fit uses comparable within-benchmark percentiles—not an invented universal score.",
  },
  {
    number: "02",
    title: "Public evidence narrows. Private evidence certifies.",
    body: "Public results can shortlist models and expose evidence gaps. A production quality floor should be certified with comparable held-out private results.",
  },
  {
    number: "03",
    title: "Hard gates precede optimization.",
    body: "Capability, context, privacy, quality, cost, and evidence-age requirements remove invalid candidates before any preference weights are applied.",
  },
  {
    number: "04",
    title: "Missing means missing.",
    body: "Unknown latency, cost, or quality is never converted to zero. When a policy requires that dimension, the candidate is explicitly ineligible.",
  },
  {
    number: "05",
    title: "Certifications expire.",
    body: "A route is evidence under a defined workload—not eternal truth. Model availability, price changes, policy changes, or stale evidence trigger review.",
  },
];

export default function MethodologyPage() {
  return (
    <div className="method-page">
      <SiteHeader active="methodology" />
      <main className="method-main">
        <section className="method-hero">
          <p className="reader-eyebrow"><span>METHODOLOGY</span> Version 1</p>
          <h1>Evidence before<br /><em>preference.</em></h1>
          <p>Frontier Max makes the decision reproducible: source snapshot, hard gates, conditional Pareto set, selected route, and receipt.</p>
        </section>

        <section className="method-rules">
          {RULES.map((rule) => (
            <article key={rule.number}><span>{rule.number}</span><h2>{rule.title}</h2><p>{rule.body}</p></article>
          ))}
        </section>

        <section className="method-flow">
          <div><span>EVIDENCE</span><p>BenchmarkList + private aggregate results + optional runtime outcomes</p></div>
          <i>→</i>
          <div><span>GATES</span><p>Quality · cost · latency · capability · privacy · freshness</p></div>
          <i>→</i>
          <div><span>PARETO SET</span><p>Only nondominated eligible candidates remain</p></div>
          <i>→</i>
          <div><span>POLICY</span><p>Workload objective selects a concrete route</p></div>
        </section>

        <section className="method-limitations">
          <div><span>LIMITATIONS</span><h2>A route is evidence-backed.<br /><em>Not guaranteed correct.</em></h2></div>
          <ul>
            <li>Benchmark results are conditional on their harness and snapshot.</li>
            <li>Public percentiles are not private task-success probabilities.</li>
            <li>Operational fallbacks do not prove an answer failed a quality check.</li>
            <li>An external router can be certified only on comparable observed results.</li>
          </ul>
        </section>

        <section className="method-cta"><h2>Inspect the method in motion.</h2><Link className="primary-button" href="/route">Simulate a route <span>→</span></Link></section>
      </main>
    </div>
  );
}
