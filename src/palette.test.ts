import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACTIVITY_BG,
  ACTIVITY_FG,
  ALL_CHROME_KEYS,
  ALL_MANAGED_KEYS,
  buildColorCustomizations,
  clampLightness,
  contrastingForegroundHex,
  DEPRECATED_COLOR_KEYS,
  hashToPastelBase,
  hashWorkspaceIdentity,
  hslToHex,
  MAX_FOLDER_PATH_LEN,
  parseChromeScope,
  parseRandomSeed,
  relativeLuminance,
  shouldApplyChrome,
  STATUS_BG,
  STATUS_FG,
  stripManagedColorCustomizations,
  SURFACE_BG_KEYS,
  TITLE_BG,
  TITLE_FG,
} from "./palette";

const HEX = /^#[0-9a-f]{6}$/;

describe("hashWorkspaceIdentity", () => {
  it("returns the same hash when path casing and slashes differ", () => {
    const unix = hashWorkspaceIdentity("/Users/Ron/Project");
    const windows = hashWorkspaceIdentity("\\Users\\ron\\project");
    assert.equal(unix, windows);
  });

  it("returns a uint32 when given a normal folder path", () => {
    const hash = hashWorkspaceIdentity("/Users/ron/project");
    assert.equal(hash, hash >>> 0);
    assert.ok(hash >= 0);
    assert.ok(hash <= 0xffffffff);
  });

  it("truncates to MAX_FOLDER_PATH_LEN before hashing", () => {
    const prefix = "a".repeat(MAX_FOLDER_PATH_LEN);
    const truncated = hashWorkspaceIdentity(prefix);
    const longer = hashWorkspaceIdentity(prefix + "zzz");
    assert.equal(truncated, longer);
  });

  it("returns different hashes when folder paths differ", () => {
    assert.notEqual(
      hashWorkspaceIdentity("/Users/ron/alpha"),
      hashWorkspaceIdentity("/Users/ron/beta"),
    );
  });
});

describe("hashToPastelBase", () => {
  it("stays in pastel hue saturation and lightness ranges when hash varies", () => {
    for (const hash of [0, 1, 42, 2843109148, 0xffffffff]) {
      const { h, s, l } = hashToPastelBase(hash);
      assert.ok(h >= 0 && h < 360, `hue ${h} for ${hash}`);
      assert.ok(s >= 0.05 && s <= 0.29, `sat ${s} for ${hash}`);
      assert.ok(l >= 0.52 && l <= 0.7, `light ${l} for ${hash}`);
    }
  });

  it("returns the same base when the hash is repeated", () => {
    assert.deepEqual(hashToPastelBase(12345), hashToPastelBase(12345));
  });
});

describe("hslToHex", () => {
  it("returns #000000 when lightness is 0", () => {
    assert.equal(hslToHex(0, 1, 0), "#000000");
  });

  it("returns #ffffff when lightness is 1", () => {
    assert.equal(hslToHex(0, 1, 1), "#ffffff");
  });

  it("returns a lowercase six-digit hex when given mid pastel values", () => {
    const hex = hslToHex(200, 0.2, 0.6);
    assert.match(hex, HEX);
  });
});

describe("relativeLuminance", () => {
  it("returns 0 when the color is black", () => {
    assert.equal(relativeLuminance("#000000"), 0);
  });

  it("returns 1 when the color is white", () => {
    assert.equal(relativeLuminance("#ffffff"), 1);
  });
});

describe("contrastingForegroundHex", () => {
  it("returns dark text when the background is light", () => {
    assert.equal(contrastingForegroundHex("#ffffff"), "#1e1e1e");
    assert.equal(contrastingForegroundHex("#f3f3f3"), "#1e1e1e");
  });

  it("returns light text when the background is dark", () => {
    assert.equal(contrastingForegroundHex("#000000"), "#f3f3f3");
    assert.equal(contrastingForegroundHex("#221923"), "#f3f3f3");
  });
});

describe("clampLightness", () => {
  it("returns 0.42 when lightness is below the floor", () => {
    assert.equal(clampLightness(0), 0.42);
    assert.equal(clampLightness(0.41), 0.42);
  });

  it("returns 0.82 when lightness is above the ceiling", () => {
    assert.equal(clampLightness(1), 0.82);
    assert.equal(clampLightness(0.83), 0.82);
  });

  it("returns the input when lightness is inside the band", () => {
    assert.equal(clampLightness(0.6), 0.6);
  });
});

describe("parseChromeScope", () => {
  it("returns headFooter when the value is headFooter", () => {
    assert.equal(parseChromeScope("headFooter"), "headFooter");
  });

  it("returns all when the value is missing or unknown", () => {
    assert.equal(parseChromeScope(undefined), "all");
    assert.equal(parseChromeScope("all"), "all");
    assert.equal(parseChromeScope("nope"), "all");
    assert.equal(parseChromeScope(1), "all");
  });
});

