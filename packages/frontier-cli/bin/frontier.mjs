#!/usr/bin/env node

import { run } from "../src/cli.mjs";

try {
  const status = await run(process.argv.slice(2));
  if (Number.isInteger(status)) process.exitCode = status;
} catch (error) {
  process.stderr.write(`frontier: ${error.message}\n`);
  process.exitCode = 1;
}
