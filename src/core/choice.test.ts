import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeChoicePalette,
  describeColorChoice,
  formatColorChoice,
  parseColorChoice,
  type ColorChoice,
} from "./choice";
import {
  COMMON_COLORS,
  computeColorPalette,
  computeCustomThemePalette,
  type CustomThemeSpec,
} from "./colors";
import { computeWorkspacePalette } from "./palette";
import { computeThemePresetPalette, THEME_PRESET_CHOICES, THEME_PRESET_IDS, type NamedThemePreset } from "./themes";

const PRESETS = THEME_PRESET_IDS.filter((id): id is NamedThemePreset => id !== "auto");

describe("parseColorChoice", () => {
  it("parses auto", () => {
    assert.deepEqual(parseColorChoice("auto"), { kind: "auto" });
    assert.deepEqual(parseColorChoice("  auto "), { kind: "auto" });
  });

  it("parses seeds", () => {
    assert.deepEqual(parseColorChoice("seed:42"), { kind: "seed", seed: 42 });
    for (const bad of ["seed:0", "seed:-1", "seed:abc", "seed:", "seed:1.5", "seed:4294967296"]) {
      assert.equal(parseColorChoice(bad), undefined, bad);
    }
    assert.deepEqual(parseColorChoice("seed:4294967295"), { kind: "seed", seed: 4294967295 });
  });

  it("parses preset ids", () => {
    for (const preset of PRESETS) {
      assert.deepEqual(parseColorChoice(preset), { kind: "preset", preset });
    }
  });

  it("parses hex and color names as colors", () => {
    assert.deepEqual(parseColorChoice("#ABC"), { kind: "color", hex: "#aabbcc" });
    assert.deepEqual(parseColorChoice("#1E88E5"), { kind: "color", hex: "#1e88e5" });
    assert.deepEqual(parseColorChoice("Blue"), { kind: "color", hex: COMMON_COLORS.blue });
  });

  it("parses custom themes", () => {
    assert.deepEqual(parseColorChoice("custom:Brand"), { kind: "custom", name: "Brand" });
    assert.deepEqual(parseColorChoice("custom: Brand "), { kind: "custom", name: "Brand" });
    assert.equal(parseColorChoice("custom:"), undefined);
    assert.equal(parseColorChoice("custom:   "), undefined);
  });

  it("rejects garbage", () => {
    for (const bad of ["", "nonsense", "#12345", 5, null, undefined, {}]) {
      assert.equal(parseColorChoice(bad), undefined);
    }
  });
});

describe("formatColorChoice", () => {
  const choices: ColorChoice[] = [
    { kind: "auto" },
    { kind: "seed", seed: 99 },
    ...PRESETS.map((preset): ColorChoice => ({ kind: "preset", preset })),
    { kind: "color", hex: "#1e88e5" },
    { kind: "custom", name: "My Brand" },
  ];
  it("round-trips through parseColorChoice for every kind", () => {
    for (const choice of choices) {
      assert.deepEqual(parseColorChoice(formatColorChoice(choice)), choice);
    }
  });
  it("produces the documented string forms", () => {
    assert.equal(formatColorChoice({ kind: "auto" }), "auto");
    assert.equal(formatColorChoice({ kind: "seed", seed: 7 }), "seed:7");
    assert.equal(formatColorChoice({ kind: "color", hex: "#aabbcc" }), "#aabbcc");
    assert.equal(formatColorChoice({ kind: "custom", name: "X" }), "custom:X");
  });
});

describe("describeColorChoice", () => {
  it("labels each kind", () => {
    assert.match(describeColorChoice({ kind: "auto" }), /auto/i);
    assert.match(describeColorChoice({ kind: "seed", seed: 5 }), /5/);
    assert.equal(describeColorChoice({ kind: "custom", name: "Brand" }), "Custom: Brand");
  });
  it("uses the preset label", () => {
    for (const preset of PRESETS) {
      const label = THEME_PRESET_CHOICES.find((c) => c.id === preset)?.label;
      assert.ok(label);
      assert.equal(describeColorChoice({ kind: "preset", preset }), label);
    }
  });
  it("shows the name for named colors and just the hex otherwise", () => {
    const named = describeColorChoice({ kind: "color", hex: COMMON_COLORS.blue });
    assert.ok(named.includes(COMMON_COLORS.blue) && named.includes("blue"));
    const other = describeColorChoice({ kind: "color", hex: "#123456" });
    assert.ok(other.includes("#123456"));
    assert.ok(!other.includes("("));
  });
});

describe("computeChoicePalette", () => {
  const spec: CustomThemeSpec = { title: "#3366cc", activity: "#3366cc", status: "#cc6633" };
  const opts = { hash: 123456, themeKind: "dark" as const, customThemes: new Map([["Brand", spec]]) };

  it("matches the core function for each kind", () => {
    for (const themeKind of ["dark", "light"] as const) {
      const o = { ...opts, themeKind };
      assert.deepEqual(computeChoicePalette({ kind: "auto" }, o), computeWorkspacePalette(opts.hash, themeKind));
      assert.deepEqual(computeChoicePalette({ kind: "seed", seed: 31 }, o), computeWorkspacePalette(31, themeKind));
      for (const preset of PRESETS) {
        assert.deepEqual(computeChoicePalette({ kind: "preset", preset }, o), computeThemePresetPalette(preset, themeKind));
      }
      assert.deepEqual(computeChoicePalette({ kind: "color", hex: "#43a047" }, o), computeColorPalette("#43a047", themeKind));
      assert.deepEqual(computeChoicePalette({ kind: "custom", name: "Brand" }, o), computeCustomThemePalette(spec, themeKind));
    }
  });

  it("throws naming an undefined custom theme", () => {
    assert.throws(() => computeChoicePalette({ kind: "custom", name: "Missing" }, opts), /Missing/);
  });
});
