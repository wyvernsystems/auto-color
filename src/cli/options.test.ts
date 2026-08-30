import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCliOptions } from "./options";

describe("parseCliOptions", () => {
  it("returns defaults when no arguments are given", () => {
    assert.deepEqual(parseCliOptions([]), {
      dir: ".",
      source: "path",
      scope: "all",
      theme: "dark",
      seed: undefined,
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
});
