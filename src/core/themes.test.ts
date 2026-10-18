import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { relativeLuminance, type WorkspacePalette } from "./palette";
import {
  computeThemePresetPalette,
  parseThemePreset,
  THEME_PRESET_CHOICES,
  THEME_PRESET_IDS,
  type NamedThemePreset,
} from "./themes";

const HEX = /^#[0-9a-f]{6}$/;

const NAMED_PRESETS = THEME_PRESET_IDS.filter(
  (id): id is NamedThemePreset => id !== "auto",
);

describe("parseThemePreset", () => {
  it("returns auto when the value is missing or unknown", () => {
    assert.equal(parseThemePreset(undefined), "auto");
    assert.equal(parseThemePreset(null), "auto");
    assert.equal(parseThemePreset("neon-vaporwave"), "auto");
    assert.equal(parseThemePreset(42), "auto");
  });

  it("returns the preset when the value is a known id", () => {
    for (const id of THEME_PRESET_IDS) {
      assert.equal(parseThemePreset(id), id);
    }
  });
});

describe("THEME_PRESET_CHOICES", () => {
  it("lists every preset id exactly once with auto first", () => {
    assert.deepEqual(
      THEME_PRESET_CHOICES.map((c) => c.id),
      [...THEME_PRESET_IDS],
    );
    assert.equal(THEME_PRESET_CHOICES[0].id, "auto");
  });

  it("gives every choice a label and description", () => {
    for (const choice of THEME_PRESET_CHOICES) {
      assert.ok(choice.label.length > 0, choice.id);
      assert.ok(choice.description.length > 0, choice.id);
    }
  });
});

describe("computeThemePresetPalette", () => {
  it("returns valid hex for every color when preset and kind vary", () => {
    for (const preset of NAMED_PRESETS) {
      for (const kind of ["dark", "light"] as const) {
        const palette = computeThemePresetPalette(preset, kind);
        for (const [key, value] of Object.entries(palette)) {
          assert.match(value, HEX, `${preset}/${kind}/${key}`);
        }
      }
    }
  });

  it("returns the same palette when the preset is repeated", () => {
    assert.deepEqual(
      computeThemePresetPalette("matrix", "dark"),
      computeThemePresetPalette("matrix", "dark"),
    );
  });

  it("uses matrix green foregrounds on dark bars when the preset is matrix", () => {
    const palette = computeThemePresetPalette("matrix", "light");
    assert.equal(palette.titleFg, "#00ff41");
    assert.equal(palette.activityFg, "#00ff41");
    assert.equal(palette.statusFg, "#00ff41");
    assert.ok(relativeLuminance(palette.titleBg) < 0.1, palette.titleBg);
  });

  it("forces its own light or dark surfaces when the preset has a fixed style", () => {
    const light = computeThemePresetPalette("githubLight", "dark");
    assert.ok(relativeLuminance(light.editorBg) > 0.5, light.editorBg);
    const dark = computeThemePresetPalette("githubDark", "light");
    assert.ok(relativeLuminance(dark.editorBg) < 0.1, dark.editorBg);
  });

  it("follows the active theme kind when the preset is rainbow", () => {
    const dark = computeThemePresetPalette("rainbow", "dark");
    assert.ok(relativeLuminance(dark.editorBg) < 0.1, dark.editorBg);
    const light = computeThemePresetPalette("rainbow", "light");
    assert.ok(relativeLuminance(light.editorBg) > 0.5, light.editorBg);
  });

  it("gives each bar a distinct color when the preset is rainbow", () => {
    const palette = computeThemePresetPalette("rainbow", "dark");
    const bars = new Set([palette.titleBg, palette.activityBg, palette.statusBg]);
    assert.equal(bars.size, 3);
  });

  it("derives dark bar text when a light preset has no foreground override", () => {
    const palette: WorkspacePalette = computeThemePresetPalette(
      "solarizedLight",
      "dark",
    );
    assert.equal(palette.titleFg, "#1e1e1e");
  });
});

const NEW_PRESETS: Record<string, string> = {
  catppuccinLatte: "Catppuccin Latte",
  catppuccinMocha: "Catppuccin Mocha",
  tokyoNight: "Tokyo Night",
  rosePine: "Rosé Pine",
  kanagawa: "Kanagawa",
  everforest: "Everforest",
  ayuDark: "Ayu Dark",
  nightOwl: "Night Owl",
  vaporwave: "Vaporwave",
  cyberpunk: "Cyberpunk",
  retroAmber: "Retro Amber",
  sakura: "Sakura",
  deepOcean: "Deep Ocean",
  coffee: "Coffee",
  halloween: "Halloween",
  holiday: "Holiday",
  transPride: "Trans Pride",
  biPride: "Bi Pride",
  panPride: "Pan Pride",
};

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe("community, novelty, seasonal, and pride presets", () => {
  it("lists each new preset with its label when choices are built", () => {
    for (const [id, label] of Object.entries(NEW_PRESETS)) {
      assert.ok((THEME_PRESET_IDS as readonly string[]).includes(id), id);
      const choice = THEME_PRESET_CHOICES.find((c) => c.id === id);
      assert.equal(choice?.label, label, id);
    }
  });

  it("keeps bar text at WCAG 4.5:1 or better when a new preset renders in either theme", () => {
    for (const id of Object.keys(NEW_PRESETS)) {
      for (const kind of ["dark", "light"] as const) {
        const p = computeThemePresetPalette(id as NamedThemePreset, kind);
        for (const [bg, fg] of [
          [p.titleBg, p.titleFg],
          [p.activityBg, p.activityFg],
          [p.statusBg, p.statusFg],
        ]) {
          const ratio = contrastRatio(bg, fg);
          assert.ok(ratio >= 4.5, `${id}/${kind} ${fg} on ${bg} = ${ratio.toFixed(2)}`);
        }
      }
    }
  });
});

describe("existing presets bar contrast", () => {
  it("keeps every existing preset's bar text at WCAG AA contrast", () => {
    const existing = NAMED_PRESETS.filter((id) => !(id in NEW_PRESETS));
    for (const id of existing) {
      for (const kind of ["dark", "light"] as const) {
        const p = computeThemePresetPalette(id, kind);
        for (const [bg, fg] of [
          [p.titleBg, p.titleFg],
          [p.activityBg, p.activityFg],
          [p.statusBg, p.statusFg],
        ]) {
          const ratio = contrastRatio(bg, fg);
          assert.ok(ratio >= 4.5, `${id}/${kind}: ${fg} on ${bg} is ${ratio.toFixed(2)}`);
        }
      }
    }
  });
});

describe("auto-color.theme setting", () => {
  it("offers every preset plus color and custom, in order", async () => {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const manifest = JSON.parse(await readFile(join(__dirname, "..", "..", "package.json"), "utf8"));
    const setting = manifest.contributes.configuration.properties["auto-color.theme"];
    assert.deepEqual(setting.enum, [...THEME_PRESET_IDS, "color", "custom"]);
    assert.equal(setting.enumItemLabels.length, setting.enum.length);
  });
});
