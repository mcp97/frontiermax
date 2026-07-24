export const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  || "https://agent-frontier.alignedai.chatgpt.site";

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

type ShareInput = {
  slug: string;
  title: string;
  description: string;
  reportedCoverage: number;
  sourceUrl: string;
  sourceHash: string;
  checkedAt: string;
};

export type SharedReference = {
  source: "benchmarklist";
  snapshot: string;
  checkedAt: string | null;
};

export function compactSnapshot(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
}

function validCheckedAt(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function buildSnapshotShareUrl(
  slug: string,
  sourceHash: string,
  checkedAt: string,
  origin = SITE_ORIGIN,
) {
  const url = new URL(`/benchmarks/${encodeURIComponent(slug)}`, origin);
  url.searchParams.set("source", "benchmarklist");
  if (SHA256_PATTERN.test(sourceHash)) {
    url.searchParams.set("snapshot", sourceHash.toLowerCase());
  }
  const checked = validCheckedAt(checkedAt);
  if (checked) url.searchParams.set("checked", checked);
  url.hash = "provenance";
  return url.toString();
}

export function readSharedReference(search: string): SharedReference | null {
  const params = new URLSearchParams(search);
  const source = params.get("source");
  const snapshot = params.get("snapshot") ?? "";
  if (source !== "benchmarklist" || !SHA256_PATTERN.test(snapshot)) return null;
  return {
    source,
    snapshot: snapshot.toLowerCase(),
    checkedAt: validCheckedAt(params.get("checked")),
  };
}

function clippedTitle(title: string, maximumLength: number) {
  if (title.length <= maximumLength) return title;
  return `${title.slice(0, Math.max(0, maximumLength - 1)).trimEnd()}…`;
}

export function buildXShareText({
  title,
  reportedCoverage,
  sourceHash,
}: Pick<ShareInput, "title" | "reportedCoverage" | "sourceHash">) {
  const scope = `${reportedCoverage}/4 core dimensions reported. Useful for relative performance inside this evaluation contract—not a universal “best model.”`;
  const provenance = `Discovery index: BenchmarkList · snapshot ${compactSnapshot(sourceHash)}`;
  const fixedLength = scope.length + provenance.length + 4;
  return `${clippedTitle(title, Math.max(32, 240 - fixedLength))}\n\n${scope}\n\n${provenance}`;
}

export function buildEvidenceCard(input: ShareInput) {
  const shareUrl = buildSnapshotShareUrl(
    input.slug,
    input.sourceHash,
    input.checkedAt,
  );
  return [
    input.title,
    input.description,
    "",
    "What it can inform: relative performance among configurations reported under this benchmark's evaluation contract.",
    "What it does not establish: a universally best system or operational behavior that was not measured in the same run.",
    "",
    `Coverage: ${input.reportedCoverage}/4 dimensions reported.`,
    `Discovery index: BenchmarkList`,
    `Indexed record: ${input.sourceUrl}`,
    "Authority and reuse rights remain with the linked benchmark publisher/source; verify its terms before commercial use.",
    `Indexed snapshot: ${compactSnapshot(input.sourceHash)} · checked ${input.checkedAt}`,
    `Interpretation: ${shareUrl}`,
  ].join("\n");
}

export function buildXIntentUrl(text: string, shareUrl: string) {
  const intent = new URL("https://x.com/intent/post");
  intent.searchParams.set("text", text);
  intent.searchParams.set("url", shareUrl);
  return intent.toString();
}
