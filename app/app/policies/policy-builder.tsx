"use client";

import { useState } from "react";

type EvalSet = {
  id: string;
  name: string;
  version: number;
  workload_key: string;
};

export default function PolicyBuilder({ evalSets }: { evalSets: EvalSet[] }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function publish(formData: FormData) {
    setBusy(true);
    setStatus("");
    const payload = {
      name: String(formData.get("name")),
      stable_slug: String(formData.get("stable_slug")),
      workload_key: String(formData.get("workload_key")),
      eval_set_id: String(formData.get("eval_set_id")),
      objective: String(formData.get("objective")),
      quality_floor: Number(formData.get("quality_floor")) / 100,
      confidence: Number(formData.get("confidence")) / 100,
      minimum_cases: Number(formData.get("minimum_cases")),
      maximum_cost: Number(formData.get("maximum_cost")),
      maximum_p95_latency_ms: Number(formData.get("maximum_p95_latency_ms")),
    };
    try {
      const response = await fetch("/api/v1/policies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as Record<string, any>;
      if (!response.ok) throw new Error(result.message);
      setStatus(`Published ${result.policy_slug}.${result.version} → ${result.selected.candidate_id}`);
      window.setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Policy publication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="control-card policy-builder" action={publish}>
      <div className="control-card-head">
        <div><span>IMMUTABLE ON PUBLISH</span><h2>Compose a route contract</h2></div>
        <b>Quality gate first</b>
      </div>
      <div className="policy-grid">
        <label><span>Policy name</span><input name="name" defaultValue="Coding production" required /></label>
        <label><span>Stable slug</span><input name="stable_slug" defaultValue="coding-prod" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label>
        <label><span>Private benchmark</span><select name="eval_set_id" required>{evalSets.map((entry) => <option value={entry.id} key={entry.id}>{entry.name} · v{entry.version}</option>)}</select></label>
        <label><span>Workload</span><select name="workload_key">{[...new Set(evalSets.map((entry) => entry.workload_key))].map((key) => <option key={key}>{key}</option>)}</select></label>
        <label><span>Objective</span><select name="objective" defaultValue="minimize_expected_cost_per_success"><option value="minimize_expected_cost_per_success">Minimize cost per accepted result</option><option value="maximize_quality_lower_bound">Maximize conservative quality</option><option value="minimize_estimated_cost">Minimize mean cost</option><option value="minimize_p95_latency">Minimize p95 latency</option></select></label>
        <label><span>Quality floor (%)</span><input name="quality_floor" type="number" min="1" max="99" step=".1" defaultValue="70" /></label>
        <label><span>Confidence (%)</span><input name="confidence" type="number" min="80" max="99.9" step=".1" defaultValue="95" /></label>
        <label><span>Minimum cases</span><input name="minimum_cases" type="number" min="1" defaultValue="100" /></label>
        <label><span>Max mean cost ($)</span><input name="maximum_cost" type="number" min="0" step=".01" defaultValue=".50" /></label>
        <label><span>Max p95 latency (ms)</span><input name="maximum_p95_latency_ms" type="number" min="0" step="100" defaultValue="8000" /></label>
      </div>
      <div className="control-actions"><button className="primary" type="submit" disabled={busy || !evalSets.length}>Publish immutable policy →</button></div>
      <p className="control-status" aria-live="polite">{evalSets.length ? status : "Lock a held-out private benchmark before publishing a policy."}</p>
    </form>
  );
}
