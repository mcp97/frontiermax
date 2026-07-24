import type { Metadata } from "next";
import ModelRouter from "./model-router";

export const metadata: Metadata = {
  title: "Router Demo - Frontier Max",
  description:
    "Declare a workload and inspect a concrete, provisional OpenRouter model route computed from current public evidence.",
  alternates: { canonical: "/route" },
};

export default function RoutePage() {
  return <ModelRouter />;
}
