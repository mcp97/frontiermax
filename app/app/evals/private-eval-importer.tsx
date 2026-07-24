"use client";

import { useState } from "react";

const sample = {
  workload_key: "code.text",
  name: "Coding acceptance — illustrative demo",
  version: 1,
  designation: "held_out",
  outcome_definition: "Accepted patch under the declared coding scaffold",
  grader_version: "acceptance-rubric.1",
  scaffold_version: "coding-harness.1",
  evaluated_at: new Date().toISOString(),
  notes: "ILLUSTRATIVE DEMO DATA. Replace with your aggregate held-out benchmark results before production use.",
  rows: [
    {
      candidate_type: "concrete_model",
      candidate_id: "moonshotai/kimi-k3",
      case_count: 120,
      successes: 99,
      failures: 21,
      average_cost_per_case: 0.42,
      p50_latency_ms: 3300,
      p95_latency_ms: 7800,
      input_token_average: 8400,
      output_token_average: 2200,
    },
    {
      candidate_type: "concrete_model",
      candidate_id: "meta/muse-spark-1.1",
      case_count: 120,
      successes: 94,
      failures: 26,
      average_cost_per_case: 0.16,
      p50_latency_ms: 2400,
      p95_latency_ms: 5900,
      input_token_average: 8400,
      output_token_average: 2200,
    },
    {
      candidate_type: "external_router",
      candidate_id: "openrouter/auto-beta",
      case_count: 120,
      successes: 97,
      failures: 23,
      average_cost_per_case: 0.28,
      p50_latency_ms: 2900,
      p95_latency_ms: 6900,
      input_token_average: 8400,
      output_token_average: 2200,
    },
  ],
};

export default function PrivateEvalImporter() {
  const [value, setValue] = useState(JSON.stringify(sample, null, 2));
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(preview: boolean) {
    setBusy(true);
    setStatus("");
    try {
      const data = JSON.parse(value);
      const response = await fetch("/api/v1/evals/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ preview, data }),
      });
      const result = await response.json() as Record<string, any>;
      if (!response.ok) {
        const detail = Array.isArray(result.field_errors)
          ? result.field_errors.join(" ")
          : result.message;
        throw new Error(detail);
      }
      setStatus(
        preview
          ? `Valid: ${result.candidate_count} candidates · ${result.case_count} aggregate cases · ${result.source_hash.slice(0, 22)}…`
          : `Locked as ${result.eval_set_id}. Refreshing…`,
      );
      if (!preview) window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="control-card eval-importer">
      <div className="control-card-head">
        <div><span>AGGREGATE ONLY</span><h2>Import a private benchmark</h2></div>
        <b>No prompts · no outputs</b>
      </div>
      <p className="demo-warning">
        The preloaded values are explicitly illustrative demo data. Replace them
        with aggregate held-out results before making a production decision.
      </p>
      <textarea
        aria-label="Aggregate private benchmark JSON"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        spellCheck={false}
      />
      <div className="control-actions">
        <button disabled={busy} onClick={() => submit(true)} type="button">Preview validation</button>
        <button className="primary" disabled={busy} onClick={() => submit(false)} type="button">Lock benchmark version →</button>
      </div>
      <p className="control-status" aria-live="polite">{status}</p>
    </section>
  );
}
