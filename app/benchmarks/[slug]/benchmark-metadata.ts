import type { Metadata } from "next";
import {
  buildSnapshotShareUrl,
  compactSnapshot,
  SITE_ORIGIN,
  type SharedReference,
} from "./share";

type DetailMetadata = {
  title: string;
  description: string;
  category: string | null;
  sourceUrl: string;
  sourceHash: string;
  fetchedAt: string;
  checkedAt: string;
};

function fallbackTitle(slug: string) {
  const value = slug.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : "Benchmark evidence";
}

function trimDescription(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 180
    ? `${normalized.slice(0, 179).trimEnd()}…`
    : normalized;
}

async function benchmarkRecord(slug: string) {
  try {
    const { env } = await import("cloudflare:workers");
    const runtime = env as unknown as { DB: D1Database };
    const row = await runtime.DB.prepare(
      `SELECT title, description, category, source_url, source_hash,
              fetched_at, last_checked_at
       FROM benchmark_details
       WHERE benchmark_id = ?`,
    ).bind(slug).first<{
      title: string;
      description: string | null;
      category: string | null;
      source_url: string;
      source_hash: string;
      fetched_at: number;
      last_checked_at: number;
    }>();
    if (!row) return null;
    return {
      title: row.title,
      description: row.description || "",
      category: row.category,
      sourceUrl: row.source_url,
      sourceHash: row.source_hash,
      fetchedAt: new Date(row.fetched_at).toISOString(),
      checkedAt: new Date(row.last_checked_at || row.fetched_at).toISOString(),
    } satisfies DetailMetadata;
  } catch {
    return null;
  }
}

export async function benchmarkMetadata(
  slug: string,
  sharedReference: SharedReference | null,
): Promise<Metadata> {
  const detail = await benchmarkRecord(slug);
  const benchmarkTitle = detail?.title || fallbackTitle(slug);
  const title = `${benchmarkTitle} — Benchmark Evidence`;
  const baseDescription = trimDescription(
    detail?.description ||
      "A source-preserving benchmark nutrition label indexed from BenchmarkList.",
  );
  const canonicalUrl = `${SITE_ORIGIN}/benchmarks/${encodeURIComponent(slug)}`;
  const currentHash = detail?.sourceHash.toLowerCase();
  const sharedSnapshotMatches = Boolean(
    sharedReference && currentHash && sharedReference.snapshot === currentHash,
  );
  const description = sharedReference && currentHash && !sharedSnapshotMatches
    ? trimDescription(`${baseDescription} This shared snapshot reference differs from the current indexed source.`)
    : baseDescription;
  const socialUrl = sharedSnapshotMatches && detail
    ? buildSnapshotShareUrl(slug, detail.sourceHash, detail.checkedAt)
    : canonicalUrl;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "website",
      siteName: "Frontier Max",
      title,
      description,
      url: socialUrl,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: `${benchmarkTitle} — Frontier Max benchmark evidence` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og.png"],
    },
    other: {
      "frontier-max:source": "BenchmarkList",
      "frontier-max:source-url": detail?.sourceUrl || `https://benchmarklist.com/benchmarks/${slug}/`,
      "frontier-max:claim-scope": "Relative performance inside the source evaluation contract",
      ...(detail?.sourceHash ? { "frontier-max:indexed-snapshot": detail.sourceHash } : {}),
      ...(detail ? { "frontier-max:snapshot-checked": detail.checkedAt } : {}),
      ...(sharedReference ? {
        "frontier-max:shared-snapshot": compactSnapshot(sharedReference.snapshot),
        "frontier-max:shared-snapshot-status": sharedSnapshotMatches ? "current" : "superseded-or-unavailable",
      } : {}),
      ...(detail?.category ? { "frontier-max:benchmark-category": detail.category } : {}),
    },
  };
}
