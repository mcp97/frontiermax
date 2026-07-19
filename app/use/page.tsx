import type { Metadata } from "next";
import UseFrontier from "./use-frontier";

export const metadata: Metadata = {
  title: "Model Routing — Frontier Max",
  description:
    "Choose a coding workload, inspect the evidence-backed route, and launch OpenCode through OpenRouter without sending prompts or code to Frontier Max.",
};

export default function UsePage() {
  return <UseFrontier />;
}
