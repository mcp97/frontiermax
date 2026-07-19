"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type WorkloadId =
  | "realtime"
  | "interactive"
  | "delegated"
  | "batch"
  | "continuous";

type OperatingPoint = {
  id: string;
  agent: "Aster" | "Cedar" | "Loam" | "Moss";
  mode: "Fast" | "Balanced" | "Deep" | "Parallel";
  success: number;
  cost: number;
  minutes: number;
  context: number;
  p95: number;
  reliability: number;
  dailyRuns: number;
  intervention: number;
};

type Workload = {
  id: WorkloadId;
  short: string;
  title: string;
  description: string;
  objective: string;
  xLabel: string;
  xUnit: string;
  xMax: number;
  xStep: number;
  defaultCeiling: number;
  color: string;
};

const WORKLOADS: Workload[] = [
  {
    id: "realtime",
    short: "Real-time",
    title: "Respond before the moment passes.",
    description:
      "Voice, robotics, and live support make tail latency a hard gate. Quality only matters if the response arrives in time.",
    objective: "Minimize p95 response time above a quality floor.",
    xLabel: "p95 response time",
    xUnit: "s",
    xMax: 12,
    xStep: 0.5,
    defaultCeiling: 6.5,
    color: "#d97954",
  },
  {
    id: "interactive",
    short: "Interactive",
    title: "Protect the human flow state.",
    description:
      "Coding and copilots care about the full loop: first response, correction turns, and time until the result is accepted.",
    objective: "Minimize time to an accepted result.",
    xLabel: "expected time to accepted result",
    xUnit: "min",
    xMax: 42,
    xStep: 1,
    defaultCeiling: 24,
    color: "#437c69",
  },
  {
    id: "delegated",
    short: "Delegated",
    title: "Pay for verified completion.",
    description:
      "For long-horizon work, latency and context become guardrails once they are reasonable. Recovery and human intervention belong in cost.",
    objective: "Minimize expected cost per verified success.",
    xLabel: "expected cost per verified success",
    xUnit: "$",
    xMax: 18,
    xStep: 0.5,
    defaultCeiling: 10,
    color: "#9b6b43",
  },
  {
    id: "batch",
    short: "Batch",
    title: "Turn capacity into accepted work.",
    description:
      "At volume, concurrency and accepted throughput dominate after the required quality threshold has been met.",
    objective: "Minimize cost per 1,000 accepted outputs.",
    xLabel: "cost per 1,000 accepted outputs",
    xUnit: "$",
    xMax: 3400,
    xStep: 100,
    defaultCeiling: 1900,
    color: "#b48a35",
  },
  {
    id: "continuous",
    short: "Continuous",
    title: "Optimize the system, not the demo.",
    description:
      "Recurring workflows expose variance, regressions, availability, and operating overhead that one-off tests miss.",
    objective: "Minimize monthly cost above a reliability floor.",
    xLabel: "monthly cost per 1,000 verified runs",
    xUnit: "$",
    xMax: 7000,
    xStep: 200,
    defaultCeiling: 2200,
    color: "#596b42",
  },
];

const POINTS: OperatingPoint[] = [
  { id: "aster-fast", agent: "Aster", mode: "Fast", success: 78, cost: 0.42, minutes: 5.8, context: 28, p95: 1.7, reliability: 86, dailyRuns: 150, intervention: 13 },
  { id: "aster-balanced", agent: "Aster", mode: "Balanced", success: 86, cost: 0.92, minutes: 10.8, context: 56, p95: 3.2, reliability: 91, dailyRuns: 110, intervention: 8 },
  { id: "aster-deep", agent: "Aster", mode: "Deep", success: 92, cost: 2.18, minutes: 21.5, context: 118, p95: 7.6, reliability: 95, dailyRuns: 72, intervention: 4 },
  { id: "aster-parallel", agent: "Aster", mode: "Parallel", success: 94, cost: 4.1, minutes: 14.8, context: 188, p95: 8.1, reliability: 96, dailyRuns: 64, intervention: 3 },
  { id: "cedar-fast", agent: "Cedar", mode: "Fast", success: 81, cost: 0.58, minutes: 4.9, context: 36, p95: 2.1, reliability: 88, dailyRuns: 145, intervention: 11 },
  { id: "cedar-balanced", agent: "Cedar", mode: "Balanced", success: 89, cost: 1.12, minutes: 9.2, context: 68, p95: 3.7, reliability: 94, dailyRuns: 100, intervention: 6 },
  { id: "cedar-deep", agent: "Cedar", mode: "Deep", success: 95, cost: 2.86, minutes: 24.8, context: 146, p95: 8.7, reliability: 97, dailyRuns: 60, intervention: 2 },
  { id: "cedar-parallel", agent: "Cedar", mode: "Parallel", success: 97, cost: 5.3, minutes: 17.4, context: 210, p95: 9.2, reliability: 98, dailyRuns: 50, intervention: 1 },
  { id: "loam-fast", agent: "Loam", mode: "Fast", success: 75, cost: 0.28, minutes: 7.2, context: 23, p95: 1.3, reliability: 82, dailyRuns: 190, intervention: 16 },
  { id: "loam-balanced", agent: "Loam", mode: "Balanced", success: 84, cost: 0.64, minutes: 13.4, context: 48, p95: 2.8, reliability: 89, dailyRuns: 135, intervention: 9 },
  { id: "loam-deep", agent: "Loam", mode: "Deep", success: 90, cost: 1.44, minutes: 27.6, context: 96, p95: 6.8, reliability: 93, dailyRuns: 85, intervention: 5 },
  { id: "loam-parallel", agent: "Loam", mode: "Parallel", success: 92, cost: 2.8, minutes: 19.8, context: 170, p95: 7.1, reliability: 94, dailyRuns: 76, intervention: 4 },
  { id: "moss-fast", agent: "Moss", mode: "Fast", success: 80, cost: 0.76, minutes: 4.2, context: 44, p95: 2.5, reliability: 90, dailyRuns: 130, intervention: 9 },
  { id: "moss-balanced", agent: "Moss", mode: "Balanced", success: 88, cost: 1.48, minutes: 8.1, context: 82, p95: 4.4, reliability: 95, dailyRuns: 88, intervention: 4 },
  { id: "moss-deep", agent: "Moss", mode: "Deep", success: 93, cost: 3.42, minutes: 19.1, context: 162, p95: 9.8, reliability: 98, dailyRuns: 52, intervention: 1 },
  { id: "moss-parallel", agent: "Moss", mode: "Parallel", success: 96, cost: 6.2, minutes: 13.8, context: 236, p95: 10.5, reliability: 99, dailyRuns: 44, intervention: 1 },
];

