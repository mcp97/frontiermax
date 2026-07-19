import type { Metadata } from "next";
import BenchmarkEvidence from "./benchmark-evidence";
import { benchmarkMetadata } from "./benchmark-metadata";
import { readSharedReference } from "./share";

type BenchmarkPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function sharedReferenceFrom(
  searchParams: BenchmarkPageProps["searchParams"],
) {
  const query = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(await searchParams)) {
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (value) query.set(key, value);
  }
  return readSharedReference(query.toString());
}

export async function generateMetadata({
  params,
  searchParams,
}: BenchmarkPageProps): Promise<Metadata> {
  const { slug } = await params;
  return benchmarkMetadata(slug, await sharedReferenceFrom(searchParams));
}

export default async function BenchmarkPage({
  params,
  searchParams,
}: BenchmarkPageProps) {
  const { slug } = await params;
  return <BenchmarkEvidence slug={slug} sharedReference={await sharedReferenceFrom(searchParams)} />;
}
