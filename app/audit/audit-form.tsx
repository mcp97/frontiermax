"use client";

import { useState } from "react";

export default function AuditForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "Request could not be saved.");
      setState("sent");
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request could not be saved.");
      setState("error");
    }
  }

  return (
    <form className="audit-form" onSubmit={submit}>
      <div><label><span>Name</span><input name="name" required maxLength={120} /></label><label><span>Work email</span><input type="email" name="email" required maxLength={200} /></label></div>
      <div><label><span>Company</span><input name="company" required maxLength={160} /></label><label><span>Role</span><input name="role" required maxLength={160} /></label></div>
      <div><label><span>Monthly model spend</span><select name="spend"><option>&lt; $10K</option><option>$10K–$100K</option><option>$100K–$1M</option><option>$1M+</option></select></label><label><span>Production workloads</span><select name="workloads"><option>1–3</option><option>4–10</option><option>11–50</option><option>50+</option></select></label></div>
      <div><label><span>Private benchmarks</span><select name="private_evals"><option>Yes</option><option>Partial</option><option>No</option></select></label><label><span>Primary concern</span><select name="concern"><option>Quality</option><option>Cost</option><option>Latency</option><option>Governance</option><option>Portability</option></select></label></div>
      <label><span>Current gateways or providers</span><input name="providers" maxLength={240} placeholder="OpenRouter, Bedrock, direct APIs…" /></label>
      <label><span>Non-sensitive context</span><textarea name="description" maxLength={1200} placeholder="What decision are you trying to make?" /></label>
      <label className="audit-consent"><input type="checkbox" name="consent" value="yes" required /><span>I will not submit prompts, datasets, credentials, PHI, payment-card data, or other confidential information.</span></label>
      <button className="primary-button" type="submit" disabled={state === "sending" || state === "sent"}>{state === "sending" ? "Saving…" : state === "sent" ? "Request received" : "Request a routing audit"} <span>→</span></button>
      {state === "error" && <p role="alert">{message}</p>}
    </form>
  );
}
