import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const packageRoot = join(root, "packages", "frontier-cli");
const sourceManifest = join(packageRoot, "manifest.json");
const publicManifest = join(root, "public", "frontier", "v1", "manifest.json");
const downloadDirectory = join(root, "public", "downloads");

mkdirSync(join(root, "public", "frontier", "v1"), { recursive: true });
mkdirSync(downloadDirectory, { recursive: true });
copyFileSync(sourceManifest, publicManifest);

const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
const canonical = join(downloadDirectory, `frontier-max-${packageJson.version}.tgz`);
const legacyPackageAlias = join(downloadDirectory, `agent-frontier-${packageJson.version}.tgz`);
const legacyCliAlias = join(downloadDirectory, `agent-frontier-cli-${packageJson.version}.tgz`);
rmSync(canonical, { force: true });
rmSync(legacyPackageAlias, { force: true });
rmSync(legacyCliAlias, { force: true });

const packed = spawnSync("npm", ["pack", "--pack-destination", downloadDirectory], {
  cwd: packageRoot,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});
if (packed.status !== 0) process.exit(packed.status ?? 1);
copyFileSync(canonical, legacyPackageAlias);
copyFileSync(canonical, legacyCliAlias);
process.stdout.write(packed.stdout);