const AGENT_COLORS: Record<OperatingPoint["agent"], string> = {
  Aster: "#d97954",
  Cedar: "#437c69",
  Loam: "#b48a35",
  Moss: "#6f5a88",
};

function metricFor(point: OperatingPoint, workload: WorkloadId) {
  const successProbability = point.success / 100;
  const reliabilityProbability = point.reliability / 100;
  const expectedHumanCost = (point.intervention / 100) * 6;

  if (workload === "realtime") return { x: point.p95, y: point.success };
  if (workload === "interactive") {
    return { x: point.minutes / successProbability, y: point.success };
  }
  if (workload === "delegated") {
    return {
      x: (point.cost + expectedHumanCost) / successProbability,
      y: point.success,
    };
  }
  if (workload === "batch") {
    return { x: (point.cost * 1000) / successProbability, y: point.success };
  }
  return {
    x: (point.cost * 1000) / reliabilityProbability,
    y: point.reliability,
  };
}

function paretoFrontier(
  points: OperatingPoint[],
  workload: WorkloadId,
) {
  return points
    .filter((candidate) => {
      const a = metricFor(candidate, workload);
      return !points.some((other) => {
        if (other.id === candidate.id) return false;
        const b = metricFor(other, workload);
        return b.x <= a.x && b.y >= a.y && (b.x < a.x || b.y > a.y);
      });
    })
    .sort(
      (a, b) => metricFor(a, workload).x - metricFor(b, workload).x,
    );
}

function formatMetric(value: number, workload: WorkloadId) {
  if (workload === "realtime") return `${value.toFixed(1)}s`;
  if (workload === "interactive") return `${value.toFixed(1)}m`;
  if (workload === "delegated") return `$${value.toFixed(2)}`;
  return `$${Math.round(value).toLocaleString()}`;
}

