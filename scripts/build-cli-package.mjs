// Builds the publishable `auto-color-cli` npm package from the compiled `out/`.
// Usage: node scripts/build-cli-package.mjs [outputDir]   (default dist/cli-package)
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(process.argv[2] ?? join(root, "dist", "cli-package"));
const compiled = join(root, "out");
const root_pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const included = [
  join(compiled, "cli.js"),
  ...["cli", "core", "writers"].flatMap((d) => walk(join(compiled, d))),
].filter((file) => file.endsWith(".js") && !file.endsWith(".test.js"));

rmSync(outDir, { recursive: true, force: true });
for (const file of included) {
  const text = readFileSync(file, "utf8");
  if (/require\(["']vscode["']\)|from ["']vscode["']/.test(text)) {
    throw new Error(`${relative(root, file)} imports vscode; not CLI-safe`);
  }
  const target = join(outDir, relative(root, file));
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(file, target);
}

const cliJs = join(outDir, "out", "cli.js");
if (!readFileSync(cliJs, "utf8").startsWith("#!/usr/bin/env node")) {
  throw new Error("out/cli.js is missing its #!/usr/bin/env node shebang");
}
chmodSync(cliJs, 0o755);

copyFileSync(join(root, "LICENSE"), join(outDir, "LICENSE"));
copyFileSync(join(root, "cli-package", "README.md"), join(outDir, "README.md"));

const pkg = {
  name: "auto-color-cli",
  version: root_pkg.version,
  description:
    "Give each project its own editor colors: writes Auto Color workspace palettes into VS Code and Zed settings.",
  bin: { "auto-color": "out/cli.js" },
  files: ["out", "README.md", "LICENSE"],
  license: "MIT",
  repository: root_pkg.repository,
  homepage: root_pkg.homepage,
  bugs: root_pkg.bugs,
  keywords: [
    "workspace color",
    "title bar",
    "vscode",
    "zed",
    "cli",
    "theme",
    "editor",
    "color",
  ],
  engines: { node: ">=18" },
  // out/*.js is emitted as CommonJS (tsconfig module: commonjs).
  type: "commonjs",
};
writeFileSync(join(outDir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
console.log(`Built ${pkg.name}@${pkg.version} in ${outDir}`);
