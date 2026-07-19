# Frontier Max — Stanford × DeepMind Hackathon Submission Playbook

**Working date:** July 18, 2026
**Event:** Sunday, July 19, 2026, 10:00 AM–6:00 PM PT
**In-person submission hard stop:** **2:30 PM PT on July 19**
**Recommended track:** In-person Google AI Studio track
**Product line:** **From benchmark to runtime.**

## The shortest possible brief

Frontier Max is the decision and provenance layer for AI model selection. It makes third-party benchmark evidence interpretable in the context of a real workload, then turns task intent into a transparent, reproducible routing policy.

The hackathon demo should prove one closed loop:

> **Task brief → Gemini interpretation → deterministic policy validation → OpenRouter/OpenCode route → content-free local receipt**

Do not add another speculative surface before the submission essentials below are complete.

## Eligibility and submission status

| Requirement | Status now | Evidence / gap | Required owner action |
|---|---|---|---|
| Registration | **Complete** | Event page shows “You’re In.” | Bring valid ID; confirm every participant is 18+. |
| Team size | **Documented; confirm at submission** | Maximum is five people. Current documented team: Monil Patel. | Confirm the final roster and keep the team at five or fewer. |
| Track choice | **Recommended, not submitted** | Current product fits the in-person Google AI Studio track. It is not a Replit-hosted entry. | Select the Google AI Studio track unless organizers explicitly approve another path. |
| Working prototype | **Live** | ChatGPT Sites deployment: <https://agent-frontier.monilpat.chatgpt.site> | Keep this as a backup/demo mirror. Do not present it as the required Cloud Run deployment. |
| Benchmark evidence layer | **Implemented** | Source-linked BenchmarkList catalog, benchmark reader, provenance labels, and conditional frontier logic exist. | Smoke-test the exact demo pages in an incognito window. |
| Actionability layer | **Implemented preview** | The MIT-licensed local CLI exposes `code.interactive` and `code.delegated` policies for OpenCode through OpenRouter. | Run one authenticated OpenCode/OpenRouter smoke test before presenting a live route. |
| Gemini integration | **Implemented in code; runtime activation pending** | Gemini 3.5 Flash maps a short task brief to one allowed policy; checked-in code validates the result against a versioned manifest. | Add `GEMINI_API_KEY` to the Google runtime and verify both demo tasks. Never put the key in the browser, repository, slides, or video. |
| Google Cloud project and billing | **Owner task** | Not verifiable from the repository. | Select the hackathon GCP project, enable billing/quota, Cloud Run, and Cloud Build. |
| Public Cloud Run deployment | **Not complete** | Deployment guides exist at `hackathon/CLOUD_RUN.md` and `Frontier_Max_Cloud_Run_Deployment.md`; no verified public Cloud Run URL is recorded. | Deploy from source, allow unauthenticated access, test in incognito, and paste the final URL into every public artifact. |
| Google AI Studio prerequisite | **Unknown / time-sensitive** | Event copy requested a test app and form by Saturday at 9:00 AM PT. | If the form is open, submit it immediately. Message Dan for an explicit exception or confirmation. |
| Google AI Studio share link | **Not complete** | No share URL is recorded. | Create/test the Gemini project and copy a reviewer-accessible share link. |
| One-pager | **Complete** | `Frontier_Max_One_Pager.pdf` is exactly one US Letter page; editable DOCX is included. | Upload it to a reviewer-accessible location and put the same link in the submission form. |
| Pitch deck | **Complete** | The concise six-slide PPTX and PDF are the primary finalist deck. The eight-slide versions are packaged as detail-rich backups. | Rehearse the five-minute finalist version and keep both PDFs offline. |
| Two-minute team/elevator-pitch video | **Script ready; recording missing** | Script is in this kit. | Record, caption, trim to 2:00 or less, upload, and test the public/reviewer link. |
| One-minute prototype demo / Playcast | **Script ready; recording missing** | Shot list is in this kit. | Record the real Cloud Run build with Gemini active; upload publicly to YouTube and test signed out. |
| Code repository | **Owner task** | Local source exists; final reviewer URL and visibility are not recorded. | Create or verify the repository, tag the pre-event baseline, remove secrets, add setup instructions, and test reviewer access. |
| Public demo engagement | **Not started** | A public YouTube demo is required for the social component. | Publish before submission, share through genuine networks, and keep it public for at least 14 days. |
| Paid-social/data consent | **Clarification needed** | Event copy says organizers may use the playcast in paid ads and also describes an opt-out; eligibility impact is unclear. | Ask the organizer before submission and retain the written answer. |
| Final submission | **Not complete** | Required links have not all been created. | Submit before **2:30 PM PT**, then immediately reopen the confirmation and test every URL. |

