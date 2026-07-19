"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type MetricKey = "cost" | "latency" | "tokens";
type ProfileId = "interactive" | "delegated" | "realtime" | "batch" | "continuous";
type SourceRole = "authoritative_publisher" | "discovery_index" | "user_supplied";
type CommercialUseStatus = "permitted" | "restricted" | "unknown";

type BenchmarkRow = {
  id: string;
  name: string;
  quality: number;
  cost: number;
  latency: number;
  tokens: number;
  sourceRow: number;
};

type Constraints = {
  quality: number;
  cost: number;
  latency: number;
  tokens: number;
};

type ParsedDataset = {
  rows: BenchmarkRow[];
  mapping: Record<"name" | "quality" | "cost" | "latency" | "tokens", string>;
  ignored: string[];
  cohort: {
    schemaVersion: string;
    benchmarkId: string;
    benchmarkVersion: string;
    harnessId: string;
    observedAt: string;
    sourceRole: SourceRole;
    sourceReference: string;
    commercialUseStatus: CommercialUseStatus;
  };
};

const COHORT_SCHEMA_VERSION = "frontier-max/cohort/0.1";
const SAMPLE_CSV = `frontier_schema_version,benchmark_id,benchmark_version,harness,observed_at,source_role,source_reference,commercial_use_status,configuration,score_0_100,cost_usd_per_run,total_seconds,total_tokens
${COHORT_SCHEMA_VERSION},illustrative-repo-repair,1.0,illustrative-harness-2,2026-07-18T00:00:00Z,user_supplied,https://example.org/illustrative-eval,unknown,Aster Fast,78,0.42,5.8,28000
${COHORT_SCHEMA_VERSION},illustrative-repo-repair,1.0,illustrative-harness-2,2026-07-18T00:00:00Z,user_supplied,https://example.org/illustrative-eval,unknown,Aster Balanced,86,0.92,10.8,56000
${COHORT_SCHEMA_VERSION},illustrative-repo-repair,1.0,illustrative-harness-2,2026-07-18T00:00:00Z,user_supplied,https://example.org/illustrative-eval,unknown,Aster Deep,92,2.18,21.5,118000
${COHORT_SCHEMA_VERSION},illustrative-repo-repair,1.0,illustrative-harness-2,2026-07-18T00:00:00Z,user_supplied,https://example.org/illustrative-eval,unknown,Aster Parallel,94,4.10,14.8,188000
${COHORT_SCHEMA_VERSION},illustrative-repo-repair,1.0,illustrative-harness-2,2026-07-18T00:00:00Z,user_supplied,https://example.org/illustrative-eval,unknown,Cedar Fast,81,0.58,4.9,36000
${COHORT_SCHEMA_VERSION},illustrative-repo-repair,1.0,illustrative-harness-2,2026-07-18T00:00:00Z,user_supplied,https://example.org/illustrative-eval,unknown,Cedar Balanced,89,1.12,9.2,68000
${COHORT_SCHEMA_VERSION},illustrative-repo-repair,1.0,illustrative-harness-2,2026-07-18T00:00:00Z,user_supplied,https://example.org/illustrative-eval,unknown,Cedar Deep,95,2.86,24.8,146000
${COHORT_SCHEMA_VERSION},illustrative-repo-repair,1.0,illustrative-harness-2,2026-07-18T00:00:00Z,user_supplied,https://example.org/illustrative-eval,unknown,Cedar Parallel,97,5.30,17.4,210000
${COHORT_SCHEMA_VERSION},illustrative-repo-repair,1.0,illustrative-harness-2,2026-07-18T00:00:00Z,user_supplied,https://example.org/illustrative-eval,unknown,Loam Fast,75,0.28,7.2,23000
${COHORT_SCHEMA_VERSION},illustrative-repo-repair,1.0,illustrative-harness-2,2026-07-18T00:00:00Z,user_supplied,https://example.org/illustrative-eval,unknown,Loam Balanced,84,0.64,13.4,48000
${COHORT_SCHEMA_VERSION},illustrative-repo-repair,1.0,illustrative-harness-2,2026-07-18T00:00:00Z,user_supplied,https://example.org/illustrative-eval,unknown,Loam Deep,90,1.44,27.6,96000
${COHORT_SCHEMA_VERSION},illustrative-repo-repair,1.0,illustrative-harness-2,2026-07-18T00:00:00Z,user_supplied,https://example.org/illustrative-eval,unknown,Loam Parallel,92,2.80,19.8,170000
${COHORT_SCHEMA_VERSION},illustrative-repo-repair,1.0,illustrative-harness-2,2026-07-18T00:00:00Z,user_supplied,https://example.org/illustrative-eval,unknown,Moss Fast,80,0.76,4.2,44000
${COHORT_SCHEMA_VERSION},illustrative-repo-repair,1.0,illustrative-harness-2,2026-07-18T00:00:00Z,user_supplied,https://example.org/illustrative-eval,unknown,Moss Balanced,88,1.48,8.1,82000
${COHORT_SCHEMA_VERSION},illustrative-repo-repair,1.0,illustrative-harness-2,2026-07-18T00:00:00Z,user_supplied,https://example.org/illustrative-eval,unknown,Moss Deep,93,3.42,19.1,162000
${COHORT_SCHEMA_VERSION},illustrative-repo-repair,1.0,illustrative-harness-2,2026-07-18T00:00:00Z,user_supplied,https://example.org/illustrative-eval,unknown,Moss Parallel,96,6.20,13.8,236000`;
const TEMPLATE_CSV = `${SAMPLE_CSV.slice(0, SAMPLE_CSV.indexOf("\n"))}\n`;

