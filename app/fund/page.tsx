import type { Metadata } from "next";
import Link from "next/link";
import RunFundBuilder from "./run-fund-builder";

export const metadata: Metadata = {
  title: "Run Fund — Frontier Max",
  description: "A policy-neutral proposal for helping independent evaluators pay for expensive benchmark runs without buying conclusions.",
};

function Brand() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>;
}

export default function FundPage() {
  return (
    <div className="fund-shell">
      <a className="skip-link" href="#fund-content">Skip to content</a>
      <header className="use-header fund-header">
        <Link className="brand" href="/" aria-label="Frontier Max home"><Brand />Frontier Max</Link>
        <nav aria-label="Primary navigation">
          <Link href="/benchmarks">Benchmarks</Link>
          <Link href="/reader">Reader</Link>
          <Link href="/use">Use</Link>
          <Link href="/fund" aria-current="page">Fund</Link>
          <a href="/run-fund/v1/funding-policy.json">Policy</a>
        </nav>
        <Link className="use-back" href="/benchmarks">Browse evidence <span>↗</span></Link>
      </header>

      <main id="fund-content">
        <section className="fund-hero">
          <div>
            <p className="eyebrow"><span>STRUCTURE REVIEW</span> The Run Fund</p>
            <h1>Benchmarks are public infrastructure.<br /><em>Their inference bills are not.</em></h1>
            <p>Help independent evaluators cover eligible, pre-registered benchmark work. Support funds execution—not conclusions, rankings, routes, or editorial treatment.</p>
            <div className="fund-hero-actions">
              <a href="#prepare-request">Prepare a run request <span>→</span></a>
              <a href="/run-fund/v1/funding-policy.json">Read the machine-readable policy <span>↗</span></a>
            </div>
          </div>
          <aside className="fund-ledger" aria-label="Run Fund formation ledger">
            <div><span>HOST STRUCTURE · DRAFTED</span><b>Founder outreach pending</b></div>
            <dl>
              <div><dt>Minimum to evidence work</dt><dd>80%</dd></div>
              <div><dt>OSC fiscal-host fee</dt><dd>10%</dd></div>
              <div><dt>Frontier Max pilot margin</dt><dd>0%</dd></div>
              <div><dt>Payment processing</dt><dd>At cost</dd></div>
            </dl>
            <p>No checkout is active. Contributions remain disabled until Open Source Collective confirms the right structure, approves it, and exposes the real public ledger.</p>
          </aside>
        </section>

        <section className="fund-premise">
          <div className="section-index">01 / A SMALL ADDENDUM</div>
          <div className="fund-premise-head">
            <h2>Make evidence possible.<br /><em>Keep the reader neutral.</em></h2>
            <p>Frontier Max still consumes and interprets third-party evidence. The Run Fund is a separate support rail for evaluators who already know what they want to measure but cannot absorb every model and compute bill themselves.</p>
          </div>
          <div className="fund-support-types">
            <article><span>01</span><b>Community cash</b><h3>Small contributions, pooled visibly.</h3><p>Users can eventually support a Fund-approved award or hosted-project-eligible post-run expense. Every eligible expense and fee is disclosed.</p></article>
            <article><span>02</span><b>Provider credits</b><h3>Useful, but never fungible.</h3><p>API credits are labeled as restricted in-kind support, including provider, expiry, model limits, and conditions.</p></article>
            <article><span>03</span><b>Compute</b><h3>Capacity with provenance.</h3><p>GPU time, hosted harnesses, and reviewer labor appear in the same ledger as cash rather than disappearing into “free” support.</p></article>
          </div>
        </section>

        <section className="fund-process">
          <div className="section-index light">02 / THE NEUTRAL PROCESS</div>
          <div className="fund-process-head"><h2>Fund the protocol.<br /><em>Publish whatever happens.</em></h2><p>Requests are assessed before results exist. Frontier Max verifies completeness, identity, rights, and disclosure—not the expected scientific conclusion.</p></div>
          <ol>
            <li><span>01</span><div><b>Prepare first</b><h3>Freeze the evaluation contract.</h3><p>Create a versioned pre-registration draft covering the benchmark, harness, model scope, budget, deliverables, license, deadline, and conflicts.</p></div></li>
            <li><span>02</span><div><b>Disclose support</b><h3>Separate cash from credits.</h3><p>Every restriction and funder relationship stays attached to the request and every later chart.</p></div></li>
            <li><span>03</span><div><b>Run independently</b><h3>No funder veto.</h3><p>Funders cannot approve methodology, suppress negative results, or purchase a preferred ranking.</p></div></li>
            <li><span>04</span><div><b>Close the ledger</b><h3>Publish spend and failure.</h3><p>Delivered, partial, and failed runs disclose actual cost, artifacts, checksums, refunds, and unresolved gaps.</p></div></li>
          </ol>
        </section>

        <RunFundBuilder />

        <section className="fund-contract">
          <div className="section-index">04 / NON-NEGOTIABLES</div>
          <h2>Money can create evidence.<br />It cannot purchase <em>interpretation.</em></h2>
          <div className="fund-contract-grid">
            <span><b>01</b> Funding never changes benchmark inclusion or order.</span>
            <span><b>02</b> Funding never changes a routing recommendation.</span>
            <span><b>03</b> Provider credits remain separately labeled and restricted.</span>
            <span><b>04</b> Negative, partial, and failed runs remain visible.</span>
            <span><b>05</b> Reviewers disclose conflicts and recuse when necessary.</span>
            <span><b>06</b> OSC-hosted support is not represented as tax-deductible.</span>
          </div>
          <div className="fund-operating-boundary">
            <div><span>PREFERRED HOST PATH</span><h3>One ring-fenced program. One public ledger.</h3></div>
            <p>Frontier Max has drafted a question for Open Source Collective about whether this belongs in a dedicated OSC Fund or a Frontier Max hosted-project program. No host has been contacted or selected yet. Under either proposed structure, OSC would hold the money, handle compliance and eligible payouts, and expose the ledger through Open Collective. This remains separate from Frontier Max&apos;s commercial revenue.</p>
            <div className="fund-allocation" aria-label="Planned contribution allocation">
              <span><b>≥80%</b>Awards or eligible post-run expenses</span>
              <span><b>10%</b>OSC fiscal hosting</span>
              <span><b>0%</b>Frontier Max pilot margin</span>
              <span><b>Actual</b>Processor costs</span>
            </div>
            <p className="fund-allocation-rule">Eligible evidence work receives every dollar left after the host and actual transaction costs. Preregistration does not guarantee prepayment: the host-approved structure controls whether support is an award, post-run invoice, or reimbursement. Frontier takes no margin during the pilot. If a payment method would push evidence work below 80% of gross, that method stays disabled. OSC-hosted contributions are not represented as tax-deductible.</p>
            <div className="fund-boundary-links"><a href="https://docs.oscollective.org/for-donors-companies-organizations-and-individuals/supporting-projects" target="_blank" rel="noreferrer">Review OSC Fund structure ↗</a><a href="https://docs.oscollective.org/welcome-and-introduction-to-osc/fees" target="_blank" rel="noreferrer">Verify OSC fees ↗</a><a href="/run-fund/v1/funding-policy.json">Inspect the allocation policy ↗</a></div>
          </div>
        </section>
      </main>

      <footer className="use-footer fund-footer">
        <Link className="brand" href="/"><Brand />Frontier Max</Link>
        <p>Help evidence exist. Never buy the conclusion.</p>
        <div><Link href="/benchmarks">Benchmarks</Link><Link href="/reader">Reader</Link><Link href="/use">Use</Link><a href="/run-fund/v1/funding-policy.json">Funding policy</a></div>
      </footer>
    </div>
  );
}
