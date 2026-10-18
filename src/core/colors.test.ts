import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyBranchAlert,
  applyEnvironmentCast,
  COMMON_COLORS,
  computeColorPalette,
  computeCustomThemePalette,
  ENVIRONMENT_COLORS,
  environmentFromRemoteName,
  hexToHsl,
  matchesBranchPattern,
  MAX_CUSTOM_THEME_NAME_LEN,
  parseColor,
  parseCustomThemes,
  parseGitHead,
  type CustomThemeSpec,
} from "./colors";
import {
  computeWorkspacePalette,
  contrastRatio,
  hslToHex,
  MIN_BAR_CONTRAST,
  type ThemeKind,
  type WorkspacePalette,
} from "./palette";

const KINDS: ThemeKind[] = ["dark", "light"];
const BAR_PAIRS = (p: WorkspacePalette): [string, string][] => [
  [p.titleBg, p.titleFg],
  [p.activityBg, p.activityFg],
  [p.statusBg, p.statusFg],
];
const SURFACES = (p: WorkspacePalette) => {
  const { titleBg, titleFg, activityBg, activityFg, statusBg, statusFg, ...rest } = p;
  return rest;
};

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

describe("parseColor", () => {
  it("expands #rgb and lowercases #RRGGBB", () => {
    assert.equal(parseColor("#abc"), "#aabbcc");
    assert.equal(parseColor("#ABC"), "#aabbcc");
    assert.equal(parseColor("#1E88E5"), "#1e88e5");
  });

  it("accepts color names in any case with whitespace", () => {
    assert.equal(parseColor("blue"), COMMON_COLORS.blue);
    assert.equal(parseColor("Blue"), COMMON_COLORS.blue);
    assert.equal(parseColor("  PURPLE  "), COMMON_COLORS.purple);
  });

  it("rejects malformed values", () => {
    for (const bad of ["#12345", "red2", "", "#gggggg", "123456", "#1234567"]) {
      assert.equal(parseColor(bad), undefined, bad);
    }
  });

  it("rejects non-strings", () => {
    for (const bad of [undefined, null, 5, {}, [], true]) {
      assert.equal(parseColor(bad), undefined);
    }
  });

  it("rejects prototype keys", () => {
    for (const bad of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      assert.equal(parseColor(bad), undefined, bad);
    }
  });
});

describe("hexToHsl", () => {
  it("round-trips with hslToHex within 1 per channel", () => {
    const samples = ["#e53935", "#1e88e5", "#43a047", "#757575", "#000000", "#ffffff", "#808080", "#123456", "#fdd835"];
    const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    for (const hex of samples) {
      const { h, s, l } = hexToHsl(hex);
      const back = hslToHex(h, s, l);
      const a = channels(hex);
      const b = channels(back);
      for (let i = 0; i < 3; i++) {
        assert.ok(Math.abs(a[i] - b[i]) <= 1, `${hex} -> ${back}`);
      }
    }
  });

  it("reports zero saturation for gray", () => {
    const { s, l } = hexToHsl("#808080");
    assert.equal(s, 0);
    assert.ok(Math.abs(l - 128 / 255) < 1e-9);
  });
});

describe("computeColorPalette", () => {
  for (const [name, hex] of Object.entries(COMMON_COLORS)) {
    for (const kind of KINDS) {
      it(`keeps hue and readable bars for ${name} (${kind})`, () => {
        const palette = computeColorPalette(hex, kind);
        const hue = hexToHsl(hex).h;
        const saturated = hexToHsl(hex).s > 0.05;
        for (const [bg, fg] of BAR_PAIRS(palette)) {
          if (saturated) {
            assert.ok(hueDistance(hexToHsl(bg).h, hue) <= 1, `${bg} hue vs ${hex}`);
          }
          assert.ok(contrastRatio(bg, fg) >= MIN_BAR_CONTRAST, `${bg}/${fg}`);
        }
      });
    }
  }
});