describe("parseRandomSeed", () => {
  it("returns undefined when the seed is not a valid non-zero uint32", () => {
    assert.equal(parseRandomSeed(0), undefined);
    assert.equal(parseRandomSeed(-1), undefined);
    assert.equal(parseRandomSeed(1.5), undefined);
    assert.equal(parseRandomSeed(4294967296), undefined);
    assert.equal(parseRandomSeed(Number.NaN), undefined);
    assert.equal(parseRandomSeed(Number.POSITIVE_INFINITY), undefined);
    assert.equal(parseRandomSeed("1"), undefined);
    assert.equal(parseRandomSeed(undefined), undefined);
  });

  it("returns the uint32 value when the seed is a positive finite number", () => {
    assert.equal(parseRandomSeed(1), 1);
    assert.equal(parseRandomSeed(2843109148), 2843109148);
    assert.equal(parseRandomSeed(4294967295), 4294967295);
  });
});

describe("shouldApplyChrome", () => {
  it("returns true when globally enabled and the workspace is not disabled", () => {
    assert.equal(shouldApplyChrome(true, false), true);
  });

  it("returns false when globally disabled or the workspace is disabled", () => {
    assert.equal(shouldApplyChrome(true, true), false);
    assert.equal(shouldApplyChrome(false, false), false);
    assert.equal(shouldApplyChrome(false, true), false);
  });
});

describe("buildColorCustomizations", () => {
  const hash = hashWorkspaceIdentity("/Users/ron/project");

  it("paints every chrome and surface key when scope is all", () => {
    const next = buildColorCustomizations({ hash, scope: "all", existing: {} });
    for (const key of ALL_MANAGED_KEYS) {
      assert.match(next[key] ?? "", HEX, key);
    }
    assert.equal(next[TITLE_FG], contrastingForegroundHex(next[TITLE_BG]!));
    assert.equal(next[ACTIVITY_FG], contrastingForegroundHex(next[ACTIVITY_BG]!));
    assert.equal(next[STATUS_FG], contrastingForegroundHex(next[STATUS_BG]!));
    assert.equal(next["tab.activeBackground"], next["editor.background"]);
    assert.equal(next["terminal.background"], next["editor.background"]);
  });

  it("omits activity bar and surfaces when scope is headFooter", () => {
    const next = buildColorCustomizations({
      hash,
      scope: "headFooter",
      existing: {},
    });
    assert.match(next[TITLE_BG] ?? "", HEX);
    assert.match(next[STATUS_BG] ?? "", HEX);
    assert.equal(next[ACTIVITY_BG], undefined);
    assert.equal(next[ACTIVITY_FG], undefined);
    for (const key of SURFACE_BG_KEYS) {
      assert.equal(next[key], undefined, key);
    }
  });

  it("keeps unrelated customizations when merging into an existing map", () => {
    const next = buildColorCustomizations({
      hash,
      scope: "all",
      existing: { "editor.cursor": "#ff0000" },
    });
    assert.equal(next["editor.cursor"], "#ff0000");
  });

  it("drops deprecated foreground keys when they exist on the incoming map", () => {
    const existing = Object.fromEntries(
      DEPRECATED_COLOR_KEYS.map((key) => [key, "#abcdef"]),
    );
    const next = buildColorCustomizations({ hash, scope: "all", existing });
    for (const key of DEPRECATED_COLOR_KEYS) {
      assert.equal(next[key], undefined, key);
    }
  });

  it("clears leftover activity and surface keys when switching to headFooter", () => {
    const painted = buildColorCustomizations({ hash, scope: "all", existing: {} });
    const next = buildColorCustomizations({
      hash,
      scope: "headFooter",
      existing: painted,
    });
    assert.equal(next[ACTIVITY_BG], undefined);
    assert.equal(next[ACTIVITY_FG], undefined);
    for (const key of SURFACE_BG_KEYS) {
      assert.equal(next[key], undefined, key);
    }
    for (const key of ALL_CHROME_KEYS) {
      if (key === ACTIVITY_BG || key === ACTIVITY_FG) {
        continue;
      }
      assert.match(next[key] ?? "", HEX, key);
    }
  });

  it("returns the same map when called twice with the same inputs", () => {
    const a = buildColorCustomizations({ hash, scope: "all", existing: {} });
    const b = buildColorCustomizations({ hash, scope: "all", existing: {} });
    assert.deepEqual(a, b);
  });
});

describe("stripManagedColorCustomizations", () => {
  it("returns an empty object when only managed and deprecated keys are present", () => {
    const existing = {
      [TITLE_BG]: "#aaaaaa",
      "editor.background": "#111111",
      "editor.foreground": "#eeeeee",
    };
    assert.deepEqual(stripManagedColorCustomizations(existing), {});
  });

  it("keeps unrelated keys when stripping managed colors", () => {
    const next = stripManagedColorCustomizations({
      [TITLE_BG]: "#aaaaaa",
      "editor.cursor": "#ff0000",
    });
    assert.deepEqual(next, { "editor.cursor": "#ff0000" });
  });
});
