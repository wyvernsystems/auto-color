import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import {
  buildColorCustomizations,
  buildColorCustomizationsFromPalette,
  hashWorkspaceIdentity,
} from "../core/palette";
import { computeColorPalette } from "../core/colors";
import { computeThemePresetPalette } from "../core/themes";
import { renderZedSettings } from "../writers/zed-settings";
import { runCli } from "./main";

const roots: string[] = [];

function makeProject(dirs: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "auto-color-cli-"));
  roots.push(root);
  for (const dir of dirs) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  return root;
}

function silent(): (line: string) => void {
  return () => {};
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

after(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("runCli", () => {
  it("writes settings for each detected editor", async () => {
    const root = makeProject([".vscode", ".zed"]);
    const code = await runCli([root], root, silent(), silent());
    assert.equal(code, 0);
    const vscodeSettings = readJson(join(root, ".vscode", "settings.json"));
    assert.deepEqual(
      vscodeSettings["workbench.colorCustomizations"],
      buildColorCustomizations({
        hash: hashWorkspaceIdentity(root),
        scope: "all",
        existing: {},
        themeKind: "dark",
      }),
    );
    const zedSettings = readJson(join(root, ".zed", "settings.json"));
    assert.ok(
      Object.keys(
        zedSettings["experimental.theme_overrides"] as Record<string, unknown>,
      ).length > 0,
    );
  });

  it("writes the named theme palette when --theme is a preset", async () => {
    const root = makeProject([".vscode"]);
    const code = await runCli(
      [root, "--theme", "matrix"],
      root,
      silent(),
      silent(),
    );
    assert.equal(code, 0);
    const settings = readJson(join(root, ".vscode", "settings.json"));
    assert.deepEqual(
      settings["workbench.colorCustomizations"],
      buildColorCustomizationsFromPalette({
        palette: computeThemePresetPalette("matrix", "dark"),
        scope: "all",
        existing: {},
      }),
    );
  });

  it("paints the --color palette for vscode and zed", async () => {
    const root = makeProject([".vscode", ".zed"]);
    const code = await runCli(
      [root, "--color", "blue", "--theme", "light"],
      root,
      silent(),
      silent(),
    );
    assert.equal(code, 0);
    const palette = computeColorPalette("#1e88e5", "light");
    assert.deepEqual(
      readJson(join(root, ".vscode", "settings.json"))[
        "workbench.colorCustomizations"
      ],
      buildColorCustomizationsFromPalette({ palette, scope: "all", existing: {} }),
    );
    assert.equal(
      readFileSync(join(root, ".zed", "settings.json"), "utf8"),
      renderZedSettings({
        existingText: undefined,
        hash: 0,
        scope: "all",
        themeKind: "light",
        palette,
      }),
    );
  });

  it("rejects --color combined with --seed", async () => {
    const root = makeProject([".vscode"]);
    const errors: string[] = [];
    const code = await runCli(
      [root, "--color", "#f00", "--seed", "3"],
      root,
      silent(),
      (line) => errors.push(line),
    );
    assert.equal(code, 1);
    assert.match(errors.join("\n"), /--color cannot be combined/);
  });

  it("writes nothing on a dry run", async () => {
    const root = makeProject([".vscode"]);
    const code = await runCli([root, "--dry-run"], root, silent(), silent());
    assert.equal(code, 0);
    assert.throws(() => readJson(join(root, ".vscode", "settings.json")));
  });

  it("fails with guidance when no editor config is detected", async () => {
    const root = makeProject([]);
    const errors: string[] = [];
    const code = await runCli([root], root, silent(), (line) =>
      errors.push(line),
    );
    assert.equal(code, 1);
    assert.match(errors.join("\n"), /--targets/);
  });

  it("respects --targets over detection and creates the editor directory", async () => {
    const root = makeProject([]);
    const code = await runCli(
      [root, "--targets", "zed"],
      root,
      silent(),
      silent(),
    );
    assert.equal(code, 0);
    assert.ok(readJson(join(root, ".zed", "settings.json")));
  });

  it("derives the color from the git origin remote when asked", async () => {
    const rootA = makeProject([".vscode", ".git"]);
    const rootB = makeProject([".vscode", ".git"]);
    const gitConfig = [
      '[remote "origin"]',
      "\turl = git@github.com:owner/repo.git",
      "",
    ].join("\n");
    writeFileSync(join(rootA, ".git", "config"), gitConfig);
    writeFileSync(join(rootB, ".git", "config"), gitConfig);
    assert.equal(
      await runCli([rootA, "--source", "gitRemote"], rootA, silent(), silent()),
      0,
    );
    assert.equal(
      await runCli([rootB, "--source", "gitRemote"], rootB, silent(), silent()),
      0,
    );
    assert.deepEqual(
      readJson(join(rootA, ".vscode", "settings.json")),
      readJson(join(rootB, ".vscode", "settings.json")),
    );
  });

  it("keeps a failing target from blocking the others and reports failure", async () => {
    const root = makeProject([".vscode", ".zed"]);
    writeFileSync(
      join(root, ".vscode", "settings.json"),
      "{ // jsonc comment\n}",
    );
    const errors: string[] = [];
    const code = await runCli([root], root, silent(), (line) =>
      errors.push(line),
    );
    assert.equal(code, 1);
    assert.ok(readJson(join(root, ".zed", "settings.json")));
    assert.match(errors.join("\n"), /\.vscode\/settings\.json/);
  });

  it("removes managed keys with --remove", async () => {
    const root = makeProject([".vscode"]);
    assert.equal(await runCli([root], root, silent(), silent()), 0);
    assert.equal(await runCli([root, "--remove"], root, silent(), silent()), 0);
    const settings = readJson(join(root, ".vscode", "settings.json"));
    assert.equal("workbench.colorCustomizations" in settings, false);
  });
});