describe("parseCustomThemes", () => {
  it("defaults activity to title and status to activity", () => {
    const { themes, errors } = parseCustomThemes({ A: { title: "#3366cc" }, B: { title: "red", activity: "blue" } });
    assert.deepEqual(errors, []);
    assert.equal(themes.get("A")?.activity, "#3366cc");
    assert.equal(themes.get("A")?.status, "#3366cc");
    assert.equal(themes.get("B")?.title, COMMON_COLORS.red);
    assert.equal(themes.get("B")?.activity, COMMON_COLORS.blue);
    assert.equal(themes.get("B")?.status, COMMON_COLORS.blue);
  });

  it("accepts optional surface, kind, and foreground", () => {
    const { themes, errors } = parseCustomThemes({
      X: { title: "#111", surface: "green", kind: "light", foreground: "#FFF" },
    });
    assert.deepEqual(errors, []);
    const x = themes.get("X");
    assert.equal(x?.surface, COMMON_COLORS.green);
    assert.equal(x?.kind, "light");
    assert.equal(x?.foreground, "#ffffff");
  });

  it("returns empty for null and undefined", () => {
    for (const raw of [null, undefined]) {
      const r = parseCustomThemes(raw);
      assert.equal(r.themes.size, 0);
      assert.deepEqual(r.errors, []);
    }
  });

  it("reports a non-object root", () => {
    for (const raw of ["x", 5, [], true]) {
      const r = parseCustomThemes(raw);
      assert.equal(r.themes.size, 0);
      assert.equal(r.errors.length, 1);
    }
  });

  it("skips only the invalid theme and reports each error", () => {
    const cases: Record<string, unknown> = {
      missingTitle: { activity: "red" },
      badOptional: { title: "red", status: "nope" },
      badKind: { title: "red", kind: "sepia" },
      "": { title: "red" },
      [" ".repeat(3)]: { title: "red" },
      ["n".repeat(MAX_CUSTOM_THEME_NAME_LEN + 1)]: { title: "red" },
      notObject: "red",
      isArray: [],
      isNull: null,
    };
    const { themes, errors } = parseCustomThemes({ ...cases, good: { title: "blue" } });
    assert.deepEqual([...themes.keys()], ["good"]);
    assert.equal(errors.length, Object.keys(cases).length);
  });

  it("accepts a name at the maximum length", () => {
    const name = "n".repeat(MAX_CUSTOM_THEME_NAME_LEN);
    const { themes, errors } = parseCustomThemes({ [name]: { title: "red" } });
    assert.deepEqual(errors, []);
    assert.ok(themes.has(name));
  });
});

describe("computeCustomThemePalette", () => {
  const spec = (over: Partial<CustomThemeSpec> = {}): CustomThemeSpec => ({
    title: "#101010",
    activity: "#101010",
    status: "#101010",
    ...over,
  });

  it("follows the active kind unless the theme forces one", () => {
    const dark = computeCustomThemePalette(spec(), "dark");
    const light = computeCustomThemePalette(spec(), "light");
    assert.notEqual(dark.editorBg, light.editorBg);
    assert.deepEqual(computeCustomThemePalette(spec({ kind: "light" }), "dark"), light);
    assert.deepEqual(computeCustomThemePalette(spec({ kind: "dark" }), "light"), dark);
  });

  it("uses a readable foreground override", () => {
    const p = computeCustomThemePalette(spec({ foreground: "#ffff00" }), "dark");
    for (const [, fg] of BAR_PAIRS(p)) {
      assert.equal(fg, "#ffff00");
    }
  });

  it("falls back to a readable foreground when the override is unreadable", () => {
    const p = computeCustomThemePalette(spec({ foreground: "#000000" }), "dark");
    for (const [bg, fg] of BAR_PAIRS(p)) {
      assert.notEqual(fg, "#000000");
      assert.ok(contrastRatio(bg, fg) >= MIN_BAR_CONTRAST);
    }
  });
});

describe("parseGitHead", () => {
  it("reads a branch name", () => {
    assert.equal(parseGitHead("ref: refs/heads/main"), "main");
  });
  it("keeps slashes in branch names", () => {
    assert.equal(parseGitHead("ref: refs/heads/feature/a/b"), "feature/a/b");
  });
  it("ignores trailing newline and CRLF", () => {
    assert.equal(parseGitHead("ref: refs/heads/main\n"), "main");
    assert.equal(parseGitHead("ref: refs/heads/main\r\n"), "main");
  });
  it("returns undefined for a detached SHA or junk", () => {
    assert.equal(parseGitHead("0123456789abcdef0123456789abcdef01234567\n"), undefined);
    assert.equal(parseGitHead(""), undefined);
  });
});

