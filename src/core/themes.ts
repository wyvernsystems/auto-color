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
  "catppuccinLatte",
  "catppuccinMocha",
  "tokyoNight",
  "rosePine",
  "kanagawa",
  "everforest",
  "ayuDark",
  "nightOwl",
  "vaporwave",
  "cyberpunk",
  "retroAmber",
  "sakura",
  "deepOcean",
  "coffee",
  "halloween",
  "holiday",
  "transPride",
  "biPride",
  "panPride",
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
  catppuccinLatte: {
    label: "Catppuccin Latte",
    description: "Creamy lavender light with soft mauve chrome",
    kind: "light",
    bars: shades(231, 0.25, 0.89),
    surface: { h: 220, s: 0.23, editorL: 0.95 },
  },
  catppuccinMocha: {
    label: "Catppuccin Mocha",
    description: "Cozy mauve on warm midnight",
    kind: "dark",
    bars: shades(267, 0.25, 0.2),
    surface: { h: 240, s: 0.21, editorL: 0.15 },
  },
  tokyoNight: {
    label: "Tokyo Night",
    description: "Neon-lit indigo after dark",
    kind: "dark",
    bars: shades(235, 0.25, 0.14),
    surface: { h: 235, s: 0.24, editorL: 0.115 },
  },
  rosePine: {
    label: "Rosé Pine",
    description: "Dusky rose and pine on deep plum",
    kind: "dark",
    bars: shades(249, 0.22, 0.17),
    surface: { h: 249, s: 0.22, editorL: 0.12 },
    barFg: "#ebbcba",
  },
  kanagawa: {
    label: "Kanagawa",
    description: "Ukiyo-e indigo ink with sumi gray",
    kind: "dark",
    bars: shades(240, 0.12, 0.13),
    surface: { h: 240, s: 0.1, editorL: 0.115 },
    barFg: "#dcd7ba",
  },
  everforest: {
    label: "Everforest",
    description: "Mossy forest greens, easy on the eyes",
    kind: "dark",
    bars: shades(150, 0.1, 0.19),
    surface: { h: 160, s: 0.08, editorL: 0.17 },
    barFg: "#a7c080",
  },
  ayuDark: {
    label: "Ayu Dark",
    description: "Ink-black with a warm orange glow",
    kind: "dark",
    bars: shades(220, 0.2, 0.09),
    surface: { h: 220, s: 0.25, editorL: 0.075 },
    barFg: "#ffb454",
  },
  nightOwl: {
    label: "Night Owl",
    description: "Deep midnight blue for late-night coding",
    kind: "dark",
    bars: shades(207, 0.8, 0.1),
    surface: { h: 207, s: 0.6, editorL: 0.08 },
    barFg: "#7fdbca",
  },
  vaporwave: {
    label: "Vaporwave",
    description: "Pastel pink and cyan, mall-at-midnight haze",
    kind: "dark",
    bars: [
      { h: 300, s: 0.45, l: 0.13 },
      { h: 270, s: 0.45, l: 0.16 },
      { h: 190, s: 0.5, l: 0.13 },
    ],
    surface: { h: 270, s: 0.35, editorL: 0.1 },
    barFg: "#ffb3f0",
  },
  cyberpunk: {
    label: "Cyberpunk",
    description: "Neon yellow and cyan on a dark street",
    kind: "dark",
    bars: [
      { h: 55, s: 0.4, l: 0.08 },
      { h: 185, s: 0.5, l: 0.1 },
      { h: 55, s: 0.4, l: 0.08 },
    ],
    surface: { h: 240, s: 0.3, editorL: 0.06 },
    barFg: "#fcee0a",
  },
  retroAmber: {
    label: "Retro Amber",
    description: "Amber phosphor terminal on near-black",
    kind: "dark",
    bars: shades(35, 0.5, 0.09),
    surface: { h: 35, s: 0.3, editorL: 0.05 },
    barFg: "#ffb000",
  },
  sakura: {
    label: "Sakura",
    description: "Cherry-blossom pinks on soft white",
    kind: "light",
    bars: [
      { h: 340, s: 0.7, l: 0.88 },
      { h: 350, s: 0.65, l: 0.9 },
      { h: 330, s: 0.6, l: 0.86 },
    ],
    surface: { h: 345, s: 0.4, editorL: 0.975 },
  },
  deepOcean: {
    label: "Deep Ocean",
    description: "Abyssal navy fading into bioluminescent teal",
    kind: "dark",
    bars: [
      { h: 220, s: 0.7, l: 0.14 },
      { h: 205, s: 0.7, l: 0.17 },
      { h: 180, s: 0.65, l: 0.14 },
    ],
    surface: { h: 215, s: 0.6, editorL: 0.075 },
  },
  coffee: {
    label: "Coffee",
    description: "Espresso browns with a latte-foam finish",
    kind: "dark",
    bars: shades(25, 0.4, 0.14),
    surface: { h: 25, s: 0.3, editorL: 0.1 },
    barFg: "#e8d5c0",
  },
  halloween: {
    label: "Halloween",
    description: "Pumpkin orange and witchy purple on black",
    kind: "dark",
    bars: [
      { h: 25, s: 0.9, l: 0.1 },
      { h: 275, s: 0.6, l: 0.15 },
      { h: 25, s: 0.9, l: 0.1 },
    ],
    surface: { h: 270, s: 0.3, editorL: 0.05 },
    barFg: "#ff9a1f",
  },
  holiday: {
    label: "Holiday",
    description: "Festive red, green, and gold",
    kind: "dark",
    bars: [
      { h: 0, s: 0.7, l: 0.25 },
      { h: 140, s: 0.6, l: 0.18 },
      { h: 45, s: 0.7, l: 0.2 },
    ],
    surface: { h: 140, s: 0.3, editorL: 0.09 },
    barFg: "#fff4d6",
  },
  transPride: {
    label: "Trans Pride",
    description: "Light blue, pink, and white stripes",
    kind: "light",
    bars: [
      { h: 197, s: 0.8, l: 0.78 },
      { h: 350, s: 0.8, l: 0.84 },
      { h: 0, s: 0, l: 0.97 },
    ],
    surface: { h: 200, s: 0.3, editorL: 0.975 },
  },
  biPride: {
    label: "Bi Pride",
    description: "Magenta, purple, and blue",
    kind: "dark",
    bars: [
      { h: 330, s: 0.8, l: 0.25 },
      { h: 275, s: 0.5, l: 0.25 },
      { h: 225, s: 0.8, l: 0.25 },
    ],
    surface: { h: 275, s: 0.3, editorL: 0.1 },
  },
  panPride: {
    label: "Pan Pride",
    description: "Pink, yellow, and cyan",
    kind: "light",
    bars: [
      { h: 330, s: 0.9, l: 0.82 },
      { h: 52, s: 0.95, l: 0.75 },
      { h: 190, s: 0.9, l: 0.78 },
    ],
    surface: { h: 52, s: 0.3, editorL: 0.975 },
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