## Priority-ordered owner actions

### P0 — Do tonight

1. **Send the organizer note below.** Resolve prerequisite, pre-existing-code, hosting, repository, track, social-window, and consent ambiguities in writing.
2. **Prepare the Google project.** Confirm billing, Gemini access, Cloud Run, and Cloud Build. Create the Gemini key and store it only as a runtime secret.
3. **Create an AI Studio project and share link.** Test the exact structured task-to-policy request used by Frontier Max.
4. **Tag the pre-event source state.** Keep a clean record of what already existed. Do not describe pre-existing work as hackathon-sprint work.
5. **Choose the submission team and track.** Keep the team at five or fewer and default to the in-person Google AI Studio track.
6. **Complete every account-bound URL.** Replace each explicit “not yet created” status only after the asset exists and passes signed-out verification.

### P1 — Prove the Google-track build

1. Deploy the current source to a public Cloud Run service using the checked-in guide.
2. Add `GEMINI_API_KEY` as a server-side secret and verify that the key never appears in client source or network responses.
3. Test these exact tasks on `/use`:
   - **Interactive:** “Fix a flaky authentication test while I pair.”
   - **Delegated:** “Migrate thirty endpoints overnight and open a verified PR.”
4. Confirm that Gemini returns only `code.interactive` or `code.delegated`, the response passes manifest validation, and the UI identifies the requested route and its limitations.
5. Run an authenticated OpenCode/OpenRouter smoke test. The dry run is acceptable for the recorded demo only if it is clearly labeled; do not imply that a model executed when it did not.
6. Open the Cloud Run URL, AI Studio link, repository, and video links in a signed-out/incognito browser.

### P2 — Package and record

1. Finalize the exact one-page PDF and deck.
2. Record the two-minute pitch from the supplied script.
3. Record the one-minute demo from the supplied shot list. Use the Cloud Run URL, not localhost and not a mock.
4. Add captions. Keep the product UI readable on a phone-sized player.
5. Upload the one-minute video publicly to YouTube. Keep it public for **14 days** because the event copy conflicts between seven days and two weeks.
6. Use the launch copy in this kit; route every post to the same canonical YouTube URL.

### P3 — Submit and verify

1. Freeze the demo build by 1:45 PM PT.
2. Assemble the one-pager, Cloud Run URL, AI Studio share link, two videos, and repository link by 2:10 PM PT.
3. Submit by 2:20 PM PT, preserving ten minutes for a broken-link recovery. The stated hard stop is 2:30 PM PT.
4. Save a screenshot and confirmation receipt.
5. Test every submitted URL signed out.
6. Share the public demo before the 5:00 PM Phase 1 engagement checkpoint, then continue authentic distribution for 14 days.

## Organizer note — send verbatim

> Hi Dan — I’m confirmed for tomorrow and want to follow the rules precisely. Could you clarify whether (1) the AI Studio prerequisite is still required for accepted participants, (2) pre-existing code is permitted if we clearly identify the Gemini feature built during the sprint, (3) the main-track prototype must be hosted specifically on Cloud Run, (4) the repository must be public, (5) teams may enter more than one track, (6) social scoring runs 7 days or 2 weeks and which round it affects, and (7) opting out of paid-social use changes eligibility? Thank you.

