import type { Metadata } from "next";
import CatalogExplorer from "./catalog-explorer";

export const metadata: Metadata = {
  title: "Benchmark Catalog — Frontier Max",
  description:
    "Explore public AI benchmark evidence indexed from BenchmarkList, with source-preserving nutrition labels and comparability guidance.",
};

export default function BenchmarksPage() {
  return <CatalogExplorer />;
}
