# Frontier Max design QA

## Product boundary

- The primary experience is a stored, periodically refreshed BenchmarkList catalog. There is no user upload or CSV parsing surface.
- `/reader` redirects to `/benchmarks` so earlier links do not strand users on the retired upload workflow.
- Frontier Max indexes and interprets reported evidence; it does not claim affiliation with BenchmarkList, create benchmark scores, rerun evaluations, or infer absent operational measurements.
- Every catalog and detail view links to the BenchmarkList record. Detail pages also expose primary and related references when the source provides them.

## Information architecture

- `/`: product thesis, catalog entry point, workload framework, and optional CLI activation path.
- `/benchmarks`: searchable catalog with category filtering, source freshness, bootstrap fallback, and explicit cross-benchmark comparability guidance.
- `/benchmarks/[slug]`: benchmark nutrition label, interpretation boundary, measurement coverage, reported comparison set, provenance, and shareable evidence summary.
- `/reader`: redirect to `/benchmarks`.
- `/use`: separate action layer for the policy-pinned CLI concept.

## Catalog QA

- The catalog first renders a checked-in bootstrap snapshot, then replaces it with the stored live index when available. A slower bootstrap response cannot overwrite a successful live response.
- Search covers the normalized source index and category filtering updates the visible result count.
- The page does not hardcode a benchmark count in its headline; the source strip shows the count from the active stored snapshot.
- Source state distinguishes loading, bootstrap, live, and unavailable states.
- Missing cost, completion time, and token use are disclosed as unavailable rather than converted to zero or joined from unrelated model runs.
- Scores are explicitly described as comparable within a benchmark, not across the catalog.

## Nutrition-label QA

- Detail pages label what the benchmark measures, its primary metric and direction, release/update dates, and reported configuration count.
- “Can inform” and “Does not establish” cards separate a defensible within-contract reading from universal-model claims.
- Measurement coverage is derived only from nonblank result values. Merely naming a variable does not mark that dimension as reported.
- A conditional 4D frontier is described as possible only when at least two configurations contain score, cost, time, and tokens in the same result row.
- Missing dimensions remain visible as unavailable. Empty axes, synthetic zeros, and unrelated operational joins are not rendered.
- Reported results include a comparison warning because observation dates, harnesses, or configurations may differ when source metadata is incomplete.
- Filtering to zero configurations produces an explicit empty state instead of a blank table.
- Evidence-card copying remains disabled until the detailed source snapshot is loaded; clipboard failure exposes a manual-copy field.

## Provenance QA

- Public provenance displays the source link, fetch time, compact content hash, and parser version.
- Copy distinguishes an indexed BenchmarkList record from any primary paper, dataset, or related source linked by that record.
- Raw source snapshots are retained privately by the persistence layer; public UI exposes lineage metadata rather than republishing raw pages.

## Accessibility and responsive QA

- Catalog and detail pages include skip links, labeled navigation, labeled search/filter inputs, live source-status regions, table captions, and keyboard-visible focus states.
- Status and clipboard feedback use live regions.
- Result tables scroll horizontally rather than compressing metric columns into unreadable widths.
- At 1,050 px, hero and nutrition layouts collapse to simpler grids. At 760 px, filters, interpretation cards, provenance, and sharing collapse to one column.
- Mobile nutrition cards explicitly clear desktop left borders so the single-column divider system remains clean.

## Reference direction

- The visual system is original: warm paper, sage, clay, ochre, editorial serif headlines, restrained borders, and data-dense lists.
- The intended references are the immediacy of Arena-style discovery, the operational rigor of Artificial Analysis, and the evidence/provenance discipline of Vals.
- No reference-site assets, logos, screenshots, or proprietary copy are included.

## Verification checklist

- `npm run lint`
- `npm test`
- Rendered HTML coverage for `/`, `/reader`, `/benchmarks`, `/benchmarks/[slug]`, and `/use`
- Visual inspection of catalog and benchmark-detail first viewports after the next Sites checkpoint
- Mobile visual inspection remains required whenever an interactive browser preview is available
