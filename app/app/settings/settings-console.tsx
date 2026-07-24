"use client";

import { useState } from "react";

type ApiKeySummary = {
  id: string;
  name: string;
  prefix: string;
  revoked: boolean;
};

export default function SettingsConsole({
  apiKeys,
  canAdmin,
}: {
  apiKeys: ApiKeySummary[];
  canAdmin: boolean;
}) {
  const [status, setStatus] = useState("");
  const [apiKey, setApiKey] = useState("");

  async function post(payload: Record<string, unknown>) {
    const response = await fetch("/api/v1/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json() as Record<string, any>;
    if (!response.ok) throw new Error(result.message);
    return result;
  }

  async function addMember(form: FormData) {
    try {
      const result = await post({
        action: "add_member",
        email: String(form.get("email")),
        role: String(form.get("role")),
      });
      setStatus(`${result.email} saved as ${result.role}.`);
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Member update failed.");
    }
  }

  async function createKey(form: FormData) {
    try {
      const result = await post({
        action: "create_api_key",
        name: String(form.get("name")),
        scopes: ["route:read", "manifest:read", "outcomes:write"],
      });
      setApiKey(result.api_key);
      setStatus(result.warning);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "API key creation failed.");
    }
  }

  async function revokeKey(keyId: string) {
    try {
      await post({ action: "revoke_api_key", key_id: keyId });
      setStatus("API key revoked.");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "API key revocation failed.");
    }
  }

  return (
    <div className="settings-grid">
      <form className="control-card" action={addMember}>
        <div className="control-card-head"><div><span>MEMBERS</span><h2>Add by email</h2></div><b>Server-scoped roles</b></div>
        <div className="policy-grid two">
          <label><span>Email</span><input name="email" type="email" required disabled={!canAdmin} /></label>
          <label><span>Role</span><select name="role" disabled={!canAdmin}><option>viewer</option><option>editor</option><option>admin</option></select></label>
        </div>
        <div className="control-actions"><button type="submit" disabled={!canAdmin}>Save member →</button></div>
      </form>
      <form className="control-card" action={createKey}>
        <div className="control-card-head"><div><span>SERVER API</span><h2>Create scoped key</h2></div><b>Shown once</b></div>
        <label className="single-field"><span>Key name</span><input name="name" defaultValue="Production router" required disabled={!canAdmin} /></label>
        <p className="form-note">Scopes: route:read · manifest:read · outcomes:write</p>
        <div className="control-actions"><button type="submit" disabled={!canAdmin}>Create API key →</button></div>
        {apiKey ? <div className="one-time-key"><span>COPY NOW</span><code>{apiKey}</code><pre>{`export FRONTIER_MAX_API_KEY="${apiKey}"
frontier route --policy coding-prod --session demo-1 --tools`}</pre></div> : null}
        {apiKeys.some((key) => !key.revoked) ? <div className="api-key-actions"><span>ACTIVE KEYS</span>{apiKeys.filter((key) => !key.revoked).map((key) => <div key={key.id}><p><b>{key.name}</b><small>{key.prefix}</small></p><button type="button" onClick={() => revokeKey(key.id)} disabled={!canAdmin}>Revoke</button></div>)}</div> : null}
      </form>
      <p className="control-status settings-status" aria-live="polite">{status}</p>
    </div>
  );
}
