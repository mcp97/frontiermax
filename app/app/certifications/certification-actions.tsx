"use client";

import { useState } from "react";

export default function CertificationActions({
  policyVersionId,
  policySlug,
  hasCertification,
}: {
  policyVersionId: string | null;
  policySlug: string | null;
  hasCertification: boolean;
}) {
  const [status, setStatus] = useState("");
  const [route, setRoute] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);

  async function certify() {
    if (!policyVersionId) return;
    setBusy(true);
    try {
      const response = await fetch("/api/v1/certifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ policy_version_id: policyVersionId }),
      });
      const result = await response.json() as Record<string, any>;
      if (!response.ok) throw new Error(result.message);
      setStatus(`Certified ${result.candidate_id} until ${new Date(result.valid_until).toLocaleDateString()}.`);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Certification failed.");
    } finally {
      setBusy(false);
    }
  }

  async function simulateRoute() {
    if (!policySlug) return;
    setBusy(true);
    try {
      const response = await fetch("/api/v1/route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          policy: policySlug,
          session_id: `demo-${new Date().toISOString().slice(0, 10)}`,
          features: {
            input_tokens_estimate: 8400,
            output_tokens_estimate: 2200,
            input_modalities: ["text"],
            output_modalities: ["text"],
            requires_tools: true,
            requires_structured_output: false,
            required_context_tokens: 32000,
            complexity_hint: "medium",
            risk_class: "standard",
          },
        }),
      });
      const result = await response.json() as Record<string, any>;
      if (!response.ok) throw new Error(result.message);
      setRoute(result);
      setStatus(`Route ${result.route_id} written to Receipts.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Route simulation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="control-card certification-action">
      <div className="control-card-head">
        <div><span>CERTIFY → ROUTE</span><h2>Freeze the winner, then publish it.</h2></div>
        <b>Hash verified · unsigned</b>
      </div>
      <div className="control-actions">
        <button className="primary" type="button" disabled={busy || !policyVersionId} onClick={certify}>Create certification</button>
        <button type="button" disabled={busy || !hasCertification} onClick={simulateRoute}>Simulate certified route →</button>
      </div>
      <p className="control-status" aria-live="polite">{policyVersionId ? status : "Publish a policy first."}</p>
      {route ? (
        <div className="route-reveal">
          <div><span>ROUTE</span><b>{String(route.route_id)}</b></div>
          <div><span>SELECTED</span><b>{String(route.model ?? route.external_router)}</b></div>
          <div><span>SCOPE</span><b>{String(route.selection_scope)}</b></div>
          <div><span>RECEIPT</span><b>{String(route.manifest_hash).slice(0, 24)}…</b></div>
        </div>
      ) : null}
    </section>
  );
}
