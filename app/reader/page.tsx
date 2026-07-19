import type { Metadata } from "next";

import BenchmarkReader from "./benchmark-reader";

export const metadata: Metadata = {
  title: "Benchmark Reader — Frontier Max",
  description: "Read one comparable benchmark cohort through transparent workload constraints and conditional Pareto frontiers without changing the source evidence.",
};

export default function ReaderPage() {
  return <BenchmarkReader />;
}