If the Gemini integration itself was completed before the official sprint, revise item (2) to say: “pre-existing code is permitted if we clearly tag and disclose the baseline and identify the incremental feature built during the sprint.” Do not claim otherwise.

## Recommended submission bundle

Submit or keep ready:

- Exact one-page PDF
- Public Cloud Run prototype URL
- Google AI Studio share link
- Two-minute team/elevator-pitch video
- One-minute public YouTube prototype demo / Playcast
- Reviewer-accessible code repository
- Five-minute finalist deck plus PDF backup
- This playbook, with all links and confirmations recorded

Canonical link and asset status:

- ChatGPT Sites mirror: <https://agent-frontier.monilpat.chatgpt.site>
- Cloud Run: **Not yet created — owner/account action; add only after signed-out verification.**
- Google AI Studio: **Not yet created — owner/account action; add only after reviewer-access verification.**
- Repository: **Not yet created — owner/account action; add only after repository visibility and signed-out access are verified.**
- Two-minute pitch: **Not yet created — owner/account action; add only after upload and signed-out verification.**
- One-minute YouTube demo: **Not yet created — owner/account action; add only after public upload and signed-out verification.**
- Public one-pager URL: **Not yet created — owner/account action; add only after upload and signed-out verification. The local PDF is complete.**

## Five-minute finalist structure

1. **0:00–0:35 — Problem:** Leaderboards report a winner under one evaluation contract; they do not decide what should run a particular job.
2. **0:35–1:10 — Insight:** “Best” is conditional. Quality is a gate; cost, waiting time, throughput, and context bind differently by workload.
3. **1:10–2:30 — Live loop:** Enter an interactive task, show Gemini’s policy, validation, requested route, and receipt. Then switch to the overnight delegated task.
4. **2:30–3:15 — Trust:** Open a source-linked benchmark record and show the transformation/provenance boundary.
5. **3:15–4:10 — Technical design:** Gemini interprets semantics; deterministic code owns the executable policy; Frontier Max never proxies the downstream prompt or repository.
6. **4:10–4:40 — Market:** Free evidence catalog and local CLI; paid team policy workspace/API, controls, and auditability.
7. **4:40–5:00 — Ask:** Five design partners, GCP support, and investor conversations.

## Rehearsal and event runbook

### Before leaving for Stanford

- Charge laptop and backup battery; bring charger, adapter, hotspot, and valid ID.
- Save an offline PDF of the one-pager and deck.
- Save a local screen recording of the working demo as a fallback, clearly dated.
- Verify Cloud Run, AI Studio, repository, and video access while signed out.
- Prepare a demo account for OpenRouter/OpenCode; never expose its key on screen.
- Turn off notifications and hide unrelated browser tabs, terminal history, and secrets.

### July 19 operating clock

| Time (PT) | Action |
|---|---|
| 10:00 | Check in, confirm track and submission channel. |
| 10:30 | Capture every rules clarification; update this playbook immediately. |
| 11:30 | Start the official sprint branch or incremental feature allowed by the organizers. Preserve the pre-event tag. |
| 12:15 | Feature complete; run focused tests and one live Gemini call. |
| 12:45 | Deploy the candidate to Cloud Run and test signed out. |
| 1:10 | Freeze narration and record the one-minute demo. |
| 1:30 | Record or finalize the two-minute pitch; upload both videos. |
| 1:45 | Freeze code and URLs; no non-critical product work after this point. |
| 2:00 | Reviewer simulation: one person follows the submission from a blank browser. |
| 2:10 | Paste final links and inspect the one-pager preview. |
| 2:20 | Submit. Save confirmation. |
| 2:30 | Hard stop. |
| 3:30 | If selected, run the five-minute pitch once with a visible timer. |
| 4:00 | Finals. Keep Q&A answers to one claim plus one piece of evidence. |
| 5:00 | Phase 1 public-engagement checkpoint stated by the event. |

