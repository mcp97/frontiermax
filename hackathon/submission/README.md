# Frontier Max — Hackathon Submission Kit

**From benchmark to runtime.**

Live prototype: https://agent-frontier.monilpat.chatgpt.site

This folder is the working submission package for the Stanford × DeepMind hackathon. The public ChatGPT Sites mirror is live and the judge-facing narrative is complete. The Gemini feature is deployed in code, but live runtime activation still requires a server-side `GEMINI_API_KEY` and signed-out verification. Account-bound actions are listed in `Frontier_Max_Submission_Playbook.md`.

## Deliverables

- `Frontier_Max_Hackathon_Deck_Concise.pptx` — primary editable six-slide finalist deck
- `Frontier_Max_Hackathon_Deck_Concise.pdf` — primary shareable six-slide deck
- `Frontier_Max_Hackathon_Deck.pptx` — backup editable eight-slide deck with additional detail
- `Frontier_Max_Hackathon_Deck.pdf` — backup eight-slide deck PDF
- `Frontier_Max_One_Pager.docx` — editable one-page brief
- `Frontier_Max_One_Pager.pdf` — submission-ready one-page brief
- `Frontier_Max_2_Minute_Pitch.txt` — timed pitch script
- `Frontier_Max_1_Minute_Demo.txt` — shot-by-shot demo plan and voiceover
- `Frontier_Max_Submission_Copy.md` — reusable application-field copy
- `Frontier_Max_Launch_Copy.md` — YouTube, X, and LinkedIn launch copy
- `Frontier_Max_Submission_Playbook.md` — eligibility, owner actions, rehearsal, and submission checklist
- `Frontier_Max_Cloud_Run_Deployment.md` — copy-paste Google-track deployment and verification guide

The packaged handoff also includes `Frontier_Max_Hackathon_Submission_Kit.zip`,
with the concise deck listed first. The GitHub source copy intentionally omits
that ZIP so the bundle is not nested recursively inside itself.

## Product truth boundary

- With `GEMINI_API_KEY` configured server-side, Gemini maps a short task brief onto one of two allowed coding policies and returns a concise explanation, visible signals, confidence, and a caveat.
- Deterministic code validates that policy and resolves the executable OpenRouter × OpenCode route.
- The current CLI uses the OpenRouter Pareto Code high Artificial Analysis coding tier: interactive chooses the fastest available model by p50 throughput; delegated chooses the cheapest available model in that tier.
- BenchmarkList provenance is real. Do not claim arbitrary BenchmarkList records directly select arbitrary models yet.
- The current public prototype is deployed on ChatGPT Sites. Its Gemini endpoint code is present, but runtime activation has not been verified because `GEMINI_API_KEY` is not configured there.
- A public Cloud Run URL, Google AI Studio share link, reviewer-accessible repository, public videos, and hosted one-pager URL remain owner/account actions.