const PROFILES: Record<
  ProfileId,
  {
    name: string;
    objective: string;
    note: string;
    defaults: Constraints;
    objectives: MetricKey[];
  }
> = {
  interactive: {
    name: "Interactive work",
    objective: "Interactive constraint preset",
    note: "Starts with a tighter completion-time gate. This MVP does not derive time-to-accepted-result.",
    defaults: { quality: 84, cost: 3, latency: 25, tokens: 160000 },
    objectives: ["latency", "tokens"],
  },
  delegated: {
    name: "Delegated work",
    objective: "Delegated constraint preset",
    note: "Starts with a higher quality floor and wider time window. This MVP does not derive cost per verified completion.",
    defaults: { quality: 88, cost: 6, latency: 60, tokens: 240000 },
    objectives: ["cost"],
  },
  realtime: {
    name: "Real-time work",
    objective: "Real-time constraint preset",
    note: "Starts with the tightest time gate. Import total completion time—not TTFT, decode speed, or an unlabeled latency value.",
    defaults: { quality: 78, cost: 2, latency: 8, tokens: 80000 },
    objectives: ["latency"],
  },
  batch: {
    name: "Batch work",
    objective: "Batch constraint preset",
    note: "Starts with a tighter unit-cost gate. This MVP does not derive throughput or accepted work per dollar.",
    defaults: { quality: 82, cost: 1.5, latency: 35, tokens: 100000 },
    objectives: ["cost"],
  },
  continuous: {
    name: "Continuous work",
    objective: "Continuous raw-metric preset",
    note: "Starts with a recurring-run cost gate. This cohort view does not derive monthly volume, availability, or time-to-detection.",
    defaults: { quality: 86, cost: 2, latency: 45, tokens: 160000 },
    objectives: ["cost"],
  },
};

const CANONICAL_HEADERS = {
  name: "configuration",
  quality: "score_0_100",
  cost: "cost_usd_per_run",
  latency: "total_seconds",
  tokens: "total_tokens",
} as const;

const COHORT_HEADERS = {
  schemaVersion: "frontier_schema_version",
  benchmarkId: "benchmark_id",
  benchmarkVersion: "benchmark_version",
  harnessId: "harness",
  observedAt: "observed_at",
  sourceRole: "source_role",
  sourceReference: "source_reference",
  commercialUseStatus: "commercial_use_status",
} as const;

const MAX_ROWS = 250;
const MAX_BYTES = 2_000_000;
const ISO_DATE_OR_TIMESTAMP = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/;

const METRIC_META: Record<MetricKey, { label: string; short: string }> = {
  cost: { label: "Cost per run", short: "$" },
  latency: { label: "Completion time", short: "s" },
  tokens: { label: "Total tokens", short: "tok" },
};

