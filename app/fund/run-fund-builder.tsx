"use client";

import { useMemo, useState } from "react";

type RequestMode = "run" | "support";
type CopyState = "idle" | "copied" | "failed";

const EMPTY_RUN = {
  applicantName: "",
  applicantAffiliation: "",
  applicantEmail: "",
  benchmarkTitle: "",
  benchmarkUrl: "",
  benchmarkVersion: "",
  methodologyUrl: "",
  requestedModels: "",
  modelScopeNotes: "",
  completionDeadline: "",
  requestedUsd: "",
  supportType: "cash",
  supportSource: "",
  creditRestrictions: "",
  deliverables: "Raw results\nRun manifest\nCost ledger\nFailure report",
  artifactLicense: "",
  rightsStatus: "",
  publicationPermission: "",
  rightsNotes: "",
  conflicts: "None disclosed",
};

const EMPTY_SUPPORT = {
  supporterName: "",
  supporterAffiliation: "",
  supporterEmail: "",
  targetBenchmarkUrl: "",
  supportType: "cash",
  amountUsd: "",
  provider: "",
  restrictions: "",
  publicLabel: "Anonymous community supporter",
};

type RunDraft = typeof EMPTY_RUN;
type SupportDraft = typeof EMPTY_SUPPORT;

function fileSafe(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized.slice(0, 48) || "draft";
}

function lines(value: string) {
  return [...new Set(value.split("\n").map((item) => item.trim()).filter(Boolean))];
}

