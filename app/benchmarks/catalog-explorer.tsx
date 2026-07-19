"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CatalogBenchmark = {
  id: string;
  title: string;
  description: string;
  category: string;
  url: string;
  search: string;
  priority: number;
};

type CatalogMeta = {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  parserVersion: string;
  benchmarkCount: number;
  rawRecordCount: number;
  bootstrap?: boolean;
};

type CatalogPayload = {
  meta: CatalogMeta;
  benchmarks: CatalogBenchmark[];
};

type IngestionStatus = {
  status: string;
  catalog: {
    indexedBenchmarks: number;
    discoveredBenchmarks: number;
    progress: number;
  };
  refresh: {
    latestRun: {
      status: string;
      completedAt: string | null;
      processed: number;
    } | null;
  };
  automation: {
    status: "active" | "unverified";
    scheduledProcessingVerified: boolean;
    clockProcessingVerified: boolean;
  };
};

const SHORTCUTS = [
  { label: "Coding agents", query: "coding agent" },
  { label: "Tool use", query: "tool use" },
  { label: "Reasoning", query: "reasoning" },
  { label: "Multimodal", query: "multimodal" },
  { label: "Safety", query: "safety" },
  { label: "Long horizon", query: "long horizon agent" },
];

function relativeTime(iso: string) {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "unknown";
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function relevance(benchmark: CatalogBenchmark, normalized: string) {
  if (!normalized) return benchmark.priority;
  const title = benchmark.title.toLowerCase();
  const id = benchmark.id.toLowerCase();
  let score = benchmark.priority / 1000;
  if (title === normalized || id === normalized) score += 1000;
  else if (title.startsWith(normalized) || id.startsWith(normalized)) score += 650;
  else if (title.includes(normalized)) score += 400;
  score -= title.length / 100;
  return score;
}

export default function CatalogExplorer() {
  const [payload, setPayload] = useState<CatalogPayload | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [visible, setVisible] = useState(40);
  const [status, setStatus] = useState<"loading" | "live" | "bootstrap" | "error">("loading");
  const [ingestion, setIngestion] = useState<IngestionStatus | null>(null);

  useEffect(() => {
    let current = true;
    let catalogAvailable = false;
    let statusTimeout: number | undefined;
    const loadIngestionStatus = () => {
      void fetch("/api/status", { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error("Ingestion status unavailable");
          return response.json() as Promise<IngestionStatus>;
        })
        .then((data) => {
          if (current) setIngestion(data);
        })
        .catch(() => undefined);
    };
    const requestBoundedRefresh = () => {
      if (!current || !catalogAvailable) return;
      void fetch("/api/benchmarklist/tick", {
        method: "POST",
        cache: "no-store",
        keepalive: true,
      })
        .then((response) => {
          if (!response.ok || !current) return;
          window.clearTimeout(statusTimeout);
          statusTimeout = window.setTimeout(loadIngestionStatus, 10_000);
        })
        .catch(() => undefined);
    };
    const refreshInterval = window.setInterval(
      requestBoundedRefresh,
      10 * 60 * 1000,
    );
    const load = async () => {
      loadIngestionStatus();
      try {
        const response = await fetch("/api/benchmarks", {
          signal: AbortSignal.timeout(5_000),
        });
        if (!response.ok) throw new Error("Live index unavailable");
        const data = await response.json() as CatalogPayload;
        catalogAvailable = true;
        if (current) {
          setPayload(data);
          setStatus("live");
        }
      } catch {
        try {
          const response = await fetch("/data/benchmarklist-bootstrap.json", {
            cache: "force-cache",
          });
          if (!response.ok) throw new Error("Bootstrap unavailable");
          const data = await response.json() as CatalogPayload;
          catalogAvailable = true;
          if (current) {
            setPayload(data);
            setStatus("bootstrap");
          }
        } catch {
          // The empty/error state below is the final fallback.
        }
      }
      if (current) {
        setStatus((value) => (value === "loading" ? "error" : value));
        requestBoundedRefresh();
      }
    };
    load();
    return () => {
      current = false;
      window.clearInterval(refreshInterval);
      window.clearTimeout(statusTimeout);
    };
  }, []);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    payload?.benchmarks.forEach((benchmark) => {
      counts.set(benchmark.category, (counts.get(benchmark.category) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [payload]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");
    const terms = normalized.split(" ").filter(Boolean);
    return (payload?.benchmarks ?? [])
      .filter((benchmark) => category === "all" || benchmark.category === category)
      .filter((benchmark) => terms.every((term) => benchmark.search.includes(term)))
      .sort((a, b) => {
        if (normalized) return relevance(b, normalized) - relevance(a, normalized) || a.title.localeCompare(b.title);
        return b.priority - a.priority || a.title.localeCompare(b.title);
      });
  }, [category, payload, query]);

  const updateQuery = (value: string) => {
    setQuery(value);
    setVisible(40);
  };

  return (
    <div className="catalog-page">
      <a className="skip-link" href="#catalog-results">Skip to catalog</a>
      <header className="reader-header catalog-header">
        <Link className="brand" href="/" aria-label="Frontier Max home"><span className="brand-mark"><i /><i /><i /></span>Frontier Max</Link>
        <nav aria-label="Catalog navigation"><Link href="/benchmarks">Benchmarks</Link><Link href="/reader">Reader</Link><Link href="/use">Use</Link><Link href="/fund">Fund</Link><Link href="/#method">Method</Link></nav>
        <a className="reader-back" href="https://benchmarklist.com/" target="_blank" rel="noreferrer">Source: BenchmarkList <span>↗</span></a>
      </header>

      <main className="catalog-main">
        <section className="catalog-hero">
          <p className="reader-eyebrow"><span>LIVE EVIDENCE CATALOG</span> Indexed from BenchmarkList</p>
          <div className="catalog-hero-grid">
            <h1>Public <em>benchmarks.</em><br />One legible map.</h1>
            <p>Search public AI benchmarks by name, capability, category, or model. Every record leads to a source-preserving evidence card—not another universal leaderboard.</p>
          </div>
          <div className="catalog-search-shell">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="Search benchmarks, capabilities, or models…"
              aria-label="Search benchmark catalog"
              autoFocus
            />
            {query && <button onClick={() => updateQuery("")} aria-label="Clear search">Clear</button>}
          </div>
          <div className="catalog-shortcuts" aria-label="Popular benchmark searches">
            {SHORTCUTS.map((shortcut) => <button key={shortcut.label} onClick={() => updateQuery(shortcut.query)}>{shortcut.label}</button>)}
          </div>
          <div className={`catalog-source-strip ${status}`} role="status" aria-live="polite">
            <span><i /> {status === "live" ? "Live stored index" : status === "bootstrap" ? "Stored bootstrap snapshot" : status === "error" ? "Index unavailable" : "Loading stored index"}</span>
            <span>{payload ? `${payload.meta.benchmarkCount.toLocaleString()} benchmarks` : "Connecting…"}</span>
            <span>{payload ? `Checked ${relativeTime(payload.meta.fetchedAt)}` : ""}</span>
            <span>{ingestion ? `${ingestion.catalog.indexedBenchmarks.toLocaleString()} evidence pages stored` : "Detail snapshots stored on demand"}</span>
            <span>{ingestion?.automation.status === "active" ? "Scheduled backfill verified" : "Visit-backed backfill active"}</span>
          </div>
        </section>

        <section className="catalog-workspace" id="catalog-results">
          <aside className="catalog-filters">
            <div><span>DISCOVER</span><h2>Filter the evidence</h2></div>
            <label><span>Capability / category</span><select value={category} onChange={(event) => { setCategory(event.target.value); setVisible(40); }}><option value="all">All categories</option>{categories.map(([name, count]) => <option value={name} key={name}>{name} ({count})</option>)}</select></label>
            <div className="catalog-filter-note"><b>What is indexed?</b><p>Benchmark identities, descriptions, categories, source URLs, and—when a record is opened—its reported metrics and configurations.</p></div>
            <div className="catalog-filter-note"><b>Backfill status</b><p>{ingestion ? `${ingestion.catalog.indexedBenchmarks.toLocaleString()} of ${ingestion.catalog.discoveredBenchmarks.toLocaleString()} detail pages are stored. Opening any record indexes it immediately; ${ingestion.automation.status === "active" ? "scheduled batches are verified." : "visits advance bounded batches while the scheduled clock is being verified."}` : "Detail pages are stored on demand while bounded background batches advance the catalog."}</p></div>
            <div className="catalog-filter-note"><b>What is not inferred?</b><p>Missing cost, completion time, and token use remain unavailable. They are never converted to zero or joined from unrelated runs.</p></div>
          </aside>

          <div className="catalog-results-panel">
            <div className="catalog-results-head"><div><span>BENCHMARK REGISTRY</span><h2>{filtered.length.toLocaleString()} matching records</h2></div><p>Scores are comparable within a benchmark—not across this list.</p></div>
            {status === "loading" && <div className="catalog-empty">Loading the stored BenchmarkList catalog…</div>}
            {status === "error" && <div className="catalog-empty error">The catalog is temporarily unavailable. The indexer will retry automatically.</div>}
            {payload && filtered.length === 0 && <div className="catalog-empty">No benchmarks match this search and category.</div>}
            <div className="catalog-list">
              {filtered.slice(0, visible).map((benchmark, index) => (
                <Link href={`/benchmarks/${benchmark.id}`} className="catalog-row" key={benchmark.id}>
                  <span className="catalog-row-index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="catalog-row-body"><div><h3>{benchmark.title}</h3><span>{benchmark.category}</span></div><p>{benchmark.description || "Source-linked benchmark record."}</p></div>
                  <div className="catalog-row-evidence"><span>BenchmarkList</span><b>Open evidence card</b></div>
                  <i aria-hidden="true">→</i>
                </Link>
              ))}
            </div>
            {visible < filtered.length && <button className="catalog-load" onClick={() => setVisible((value) => value + 40)}>Show 40 more <span>↓</span></button>}
          </div>
        </section>

        <section className="catalog-boundary">
          <span>THE INTERPRETABILITY LAYER</span>
          <h2>We index the evidence.<br /><em>We don’t invent what’s missing.</em></h2>
          <p>Frontier Max is not affiliated with BenchmarkList. Every record links back to its source. Raw pages are stored privately for provenance; public views transform the facts into a legible evaluation contract.</p>
        </section>
      </main>
      <footer className="reader-footer"><Link className="brand" href="/"><span className="brand-mark"><i /><i /><i /></span>Frontier Max</Link><p>Public benchmark evidence, made legible.</p><div className="reader-footer-links"><Link href="/reader">Reader</Link><Link href="/use">CLI</Link><Link href="/fund">Run Fund</Link><a href="https://benchmarklist.com/" target="_blank" rel="noreferrer">Visit BenchmarkList →</a></div></footer>
    </div>
  );
}