function MiniFrontier() {
  return (
    <div className="hero-visual" aria-label="Illustrative workload frontier">
      <div className="visual-topline">
        <span>Interactive coding · conceptual map</span>
        <span className="live-pill">Illustrative demo · synthetic data</span>
      </div>
      <svg viewBox="0 0 620 400" role="img" aria-label="Quality versus time chart">
        <defs>
          <linearGradient id="field" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#f2d6bd" stopOpacity=".54" />
            <stop offset="1" stopColor="#dce8d6" stopOpacity=".28" />
          </linearGradient>
        </defs>
        <rect x="52" y="28" width="536" height="314" rx="22" fill="url(#field)" />
        {[92, 170, 248, 326].map((y) => (
          <line key={y} x1="76" x2="566" y1={y} y2={y} className="chart-grid" />
        ))}
        {[132, 250, 368, 486].map((x) => (
          <line key={x} x1={x} x2={x} y1="52" y2="326" className="chart-grid" />
        ))}
        <path d="M 95 286 C 165 255, 188 216, 252 202 S 355 126, 502 80" className="hero-frontier-line" />
        <path d="M 95 286 C 165 255, 188 216, 252 202 S 355 126, 502 80 L 502 326 L 95 326 Z" className="hero-frontier-fill" />
        {[
          [95, 286, 8, "#b48a35"], [154, 261, 7, "#437c69"],
          [198, 246, 7, "#d97954"], [252, 202, 9, "#6f5a88"],
          [320, 225, 7, "#d97954"], [350, 158, 10, "#437c69"],
          [414, 178, 8, "#b48a35"], [502, 80, 11, "#6f5a88"],
          [472, 135, 7, "#437c69"], [534, 206, 9, "#d97954"],
        ].map(([x, y, r, fill], index) => (
          <g key={index}>
            <circle cx={x} cy={y} r={Number(r) + 5} fill="none" stroke={String(fill)} opacity=".18" />
            <circle cx={x} cy={y} r={r} fill={String(fill)} stroke="#fffaf2" strokeWidth="3" />
          </g>
        ))}
        <text x="78" y="374" className="chart-axis-label">TIME TO ACCEPTED RESULT →</text>
        <text x="30" y="246" transform="rotate(-90 30 246)" className="chart-axis-label">VERIFIED QUALITY →</text>
        <g transform="translate(386 44)">
          <rect width="170" height="38" rx="19" fill="#233127" />
          <text x="85" y="24" textAnchor="middle" className="frontier-label">ILLUSTRATIVE FRONTIER</text>
        </g>
      </svg>
      <div className="visual-footer">
        <span>A conceptual view of many valid trade-offs—not a measured result.</span>
      </div>
    </div>
  );
}

