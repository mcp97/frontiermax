import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const sourcePath = join(root, "packages", "frontier-cli", "manifest.json");
const publicPath = join(root, "public", "frontier", "v1", "manifest.json");
const packagePath = join(root, "packages", "frontier-cli", "package.json");
const source = readFileSync(sourcePath, "utf8");
const published = readFileSync(publicPath, "utf8");
const manifest = JSON.parse(source);
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

assert.equal(published, source, "The public policy manifest must be byte-identical to the CLI manifest.");
assert.equal(packageJson.version, manifest.cli_version, "CLI package and manifest versions must match.");
const tarball = join(root, "public", "downloads", `frontier-max-${packageJson.version}.tgz`);
const legacyPackageAlias = join(root, "public", "downloads", `agent-frontier-${packageJson.version}.tgz`);
const legacyCliAlias = join(root, "public", "downloads", `agent-frontier-cli-${packageJson.version}.tgz`);
assert.ok(existsSync(tarball), `Missing downloadable CLI package: ${tarball}`);
assert.ok(existsSync(legacyPackageAlias), `Missing legacy CLI package alias: ${legacyPackageAlias}`);
assert.ok(existsSync(legacyCliAlias), `Missing legacy CLI alias: ${legacyCliAlias}`);
assert.deepEqual(readFileSync(legacyPackageAlias), readFileSync(tarball), "Legacy package alias must be byte-identical to the canonical package.");
assert.deepEqual(readFileSync(legacyCliAlias), readFileSync(tarball), "Legacy CLI alias must be byte-identical to the canonical package.");

const packedPackage = JSON.parse(execFileSync(
  "tar",
  ["-xOzf", tarball, "package/package.json"],
  { encoding: "utf8" },
));
const packedManifest = execFileSync(
  "tar",
  ["-xOzf", tarball, "package/manifest.json"],
  { encoding: "utf8" },
);
const packedListing = execFileSync(
  "tar",
  ["-tvzf", tarball],
  { encoding: "utf8" },
);

assert.equal(packedPackage.name, packageJson.name, "Tarball package name is stale.");
assert.equal(packedPackage.version, packageJson.version, "Tarball package version is stale.");
assert.deepEqual(packedPackage.bin, packageJson.bin, "Tarball executable mapping is stale.");
assert.equal(packedManifest, source, "Tarball policy manifest is stale.");
assert.match(
  packedListing,
  /^-rwx[^\n]* package\/bin\/frontier\.mjs$/m,
  "Tarball must ship an executable frontier command.",
);

const packedFiles = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" })
  .split("\n")
  .filter((entry) => entry.startsWith("package/") && !entry.endsWith("/"));
for (const entry of packedFiles) {
  const sourceFile = join(root, "packages", "frontier-cli", entry.slice("package/".length));
  assert.ok(existsSync(sourceFile), `Tarball contains unexpected file: ${entry}`);
  assert.deepEqual(
    execFileSync("tar", ["-xOzf", tarball, entry]),
    readFileSync(sourceFile),
    `Tarball file is stale: ${entry}`,
  );
}

process.stdout.write(`Frontier release ${packageJson.version} is synchronized.\n`);
