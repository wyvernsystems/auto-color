#!/usr/bin/env node
import { runCli } from "./cli/main";

void runCli(
  process.argv.slice(2),
  process.cwd(),
  (line) => console.log(line),
  (line) => console.error(line),
).then((code) => {
  process.exitCode = code;
});
