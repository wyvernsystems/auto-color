import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, describe, it } from "node:test";

// Compiled location: <repo>/out/cli/package.test.js
const repoRoot = resolve(__dirname, "..", "..");
const tempDir = mkdtempSync(join(tmpdir(), "auto-color-cli-pkg-"));
const pkgDir = join(tempDir, "pkg");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

after(() => rmSync(tempDir, { recursive: true, force: true }));

describe("auto-color-cli package build", () => {
  execFileSync(
    process.execPath,
    [join(repoRoot, "scripts", "build-cli-package.mjs"), pkgDir],
    { stdio: "pipe" },
  );
  const files = walk(pkgDir);

  it("writes a package.json with the CLI name, bin, and root version", () => {
    const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
    const rootPkg = JSON.parse(
      readFileSync(join(repoRoot, "package.json"), "utf8"),
    );
    assert.equal(pkg.name, "auto-color-cli");
    assert.equal(pkg.version, rootPkg.version);
    assert.deepEqual(pkg.author, rootPkg.author);
    assert.deepEqual(pkg.bin, { "auto-color": "out/cli.js" });
    assert.equal(pkg.dependencies, undefined);
    assert.ok(statSync(join(pkgDir, "out", "cli.js")).mode & 0o100);
  });

  it("ships no tests and nothing that depends on vscode", () => {
    assert.ok(files.length > 0);
    assert.deepEqual(
      files.filter((f) => f.endsWith(".test.js")),
      [],
    );
    for (const file of files.filter((f) => f.endsWith(".js"))) {
      assert.doesNotMatch(
        readFileSync(file, "utf8"),
        /require\(["']vscode["']\)|from ["']vscode["']/,
        file,
      );
    }
  });

  it("runs --help from the packaged output", () => {
    const output = execFileSync(
      process.execPath,
      [join(pkgDir, "out", "cli.js"), "--help"],
      { encoding: "utf8" },
    );
    assert.match(output, /Usage: auto-color/);
    assert.match(output, /--color/);
  });
});