function splitCsv(text: string) {
  const result: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(field.trim());
      if (row.some((value) => value !== "")) result.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV has an unclosed quoted field.");
  row.push(field.trim());
  if (row.some((value) => value !== "")) result.push(row);
  return result;
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function numeric(value: string) {
  const trimmed = value.trim();
  if (!/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) return Number.NaN;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseDataset(text: string): ParsedDataset {
  if (new TextEncoder().encode(text).byteLength > MAX_BYTES) {
    throw new Error("This local reader accepts CSV files up to 2 MB.");
  }
  const table = splitCsv(text);
  if (table.length < 2) throw new Error("Add a header row and at least one result row.");
  if (table.length - 1 > MAX_ROWS) {
    throw new Error(`This browser demo accepts at most ${MAX_ROWS} rows per cohort. Split larger files before importing.`);
  }

  const headers = table[0].map(normalizeHeader);
  const duplicateHeader = headers.find((header, index) => headers.indexOf(header) !== index);
  if (duplicateHeader) throw new Error(`Duplicate header “${duplicateHeader}” is not allowed.`);
  const mappedIndexes = {} as Record<keyof typeof CANONICAL_HEADERS, number>;
  const cohortIndexes = {} as Record<keyof typeof COHORT_HEADERS, number>;
  const mapping = {} as ParsedDataset["mapping"];

  (Object.keys(CANONICAL_HEADERS) as Array<keyof typeof CANONICAL_HEADERS>).forEach((key) => {
    const expected = CANONICAL_HEADERS[key];
    const index = headers.findIndex((header) => header === expected);
    if (index === -1) {
      throw new Error(`Missing canonical column “${expected}”. Use the sample as the import template; this MVP never guesses units or metric meaning.`);
    }
    mappedIndexes[key] = index;
    mapping[key] = table[0][index];
  });

  (Object.keys(COHORT_HEADERS) as Array<keyof typeof COHORT_HEADERS>).forEach((key) => {
    const expected = COHORT_HEADERS[key];
    const index = headers.findIndex((header) => header === expected);
    if (index === -1) {
      throw new Error(`Missing cohort column “${expected}”. A comparable benchmark, version, harness, and observation date are required.`);
    }
    cohortIndexes[key] = index;
  });

  const first = table[1];
  const cohort = {
    schemaVersion: first[cohortIndexes.schemaVersion]?.trim() ?? "",
    benchmarkId: first[cohortIndexes.benchmarkId]?.trim() ?? "",
    benchmarkVersion: first[cohortIndexes.benchmarkVersion]?.trim() ?? "",
    harnessId: first[cohortIndexes.harnessId]?.trim() ?? "",
    observedAt: first[cohortIndexes.observedAt]?.trim() ?? "",
    sourceRole: first[cohortIndexes.sourceRole]?.trim() as SourceRole,
    sourceReference: first[cohortIndexes.sourceReference]?.trim() ?? "",
    commercialUseStatus: first[cohortIndexes.commercialUseStatus]?.trim() as CommercialUseStatus,
  };
  if (Object.values(cohort).some((value) => !value)) {
    throw new Error("The first result row is missing schema, cohort, provenance, or rights metadata.");
  }
  if (cohort.schemaVersion !== COHORT_SCHEMA_VERSION) {
    throw new Error(`frontier_schema_version must be exactly ${COHORT_SCHEMA_VERSION}.`);
  }
  if (!ISO_DATE_OR_TIMESTAMP.test(cohort.observedAt) || Number.isNaN(Date.parse(cohort.observedAt))) {
    throw new Error("observed_at must contain an ISO date or RFC 3339 timestamp.");
  }
  if (!["authoritative_publisher", "discovery_index", "user_supplied"].includes(cohort.sourceRole)) {
    throw new Error("source_role must be authoritative_publisher, discovery_index, or user_supplied.");
  }
  if (!["permitted", "restricted", "unknown"].includes(cohort.commercialUseStatus)) {
    throw new Error("commercial_use_status must be permitted, restricted, or unknown.");
  }
  try {
    const sourceUrl = new URL(cohort.sourceReference);
    if (!["http:", "https:"].includes(sourceUrl.protocol) || sourceUrl.username || sourceUrl.password) throw new Error();
  } catch {
    throw new Error("source_reference must be a credential-free absolute HTTP(S) URL.");
  }

  const used = new Set([...Object.values(mappedIndexes), ...Object.values(cohortIndexes)]);
  const ignored = table[0].filter((_, index) => !used.has(index));
  const rows: BenchmarkRow[] = [];
  const rowErrors: string[] = [];
  const seenNames = new Set<string>();

  table.slice(1).forEach((source, index) => {
    const sourceRow = index + 2;
    const quality = numeric(source[mappedIndexes.quality] ?? "");
    const cost = numeric(source[mappedIndexes.cost] ?? "");
    const latency = numeric(source[mappedIndexes.latency] ?? "");
    const tokens = numeric(source[mappedIndexes.tokens] ?? "");
    const name = source[mappedIndexes.name]?.trim();
    const rowCohort = {
      schemaVersion: source[cohortIndexes.schemaVersion]?.trim() ?? "",
      benchmarkId: source[cohortIndexes.benchmarkId]?.trim() ?? "",
      benchmarkVersion: source[cohortIndexes.benchmarkVersion]?.trim() ?? "",
      harnessId: source[cohortIndexes.harnessId]?.trim() ?? "",
      observedAt: source[cohortIndexes.observedAt]?.trim() ?? "",
      sourceRole: source[cohortIndexes.sourceRole]?.trim() as SourceRole,
      sourceReference: source[cohortIndexes.sourceReference]?.trim() ?? "",
      commercialUseStatus: source[cohortIndexes.commercialUseStatus]?.trim() as CommercialUseStatus,
    };
    if (Object.keys(cohort).some((key) => rowCohort[key as keyof typeof cohort] !== cohort[key as keyof typeof cohort])) {
      rowErrors.push(`row ${sourceRow}: mixed schema/benchmark/version/harness/source/rights/date cohort`);
      return;
    }
    if (!name) {
      rowErrors.push(`row ${sourceRow}: missing configuration`);
      return;
    }
    if (seenNames.has(name.toLocaleLowerCase())) {
      rowErrors.push(`row ${sourceRow}: duplicate configuration “${name}”`);
      return;
    }
    if (![quality, cost, latency, tokens].every(Number.isFinite)) {
      rowErrors.push(`row ${sourceRow}: score, cost, completion seconds, and tokens must be non-blank plain numbers`);
      return;
    }
    if (quality < 0 || quality > 100 || cost < 0 || latency < 0 || tokens < 0 || !Number.isInteger(tokens)) {
      rowErrors.push(`row ${sourceRow}: score must be 0–100; cost/time non-negative; tokens a non-negative integer`);
      return;
    }
    seenNames.add(name.toLocaleLowerCase());
    rows.push({
      id: `${normalizeHeader(name)}-${sourceRow}`,
      name,
      quality,
      cost,
      latency,
      tokens,
      sourceRow,
    });
  });

  if (rowErrors.length > 0) {
    const shown = rowErrors.slice(0, 5).join("; ");
    const remainder = rowErrors.length > 5 ? `; plus ${rowErrors.length - 5} more` : "";
    throw new Error(`Import blocked—fix every invalid row before analysis: ${shown}${remainder}.`);
  }
  if (rows.length > 1 && Math.max(...rows.map((row) => row.quality)) <= 1) {
    throw new Error("score_0_100 appears to contain a 0–1 scale. Convert it explicitly to 0–100 before import and document that transform at the source.");
  }
  return { rows, mapping, ignored, cohort };
}

function qualifies(row: BenchmarkRow, constraints: Constraints) {
  return (
    row.quality >= constraints.quality &&
    row.cost <= constraints.cost &&
    row.latency <= constraints.latency &&
    row.tokens <= constraints.tokens
  );
}

function workloadFrontier(rows: BenchmarkRow[], objectives: MetricKey[]) {
  return rows.filter(
    (candidate) =>
      !rows.some(
        (other) =>
          other.id !== candidate.id &&
          other.quality >= candidate.quality &&
          objectives.every((metric) => other[metric] <= candidate[metric]) &&
          (other.quality > candidate.quality ||
            objectives.some((metric) => other[metric] < candidate[metric])),
      ),
  );
}

function formatMetric(metric: MetricKey, value: number) {
  if (metric === "cost") return `$${value.toFixed(value < 10 ? 2 : 0)}`;
  if (metric === "latency") return `${value.toFixed(value < 10 ? 1 : 0)}s`;
  return value >= 1000 ? `${Math.round(value / 1000)}K` : `${Math.round(value)}`;
}

async function digest(value: string) {
  if (!globalThis.crypto?.subtle) return "unavailable";
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function ProjectionChart({
  metric,
  rows,
  frontier,
  feasible,
  selected,
}: {
  metric: MetricKey;
  rows: BenchmarkRow[];
  frontier: BenchmarkRow[];
  feasible: BenchmarkRow[];
  selected: string;
}) {
  const width = 360;
  const height = 244;
  const left = 38;
  const right = 15;
  const top = 20;
  const bottom = 42;
  const values = rows.map((row) => row[metric]);
  const max = Math.max(1, ...values) * 1.08;
  const minQuality = Math.min(90, Math.max(0, Math.floor((Math.min(...rows.map((row) => row.quality)) - 5) / 5) * 5));
  const qualityRange = 100 - minQuality;
  const x = (value: number) => left + (value / max) * (width - left - right);
  const y = (value: number) => top + ((100 - value) / qualityRange) * (height - top - bottom);

  return (
    <div className="projection-card">
      <div className="projection-title"><span>Score × {METRIC_META[metric].label}</span><b>← lower</b></div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Benchmark score versus ${METRIC_META[metric].label}`}>
        {[0, .25, .5, .75, 1].map((fraction) => (
          <g key={`x-${fraction}`}>
            <line x1={x(max * fraction)} x2={x(max * fraction)} y1={top} y2={height - bottom} className="reader-grid" />
            <text x={x(max * fraction)} y={height - 20} textAnchor="middle" className="reader-tick">{formatMetric(metric, max * fraction)}</text>
          </g>
        ))}
        {[minQuality, minQuality + qualityRange / 2, 100].map((value, index) => (
          <g key={`y-${index}-${value}`}>
            <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="reader-grid" />
            <text x={left - 7} y={y(value) + 3} textAnchor="end" className="reader-tick">{Math.round(value)}</text>
          </g>
        ))}
        {rows.map((row) => {
          const isFrontier = frontier.some((item) => item.id === row.id);
          const isFeasible = feasible.some((item) => item.id === row.id);
          const isSelected = selected === row.id;
          return (
            <g
              key={row.id}
              className={`reader-dot ${isFeasible ? "qualifies" : "muted"} ${isSelected ? "selected" : ""}`}
            >
              {isFrontier && <circle cx={x(row[metric])} cy={y(row.quality)} r="11" className="frontier-halo" />}
              <circle cx={x(row[metric])} cy={y(row.quality)} r={isSelected ? 6.5 : 5} className="dot-core" />
              {isSelected && <text x={x(row[metric])} y={y(row.quality) - 12} textAnchor="middle" className="reader-point-label">{row.name}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function BenchmarkReader() {
  const initial = useMemo(() => parseDataset(SAMPLE_CSV), []);
  const [csv, setCsv] = useState(SAMPLE_CSV);
  const [appliedCsv, setAppliedCsv] = useState(SAMPLE_CSV);
  const [dataset, setDataset] = useState(initial);
  const [sourceName, setSourceName] = useState("Illustrative agent results");
  const [appliedSourceName, setAppliedSourceName] = useState("Illustrative agent results");
  const [sourceHash, setSourceHash] = useState("calculating…");
  const [error, setError] = useState("");
  const [profileId, setProfileId] = useState<ProfileId>("interactive");
  const [constraints, setConstraints] = useState<Constraints>(PROFILES.interactive.defaults);
  const [objectiveMetrics, setObjectiveMetrics] = useState<MetricKey[]>(PROFILES.interactive.objectives);
  const [selected, setSelected] = useState(initial.rows[5]?.id ?? initial.rows[0].id);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profile = PROFILES[profileId];
  const dataBounds = useMemo(() => {
    const maxCost = Math.max(...dataset.rows.map((row) => row.cost));
    const maxLatency = Math.max(...dataset.rows.map((row) => row.latency));
    const maxTokens = Math.max(...dataset.rows.map((row) => row.tokens));
    return {
      costMax: Math.max(7, constraints.cost, Math.ceil(maxCost * 1.15 * 4) / 4),
      latencyMax: Math.max(65, constraints.latency, Math.ceil(maxLatency * 1.15)),
      tokensMax: Math.max(260000, constraints.tokens, Math.ceil((maxTokens * 1.15) / 5000) * 5000),
    };
  }, [constraints.cost, constraints.latency, constraints.tokens, dataset.rows]);

  useEffect(() => {
    let current = true;
    digest(appliedCsv).then((hash) => {
      if (current) setSourceHash(hash);
    }).catch(() => {
      if (current) setSourceHash("unavailable");
    });
    return () => {
      current = false;
    };
  }, [appliedCsv]);

  const feasible = useMemo(
    () => dataset.rows.filter((row) => qualifies(row, constraints)),
    [dataset.rows, constraints],
  );
  const frontier = useMemo(
    () => workloadFrontier(feasible, objectiveMetrics),
    [feasible, objectiveMetrics],
  );
  const selectedRow = dataset.rows.find((row) => row.id === selected) ?? dataset.rows[0];
  const sortedRows = useMemo(
    () =>
      [...dataset.rows].sort((a, b) => {
        const aFrontier = frontier.some((row) => row.id === a.id) ? 1 : 0;
        const bFrontier = frontier.some((row) => row.id === b.id) ? 1 : 0;
        if (aFrontier !== bFrontier) return bFrontier - aFrontier;
        return b.quality - a.quality;
      }),
    [dataset.rows, frontier],
  );

  const applyCsv = async (
    nextCsv = csv,
    nextName = sourceName,
  ) => {
    try {
      const parsed = parseDataset(nextCsv);
      setDataset(parsed);
      setCsv(nextCsv);
      setSourceHash("calculating…");
      setAppliedCsv(nextCsv);
      setSourceName(nextName);
      setAppliedSourceName(nextName);
      setSelected(parsed.rows[0].id);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read this dataset.");
    }
  };

  const loadFile = async (file?: File) => {
    if (!file) return;
    try {
      const text = await file.text();
      setCsv(text);
      await applyCsv(text, file.name);
    } catch {
      setError("This file could not be read. Try exporting it as a UTF-8 CSV.");
    }
  };

  const changeProfile = (next: ProfileId) => {
    setProfileId(next);
    setConstraints(PROFILES[next].defaults);
    setObjectiveMetrics(PROFILES[next].objectives);
  };

  const toggleObjective = (metric: MetricKey) => {
    setObjectiveMetrics((current) =>
      current.includes(metric)
        ? current.filter((item) => item !== metric)
        : [...current, metric],
    );
  };

  const objectiveLabel = [
    "score",
    ...objectiveMetrics.map((metric) => METRIC_META[metric].label.toLowerCase()),
  ].join(" + ");

  const selectedStatus = frontier.some((row) => row.id === selectedRow.id)
    ? "On workload frontier"
    : feasible.some((row) => row.id === selectedRow.id)
      ? "Qualifies"
      : "Outside constraints";
  const hasUncertainty = dataset.ignored.some((header) =>
    /(^|_)(ci|confidence|stderr|std_error|variance)(_|$)/.test(normalizeHeader(header)),
  );
  const hasUnappliedChanges =
    csv !== appliedCsv ||
    sourceName !== appliedSourceName;
  const hashPending = sourceHash === "calculating…";
  const isIllustrative = appliedCsv === SAMPLE_CSV;

  const decisionBrief = `Exploratory benchmark summary: ${appliedSourceName}\nSource: ${dataset.cohort.sourceReference}\nSource role: ${dataset.cohort.sourceRole}; commercial-use status: ${dataset.cohort.commercialUseStatus}\nCohort: ${dataset.cohort.benchmarkId} v${dataset.cohort.benchmarkVersion}; harness ${dataset.cohort.harnessId}; observed ${dataset.cohort.observedAt}\nPreset: ${profile.name}\nConstraints: score ≥ ${constraints.quality}, cost ≤ $${constraints.cost}, completion ≤ ${constraints.latency}s, tokens ≤ ${Math.round(constraints.tokens / 1000)}K\nActive objectives: ${objectiveLabel}. Unselected metrics remain measured guardrails.\nResult: ${feasible.length}/${dataset.rows.length} qualify; ${frontier.length} are non-dominated across the active objectives.\nSelected: ${selectedRow.name} — score ${selectedRow.quality}, $${selectedRow.cost.toFixed(2)}, ${selectedRow.latency}s, ${selectedRow.tokens} tokens (${selectedStatus}).\nMethod: point-estimate dominance among qualifying rows; imported uncertainty fields are not modeled.\nSource SHA-256: ${sourceHash}. Frontier Max preserved the supplied values and did not run, normalize, or verify the benchmark.`;

  const analysisReceipt = {
    receipt_schema_version: "frontier-max/analysis/0.1",
    generated_at: new Date().toISOString(),
    raw_csv_sha256: sourceHash,
    cohort: {
      frontier_schema_version: dataset.cohort.schemaVersion,
      benchmark_id: dataset.cohort.benchmarkId,
      benchmark_version: dataset.cohort.benchmarkVersion,
      harness: dataset.cohort.harnessId,
      observed_at: dataset.cohort.observedAt,
      source_role: dataset.cohort.sourceRole,
      source_reference: dataset.cohort.sourceReference,
      commercial_use_status: dataset.cohort.commercialUseStatus,
    },
    policy: {
      profile: profileId,
      active_objectives: ["maximize_score", ...objectiveMetrics.map((metric) => `minimize_${metric}`)],
      constraints: {
        score_0_100_minimum: constraints.quality,
        cost_usd_per_run_maximum: constraints.cost,
        total_seconds_maximum: constraints.latency,
        total_tokens_maximum: constraints.tokens,
      },
    },
    result: {
      qualifying_configurations: feasible.map((row) => row.name),
      frontier_configurations: frontier.map((row) => row.name),
      selected_configuration: selectedRow.name,
      selected_values: {
        score_0_100: selectedRow.quality,
        cost_usd_per_run: selectedRow.cost,
        total_seconds: selectedRow.latency,
        total_tokens: selectedRow.tokens,
      },
    },
    disclosure: "Frontier Max preserved the supplied values and applied the stated constraints/objectives. It did not run, normalize, or verify the benchmark.",
  };

  const copyBrief = async () => {
    if (hasUnappliedChanges || hashPending) return;
    try {
      await navigator.clipboard.writeText(decisionBrief);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <div className="reader-page">
      <a className="skip-link" href="#reader-content">Skip to reader</a>
      <header className="reader-header">
        <Link className="brand" href="/" aria-label="Frontier Max home"><span className="brand-mark"><i /><i /><i /></span>Frontier Max</Link>
        <nav aria-label="Reader navigation"><Link href="/benchmarks">Benchmarks</Link><Link href="/reader" aria-current="page">Reader</Link><Link href="/use">Use</Link><Link href="/fund">Fund</Link></nav>
        <Link className="reader-back" href="/benchmarks">Browse evidence <span>↗</span></Link>
      </header>

      <main id="reader-content" className="reader-main">
        <section className="reader-intro">
          <div>
            <p className="reader-eyebrow"><span>BENCHMARK READER</span> Source-preserving by design</p>
            <h1>We don’t make the measurement.<br /><em>We make it readable.</em></h1>
          </div>
          <div className="reader-intro-copy">
            <p>Bring one comparable result cohort in the explicit Frontier Max CSV format. We preserve the source snapshot, require units in the headers, and keep every derived view labeled.</p>
            <div><span>One cohort at a time</span><span>Explicit units</span><span>No universal score</span></div>
          </div>
        </section>

        <ol className="reader-steps" aria-label="Benchmark reading workflow">
          <li><b>01</b><span>Source</span><small>Bring one cohort</small></li>
          <li><b>02</b><span>Contract</span><small>Verify meaning + units</small></li>
          <li><b>03</b><span>Constrain</span><small>Choose a preset</small></li>
          <li><b>04</b><span>Read</span><small>See the workload frontier</small></li>
          <li><b>05</b><span>Summarize</span><small>Copy the evidence</small></li>
        </ol>

        <section className="reader-workbench">
          <aside className="source-panel" id="source">
            <div className="reader-panel-head"><span>01 / SOURCE</span><b>{hasUnappliedChanges ? "Unapplied changes" : `${dataset.rows.length} valid rows`}</b></div>
            <label className="reader-field"><span>Display label <i>the CSV remains authoritative</i></span><input value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Benchmark or eval name" /></label>
            <label className="reader-field csv-field"><span>Paste Frontier Max CSV <i>complete 4D cohort · max {MAX_ROWS} rows</i></span><textarea value={csv} onChange={(event) => setCsv(event.target.value)} spellCheck={false} /></label>
            {error && <p className="reader-error" role="alert">{error}</p>}
            {hasUnappliedChanges && <p className="stale-note" role="status">Draft changes are not analyzed yet. Apply them to replace the current snapshot.</p>}
            <div className="source-actions">
              <button className="reader-primary" onClick={() => applyCsv()}>Apply snapshot <span>→</span></button>
              <button className="upload-button" onClick={() => fileInputRef.current?.click()}>Upload CSV</button>
              <input ref={fileInputRef} className="reader-file-input" tabIndex={-1} type="file" accept=".csv,text/csv" onChange={(event) => {
                loadFile(event.target.files?.[0]);
                event.target.value = "";
              }} />
              <button className="sample-button" onClick={() => {
                setCsv(SAMPLE_CSV);
                applyCsv(SAMPLE_CSV, "Illustrative agent results");
              }}>Reset sample</button>
              <button className="sample-button" onClick={() => downloadFile("frontier-max-cohort-template.csv", TEMPLATE_CSV, "text/csv")}>Template ↓</button>
              <button className="sample-button" onClick={() => downloadFile(`${dataset.cohort.benchmarkId}-source.csv`, appliedCsv, "text/csv")}>Source CSV ↓</button>
            </div>
            <p className="local-note"><i>✓</i> Files are parsed in this browser session. This demo does not upload or store them.</p>

            <div className="mapping-block">
              <div className="reader-panel-head"><span>02 / IMPORT CONTRACT</span><b>Exact headers</b></div>
              {(Object.keys(dataset.mapping) as Array<keyof ParsedDataset["mapping"]>).map((key) => (
                <div className="mapping-row" key={key}><code>{dataset.mapping[key]}</code><span>→</span><b>{key === "quality" ? "benchmark score" : key}</b></div>
              ))}
              {dataset.ignored.length > 0 && <p>{dataset.ignored.length} additional column{dataset.ignored.length === 1 ? "" : "s"} preserved but not used in this view.</p>}
            </div>

            <div className="provenance-block">
              <span>Applied snapshot · SHA-256</span><code>{sourceHash}</code>
              <p>{dataset.cohort.sourceReference}</p>
              <dl><div><dt>Source role</dt><dd>{dataset.cohort.sourceRole.replaceAll("_", " ")}</dd></div><div><dt>Rights</dt><dd>{dataset.cohort.commercialUseStatus}</dd></div><div><dt>Rows</dt><dd>{dataset.rows.length}</dd></div></dl>
            </div>

            <div className="readiness-block">
              <div className="reader-panel-head"><span>DATA READINESS</span><b>Documented</b></div>
              <div><span>Comparable cohort</span><b className="pass">{dataset.cohort.benchmarkId} v{dataset.cohort.benchmarkVersion}</b></div>
              <div><span>4D metric coverage</span><b className="pass">Complete</b></div>
              <div><span>Source + rights status</span><b className="pass">Supplied</b></div>
              <div><span>Uncertainty fields</span><b className={hasUncertainty ? "pass" : "warn"}>{hasUncertainty ? "Detected · not modeled" : "Not supplied"}</b></div>
              <p>Missing metadata is disclosed, not converted into a score or penalty.</p>
            </div>
          </aside>

          <div className="reader-analysis" id="lens">
            <p className={`analysis-snapshot ${hasUnappliedChanges ? "stale" : ""}`}>
              {isIllustrative ? "Illustrative sample — no model claims · " : ""}Analyzing: <b>{appliedSourceName}</b> · {dataset.cohort.benchmarkId} v{dataset.cohort.benchmarkVersion} · harness {dataset.cohort.harnessId} · observed {dataset.cohort.observedAt}{hasUnappliedChanges ? " · draft changes not applied" : ""}
            </p>
            <div className="lens-head">
              <div><span>03 / DECISION LENS</span><h2>{profile.objective}</h2><p>{profile.note}</p></div>
              <label><span>Workload</span><select value={profileId} onChange={(event) => changeProfile(event.target.value as ProfileId)}>{(Object.keys(PROFILES) as ProfileId[]).map((id) => <option key={id} value={id}>{PROFILES[id].name}</option>)}</select></label>
            </div>

            <div className="reader-constraints">
              <label><span><b>Minimum score</b><output>{constraints.quality}</output></span><input aria-label="Minimum benchmark score" type="range" min="0" max="100" step="1" value={constraints.quality} onChange={(event) => setConstraints({ ...constraints, quality: Number(event.target.value) })} /></label>
              <label><span><b>Maximum cost</b><output>${constraints.cost.toFixed(2)}</output></span><input aria-label="Maximum cost" type="range" min="0" max={dataBounds.costMax} step={dataBounds.costMax > 100 ? 1 : .25} value={constraints.cost} onChange={(event) => setConstraints({ ...constraints, cost: Number(event.target.value) })} /></label>
              <label><span><b>Maximum time</b><output>{constraints.latency}s</output></span><input aria-label="Maximum completion time" type="range" min="0" max={dataBounds.latencyMax} step={dataBounds.latencyMax > 600 ? 10 : 1} value={constraints.latency} onChange={(event) => setConstraints({ ...constraints, latency: Number(event.target.value) })} /></label>
              <label><span><b>Token ceiling</b><output>{Math.round(constraints.tokens / 1000)}K</output></span><input aria-label="Token ceiling" type="range" min="0" max={dataBounds.tokensMax} step={dataBounds.tokensMax > 1000000 ? 25000 : 5000} value={constraints.tokens} onChange={(event) => setConstraints({ ...constraints, tokens: Number(event.target.value) })} /></label>
            </div>

            <fieldset className="objective-picker">
              <legend>ACTIVE OBJECTIVES <span>Score is always maximized. Choose which measured costs are minimized; every unselected metric remains a hard guardrail above.</span></legend>
              <div>
                {(["cost", "latency", "tokens"] as MetricKey[]).map((metric) => (
                  <label key={metric}>
                    <input
                      type="checkbox"
                      checked={objectiveMetrics.includes(metric)}
                      onChange={() => toggleObjective(metric)}
                    />
                    <span>{METRIC_META[metric].label}</span>
                    <small>{objectiveMetrics.includes(metric) ? "optimize" : "guardrail"}</small>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="result-summary" id="results" aria-live="polite">
              <div><span>04 / RESULT</span><h2><b>{feasible.length}</b> of {dataset.rows.length} configurations survive.</h2></div>
              <div><strong>{frontier.length}</strong><span>non-dominated<br />in {objectiveLabel}</span></div>
            </div>

            <div className="projection-grid">
              {(["cost", "latency", "tokens"] as MetricKey[]).map((metric) => (
                <ProjectionChart key={metric} metric={metric} rows={dataset.rows} frontier={frontier} feasible={feasible} selected={selectedRow.id} />
              ))}
            </div>
            <div className="projection-legend"><span><i className="frontier" /> workload frontier</span><span><i className="qualified" /> qualifies</span><span><i className="excluded" /> outside constraints</span><b>A frontier point can look dominated in one 2D slice because its advantage lies in another active objective. Select rows in the table.</b></div>
            <p className="frontier-method-note">This preview uses point-estimate dominance across the active objectives after all four constraints. Unselected metrics remain measured guardrails. Imported confidence or variance fields remain in the raw snapshot but do not change frontier status.</p>

            <div className="selected-record">
              <div className="selected-main"><span>SELECTED CONFIGURATION · SOURCE ROW {selectedRow.sourceRow}</span><h3>{selectedRow.name}</h3><p className={selectedStatus === "On workload frontier" ? "frontier-status" : ""}>{selectedStatus}{selectedStatus === "On workload frontier" ? ` — no qualifying row is at least as good across ${objectiveLabel} and strictly better in one active objective.` : ""}</p></div>
              <dl><div><dt>Score</dt><dd>{selectedRow.quality}</dd></div><div><dt>Cost</dt><dd>${selectedRow.cost}</dd></div><div><dt>Time</dt><dd>{selectedRow.latency}s</dd></div><div><dt>Tokens</dt><dd>{selectedRow.tokens}</dd></div></dl>
              <div className="selected-actions">
                <button disabled={hasUnappliedChanges || hashPending} onClick={copyBrief}>{hasUnappliedChanges ? "Apply changes first" : hashPending ? "Hashing snapshot…" : copyState === "copied" ? "Copied" : "Copy analysis summary"}<span>{copyState === "copied" ? "✓" : "↗"}</span></button>
                <button disabled={hasUnappliedChanges || hashPending} onClick={() => downloadFile(`${dataset.cohort.benchmarkId}-analysis.json`, `${JSON.stringify(analysisReceipt, null, 2)}\n`, "application/json")}>Download receipt <span>↓</span></button>
              </div>
            </div>
            <p className={`copy-status ${copyState}`} aria-live="polite">{copyState === "copied" ? "Analysis summary copied to the clipboard." : copyState === "failed" ? "Clipboard access failed. Select and copy the summary below." : ""}</p>
            {copyState === "failed" && <textarea className="brief-fallback" aria-label="Analysis summary for manual copy" readOnly value={decisionBrief} />}

            <div className="reader-table-wrap">
              <div className="table-head"><div><span>ALL CONFIGURATIONS</span><h3>Parsed source values + derived status</h3></div><p>Formatting is a display layer; the applied CSV remains the source snapshot.</p></div>
              <div className="reader-table-scroll">
                <table className="reader-table">
                  <caption>Configurations in the applied benchmark cohort with parsed source values and derived frontier status</caption>
                  <thead><tr><th>Configuration</th><th>Score</th><th>Cost</th><th>Time</th><th>Tokens</th><th>Derived status</th></tr></thead>
                  <tbody>{sortedRows.map((row) => {
                    const onFrontier = frontier.some((item) => item.id === row.id);
                    const isFeasible = feasible.some((item) => item.id === row.id);
                    return <tr key={row.id} className={selectedRow.id === row.id ? "selected" : ""}><td><button aria-pressed={selectedRow.id === row.id} onClick={() => setSelected(row.id)}>{row.name}</button><small>row {row.sourceRow}</small></td><td>{row.quality}</td><td>${row.cost}</td><td>{row.latency}s</td><td>{row.tokens}</td><td><span className={onFrontier ? "frontier" : isFeasible ? "qualified" : "excluded"}>{onFrontier ? "frontier" : isFeasible ? "qualifies" : "excluded"}</span></td></tr>;
                  })}</tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="neutrality-note">
          <div><span>THE PRODUCT BOUNDARY</span><h2>Opinionated about legibility.<br /><em>Neutral about the result.</em></h2></div>
          <p>Frontier Max does not create this benchmark, rerun it, alter its score, or sell placement. It shows the source, preserves the record, labels every transformation, and lets the user define the decision context.</p>
        </section>
      </main>
      <footer className="reader-footer"><Link className="brand" href="/"><span className="brand-mark"><i /><i /><i /></span>Frontier Max</Link><p>Benchmark data in. Model decisions out.</p><div className="reader-footer-links"><Link href="/benchmarks">Benchmarks</Link><Link href="/use">CLI</Link><Link href="/fund">Run Fund</Link></div></footer>
    </div>
  );
}
