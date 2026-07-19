import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const downloadDirectory = join(root, "public", "downloads");
const output = join(
  downloadDirectory,
  `frontier-max-source-${packageJson.version}.tar.gz`,
);
const legacyAlias = join(
  downloadDirectory,
  `agent-frontier-source-${packageJson.version}.tar.gz`,
);

const listed = spawnSync(
  "git",
  ["ls-files", "--cached", "-z"],
  { cwd: root, encoding: "buffer" },
);
if (listed.status !== 0) process.exit(listed.status ?? 1);

const files = listed.stdout
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .filter((file) => !file.startsWith("public/downloads/"))
  .filter((file) => file !== ".openai/hosting.json")
  .filter((file) => existsSync(join(root, file)))
  .sort();

mkdirSync(downloadDirectory, { recursive: true });
const archive = spawnSync(
  "tar",
  [
    "--create",
    "--gzip",
    "--file",
    output,
    "--null",
    "--files-from",
    "-",
    "--owner=0",
    "--group=0",
    "--numeric-owner",
    "--mtime=2026-07-17T00:00:00Z",
    "--transform",
    `s,^,frontier-max-source-${packageJson.version}/,`,
  ],
  {
    cwd: root,
    input: Buffer.from(`${files.join("\0")}\0`),
    stdio: ["pipe", "inherit", "inherit"],
  },
);
if (archive.status !== 0) process.exit(archive.status ?? 1);
copyFileSync(output, legacyAlias);

process.stdout.write(`${output}\n`);