### Demo recovery ladder

1. Live Cloud Run + live Gemini + CLI dry run.
2. Live Cloud Run + previously generated, clearly labeled output only if Gemini is temporarily rate-limited.
3. Local prerecorded product capture with the live public URL visible at the start and end.
4. Slides as the final fallback.

Never silently substitute a mock for a live result. Say what failed, switch once, and continue.

## Truth boundaries for every artifact and answer

### What Frontier Max can claim today

- It consumes and preserves third-party benchmark evidence; it does not create or alter benchmark scores.
- It makes benchmark contracts, source lineage, and conditional trade-offs more legible.
- Its first executable policy vertical is coding: interactive and delegated work.
- Gemini 3.5 Flash interprets a short task brief and proposes one of two allowed workload profiles.
- Deterministic code validates that profile against a checked-in manifest before a route changes.
- `code.interactive` requests the fastest available model in OpenRouter’s current **high Artificial Analysis coding tier**, ranked by p50 throughput.
- `code.delegated` requests the cheapest available model in that same tier.
- The CLI requests a sticky OpenRouter session route and writes a content-free local decision receipt.
- Prompts, code, diffs, API keys, and model responses do not pass through Frontier Max. OpenRouter and the selected provider still receive the model input.

### What Frontier Max must not claim

- Do not say arbitrary BenchmarkList rows directly route arbitrary models. The current executable routing wedge uses OpenRouter Pareto Code’s high Artificial Analysis coding tier.
- Do not call p50 model throughput “time to an accepted change.”
- Do not call model price “verified cost per successful task” or “accepted-result cost.”
- Do not say the receipt proves which concrete model served a run. It records the requested route; OpenRouter may resolve or re-resolve the underlying model.
- Do not imply a latency ceiling or task budget that OpenRouter does not expose.
- Do not say the npm package is published. It is a source/tarball preview.
- Do not say Cloud Run is deployed, the Gemini key is active, the AI Studio link exists, or videos are complete until each is verified.
- Do not claim live Run Fund holdings or accepted funding. The Run Fund surface does not accept money yet.
- Do not imply sponsorship, investment, or prize funding is guaranteed. The event prize is pitch access; investment depends on business fundamentals.

## Likely judge questions

**Why is this more than another leaderboard?**
Because the output is a workload policy and reproducible route with provenance, not a universal rank.

**Why Gemini?**
Humans describe work semantically, not as routing taxonomies. Gemini maps the task brief into a constrained, inspectable policy; code validates the only executable choices.

**Why only two routes?**
The coding wedge deliberately proves the closed loop with two regimes that have different binding resources. The platform can add real-time, batch, continuous, privacy, and context-bound policies without pretending one score fits all.

**Is this a learned router?**
Not yet. The current product exposes an honest, versioned policy on top of OpenRouter Pareto Code. It is designed to earn the outcome data needed for better routing later.

**What is the moat?**
The compounding layer is the benchmark/evaluation provenance graph, workload policy definitions, organization-specific constraints, and outcome-linked decision receipts—not a static chart.

**Who pays?**
AI platform, engineering productivity, and FinOps teams that need governed model policies, repeatable decisions, and auditable changes across tools and providers.

**What happens to customer code?**
Frontier Max does not proxy it. The current CLI launches OpenCode through OpenRouter; those services receive the content under their own policies.

## Official implementation references

- Gemini API: <https://ai.google.dev/api>
- Gemini structured output: <https://ai.google.dev/gemini-api/docs/structured-output>
- Cloud Run Next.js source deployment: <https://docs.cloud.google.com/run/docs/quickstarts/frameworks/deploy-nextjs-service>
- BenchmarkList source catalog: <https://benchmarklist.com/>
- OpenRouter Pareto Router: <https://openrouter.ai/docs/guides/routing/routers/pareto-router>
- OpenCode providers: <https://opencode.ai/docs/providers/>
