"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { coverageByRow, tableMetricNames } from "../../../lib/benchmark-coverage.mjs";
import {
  buildEvidenceCard,
  buildSnapshotShareUrl,
  buildXIntentUrl,
  buildXShareText,
  compactSnapshot,
  type SharedReference,
} from "./share";

type CatalogBenchmark = {
  id: string;
  title: string;
  description: string;
  category: string;
  url: string;
};

type BenchmarkResult = {
  rank: number | null;
  name: string;
  metrics: Array<{
    name: string;
    value: string | number | null;
    displayValue?: string;
    direction?: "higher" | "lower" | "unknown";
  }>;
  sourceUrl?: string | null;
  sampledAt?: string | null;
};

type BenchmarkDetail = {
  id: string;
  title: string;
  description: string;
  category: string | null;
  datePublished: string | null;
  dateModified: string | null;
  primaryMetric: string | null;
  metricDirection: "higher" | "lower" | "unknown";
  variables: string[];
  relatedUrls: string[];
  distributions: Array<{ name: string; url: string }>;
  results: BenchmarkResult[];
  snapshots: Array<{ id: string; results: BenchmarkResult[] }>;
  sourceUrl: string;
  fetchedAt: string;
  checkedAt?: string;
  sourceHash: string;
  parserVersion: string;
};

type CoverageKey = "score" | "cost" | "time" | "tokens";

const COVERAGE_META: Record<CoverageKey, { label: string }> = {
  score: { label: "Score" },
  cost: { label: "Cost" },
  time: { label: "Time" },
  tokens: { label: "Tokens" },
};

function prettyDate(value: string | null) {
  if (!value) return "Not reported";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(time);
}

function prettyTimestamp(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(time);
}

function fallbackTitle(slug: string) {
  const title = slug.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return title ? `${title.charAt(0).toUpperCase()}${title.slice(1)}` : "Benchmark evidence";
}

