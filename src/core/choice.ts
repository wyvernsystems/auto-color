import {
  COMMON_COLORS,
  computeColorPalette,
  computeCustomThemePalette,
  parseColor,
  type CustomThemeSpec,
} from "./colors";
import { computeWorkspacePalette, parseRandomSeed, type ThemeKind, type WorkspacePalette } from "./palette";
import {
  computeThemePresetPalette,
  parseThemePreset,
  THEME_PRESET_CHOICES,
  type NamedThemePreset,
} from "./themes";

/**
 * Every way a workspace's colors can be chosen. The string form (see
 * `formatColorChoice`) is what `auto-color.favorites` stores:
 * `auto`, `seed:<n>`, a preset id, `#rrggbb`, or `custom:<name>`.
 */
export type ColorChoice =
  | { kind: "auto" }
  | { kind: "seed"; seed: number }
  | { kind: "preset"; preset: NamedThemePreset }
  | { kind: "color"; hex: string }
  | { kind: "custom"; name: string };

/** Extra `auto-color.theme` values beside the presets: use `color` or `customTheme`. */
export const THEME_SETTING_COLOR = "color";
export const THEME_SETTING_CUSTOM = "custom";

export function parseColorChoice(raw: unknown): ColorChoice | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const value = raw.trim();
  if (value === "auto") {
    return { kind: "auto" };
  }
  if (value.startsWith("seed:")) {
    const seed = parseRandomSeed(Number(value.slice(5)));
    return seed === undefined ? undefined : { kind: "seed", seed };
  }
  if (value.startsWith("custom:")) {
    const name = value.slice(7).trim();
    return name ? { kind: "custom", name } : undefined;
  }
  const preset = parseThemePreset(value);
  if (preset !== "auto") {
    return { kind: "preset", preset };
  }
  const hex = parseColor(value);
  return hex ? { kind: "color", hex } : undefined;
}

export function formatColorChoice(choice: ColorChoice): string {
  switch (choice.kind) {
    case "auto":
      return "auto";
    case "seed":
      return `seed:${choice.seed}`;
    case "preset":
      return choice.preset;
    case "color":
      return choice.hex;
    case "custom":
      return `custom:${choice.name}`;
  }
}

/** Short label for pickers, e.g. "Dracula", "Color #1e88e5 (blue)", "Custom: Brand". */
export function describeColorChoice(choice: ColorChoice): string {
  switch (choice.kind) {
    case "auto":
      return "Auto (workspace color)";
    case "seed":
      return `Random palette ${choice.seed}`;
    case "preset":
      return THEME_PRESET_CHOICES.find((c) => c.id === choice.preset)?.label ?? choice.preset;
    case "color": {
      const name = (Object.keys(COMMON_COLORS) as (keyof typeof COMMON_COLORS)[]).find(
        (key) => COMMON_COLORS[key] === choice.hex,
      );
      return name ? `Color ${choice.hex} (${name})` : `Color ${choice.hex}`;
    }
    case "custom":
      return `Custom: ${choice.name}`;
  }
}

/**
 * Palette for a choice. `hash` is the workspace identity hash used by `auto`.
 * Throws when a custom theme is not defined, naming it, so callers can tell
 * the user rather than silently falling back.
 */
export function computeChoicePalette(
  choice: ColorChoice,
  opts: { hash: number; themeKind: ThemeKind; customThemes: ReadonlyMap<string, CustomThemeSpec> },
): WorkspacePalette {
  switch (choice.kind) {
    case "auto":
      return computeWorkspacePalette(opts.hash, opts.themeKind);
    case "seed":
      return computeWorkspacePalette(choice.seed, opts.themeKind);
    case "preset":
      return computeThemePresetPalette(choice.preset, opts.themeKind);
    case "color":
      return computeColorPalette(choice.hex, opts.themeKind);
    case "custom": {
      const spec = opts.customThemes.get(choice.name);
      if (!spec) {
        throw new Error(`Custom theme "${choice.name}" is not defined in auto-color.customThemes.`);
      }
      return computeCustomThemePalette(spec, opts.themeKind);
    }
  }
}
