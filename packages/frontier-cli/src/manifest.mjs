import { readFileSync } from "node:fs";

const manifestUrl = new URL("../manifest.json", import.meta.url);

export function loadManifest() {
  return JSON.parse(readFileSync(manifestUrl, "utf8"));
}

export function resolveProfile(input = "code.interactive", manifest = loadManifest()) {
  const normalized = input.trim().toLowerCase();
  const profile = manifest.profiles.find(
    (candidate) =>
      candidate.id === normalized || candidate.aliases.includes(normalized),
  );

  if (!profile) {
    const supported = manifest.profiles.map((candidate) => candidate.id).join(", ");
    throw new Error(`Unknown profile "${input}". Choose ${supported}.`);
  }

  return profile;
}
