import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const name = `frontier-max-source-${packageJson.version}`;
const archive = join(root, "public", "downloads", `${name}.tar.gz`);
const legacyAlias = join(root, "public", "downloads", `agent-frontier-source-${packageJson.version}.tar.gz`);

assert.ok(existsSync(archive), `Missing source release: ${archive}`);
assert.ok(existsSync(legacyAlias), `Missing legacy source release: ${legacyAlias}`);
assert.deepEqual(readFileSync(legacyAlias), readFileSync(archive), "Legacy source alias must be byte-identical to the canonical archive.");
const listing = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" });
const required = [
  ".openai/hosting.example.json",
  "app/api/gemini/route.ts",
  "app/reader/benchmark-reader.tsx",
  "app/benchmarks/[slug]/benchmark-metadata.ts",
  "app/benchmarks/[slug]/share.ts",
  "public/run-fund/v2/run-request.schema.json",
  "public/run-fund/v1/funding-policy.json",
  "scheduler/vercel/workflows/benchmark-clock.ts",
  "tests/gemini-policy.test.mjs",
  "tests/benchmark-share.test.mjs",
];
for (const file of required) {
  assert.match(listing, new RegExp(`^${name}/${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
}
assert.doesNotMatch(listing, /\.openai\/hosting\.json/);
assert.doesNotMatch(listing, /public\/downloads\//);

const contents = execFileSync("tar", ["-xOzf", archive], {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});
assert.doesNotMatch(contents, /\b(?:team|prj|appgprj)_[A-Za-z0-9]{20,}\b/, "Source archive must not publish opaque deployment identifiers.");
assert.doesNotMatch(contents, /(?:^|[\s(\"'=:\u0060])\/workspace\//m, "Source archive must not publish absolute workspace paths.");

const packedPackage = JSON.parse(execFileSync(
  "tar",
  ["-xOzf", archive, `${name}/package.json`],
  { encoding: "utf8" },
));
assert.equal(packedPackage.version, packageJson.version);

const packedViteConfig = execFileSync(
  "tar",
  ["-xOzf", archive, `${name}/vite.config.ts`],
  { encoding: "utf8" },
);
assert.match(packedViteConfig, /\.\/\.openai\/hosting\.example\.json/);

process.stdout.write(`Source release ${packageJson.version} is synchronized.\n`);