describe("matchesBranchPattern", () => {
  it("matches exact names", () => {
    assert.equal(matchesBranchPattern("main", ["main"]), true);
    assert.equal(matchesBranchPattern("dev", ["main", "master"]), false);
  });
  it("matches wildcards", () => {
    assert.equal(matchesBranchPattern("release/1.2", ["release/*"]), true);
    assert.equal(matchesBranchPattern("release/", ["release/*"]), true);
    assert.equal(matchesBranchPattern("hotfix/1", ["release/*"]), false);
  });
  it("does not treat regex metacharacters as regex", () => {
    assert.equal(matchesBranchPattern("featxx", ["feat.x"]), false);
    assert.equal(matchesBranchPattern("feat.x", ["feat.x"]), true);
    assert.equal(matchesBranchPattern("a+b", ["a+b"]), true);
    assert.equal(matchesBranchPattern("aab", ["a+b"]), false);
    assert.equal(matchesBranchPattern("(x)", ["(x)"]), true);
  });
  it("requires a full match", () => {
    assert.equal(matchesBranchPattern("main2", ["main"]), false);
    assert.equal(matchesBranchPattern("premain", ["main"]), false);
    assert.equal(matchesBranchPattern("x/release/1", ["release/*"]), false);
  });
  it("returns false with no patterns", () => {
    assert.equal(matchesBranchPattern("main", []), false);
  });
});

describe("applyBranchAlert", () => {
  for (const kind of KINDS) {
    it(`changes only the bars and keeps them readable (${kind})`, () => {
      const base = computeWorkspacePalette(12345, kind);
      const alerted = applyBranchAlert(base, "#c62828");
      assert.deepEqual(SURFACES(alerted), SURFACES(base));
      assert.notEqual(alerted.titleBg, base.titleBg);
      assert.notEqual(alerted.activityBg, base.activityBg);
      assert.notEqual(alerted.statusBg, base.statusBg);
      for (const [bg, fg] of BAR_PAIRS(alerted)) {
        assert.ok(contrastRatio(bg, fg) >= MIN_BAR_CONTRAST, `${bg}/${fg}`);
      }
    });
  }
  it("does not mutate the input palette", () => {
    const base = computeWorkspacePalette(1, "dark");
    const copy = { ...base };
    applyBranchAlert(base, "#c62828");
    assert.deepEqual(base, copy);
  });
});

describe("environmentFromRemoteName", () => {
  it("maps known names", () => {
    assert.equal(environmentFromRemoteName("ssh-remote"), "ssh");
    assert.equal(environmentFromRemoteName("dev-container"), "container");
    assert.equal(environmentFromRemoteName("attached-container"), "container");
    assert.equal(environmentFromRemoteName("wsl"), "wsl");
    assert.equal(environmentFromRemoteName("codespaces"), "codespaces");
    assert.equal(environmentFromRemoteName("tunnel"), "tunnel");
  });
  it("returns undefined for local windows", () => {
    assert.equal(environmentFromRemoteName(undefined), undefined);
    assert.equal(environmentFromRemoteName(""), undefined);
  });
  it("maps unknown names to other", () => {
    assert.equal(environmentFromRemoteName("something-new"), "other");
  });
});

describe("applyEnvironmentCast", () => {
  it("changes only the status bar", () => {
    const base = computeWorkspacePalette(777, "dark");
    const cast = applyEnvironmentCast(base, "ssh");
    assert.equal(cast.statusBg, ENVIRONMENT_COLORS.ssh);
    assert.ok(contrastRatio(cast.statusBg, cast.statusFg) >= MIN_BAR_CONTRAST);
    const { statusBg, statusFg, ...restCast } = cast;
    const { statusBg: _b, statusFg: _f, ...restBase } = base;
    assert.deepEqual(restCast, restBase);
  });
});
