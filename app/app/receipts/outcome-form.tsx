"use client";

import { useState } from "react";

export default function OutcomeForm({ routeId }: { routeId: string }) {
  const [status, setStatus] = useState("");
  async function record() {
    const response = await fetch("/api/v1/outcomes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        route_id: routeId,
        application_outcome: "accepted",
        actual_model: null,
        actual_provider: null,
      }),
    });
    const result = await response.json() as Record<string, any>;
    setStatus(response.ok ? "Accepted outcome recorded." : result.message);
    if (response.ok) window.setTimeout(() => window.location.reload(), 700);
  }
  return <div className="outcome-action"><button type="button" onClick={record}>Mark accepted</button><span aria-live="polite">{status}</span></div>;
}
