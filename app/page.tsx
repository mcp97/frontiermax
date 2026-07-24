"use client";

import Link from "next/link";
import { useState } from "react";
import Interactive4DCube, { type WorkloadId } from "./interactive-4d-cube";
import SiteHeader from "./site-header";

const EVIDENCE_LAYERS = [
  { number: "01", title: "Public evidence", note: "Shortlist" },
  { number: "02", title: "Private benchmarks", note: "Certify" },
  { number: "03", title: "Runtime outcomes", note: "Detect drift" },
];

const DIMENSIONS = [
  { label: "Quality", direction: "Higher", color: "#3f7766" },
  { label: "Cost", direction: "Lower", color: "#c96f4d" },
  { label: "Latency", direction: "Lower", color: "#a98234" },
  { label: "Evidence", direction: "Stronger", color: "#69597b" },
];

export default function Home() {
  const [workloadId, setWorkloadId] = useState<WorkloadId>("interactive");

  return (
    <div className="site-shell home-v3">
      <a className="skip-link" href="#content">Skip to content</a>
      <SiteHeader />

      <main id="content">
        <section className="control-hero" id="top">
          <div className="control-hero-copy">
            <p className="eyebrow">INDEPENDENT MODEL DECISION INFRASTRUCTURE</p>
            <h1>Turn benchmarks<br />into <em>decisions.</em></h1>
            <p>Compare concrete models and existing routers against your workload. Publish the winning route without sending Frontier the prompt.</p>
            <div className="home-hero-actions">
              <Link className="primary-button" href="/route">Simulate a route <span>→</span></Link>
              <Link className="text-button" href="/audit">Request a routing audit <span>↗</span></Link>
            </div>
          </div>
          <div className="control-statement">
            <span>THE DIFFERENCE</span>
            <h2>Gateways move AI traffic.</h2>
            <p>Frontier Max proves where it should go.</p>
            <div className="control-trust"><span>No prompt.</span><span>No output.</span><span>No provider key.</span></div>
          </div>
        </section>

        <section className="evidence-layers">
          <div className="home-section-copy">
            <span>THE OPERATING MODEL</span>
            <h2>One workload.<br /><em>Three evidence layers.</em><br />One versioned route.</h2>
          </div>
          <div className="evidence-layer-list">
            {EVIDENCE_LAYERS.map((layer) => (
              <article key={layer.number}><span>{layer.number}</span><h3>{layer.title}</h3><p>{layer.note}</p></article>
            ))}
          </div>
        </section>

        <section className="decision-space">
          <div className="decision-space-copy">
            <span>CONDITIONAL PARETO FRONTIER</span>
            <h2>The winner changes<br /><em>with the workload.</em></h2>
            <p>Hard gates first. Nondominated candidates second. Workload preferences last.</p>
            <div className="dimension-key">
              {DIMENSIONS.map((dimension) => (
                <div key={dimension.label}><i style={{ background: dimension.color }} /><b>{dimension.label}</b><small>{dimension.direction}</small></div>
              ))}
            </div>
          </div>
          <Interactive4DCube workloadId={workloadId} onWorkloadChange={setWorkloadId} />
        </section>

        <section className="product-steps">
          <article><span>01 / COMPARE</span><h2>Same workload.<br />Same evidence.</h2><p>Concrete models, fixed baselines, and external routers.</p></article>
          <article><span>02 / CERTIFY</span><h2>Hard gates.<br />Conservative proof.</h2><p>Quality, capability, privacy, cost, and evidence age.</p></article>
          <article><span>03 / ROUTE</span><h2>Concrete route.<br />Versioned receipt.</h2><p>Your application still calls OpenRouter directly.</p></article>
        </section>

        <section className="home-boundary">
          <h2>Missing evidence stays missing.</h2>
          <p>No universal score. No invented latency. No agent score silently assigned to a base model.</p>
          <div><Link href="/benchmarks">Explore public evidence <span>→</span></Link><Link href="/methodology">Read the methodology <span>→</span></Link></div>
        </section>
      </main>

      <footer>
        <a className="brand" href="#top"><span className="brand-mark"><i /><i /><i /></span>Frontier Max</a>
        <p>Gateways move AI traffic. Frontier Max proves where it should go.</p>
        <div><Link href="/benchmarks">Evidence</Link><Link href="/route">Router Demo</Link><Link href="/audit">Routing Audit</Link></div>
      </footer>
    </div>
  );
}