function positiveAmount(value: string) {
  if (!value.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function isWebUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol)
      && Boolean(url.hostname)
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

function normalizedWebUrl(value: string) {
  if (!isWebUrl(value)) return value.trim();
  return new URL(value.trim()).toString();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function localDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function isRealDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function runValidationIssues(run: RunDraft) {
  const issues: string[] = [];
  if (!run.applicantName.trim()) issues.push("add the applicant's name");
  if (!isEmail(run.applicantEmail)) issues.push("add a valid applicant email");
  if (!run.benchmarkTitle.trim()) issues.push("add a benchmark title");
  if (!isWebUrl(run.benchmarkUrl)) issues.push("add a valid http(s) source URL without embedded credentials");
  if (!run.benchmarkVersion.trim()) issues.push("identify the benchmark version, harness, or commit");
  if (!isWebUrl(run.methodologyUrl)) issues.push("add a valid public http(s) methodology URL");
  if (lines(run.requestedModels).length === 0) issues.push("identify at least one model or model family in scope");
  if (!isRealDate(run.completionDeadline) || run.completionDeadline < localDate()) issues.push("choose a real completion deadline that is today or later");
  if (positiveAmount(run.requestedUsd) === null) issues.push("add a positive, finite requested value");
  if (["provider_credits", "compute", "mixed"].includes(run.supportType) && !run.supportSource.trim()) issues.push("identify the provider or compute source");
  if (["provider_credits", "compute", "mixed"].includes(run.supportType) && !run.creditRestrictions.trim()) issues.push("disclose non-cash restrictions, availability, or expiry—or write “None”");
  if (lines(run.deliverables).length === 0) issues.push("add at least one public deliverable");
  if (!run.artifactLicense.trim()) issues.push("identify the intended artifact license or applicable source terms");
  if (!run.rightsStatus) issues.push("select the rights basis for running the evaluation");
  if (!run.publicationPermission) issues.push("state whether result artifacts may be published");
  if (!run.rightsNotes.trim()) issues.push("describe permissions and any publication constraints");
  if (lines(run.conflicts).length === 0) issues.push("disclose conflicts, or write “None disclosed”");
  return issues;
}

function supportValidationIssues(support: SupportDraft) {
  const issues: string[] = [];
  const amount = positiveAmount(support.amountUsd);
  const isCash = support.supportType === "cash";
  const needsSource = ["provider_credits", "compute"].includes(support.supportType);
  if (!support.supporterName.trim()) issues.push("add the supporter's name");
  if (!isEmail(support.supporterEmail)) issues.push("add a valid supporter email");
  if (support.targetBenchmarkUrl.trim() && !isWebUrl(support.targetBenchmarkUrl)) issues.push("use a valid http(s) target benchmark URL");
  if (isCash && amount === null) issues.push("add a positive, finite cash amount");
  if (!isCash && support.amountUsd.trim() && amount === null) issues.push("use a positive, finite estimated value or leave it blank");
  if (needsSource && !support.provider.trim()) issues.push("identify the provider or compute source");
  if (!isCash && !support.restrictions.trim()) issues.push("describe restrictions, expiry, model limits, or availability—or write “None”");
  if (!support.publicLabel.trim()) issues.push("add a public ledger label");
  return issues;
}

export default function RunFundBuilder() {
  const [mode, setMode] = useState<RequestMode>("run");
  const [run, setRun] = useState(EMPTY_RUN);
  const [support, setSupport] = useState(EMPTY_SUPPORT);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [message, setMessage] = useState("");

  const issues = useMemo(
    () => mode === "run" ? runValidationIssues(run) : supportValidationIssues(support),
    [mode, run, support],
  );

  const payload = useMemo(() => mode === "run" ? {
    schema: "frontier-max/run-request/v2",
    status: "portable_draft",
    completeness: issues.length === 0 ? "ready_to_export" : "incomplete",
    submission: {
      state: "not_submitted",
      delivery_method: "copy_or_download_only",
      intake_url: null,
      submitted_at: null,
    },
    applicant: {
      name: run.applicantName.trim(),
      affiliation: run.applicantAffiliation.trim() || null,
      contact_email: run.applicantEmail.trim(),
    },
    benchmark: {
      title: run.benchmarkTitle.trim(),
      source_url: normalizedWebUrl(run.benchmarkUrl),
      version_or_harness: run.benchmarkVersion.trim(),
      methodology_url: normalizedWebUrl(run.methodologyUrl),
    },
    model_scope: {
      requested_models: lines(run.requestedModels),
      execution_notes: run.modelScopeNotes.trim() || null,
    },
    schedule: {
      requested_completion_deadline: run.completionDeadline || null,
    },
    budget: {
      requested_usd: positiveAmount(run.requestedUsd),
      requested_support: run.supportType,
      non_cash_provider_or_compute_source: ["provider_credits", "compute", "mixed"].includes(run.supportType)
        ? run.supportSource.trim() || null
        : null,
      non_cash_restrictions: ["provider_credits", "compute", "mixed"].includes(run.supportType)
        ? run.creditRestrictions.trim() || null
        : null,
    },
    deliverables: lines(run.deliverables),
    artifact_license: run.artifactLicense.trim() || null,
    rights_and_permissions: {
      basis: run.rightsStatus || null,
      artifact_publication: run.publicationPermission || null,
      notes: run.rightsNotes.trim() || null,
    },
    conflicts: lines(run.conflicts),
    result_independence: true,
  } : {
    schema: "frontier-max/support-offer/v2",
    status: "non_binding_portable_draft",
    completeness: issues.length === 0 ? "ready_to_export" : "incomplete",
    submission: {
      state: "not_submitted",
      delivery_method: "copy_or_download_only",
      intake_url: null,
      submitted_at: null,
    },
    supporter: {
      name: support.supporterName.trim(),
      affiliation: support.supporterAffiliation.trim() || null,
      contact_email: support.supporterEmail.trim(),
    },
    target_benchmark_url: support.targetBenchmarkUrl.trim() ? normalizedWebUrl(support.targetBenchmarkUrl) : null,
    support: {
      type: support.supportType,
      amount_usd_or_credit_value: positiveAmount(support.amountUsd),
      provider: support.provider.trim() || null,
      restrictions: support.restrictions.trim() || null,
    },
    public_label: support.publicLabel.trim(),
    ranking_influence: false,
  }, [issues.length, mode, run, support]);

  const serialized = JSON.stringify(payload, null, 2);
  const needsNonCashDisclosure = ["provider_credits", "compute", "mixed"].includes(run.supportType);
  const supportNeedsTerms = support.supportType !== "cash";
  const supportNeedsProvider = ["provider_credits", "compute"].includes(support.supportType);
  const minDeadline = localDate();

  function updateRun<Key extends keyof RunDraft>(key: Key, value: RunDraft[Key]) {
    setRun((current) => ({ ...current, [key]: value }));
    setCopyState("idle");
    setMessage("");
  }

  function updateSupport<Key extends keyof SupportDraft>(key: Key, value: SupportDraft[Key]) {
    setSupport((current) => ({ ...current, [key]: value }));
    setCopyState("idle");
    setMessage("");
  }

  function validate() {
    if (issues.length === 0) return true;
    const remaining = issues.length - 1;
    setMessage(`Before exporting, ${issues[0]}${remaining > 0 ? ` (${remaining} more ${remaining === 1 ? "item" : "items"} to complete).` : "."}`);
    return false;
  }

  async function copyDraft() {
    if (!validate()) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(serialized);
      setCopyState("copied");
      setMessage("Portable draft copied. It was not submitted or sent to Frontier Max.");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("failed");
      setMessage("Clipboard access failed. Copy the JSON from the manual-copy field. Nothing was submitted.");
    }
  }

  function downloadDraft() {
    if (!validate()) return;
    const blob = new Blob([`${serialized}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const label = mode === "run" ? run.benchmarkTitle : support.publicLabel;
    anchor.href = url;
    anchor.download = `${mode === "run" ? "run-request" : "support-offer"}-${fileSafe(label)}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage("Portable draft downloaded. It was not submitted or sent to Frontier Max.");
  }

  function switchMode(nextMode: RequestMode) {
    setMode(nextMode);
    setCopyState("idle");
    setMessage("");
  }

  return (
    <section className="fund-builder" id="prepare-request">
      <div className="section-index">03 / PREPARE A DRAFT</div>
      <div className="fund-builder-head"><h2>Prepare the run.<br /><em>Or document the support.</em></h2><p>This local builder creates a portable, non-submitted draft. Contact details appear only in the JSON you copy or download. There is no intake form, payment rail, or funding commitment yet.</p></div>
      <div className="fund-builder-tabs" role="tablist" aria-label="Run Fund draft type">
        <button type="button" role="tab" aria-selected={mode === "run"} onClick={() => switchMode("run")}>Evaluator run request</button>
        <button type="button" role="tab" aria-selected={mode === "support"} onClick={() => switchMode("support")}>Support offer</button>
      </div>
      <div className="fund-builder-shell">
        <form noValidate onSubmit={(event) => event.preventDefault()}>
          {mode === "run" ? <>
            <div className="fund-form-pair"><label><span>Applicant name *</span><input required autoComplete="name" value={run.applicantName} onChange={(event) => updateRun("applicantName", event.target.value)} placeholder="Name used for eligibility review" /></label><label><span>Affiliation</span><input autoComplete="organization" value={run.applicantAffiliation} onChange={(event) => updateRun("applicantAffiliation", event.target.value)} placeholder="Independent / lab / organization" /></label></div>
            <label><span>Applicant contact email *</span><input required type="email" autoComplete="email" value={run.applicantEmail} onChange={(event) => updateRun("applicantEmail", event.target.value)} placeholder="Used only in the portable draft" /></label>
            <label><span>Benchmark title *</span><input required value={run.benchmarkTitle} onChange={(event) => updateRun("benchmarkTitle", event.target.value)} placeholder="Repository repair evaluation" /></label>
            <label><span>Source record URL *</span><input required type="url" inputMode="url" value={run.benchmarkUrl} onChange={(event) => updateRun("benchmarkUrl", event.target.value)} placeholder="https://…" /></label>
            <label><span>Version / harness / commit *</span><input required value={run.benchmarkVersion} onChange={(event) => updateRun("benchmarkVersion", event.target.value)} placeholder="v1.4 · commit hash · harness release" /></label>
            <label><span>Pre-registered methodology URL *</span><input required type="url" inputMode="url" value={run.methodologyUrl} onChange={(event) => updateRun("methodologyUrl", event.target.value)} placeholder="https://…" /></label>
            <label><span>Models in scope · one per line *</span><textarea required value={run.requestedModels} onChange={(event) => updateRun("requestedModels", event.target.value)} placeholder="Provider/model-id\nProvider/model-family, version pinned before execution" /></label>
            <label><span>Model scope and execution notes</span><textarea value={run.modelScopeNotes} onChange={(event) => updateRun("modelScopeNotes", event.target.value)} placeholder="Provider endpoints, reasoning modes, sampling policy, exclusions, or how newly released versions are handled" /></label>
            <div className="fund-form-pair"><label><span>Requested completion deadline *</span><input required type="date" min={minDeadline} value={run.completionDeadline} onChange={(event) => updateRun("completionDeadline", event.target.value)} /></label><label><span>Requested value (USD) *</span><input required type="number" min="1" step="0.01" value={run.requestedUsd} onChange={(event) => updateRun("requestedUsd", event.target.value)} placeholder="2500" /></label></div>
            <label><span>Support requested</span><select value={run.supportType} onChange={(event) => updateRun("supportType", event.target.value)}><option value="cash">Cash</option><option value="provider_credits">Provider API credits</option><option value="compute">Compute</option><option value="mixed">Mixed</option></select></label>
            {needsNonCashDisclosure && <><label><span>Provider / compute source *</span><input required value={run.supportSource} onChange={(event) => updateRun("supportSource", event.target.value)} placeholder="Provider account, cloud, cluster, or hardware source" /></label><label><span>Non-cash restrictions, availability, or expiry *</span><textarea required value={run.creditRestrictions} onChange={(event) => updateRun("creditRestrictions", event.target.value)} placeholder="Eligible models, hardware, dates, account limits, scheduling constraints—or write “None”" /></label></>}
            <label><span>Public deliverables · one per line *</span><textarea required value={run.deliverables} onChange={(event) => updateRun("deliverables", event.target.value)} /></label>
            <label><span>Intended artifact license or source terms *</span><input required value={run.artifactLicense} onChange={(event) => updateRun("artifactLicense", event.target.value)} placeholder="CC BY 4.0 / MIT / source dataset terms" /></label>
            <div className="fund-form-pair"><label><span>Rights basis *</span><select required value={run.rightsStatus} onChange={(event) => updateRun("rightsStatus", event.target.value)}><option value="">Select one</option><option value="owned_or_authorized">Owned or explicitly authorized</option><option value="public_license">Public license permits the run</option><option value="permission_pending">Permission pending</option><option value="rights_constrained">Rights constrained</option></select></label><label><span>Artifact publication *</span><select required value={run.publicationPermission} onChange={(event) => updateRun("publicationPermission", event.target.value)}><option value="">Select one</option><option value="permitted">Permitted</option><option value="conditional">Permitted with conditions</option><option value="not_permitted">Not permitted</option></select></label></div>
            <label><span>Rights, permissions, and publication constraints *</span><textarea required value={run.rightsNotes} onChange={(event) => updateRun("rightsNotes", event.target.value)} placeholder="Cite the license or authorization and identify anything that cannot be redistributed" /></label>
            <label><span>Conflicts · one per line *</span><textarea required value={run.conflicts} onChange={(event) => updateRun("conflicts", event.target.value)} /></label>
          </> : <>
            <div className="fund-form-pair"><label><span>Supporter name *</span><input required autoComplete="name" value={support.supporterName} onChange={(event) => updateSupport("supporterName", event.target.value)} placeholder="Name for host eligibility review" /></label><label><span>Affiliation</span><input autoComplete="organization" value={support.supporterAffiliation} onChange={(event) => updateSupport("supporterAffiliation", event.target.value)} placeholder="Individual / provider / organization" /></label></div>
            <label><span>Supporter contact email *</span><input required type="email" autoComplete="email" value={support.supporterEmail} onChange={(event) => updateSupport("supporterEmail", event.target.value)} placeholder="Used only in the portable draft" /></label>
            <label><span>Target benchmark URL</span><input type="url" inputMode="url" value={support.targetBenchmarkUrl} onChange={(event) => updateSupport("targetBenchmarkUrl", event.target.value)} placeholder="Optional · leave blank for the commons pool" /></label>
            <div className="fund-form-pair"><label><span>Support type</span><select value={support.supportType} onChange={(event) => updateSupport("supportType", event.target.value)}><option value="cash">Cash</option><option value="provider_credits">Provider API credits</option><option value="compute">Compute</option><option value="review_labor">Review labor</option></select></label><label><span>{support.supportType === "cash" ? "Proposed amount (USD) *" : "Estimated value (USD)"}</span><input required={support.supportType === "cash"} type="number" min="1" step="0.01" value={support.amountUsd} onChange={(event) => updateSupport("amountUsd", event.target.value)} placeholder="100" /></label></div>
            <label><span>Provider / compute source{supportNeedsProvider ? " *" : ""}</span><input required={supportNeedsProvider} value={support.provider} onChange={(event) => updateSupport("provider", event.target.value)} placeholder="Required for provider credits or compute" /></label>
            <label><span>Restrictions, expiry, model limits, or availability{supportNeedsTerms ? " *" : ""}</span><textarea required={supportNeedsTerms} value={support.restrictions} onChange={(event) => updateSupport("restrictions", event.target.value)} placeholder={supportNeedsTerms ? "Describe every condition—or write “None”" : "Optional; no payment is collected here"} /></label>
            <label><span>Public ledger label *</span><input required value={support.publicLabel} onChange={(event) => updateSupport("publicLabel", event.target.value)} /></label>
          </>}
          <div className="fund-builder-actions"><button type="button" onClick={downloadDraft}>Download JSON <span>↓</span></button><button type="button" onClick={copyDraft}>{copyState === "copied" ? "Copied" : "Copy JSON"} <span>↗</span></button></div>
          <p className="fund-builder-message" role="status" aria-live="polite">{message || `${issues.length === 0 ? "Ready to export" : `${issues.length} ${issues.length === 1 ? "item" : "items"} remaining`}. Copy or download is the only handoff; nothing is persisted or submitted.`}</p>
        </form>
        <div className="fund-json-preview"><div><span>{issues.length === 0 ? "PORTABLE · NOT SUBMITTED" : "INCOMPLETE PREVIEW · NOT SUBMITTED"}</span><a href={mode === "run" ? "/run-fund/v2/run-request.schema.json" : "/run-fund/v2/support-offer.schema.json"}>Open export schema ↗</a></div><pre><code>{serialized}</code></pre>{copyState === "failed" && <textarea aria-label="Run Fund JSON for manual copy" readOnly value={serialized} />}</div>
      </div>
    </section>
  );
}
