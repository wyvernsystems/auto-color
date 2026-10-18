import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { THEME_PRESET_IDS } from "../core/themes";
import { parseCliOptions } from "./options";

describe("parseCliOptions", () => {
  it("returns defaults when no arguments are given", () => {
    assert.deepEqual(parseCliOptions([]), {
      dir: ".",
      source: "path",
      scope: "all",
      theme: "dark",
      seed: undefined,
      color: undefined,
      targets: undefined,
      remove: false,
      dryRun: false,
      help: false,
    });
  });

  it("parses every flag and the directory positional", () => {
    assert.deepEqual(
      parseCliOptions([
        "/some/dir",
        "--source",
        "gitRemote",
        "--scope",
        "headFooter",
        "--theme",
        "light",
        "--seed",
        "42",
        "--targets",
        "vscode,zed",
        "--dry-run",
        "--remove",
      ]),
      {
        dir: "/some/dir",
        source: "gitRemote",
        scope: "headFooter",
        theme: "light",
        seed: 42,
        color: undefined,
        targets: ["vscode", "zed"],
        remove: true,
        dryRun: true,
        help: false,
      },
    );
  });

  it("parses --help", () => {
    assert.equal(parseCliOptions(["--help"]).help, true);
  });

  it("accepts a named theme preset as --theme", () => {
    assert.equal(parseCliOptions(["--theme", "matrix"]).theme, "matrix");
    assert.equal(parseCliOptions(["--theme", "githubLight"]).theme, "githubLight");
    assert.equal(parseCliOptions(["--theme", "rainbow"]).theme, "rainbow");
  });

  it("throws on invalid values instead of silently defaulting", () => {
    assert.throws(() => parseCliOptions(["--source", "remote"]), /--source/);
    assert.throws(() => parseCliOptions(["--scope", "bars"]), /--scope/);
    assert.throws(() => parseCliOptions(["--theme", "auto"]), /--theme/);
    assert.throws(() => parseCliOptions(["--seed", "0"]), /--seed/);
    assert.throws(() => parseCliOptions(["--seed", "abc"]), /--seed/);
    assert.throws(() => parseCliOptions(["--targets", "emacs"]), /--targets/);
    assert.throws(() => parseCliOptions(["--nope"]));
    assert.throws(() => parseCliOptions(["a", "b"]), /directory/);
  });

  it("accepts every theme preset id except auto", () => {
    for (const id of THEME_PRESET_IDS.filter((t) => t !== "auto")) {
      assert.equal(parseCliOptions(["--theme", id]).theme, id);
    }
  });

  it("normalizes --color hex and names", () => {
    assert.equal(parseCliOptions(["--color", "#ABC"]).color, "#aabbcc");
    assert.equal(parseCliOptions(["--color", "#1E88E5"]).color, "#1e88e5");
    assert.equal(parseCliOptions(["--color", "Blue"]).color, "#1e88e5");
  });

  it("rejects an invalid --color and lists the color names", () => {
    assert.throws(() => parseCliOptions(["--color", "chartreuse"]), /--color.*red.*gray/);
    assert.throws(() => parseCliOptions(["--color", "#12"]), /--color/);
  });

  it("rejects --color with --seed or a named preset, allows dark/light", () => {
    assert.throws(() => parseCliOptions(["--color", "red", "--seed", "5"]), /--seed/);
    assert.throws(() => parseCliOptions(["--color", "red", "--theme", "matrix"]), /--theme/);
    const o = parseCliOptions(["--color", "red", "--theme", "light"]);
    assert.equal(o.theme, "light");
    assert.equal(o.color, "#e53935");
  });
});