function FrontierChart({
  workload,
  qualityFloor = 74,
  xCeiling,
  sla = 36,
  contextCeiling = 180,
  selected,
  onSelect,
}: {
  workload: Workload;
  qualityFloor?: number;
  xCeiling: number;
  sla?: number;
  contextCeiling?: number;
  selected?: string;
  onSelect?: (id: string) => void;
}) {
  const feasible = POINTS.filter((point) => {
    const metric = metricFor(point, workload.id);
    return (
      metric.y >= qualityFloor &&
      metric.x <= xCeiling &&
      (workload.id === "realtime" || point.minutes <= sla) &&
      point.context <= contextCeiling
    );
  });
  const frontier = paretoFrontier(feasible, workload.id);
  const width = 720;
  const height = 430;
  const left = 68;
  const right = 28;
  const top = 28;
  const bottom = 68;
  const domainMax = Math.max(
    workload.xMax,
    ...POINTS.map((point) => metricFor(point, workload.id).x * 1.08),
  );
  const xScale = (x: number) =>
    left + (x / domainMax) * (width - left - right);
  const yScale = (y: number) =>
    top + ((100 - y) / 30) * (height - top - bottom);
  const frontierPath = frontier
    .map((point, index) => {
      const metric = metricFor(point, workload.id);
      return `${index === 0 ? "M" : "L"} ${xScale(metric.x)} ${yScale(metric.y)}`;
    })
    .join(" ");

  return (
    <div className="frontier-chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${workload.short} conditional Pareto frontier`}
      >
        <rect
          x={left}
          y={top}
          width={Math.max(0, xScale(xCeiling) - left)}
          height={Math.max(0, yScale(qualityFloor) - top)}
          rx="16"
          fill={workload.color}
          opacity=".07"
        />
        {[70, 75, 80, 85, 90, 95, 100].map((value) => (
          <g key={value}>
            <line x1={left} x2={width - right} y1={yScale(value)} y2={yScale(value)} className="chart-grid" />
            <text x={left - 14} y={yScale(value) + 4} textAnchor="end" className="chart-tick">{value}%</text>
          </g>
        ))}
        {[0, .25, .5, .75, 1].map((fraction) => {
          const value = domainMax * fraction;
          const x = xScale(value);
          return (
            <g key={fraction}>
              <line x1={x} x2={x} y1={top} y2={height - bottom} className="chart-grid" />
              <text x={x} y={height - bottom + 24} textAnchor="middle" className="chart-tick">
                {formatMetric(value, workload.id)}
              </text>
            </g>
          );
        })}
        <line x1={left} x2={width - right} y1={yScale(qualityFloor)} y2={yScale(qualityFloor)} className="constraint-line" />
        <line x1={xScale(xCeiling)} x2={xScale(xCeiling)} y1={top} y2={height - bottom} className="constraint-line" />
        {frontier.length > 1 && <path d={frontierPath} className="frontier-path" />}
        {POINTS.map((point) => {
          const metric = metricFor(point, workload.id);
          const x = xScale(metric.x);
          const y = yScale(metric.y);
          const isFeasible = feasible.some((candidate) => candidate.id === point.id);
          const isFrontier = frontier.some((candidate) => candidate.id === point.id);
          const isSelected = selected === point.id;
          const radius = 5.5 + Math.min(point.minutes, 30) / 8;
          return (
            <g
              key={point.id}
              className={`data-point ${isFeasible ? "is-feasible" : "is-muted"} ${isSelected ? "is-selected" : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`${point.agent} ${point.mode}: ${metric.y}% ${workload.id === "continuous" ? "reliability" : "verified outcome"}, ${formatMetric(metric.x, workload.id)}`}
              onClick={() => onSelect?.(point.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect?.(point.id);
                }
              }}
            >
              <circle cx={x} cy={y} r="22" fill="transparent" />
              {isFrontier && <circle cx={x} cy={y} r={radius + 8} fill={workload.color} opacity=".13" />}
              <circle cx={x} cy={y} r={radius + point.context / 90} fill="none" stroke={AGENT_COLORS[point.agent]} strokeWidth="1" opacity={isFeasible ? .28 : .08} />
              <circle cx={x} cy={y} r={radius} fill={AGENT_COLORS[point.agent]} stroke={isSelected ? "#1f2d24" : "#fffaf2"} strokeWidth={isSelected ? 4 : 2.5} />
              {isSelected && <text x={x} y={y - radius - 12} textAnchor="middle" className="point-label">{point.agent} · {point.mode}</text>}
            </g>
          );
        })}
        <text x={(left + width - right) / 2} y={height - 10} textAnchor="middle" className="chart-axis-label">
          {workload.xLabel.toUpperCase()} →
        </text>
        <text x="18" y={(top + height - bottom) / 2} transform={`rotate(-90 18 ${(top + height - bottom) / 2})`} textAnchor="middle" className="chart-axis-label">
          {workload.id === "continuous" ? "RELIABILITY" : "VERIFIED OUTCOME"} →
        </text>
      </svg>
      <div className="chart-legend">
        {(Object.keys(AGENT_COLORS) as OperatingPoint["agent"][]).map((agent) => (
          <span key={agent}><i style={{ background: AGENT_COLORS[agent] }} />{agent}</span>
        ))}
        <span className="legend-note">Illustrative configurations</span>
      </div>
    </div>
  );
}

function MetricIcon({ kind }: { kind: "quality" | "cost" | "time" | "context" }) {
  const paths = {
    quality: <><path d="M12 3l7 3v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3z" /><path d="M9 12l2 2 4-5" /></>,
    cost: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5c-.7-.8-1.8-1.2-3.2-1.2-1.7 0-3 .8-3 2s1 1.8 3.2 2.2c2 .4 3.2 1 3.2 2.4s-1.5 2.5-3.5 2.5c-1.4 0-2.7-.5-3.6-1.4M12 5.5v13" /></>,
    time: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    context: <><path d="M5 6.5h14M5 11.5h14M5 16.5h9" /><circle cx="3" cy="6.5" r=".8" fill="currentColor" /><circle cx="3" cy="11.5" r=".8" fill="currentColor" /><circle cx="3" cy="16.5" r=".8" fill="currentColor" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[kind]}</svg>;
}

export default function Home() {
  useEffect(() => {
    const requestBoundedRefresh = () => {
      void fetch("/api/benchmarklist/tick", {
        method: "POST",
        cache: "no-store",
        keepalive: true,
      }).catch(() => undefined);
    };
    requestBoundedRefresh();
    const refreshInterval = window.setInterval(
      requestBoundedRefresh,
      10 * 60 * 1000,
    );
    return () => window.clearInterval(refreshInterval);
  }, []);

  const [workloadId, setWorkloadId] = useState<WorkloadId>("interactive");
  const workload = WORKLOADS.find((item) => item.id === workloadId)!;
  const [qualityFloor, setQualityFloor] = useState(84);
  const [ceilingByWorkload, setCeilingByWorkload] = useState<Record<WorkloadId, number>>({
    realtime: 6.5,
    interactive: 24,
    delegated: 10,
    batch: 1900,
    continuous: 2200,
  });
  const [sla, setSla] = useState(28);
  const [contextCeiling, setContextCeiling] = useState(140);
  const [selected, setSelected] = useState("cedar-balanced");
  const xCeiling = ceilingByWorkload[workloadId];

  const feasible = useMemo(
    () =>
      POINTS.filter((point) => {
        const metric = metricFor(point, workloadId);
        return (
          metric.y >= qualityFloor &&
          metric.x <= xCeiling &&
          (workloadId === "realtime" || point.minutes <= sla) &&
          point.context <= contextCeiling
        );
      }),
    [workloadId, qualityFloor, xCeiling, sla, contextCeiling],
  );
  const frontier = useMemo(
    () => paretoFrontier(feasible, workloadId),
    [feasible, workloadId],
  );
  const recommendation = frontier[0] ?? feasible[0];
  const inspected = POINTS.find((point) => point.id === selected);
  const resultPoint = inspected ?? recommendation;
  const inspectedQualifies = inspected
    ? feasible.some((point) => point.id === inspected.id)
    : false;

  return (
    <div className="site-shell">
      <a className="skip-link" href="#content">Skip to content</a>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Frontier Max home">
          <span className="brand-mark"><i /><i /><i /></span>
          Frontier Max
        </a>
        <nav aria-label="Primary navigation">
          <a href="#thesis">Thesis</a>
          <Link href="/benchmarks">Benchmarks</Link>
          <Link href="/reader">Reader</Link>
          <Link href="/use">Use</Link>
          <Link href="/fund">Fund</Link>
          <a href="#frontiers">Frontiers</a>
        </nav>
        <Link className="header-cta" href="/benchmarks">Explore benchmarks <span>↗</span></Link>
      </header>

      <main id="content">
      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span>PREVIEW</span> The interpretability + actionability layer</p>
          <h1>There is no<br /><em>#1 agent.</em></h1>
          <p className="hero-lede">
            Frontier Max makes public AI benchmarks legible. Its first action preview turns a coding task into one of two transparent, evidence-backed workload policies.
          </p>
          <div className="hero-actions">
            <Link className="primary-button" href="/benchmarks">Explore benchmarks <span>→</span></Link>
            <Link className="text-button" href="/reader">Read a cohort <span>↗</span></Link>
          </div>
          <p className="hero-note">Interpret the evidence. Act on the decision.</p>
        </div>
        <MiniFrontier />
      </section>

      <section className="statement" id="thesis">
        <div className="section-index">01 / THE PROBLEM</div>
        <div className="statement-grid">
          <h2>Leaderboards answer<br />the wrong question.</h2>
          <div className="statement-copy">
            <p className="question old">“Which model has the highest score?”</p>
            <p className="turn">becomes</p>
            <p className="question new">“Which agent configuration can deliver a verified result within my quality, time, cost, and context limits?”</p>
          </div>
        </div>
        <div className="problem-rail">
          <div><b>01</b><h3>One rank hides the trade-offs.</h3><p>Score alone says nothing about whether a result is practical to produce.</p></div>
          <div><b>02</b><h3>Agents are curves, not points.</h3><p>Fast, Balanced, Deep, and Parallel settings create different operating points.</p></div>
          <div><b>03</b><h3>“Best” changes with the work.</h3><p>The frontier for a live copilot is not the frontier for a delegated research run.</p></div>
        </div>
      </section>

      <section className="translation-layer">
        <div className="section-index">02 / OUR ROLE</div>
        <div className="translation-head">
          <h2>The semantic and decision layer.<br /><em>Not a benchmark lab.</em></h2>
          <div>
            <p>Frontier Max continuously indexes public benchmark evidence from BenchmarkList, preserves its source lineage, and translates each evaluation contract into a decision surface without changing the reported result.</p>
            <Link href="/benchmarks">Open the benchmark catalog <span>→</span></Link>
            <Link href="/reader">Bring a comparable cohort <span>→</span></Link>
          </div>
        </div>
        <div className="translation-flow">
          <article><span>01</span><b>Source evidence</b><h3>Keep the grades.</h3><p>Preserve the publisher’s score, system configuration, version, date, source, and uncertainty when available.</p></article>
          <i>→</i>
          <article><span>02</span><b>Interpretability</b><h3>Make it legible.</h3><p>Archive the source snapshot, expose what the benchmark can and cannot establish, and keep every derived view reversible.</p></article>
          <i>→</i>
          <article><span>03</span><b>Actionability</b><h3>Make it usable.</h3><p>Let the workload and hard constraints select an explainable route. Never invent one universal rank.</p></article>
        </div>
      </section>

      <section className="home-fund-layer">
        <div className="section-index">03 / THE RUN FUND</div>
        <div className="home-fund-grid">
          <div><p className="action-kicker">A minor, neutral addendum</p><h2>Benchmarks are public infrastructure.<br /><em>Their inference bills are not.</em></h2></div>
          <div><p>Independent evaluators can pre-register an expensive run. Users and providers can eventually support execution with cash, API credits, or compute—without purchasing a conclusion, ranking, or route.</p><Link href="/fund">Open the Run Fund policy <span>→</span></Link></div>
        </div>
        <div className="home-fund-rail"><span><b>$0</b> cash held today</span><span><b>0</b> grants awarded</span><span><b>100%</b> funding provenance disclosed</span><span><b>Never</b> pay to rank</span></div>
      </section>

      <section className="action-layer">
        <div className="section-index">04 / THE ACTION LAYER</div>
        <div className="action-layer-grid">
          <div>
            <p className="action-kicker">OpenRouter × OpenCode</p>
            <h2>From benchmark<br /><em>to runtime.</em></h2>
          </div>
          <div className="action-layer-copy">
            <p>Choose interactive or delegated coding. We expose the objective, pin the route for one session, and launch OpenCode through OpenRouter without proxying your work.</p>
            <Link href="/reader">Open the Benchmark Reader <span>→</span></Link>
            <Link href="/use">Open the Frontier Max CLI <span>→</span></Link>
          </div>
        </div>
        <div className="action-route">
          <span><b>01</b> Workload</span><i>→</i><span><b>02</b> Visible policy</span><i>→</i><span><b>03</b> OpenRouter route</span><i>→</i><span><b>04</b> OpenCode session</span>
        </div>
      </section>

      <section className="measurement">
        <div className="section-index">05 / THE MEASUREMENT SPACE</div>
        <div className="measurement-head">
          <div>
            <h2>Four coordinates.<br /><em>Three objectives.</em></h2>
          </div>
          <p>
            A decision-ready run needs the same evidence. Most public benchmarks report only the outcome, so we disclose the gaps. Even when all four signals exist, tokens are often the mechanism behind cost and time—not an independent goal.
          </p>
        </div>
        <div className="metrics-row">
          <article className="metric quality"><MetricIcon kind="quality" /><span>01</span><h3>Outcome</h3><p>Did the task complete, and did the result verify?</p><b>OPTIMIZE ↑</b></article>
          <article className="metric cost"><MetricIcon kind="cost" /><span>02</span><h3>Cost</h3><p>All attempts, tools, retries, recovery, and human review.</p><b>OPTIMIZE ↓</b></article>
          <article className="metric time"><MetricIcon kind="time" /><span>03</span><h3>Time</h3><p>From request to accepted result: TTFT, generation, tools, retries, and review.</p><b>OPTIMIZE ↓</b></article>
          <article className="metric context"><MetricIcon kind="context" /><span>04</span><h3>Context</h3><p>Input, reasoning, output, state growth, and review burden.</p><b>MEASURE ALWAYS</b></article>
        </div>
        <div className="tokens-note">
          <span className="quote-mark">“</span>
          <p>Tokens should always be measured.<br /><strong>They should not always be optimized.</strong></p>
          <div>
            They become a true objective when context limits, rate limits, energy, review burden, or edge compute are binding.
          </div>
        </div>
      </section>

      <section className="atlas" id="frontiers">
        <div className="section-index light">06 / CONCEPT ATLAS</div>
        <div className="atlas-head">
          <h2>Same evidence.<br /><em>Different frontier.</em></h2>
          <p>This illustrative atlas shows why the operating regime must be chosen before comparison. Hard constraints decide what survives; the conditional frontier reveals the trade-offs.</p>
        </div>
        <div className="workload-tabs" aria-label="Workload profiles">
          {WORKLOADS.map((item, index) => (
            <button
              key={item.id}
              aria-pressed={workloadId === item.id}
              className={workloadId === item.id ? "active" : ""}
              onClick={() => {
                setWorkloadId(item.id);
                setSelected("");
              }}
            >
              <span>0{index + 1}</span>{item.short}
            </button>
          ))}
        </div>
        <div className="modifier-strip modifier-taxonomy">
          <span>Example modifiers · taxonomy only</span>
          <ul><li>High-stakes</li><li>Context-bound</li><li>High-volume</li><li>Edge</li><li>Creative</li></ul>
        </div>
        <div className="atlas-body">
          <div className="atlas-copy">
            <p className="profile-label" style={{ color: workload.color }}>{workload.short} work</p>
            <h3>{workload.title}</h3>
            <p>{workload.description}</p>
            <dl>
              <div><dt>Primary objective</dt><dd>{workload.objective}</dd></div>
              <div><dt>Context’s role</dt><dd>{workloadId === "interactive" ? "Protect session flow and prompt headroom." : workloadId === "delegated" ? "A gate until context or review becomes scarce." : "A measured operating constraint."}</dd></div>
            </dl>
          </div>
          <div className="atlas-chart-column">
            <FrontierChart
              workload={workload}
              xCeiling={workload.defaultCeiling}
              selected={selected}
              onSelect={setSelected}
            />
            <p className="atlas-gates">
              Atlas gates: {workload.id === "continuous" ? "74% reliability" : "74% verified outcome"} · {formatMetric(workload.defaultCeiling, workload.id)} objective ceiling · {workload.id === "realtime" ? "response SLA encoded on x-axis" : "≤36 min completion"} · ≤180K context.
            </p>
          </div>
        </div>
      </section>

      <section className="curve-section">
        <div className="curve-copy">
          <div className="section-index">07 / OPERATING CURVES</div>
          <h2>An agent is a curve,<br /><em>not a point.</em></h2>
          <p>The comparison unit is the full system: model, harness, tools, runtime policy, and effort setting. Change one, and you create a new operating point.</p>
          <div className="mode-list">
            <span><i style={{ background: "#d97954" }} />Fast <small>low effort</small></span>
            <span><i style={{ background: "#b48a35" }} />Balanced <small>default</small></span>
            <span><i style={{ background: "#437c69" }} />Deep <small>high effort</small></span>
            <span><i style={{ background: "#6f5a88" }} />Parallel <small>best-of-N</small></span>
          </div>
        </div>
        <div className="curve-visual" aria-label="Agent operating curve illustration">
          <div className="curve-axis y">QUALITY ↑</div>
          <div className="curve-axis x">COST + TIME →</div>
          <svg viewBox="0 0 650 410" role="img">
            {[80, 150, 220, 290, 360].map((y) => <line key={y} x1="46" x2="620" y1={y} y2={y} className="chart-grid" />)}
            {[90, 210, 330, 450, 570].map((x) => <line key={x} x1={x} x2={x} y1="32" y2="366" className="chart-grid" />)}
            <path d="M96 318 C176 292, 228 247, 284 208 S410 118, 518 72" className="curve-line" />
            {[
              [96,318,10,"Fast","$0.42 · 6m"],
              [232,246,12,"Balanced","$0.92 · 11m"],
              [380,148,14,"Deep","$2.18 · 22m"],
              [518,72,16,"Parallel","$4.62 · 14m"],
            ].map(([x,y,r,label,detail], index) => (
              <g key={String(label)}>
                <circle cx={Number(x)} cy={Number(y)} r={Number(r)+10} fill={["#d97954","#b48a35","#437c69","#6f5a88"][index]} opacity=".13" />
                <circle cx={Number(x)} cy={Number(y)} r={Number(r)} fill={["#d97954","#b48a35","#437c69","#6f5a88"][index]} stroke="#fffaf2" strokeWidth="4" />
                <text x={Number(x)} y={Number(y)-Number(r)-18} textAnchor="middle" className="curve-point-title">{label}</text>
                <text x={Number(x)} y={Number(y)+Number(r)+25} textAnchor="middle" className="curve-point-detail">{detail}</text>
              </g>
            ))}
          </svg>
          <p>Same agent · four runtime policies</p>
        </div>
      </section>

      <section className="studio" id="studio">
        <div className="section-index">08 / CONCEPT SIMULATOR</div>
        <div className="studio-head">
          <div><h2>Change what matters.<br /><em>See what would survive.</em></h2></div>
          <p>Use synthetic operating points to test the decision grammar. Set hard constraints, remove invalid configurations, and calculate a conditional frontier—without treating this simulator as a model claim.</p>
        </div>
        <div className="studio-shell">
          <aside className="controls-panel">
            <label className="select-label">
              <span>Workload</span>
              <select value={workloadId} onChange={(event) => {
                setWorkloadId(event.target.value as WorkloadId);
                setSelected("");
              }}>
                {WORKLOADS.map((item) => <option key={item.id} value={item.id}>{item.short}</option>)}
              </select>
            </label>
            <label className="range-control">
              <span><b>Minimum {workloadId === "continuous" ? "reliability" : "verified outcome"}</b><output>{qualityFloor}%</output></span>
              <input aria-label={`Minimum ${workloadId === "continuous" ? "reliability" : "verified outcome"}`} aria-valuetext={`${qualityFloor} percent`} type="range" min="72" max="96" step="1" value={qualityFloor} onChange={(event) => setQualityFloor(Number(event.target.value))} />
              <small><i /> hard quality gate</small>
            </label>
            <label className="range-control">
              <span><b>Maximum {workload.xLabel}</b><output>{formatMetric(xCeiling, workloadId)}</output></span>
              <input
                aria-label={`Maximum ${workload.xLabel}`}
                aria-valuetext={formatMetric(xCeiling, workloadId)}
                type="range"
                min={workload.xStep}
                max={workload.xMax}
                step={workload.xStep}
                value={xCeiling}
                onChange={(event) => setCeilingByWorkload({ ...ceilingByWorkload, [workloadId]: Number(event.target.value) })}
              />
              <small><i /> workload objective ceiling</small>
            </label>
            {workloadId === "realtime" ? (
              <div className="range-control contextual-note">
                <span><b>Response SLA</b><output>{formatMetric(xCeiling, workloadId)}</output></span>
                <p>Already encoded by the p95 ceiling above; no duplicate minute-based gate is applied.</p>
              </div>
            ) : (
              <label className="range-control">
                <span><b>Completion SLA</b><output>{sla} min</output></span>
                <input aria-label="Completion SLA" aria-valuetext={`${sla} minutes`} type="range" min="5" max="40" step="1" value={sla} onChange={(event) => setSla(Number(event.target.value))} />
                <small><i /> request to accepted result</small>
              </label>
            )}
            <label className="range-control">
              <span><b>Context ceiling</b><output>{contextCeiling}K</output></span>
              <input aria-label="Context ceiling" aria-valuetext={`${contextCeiling} thousand tokens`} type="range" min="24" max="260" step="4" value={contextCeiling} onChange={(event) => setContextCeiling(Number(event.target.value))} />
              <small><i /> input + reasoning + output</small>
            </label>
          </aside>
          <div className="studio-chart">
            <div className="studio-chart-head">
              <div><span>CONDITIONAL FRONTIER</span><h3>{workload.short} configurations</h3></div>
              <p><b>{feasible.length}</b> of {POINTS.length} qualify · <b>{frontier.length}</b> frontier points</p>
            </div>
            <FrontierChart
              workload={workload}
              qualityFloor={qualityFloor}
              xCeiling={xCeiling}
              sla={sla}
              contextCeiling={contextCeiling}
              selected={selected}
              onSelect={setSelected}
            />
            <div className="recommendation">
              {resultPoint ? (
                <>
                  <div className="recommendation-mark">↗</div>
                  <div>
                    <span>{inspected ? "SELECTED CONFIGURATION" : "RECOMMENDED STARTING POINT"}</span>
                    <h4>{resultPoint.agent} · {resultPoint.mode}</h4>
                    <p>{inspected ? (inspectedQualifies ? "Clears every active gate." : "Does not clear every active gate.") : `Lowest ${workload.xLabel} on the surviving frontier.`}</p>
                  </div>
                  <dl>
                    <div><dt>{workloadId === "continuous" ? "Reliability" : "Outcome"}</dt><dd>{metricFor(resultPoint, workloadId).y}%</dd></div>
                    <div><dt>{workload.short} metric</dt><dd>{formatMetric(metricFor(resultPoint, workloadId).x, workloadId)}</dd></div>
                    <div><dt>Context</dt><dd>{resultPoint.context}K</dd></div>
                  </dl>
                </>
              ) : (
                <div className="empty-result"><b>No configuration clears every gate.</b><span>Relax one constraint to reveal the nearest operating points.</span></div>
              )}
            </div>
          </div>
        </div>
        <p className="demo-disclosure">Synthetic operating points only—not measured model claims. This demo uses point-estimate dominance; production comparisons should account for confidence intervals. Delegated cost assumes a synthetic $6 human intervention event.</p>
      </section>

      <section className="method" id="method">
        <div className="method-head">
          <div className="section-index light">09 / METHODOLOGY</div>
          <h2>Every real point<br /><em>must come with evidence.</em></h2>
          <p>Real-world tasks make the benchmark relevant. Versioned configurations make it reproducible. Distributions and traces make it honest.</p>
        </div>
        <div className="evidence-panel">
          <div className="evidence-top">
            <span className="verified"><i>i</i> ILLUSTRATIVE EVIDENCE SCHEMA</span>
            <span>Synthetic example · not a measured claim</span>
          </div>
          <div className="evidence-title">
            <div><p>Interactive coding · Repository repair</p><h3>Cedar · Balanced</h3></div>
            <div className="score-orb"><b>89</b><span>± 2.4</span></div>
          </div>
          <div className="evidence-grid">
            <div><span>Benchmark</span><b>sample-workload v1.4</b></div>
            <div><span>Run count</span><b>240 synthetic attempts</b></div>
            <div><span>Verifier</span><b>tests + expert review</b></div>
            <div><span>Confidence</span><b>95% interval</b></div>
            <div><span>Timing ledger</span><b>TTFT · generation · tools · total</b></div>
            <div><span>Token ledger</span><b>input · reasoning · output</b></div>
          </div>
          <div className="evidence-bars">
            <div><span>Passed first attempt</span><i><b style={{ width: "72%" }} /></i><strong>72%</strong></div>
            <div><span>Recovered autonomously</span><i><b style={{ width: "17%" }} /></i><strong>17%</strong></div>
            <div><span>Needed human intervention</span><i><b style={{ width: "6%" }} /></i><strong>6%</strong></div>
            <div><span>Failed verification</span><i><b style={{ width: "5%" }} /></i><strong>5%</strong></div>
          </div>
          <p className="evidence-disclosure">Illustrative record showing the evidence schema. Values are not claims about a real system.</p>
        </div>
        <div className="principles">
          <article><span>01</span><h3>Real work</h3><p>Tasks people actually delegate, reviewed by domain experts where the stakes demand it.</p></article>
          <article><span>02</span><h3>Reproducible runs</h3><p>Version the prompt, model, tools, harness, scorer, and execution environment.</p></article>
          <article><span>03</span><h3>Honest uncertainty</h3><p>Show confidence intervals, p50 and p95, traces, variance, and failure modes—not averages alone.</p></article>
        </div>
      </section>

      <section className="closing">
        <p>A BETTER EVALUATION QUESTION</p>
        <h2>Stop asking<br />which agent <em>wins.</em></h2>
        <p className="closing-lede">Ask which configuration clears your bar at the lowest cost, time, and context.</p>
        <Link href="/use" className="closing-button">Put the frontier to work <span>→</span></Link>
        <div className="closing-orbits" aria-hidden="true"><i /><i /><i /></div>
      </section>
      </main>

      <footer>
        <a className="brand" href="#top"><span className="brand-mark"><i /><i /><i /></span>Frontier Max</a>
        <p>The interpretability and actionability layer for AI benchmarks.</p>
        <div><a href="#thesis">Thesis</a><Link href="/benchmarks">Benchmarks</Link><Link href="/reader">Reader</Link><Link href="/use">Use</Link><Link href="/fund">Run Fund</Link><a href="#method">Methodology</a></div>
      </footer>
    </div>
  );
}