export default function BenchmarkEvidence({
  slug,
  sharedReference,
}: {
  slug: string;
  sharedReference: SharedReference | null;
}) {
  const [detail, setDetail] = useState<BenchmarkDetail | null>(null);
  const [catalogEntry, setCatalogEntry] = useState<CatalogBenchmark | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "partial" | "error">("loading");
  const [query, setQuery] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    let current = true;
    const bootstrap = fetch("/data/benchmarklist-bootstrap.json", { cache: "force-cache" })
      .then((response) => response.json() as Promise<{ benchmarks?: CatalogBenchmark[] }>)
      .then((payload) => {
        const entry = payload.benchmarks?.find((benchmark) => benchmark.id === slug) ?? null;
        if (current && entry) {
          setCatalogEntry(entry);
          setStatus((value) => (value === "loading" ? "partial" : value));
        }
      })
      .catch(() => undefined);
    const live = fetch(`/api/benchmarks/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Live benchmark evidence unavailable");
        return response.json() as Promise<{ detail: BenchmarkDetail; catalogEntry: CatalogBenchmark | null }>;
      })
      .then((payload) => {
        if (current) {
          setDetail(payload.detail);
          setCatalogEntry(payload.catalogEntry);
          setStatus("ready");
        }
      })
      .catch(() => undefined);
    Promise.all([bootstrap, live]).then(() => {
      if (current) setStatus((value) => (value === "loading" ? "error" : value));
    });
    return () => {
      current = false;
    };
  }, [slug]);

  const title = detail?.title || catalogEntry?.title || fallbackTitle(slug);
  const description = detail?.description || catalogEntry?.description || "Source-linked benchmark record.";
  const category = detail?.category || catalogEntry?.category || "Uncategorized";
  const rowCoverage = useMemo(
    () => coverageByRow(detail?.results ?? [], detail?.primaryMetric ?? null) as Set<CoverageKey>[],
    [detail],
  );
  const coverage = (Object.keys(COVERAGE_META) as CoverageKey[]).map((key) => ({
    key,
    label: COVERAGE_META[key].label,
    reported: rowCoverage.some((keys) => keys.has(key)),
  }));
  const reportedCoverage = coverage.filter((item) => item.reported).length;
  const complete4dRows = rowCoverage.filter((keys) => keys.size === 4).length;
  const complete4d = complete4dRows >= 2;
  const tableMetrics = useMemo(() => {
    return tableMetricNames(detail?.results ?? [], detail?.primaryMetric ?? null) as string[];
  }, [detail]);
  const filteredResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return detail?.results ?? [];
    return (detail?.results ?? []).filter((result) => result.name.toLowerCase().includes(normalized));
  }, [detail, query]);
  const links = useMemo(() => {
    const values = [
      ...(detail?.distributions ?? []).map((item) => ({ label: item.name, url: item.url })),
      ...(detail?.relatedUrls ?? []).map((url, index) => ({ label: index === 0 ? "Primary reference" : `Related source ${index + 1}`, url })),
    ];
    return values.filter((item, index) => values.findIndex((other) => other.url === item.url) === index);
  }, [detail]);
  const shareArtifacts = useMemo(() => {
    if (!detail) return null;
    const checkedAt = detail.checkedAt || detail.fetchedAt;
    const shareUrl = buildSnapshotShareUrl(slug, detail.sourceHash, checkedAt);
    const shareText = buildXShareText({ title, reportedCoverage, sourceHash: detail.sourceHash });
    return {
      shareUrl,
      xIntentUrl: buildXIntentUrl(shareText, shareUrl),
      evidenceCard: buildEvidenceCard({
        slug,
        title,
        description,
        reportedCoverage,
        sourceUrl: detail.sourceUrl,
        sourceHash: detail.sourceHash,
        checkedAt,
      }),
    };
  }, [description, detail, reportedCoverage, slug, title]);
  const sharedSnapshotMatches = Boolean(
    sharedReference && detail && sharedReference.snapshot === detail.sourceHash.toLowerCase(),
  );

  const copyEvidence = async () => {
    if (!shareArtifacts) return;
    try {
      await navigator.clipboard.writeText(shareArtifacts.evidenceCard);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("failed");
    }
  };

  const shareOnX = () => {
    if (!shareArtifacts) return;
    const popup = window.open(shareArtifacts.xIntentUrl, "_blank", "noopener,noreferrer");
    if (popup) popup.opener = null;
  };

  return (
    <div className="evidence-page">
      <a className="skip-link" href="#evidence-content">Skip to evidence</a>
      <header className="reader-header catalog-header">
        <Link className="brand" href="/" aria-label="Frontier Max home"><span className="brand-mark"><i /><i /><i /></span>Frontier Max</Link>
        <nav aria-label="Evidence navigation"><Link href="/benchmarks">Catalog</Link><Link href="/reader">Reader</Link><a href="#results">Results</a><Link href="/fund">Fund</Link><a href="#provenance">Provenance</a></nav>
        <a className="reader-back" href={detail?.sourceUrl || catalogEntry?.url || `https://benchmarklist.com/benchmarks/${slug}/`} target="_blank" rel="noreferrer">Open source <span>↗</span></a>
      </header>

      <main className="evidence-main" id="evidence-content">
        <nav className="evidence-breadcrumb" aria-label="Breadcrumb"><Link href="/benchmarks">Benchmarks</Link><span>/</span><b>{title}</b></nav>
        <section className="evidence-hero">
          <div>
            <p className="reader-eyebrow"><span>BENCHMARK NUTRITION LABEL</span> Indexed from BenchmarkList</p>
            <h1>{title}</h1>
          </div>
          <div className="evidence-hero-copy"><span>{category}</span><p>{description}</p></div>
        </section>

        <div className={`evidence-sync ${status}`} role="status" aria-live="polite">
          <span><i /> {status === "ready" ? "Live source snapshot stored" : status === "partial" ? "Catalog record loaded · detail snapshot unavailable" : status === "error" ? "Catalog record unavailable" : "Indexing source evidence"}</span>
          {detail && <><span>Checked {prettyTimestamp(detail.checkedAt || detail.fetchedAt)}</span><span>Snapshot {compactSnapshot(detail.sourceHash)}</span><span>Parser {detail.parserVersion}</span></>}
          {sharedReference && <span style={{ color: sharedSnapshotMatches ? "#3f6850" : "#a45238" }}>{detail ? sharedSnapshotMatches ? `Shared reference${sharedReference.checkedAt ? ` checked ${prettyTimestamp(sharedReference.checkedAt)}` : ""} matches this indexed snapshot` : `Shared snapshot ${compactSnapshot(sharedReference.snapshot)}${sharedReference.checkedAt ? ` checked ${prettyTimestamp(sharedReference.checkedAt)}` : ""} differs from the current index` : `Shared snapshot reference ${compactSnapshot(sharedReference.snapshot)}${sharedReference.checkedAt ? ` checked ${prettyTimestamp(sharedReference.checkedAt)}` : ""}`}</span>}
        </div>

        <section className="nutrition-grid">
          <article><span>WHAT IT MEASURES</span><p>{description}</p></article>
          <article><span>PRIMARY METRIC</span><h2>{detail?.primaryMetric || "Not reported"}</h2><p>{detail?.metricDirection === "higher" ? "Higher is better" : detail?.metricDirection === "lower" ? "Lower is better" : "Direction not explicitly reported"}</p></article>
          <article><span>RELEASED / UPDATED</span><h2>{prettyDate(detail?.datePublished ?? null)}</h2><p>Source updated {prettyDate(detail?.dateModified ?? null)}</p></article>
          <article><span>REPORTED CONFIGURATIONS</span><h2>{detail?.results.length ?? "—"}</h2><p>{detail?.snapshots.length ? `${detail.snapshots.length} source view${detail.snapshots.length === 1 ? "" : "s"} preserved` : "Detail indexing in progress"}</p></article>
        </section>

        <section className="interpretation-grid">
          <article className="can-inform"><span>CAN INFORM</span><h2>Relative performance inside this evaluation contract.</h2><p>Use the reported comparison set to understand how configurations performed on the capability this benchmark actually measures.</p></article>
          <article className="cannot-inform"><span>DOES NOT ESTABLISH</span><h2>A universally best model or agent.</h2><p>Results do not establish run-level cost, latency, or token efficiency unless those fields were measured in the same source snapshot.</p></article>
        </section>

        <section className="coverage-section">
          <div className="coverage-head"><div><span>MEASUREMENT COVERAGE</span><h2>{reportedCoverage} of 4 dimensions reported</h2></div><p>{complete4d ? `${complete4dRows} configurations contain the four same-row measurements needed to consider a conditional workload frontier.` : "Missing dimensions remain unavailable. We never turn them into zeros or splice in unrelated operational data."}</p></div>
          <div className="coverage-cards">{coverage.map((item) => <div className={item.reported ? "reported" : "missing"} key={item.key}><span>{item.label}</span><b>{item.reported ? "Reported" : "Unavailable"}</b><i>{item.reported ? "✓" : "—"}</i></div>)}</div>
        </section>

        <section className="funding-provenance">
          <div><span>RUN FUNDING</span><h2>Funding should explain the run—not influence the result.</h2></div>
          <div className="funding-provenance-status"><span>Frontier Max support</span><b>None</b><p>Frontier Max has not funded this indexed run. Funding relationships from the source are not currently normalized, so absence here is not evidence that the original run had no sponsors.</p></div>
          <Link href="/fund">Read the Run Fund policy <span>→</span></Link>
        </section>

        <section className="evidence-results" id="results">
          <div className="evidence-results-head"><div><span>REPORTED COMPARISON SET</span><h2>{detail ? `${filteredResults.length} configurations` : "Indexing configurations"}</h2></div>{detail?.results.length ? <label><span>Filter results</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Model or configuration…" /></label> : null}</div>
          <p className="comparison-note"><b>Read before comparing.</b> These values are displayed as reported by BenchmarkList. Observation dates, harnesses, or system configurations may differ when the source does not expose that metadata. Frontier Max does not calculate a Pareto frontier from an uncertain comparison set.</p>
          {!detail && <div className="catalog-empty">The catalog record is available, but its detailed source snapshot has not loaded. Open the source or try again later.</div>}
          {detail && !detail.results.length && <div className="catalog-empty">No reported-results table was indexed from this source record.</div>}
          {detail && detail.results.length > 0 && filteredResults.length === 0 && <div className="catalog-empty">No reported configurations match this filter.</div>}
          {detail && filteredResults.length > 0 && <div className="reader-table-scroll evidence-table-scroll"><table className="reader-table evidence-table"><caption>Reported BenchmarkList configurations and source values</caption><thead><tr><th>Rank</th><th>Configuration</th>{tableMetrics.map((metric) => <th key={metric}>{metric}</th>)}<th>Sampled</th></tr></thead><tbody>{filteredResults.map((result, index) => <tr key={`${result.name}-${index}`}><td>{result.rank ?? "—"}</td><td><b>{result.name}</b>{result.sourceUrl && <a href={result.sourceUrl} target="_blank" rel="noreferrer">source ↗</a>}</td>{tableMetrics.map((metricName) => { const metric = result.metrics.find((item) => item.name === metricName); return <td key={metricName}>{metric?.displayValue || metric?.value?.toString() || "—"}</td>; })}<td>{prettyDate(result.sampledAt ?? null)}</td></tr>)}</tbody></table></div>}
        </section>

        <section className="evidence-provenance" id="provenance">
          <div><span>PROVENANCE</span><h2>Every interpretation resolves back to evidence.</h2><p>The raw BenchmarkList response is stored privately by content hash. Parsed fields retain the source URL, fetch time, parser version, and snapshot lineage.</p></div>
          <div className="provenance-links"><a href={detail?.sourceUrl || catalogEntry?.url || `https://benchmarklist.com/benchmarks/${slug}/`} target="_blank" rel="noreferrer"><span>BenchmarkList record</span><b>Open original ↗</b></a>{links.slice(0, 6).map((link) => <a href={link.url} target="_blank" rel="noreferrer" key={link.url}><span>{link.label}</span><b>Open source ↗</b></a>)}</div>
        </section>

        <section className="evidence-share"><div><span>SHARE THE INTERPRETATION</span><h2>One claim. One caveat. One source.</h2></div><div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "flex-end" }}><button disabled={!shareArtifacts} onClick={shareOnX}>Share on X<span>↗</span></button><button disabled={!shareArtifacts} onClick={copyEvidence}>{copyState === "copied" ? "Copied" : "Copy evidence card"}<span>{copyState === "copied" ? "✓" : "⧉"}</span></button></div><p className="copy-announcement" role="status" aria-live="polite">{copyState === "copied" ? "Evidence card copied with source and snapshot reference." : copyState === "failed" ? "Clipboard access failed. Copy the text below manually." : shareArtifacts ? "Shares preserve the indexed source hash and checked time; opening an older link reveals when the current snapshot has changed." : "Sharing becomes available when the source snapshot loads."}</p>{copyState === "failed" && shareArtifacts && <textarea aria-label="Evidence card for manual copy" readOnly value={shareArtifacts.evidenceCard} />}</section>
      </main>
      <footer className="reader-footer"><Link className="brand" href="/"><span className="brand-mark"><i /><i /><i /></span>Frontier Max</Link><p>Source-linked behavioral interpretability.</p><div className="reader-footer-links"><Link href="/fund">Run Fund</Link><Link href="/benchmarks">Back to catalog →</Link></div></footer>
    </div>
  );
}
