import {
  composeWorkspacePalette,
  computeWorkspacePalette,
  SHADE_DL,
  type Hsl,
  type ThemeKind,
  type WorkspacePalette,
} from "./palette";

/**
 * Named theme palettes selectable with the Select theme command. `auto` is the
 * classic behavior: the palette is derived from the workspace identity hash.
 */
export const THEME_PRESET_IDS = [
  "auto",
  "matrix",
  "githubDark",
  "githubLight",
  "dracula",
  "nord",
  "solarizedDark",
  "solarizedLight",
  "monokai",
  "gruvboxDark",
  "oneDark",
  "synthwave",
  "ocean",
  "sunset",
  "rainbow",
] as const;

export type ThemePreset = (typeof THEME_PRESET_IDS)[number];

export type NamedThemePreset = Exclude<ThemePreset, "auto">;

type ThemePresetSpec = {
  label: string;
  description: string;
  /** Forced surface style; omitted → follow the active editor theme. */
  kind?: ThemeKind;
  /** Chrome bar colors: title, activity, status. */
  bars: [Hsl, Hsl, Hsl];
  surface: { h: number; s: number; editorL?: number };
  /** Foreground override for the bars (e.g. matrix green). */
  barFg?: string;
};

/** Title / activity / status bars at one hue, stepped by the standard shade offset. */
function shades(h: number, s: number, l: number): [Hsl, Hsl, Hsl] {
  return [
    { h, s, l: l - SHADE_DL },
    { h, s, l },
    { h, s, l: l + SHADE_DL },
  ];
}

const THEME_PRESET_SPECS: Record<NamedThemePreset, ThemePresetSpec> = {
  matrix: {
    label: "Matrix",
    description: "Phosphor green on near-black",
    kind: "dark",
    bars: shades(120, 0.5, 0.13),
    surface: { h: 120, s: 0.28, editorL: 0.055 },
    barFg: "#00ff41",
  },
  githubDark: {
    label: "GitHub Dark",
    description: "Slate blue-gray, GitHub's dark look",
    kind: "dark",
    bars: shades(215, 0.22, 0.12),
    surface: { h: 216, s: 0.12, editorL: 0.068 },
  },
  githubLight: {
    label: "GitHub Light",
    description: "Clean white with cool gray chrome",
    kind: "light",
    bars: shades(210, 0.25, 0.95),
    surface: { h: 210, s: 0.16, editorL: 0.988 },
  },
  dracula: {
    label: "Dracula",
    description: "Muted purple on a dark slate",
    kind: "dark",
    bars: shades(265, 0.35, 0.36),
    surface: { h: 231, s: 0.16, editorL: 0.16 },
  },
  nord: {
    label: "Nord",
    description: "Arctic frost blues",
    kind: "dark",
    bars: shades(213, 0.3, 0.42),
    surface: { h: 220, s: 0.17, editorL: 0.2 },
  },
  solarizedDark: {
    label: "Solarized Dark",
    description: "Deep teal, Solarized's dark base",
    kind: "dark",
    bars: shades(192, 0.8, 0.16),
    surface: { h: 192, s: 0.6, editorL: 0.105 },
  },
  solarizedLight: {
    label: "Solarized Light",
    description: "Warm parchment, Solarized's light base",
    kind: "light",
    bars: shades(44, 0.5, 0.88),
    surface: { h: 44, s: 0.55, editorL: 0.94 },
  },
  monokai: {
    label: "Monokai",
    description: "Olive-tinted charcoal",
    kind: "dark",
    bars: shades(70, 0.12, 0.18),
    surface: { h: 70, s: 0.09, editorL: 0.135 },
  },
  gruvboxDark: {
    label: "Gruvbox Dark",
    description: "Retro warm browns and orange",
    kind: "dark",
    bars: shades(24, 0.45, 0.33),
    surface: { h: 40, s: 0.14, editorL: 0.15 },
  },
  oneDark: {
    label: "One Dark",
    description: "Atom's cool gray-blue",
    kind: "dark",
    bars: shades(220, 0.16, 0.2),
    surface: { h: 220, s: 0.14, editorL: 0.17 },
  },
  synthwave: {
    label: "Synthwave",
    description: "Neon pink on deep purple",
    kind: "dark",
    bars: shades(285, 0.55, 0.22),
    surface: { h: 280, s: 0.35, editorL: 0.09 },
    barFg: "#ff7edb",
  },
  ocean: {
    label: "Ocean",
    description: "Deep sea blues and teals",
    kind: "dark",
    bars: shades(200, 0.5, 0.4),
    surface: { h: 205, s: 0.3, editorL: 0.13 },
  },
  sunset: {
    label: "Sunset",
    description: "Rose, orange, and gold bars",
    kind: "dark",
    bars: [
      { h: 350, s: 0.55, l: 0.5 },
      { h: 20, s: 0.6, l: 0.55 },
      { h: 42, s: 0.65, l: 0.6 },
    ],
    surface: { h: 20, s: 0.3, editorL: 0.13 },
  },
  rainbow: {
    label: "Rainbow",
    description: "A different hue per bar; follows your light/dark theme",
    bars: [
      { h: 0, s: 0.6, l: 0.58 },
      { h: 130, s: 0.5, l: 0.52 },
      { h: 230, s: 0.55, l: 0.6 },
    ],
    surface: { h: 275, s: 0.2 },
  },
};

/** Quick pick / settings order: `auto` first, then the named presets. */
export const THEME_PRESET_CHOICES: {
  id: ThemePreset;
  label: string;
  description: string;
}[] = [
  {
    id: "auto",
    label: "Auto",
    description: "Derive the palette from this workspace (default)",
  },
  ...(Object.keys(THEME_PRESET_SPECS) as NamedThemePreset[]).map((id) => ({
    id: id as ThemePreset,
    label: THEME_PRESET_SPECS[id].label,
    description: THEME_PRESET_SPECS[id].description,
  })),
];

export function parseThemePreset(value: unknown): ThemePreset {
  return typeof value === "string" &&
    (THEME_PRESET_IDS as readonly string[]).includes(value)
    ? (value as ThemePreset)
    : "auto";
}

/**
 * Palette for a named theme preset. Presets with their own light/dark style
 * force it; the rest follow `activeKind` (the editor's current theme).
 */
export function computeThemePresetPalette(
  preset: NamedThemePreset,
  activeKind: ThemeKind,
): WorkspacePalette {
  const spec = THEME_PRESET_SPECS[preset];
  return composeWorkspacePalette({
    bars: { title: spec.bars[0], activity: spec.bars[1], status: spec.bars[2] },
    surface: spec.surface,
    themeKind: spec.kind ?? activeKind,
    barFg: spec.barFg,
  });
}

/** The preset's palette, or the workspace-derived one when no preset is given. */
export function computePaletteWithPreset(opts: {
  hash: number;
  themeKind: ThemeKind;
  preset?: NamedThemePreset;
}): WorkspacePalette {
  return opts.preset
    ? computeThemePresetPalette(opts.preset, opts.themeKind)
    : computeWorkspacePalette(opts.hash, opts.themeKind);
}
