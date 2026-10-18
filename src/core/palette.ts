/** Avoid hashing megabyte paths (pathological workspace roots). */
export const MAX_FOLDER_PATH_LEN = 4096;

export type ChromeScope = "all" | "headFooter";

export type ThemeKind = "dark" | "light";

export type ColorMap = Record<string, string | undefined>;

export const TITLE_BG = "titleBar.activeBackground" as const;
export const TITLE_FG = "titleBar.activeForeground" as const;
export const ACTIVITY_BG = "activityBar.background" as const;
export const ACTIVITY_FG = "activityBar.foreground" as const;
export const STATUS_BG = "statusBar.background" as const;
export const STATUS_FG = "statusBar.foreground" as const;

export const ALL_CHROME_KEYS = [
  TITLE_BG,
  TITLE_FG,
  ACTIVITY_BG,
  ACTIVITY_FG,
  STATUS_BG,
  STATUS_FG,
] as const;

export const SURFACE_BG_KEYS = [
  "sideBar.background",
  "sideBar.border",
  "sideBarSectionHeader.background",
  "list.activeSelectionBackground",
  "list.hoverBackground",
  "list.inactiveSelectionBackground",
  "editor.background",
  "editor.lineHighlightBackground",
  "editorGutter.background",
  "editorGroupHeader.tabsBackground",
  "editorGroupHeader.noTabsBackground",
  "tab.inactiveBackground",
  "tab.activeBackground",
  "tab.border",
  "panel.background",
  "panel.border",
  "terminal.background",
  "breadcrumb.background",
  "editorWidget.background",
  "editorGroup.border",
  "activityBar.border",
  "titleBar.border",
  "statusBar.border",
  "sideBarSectionHeader.border",
  "editorWidget.border",
  "tab.activeBorder",
  "welcomePage.background",
  "welcomePage.tileBackground",
  "walkThrough.embeddedEditorBackground",
  "editorGroup.emptyBackground",
  "editorPane.background",
  "textBlockQuote.background",
  "sideBarTitle.background",
  "panelTitle.activeBorder",
  "input.background",
  "dropdown.background",
  "quickInput.background",
  "notifications.background",
  "debugToolBar.background",
] as const;

export const ALL_MANAGED_KEYS = [...ALL_CHROME_KEYS, ...SURFACE_BG_KEYS] as const;

export const DEPRECATED_COLOR_KEYS = [
  "sideBar.foreground",
  "sideBarSectionHeader.foreground",
  "list.activeSelectionForeground",
  "list.inactiveSelectionForeground",
  "editor.foreground",
  "editorLineNumber.foreground",
  "editorLineNumber.activeForeground",
  "tab.inactiveForeground",
  "tab.activeForeground",
] as const;

/** Lightness offset between title / activity / status (same hue). */
export const SHADE_DL = 0.035;

const PHI = (1 + Math.sqrt(5)) / 2;
const PHI_SQ = PHI * PHI;
const GOLDEN_ANGLE_DEG = 360 / PHI_SQ;
const INV_PHI = 1 / PHI;

export function parseChromeScope(value: unknown): ChromeScope {
  return value === "headFooter" ? "headFooter" : "all";
}

/** Maps `vscode.ColorThemeKind` (Light = 1, HighContrastLight = 4) to a palette theme kind. */
export function themeKindFromVsCode(kind: unknown): ThemeKind {
  return kind === 1 || kind === 4 ? "light" : "dark";
}

export function hasManagedColorKeys(existing: ColorMap): boolean {
  return ALL_MANAGED_KEYS.some((key) => existing[key] !== undefined);
}

/** Draws until it has `count` unique seeds accepted by `parseRandomSeed`. */
export function generateSeedCandidates(
  nextUint32: () => number,
  count: number,
): number[] {
  const seeds = new Set<number>();
  let attempts = 0;
  const maxAttempts = count * 100;
  while (seeds.size < count && attempts < maxAttempts) {
    attempts++;
    const seed = parseRandomSeed(nextUint32());
    if (seed !== undefined) {
      seeds.add(seed);
    }
  }
  return [...seeds];
}

export function parseRandomSeed(raw: unknown): number | undefined {
  if (
    typeof raw !== "number" ||
    !Number.isInteger(raw) ||
    raw <= 0 ||
    raw > 0xffffffff
  ) {
    return undefined;
  }
  return raw;
}

export function shouldApplyChrome(
  globallyEnabled: boolean,
  workspaceDisabled: boolean,
): boolean {
  return globallyEnabled && !workspaceDisabled;
}

/** Stable hash from workspace folder identity (path tail + full path salt). */
export function hashWorkspaceIdentity(folderPath: string): number {
  let normalized = folderPath.replace(/\\/g, "/").toLowerCase();
  if (normalized.length > MAX_FOLDER_PATH_LEN) {
    normalized = normalized.slice(0, MAX_FOLDER_PATH_LEN);
  }
  let h = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function goldenBlend(a: number, b: number, c: number): number {
  const x = a / PHI + b / PHI_SQ + c / (PHI * PHI_SQ);
  return x - Math.floor(x);
}

function hashToUnitTriplet(hash: number): [number, number, number] {
  const h = hash >>> 0;
  const u0 = (h & 0xffffff) / 0xffffff;
  const u1 = ((Math.imul(h, 0x9e3779b9) >>> 0) & 0xffffff) / 0xffffff;
  const u2 = ((Math.imul(h, 0x85ebca6b) >>> 0) & 0xffffff) / 0xffffff;
  return [u0, u1, u2];
}

/** Base HSL for workspace chrome bars (vibrant pastels). */
export function hashToPastelBase(hash: number): { h: number; s: number; l: number } {
  const hue = (hash * GOLDEN_ANGLE_DEG) % 360;
  const [u0, u1, u2] = hashToUnitTriplet(hash);

  const L_MIN = 0.52;
  const L_MAX = 0.7;
  const l = L_MIN + (L_MAX - L_MIN) * goldenBlend(u0, u1, u2);

  const S_MIN = 0.13;
  const S_MAX = 0.29;
  let s = S_MIN + (S_MAX - S_MIN) * goldenBlend(u1, u2, u0);
  const lNorm = (l - L_MIN) / (L_MAX - L_MIN);
  s *= 1 - lNorm * INV_PHI * 0.4;

  return { h: hue, s, l };
}

/**
 * HSL to `#rrggbb`. Saturation and lightness are clamped to 0..1 first, since
 * derived surfaces scale them and can step past the valid range.
 */
export function hslToHex(h: number, s: number, l: number): string {
  s = Math.min(1, Math.max(0, s));
  l = Math.min(1, Math.max(0, l));
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c);
  };
  const r = f(0);
  const g = f(8);
  const b = f(4);
  return `#${byteHex(r)}${byteHex(g)}${byteHex(b)}`;
}

function byteHex(n: number): string {
  return n.toString(16).padStart(2, "0");
}

export function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** WCAG 2 contrast ratio between two `#rrggbb` colors, from 1 to 21. */
export function contrastRatio(aHex: string, bHex: string): number {
  const a = relativeLuminance(aHex);
  const b = relativeLuminance(bHex);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** WCAG AA contrast for normal text, required of every bar foreground. */
export const MIN_BAR_CONTRAST = 4.5;

/**
 * Soft near-black or near-white text, whichever contrasts more with the
 * background. Mid-tone backgrounds where neither soft color reaches
 * `MIN_BAR_CONTRAST` get pure black or white instead.
 */
export function contrastingForegroundHex(bgHex: string): string {
  const pick = (dark: string, light: string) =>
    contrastRatio(bgHex, dark) >= contrastRatio(bgHex, light) ? dark : light;
  const soft = pick("#1e1e1e", "#f3f3f3");
  return contrastRatio(bgHex, soft) >= MIN_BAR_CONTRAST ? soft : pick("#000000", "#ffffff");
}

/** `preferred` when it is readable on `bgHex`, otherwise a contrast-derived color. */
export function readableForegroundHex(bgHex: string, preferred?: string): string {
  return preferred !== undefined && contrastRatio(bgHex, preferred) >= MIN_BAR_CONTRAST
    ? preferred
    : contrastingForegroundHex(bgHex);
}

export function clampLightness(l: number): number {
  return Math.min(0.82, Math.max(0.42, l));
}

type Region = {
  bg: typeof TITLE_BG | typeof ACTIVITY_BG | typeof STATUS_BG;
  fg: typeof TITLE_FG | typeof ACTIVITY_FG | typeof STATUS_FG;
  bgHex: string;
  fgHex: string;
};

export type Hsl = { h: number; s: number; l: number };

/** Editor-agnostic colors for a workspace; writers map these to editor-specific keys. */
export type WorkspacePalette = {
  titleBg: string;
  titleFg: string;
  activityBg: string;
  activityFg: string;
  statusBg: string;
  statusFg: string;
  editorBg: string;
  editorHighlightBg: string;
  sidebarBg: string;
  sidebarSectionBg: string;
  tabsHeaderBg: string;
  tabInactiveBg: string;
  tabActiveBg: string;
  panelBg: string;
  terminalBg: string;
  breadcrumbBg: string;
  widgetBg: string;
  listActiveBg: string;
  listHoverBg: string;
  listInactiveBg: string;
  border: string;
};

/**
 * Composes a full palette from per-bar chrome colors and a surface tint.
 * Bar foregrounds are contrast-derived unless `barFg` overrides them; an
 * override that is not readable on a bar falls back to the derived color.
 */
export function composeWorkspacePalette(opts: {
  bars: { title: Hsl; activity: Hsl; status: Hsl };
  surface: { h: number; s: number; editorL?: number };
  themeKind: ThemeKind;
  barFg?: string;
}): WorkspacePalette {
  const { bars, surface, themeKind, barFg } = opts;

  const titleBg = hslToHex(bars.title.h, bars.title.s, bars.title.l);
  const activityBg = hslToHex(bars.activity.h, bars.activity.s, bars.activity.l);
  const statusBg = hslToHex(bars.status.h, bars.status.s, bars.status.l);

  // Surfaces start at the base editor lightness and step away from it: lighter
  // shades in dark themes, darker shades in light themes.
  const isLight = themeKind === "light";
  const editorL = surface.editorL ?? (isLight ? 0.945 : 0.118);
  const dlSign = isLight ? -1 : 1;
  const surf = (sat: number, dl: number) =>
    hslToHex(surface.h, surface.s * sat, editorL + dlSign * dl);

  const editorBg = surf(0.55, 0);

  return {
    titleBg,
    titleFg: readableForegroundHex(titleBg, barFg),
    activityBg,
    activityFg: readableForegroundHex(activityBg, barFg),
    statusBg,
    statusFg: readableForegroundHex(statusBg, barFg),
    editorBg,
    editorHighlightBg: surf(0.7, 0.008),
    sidebarBg: surf(1.0, 0.027),
    sidebarSectionBg: surf(1.0, 0.04),
    tabsHeaderBg: surf(0.65, 0.058),
    tabInactiveBg: surf(0.6, 0.058),
    tabActiveBg: editorBg,
    panelBg: surf(0.45, 0),
    terminalBg: editorBg,
    breadcrumbBg: surf(0.55, 0.005),
    widgetBg: surf(0.6, 0.027),
    listActiveBg: surf(1.1, 0.05),
    listHoverBg: surf(0.8, 0.02),
    listInactiveBg: surf(0.9, 0.028),
    border: surf(0.4, 0.149),
  };
}

export function computeWorkspacePalette(
  hash: number,
  themeKind: ThemeKind = "dark",
): WorkspacePalette {
  const { h, s, l } = hashToPastelBase(hash);
  return composeWorkspacePalette({
    bars: {
      title: { h, s, l: clampLightness(l - SHADE_DL) },
      activity: { h, s, l: clampLightness(l) },
      status: { h, s, l: clampLightness(l + SHADE_DL) },
    },
    surface: { h, s: Math.min(s * 1.6, 0.4) },
    themeKind,
  });
}

export function buildColorCustomizations(opts: {
  hash: number;
  scope: ChromeScope;
  existing: ColorMap;
  themeKind?: ThemeKind;
}): ColorMap {
  const { hash, scope, existing, themeKind = "dark" } = opts;
  return buildColorCustomizationsFromPalette({
    palette: computeWorkspacePalette(hash, themeKind),
    scope,
    existing,
  });
}

export function buildColorCustomizationsFromPalette(opts: {
  palette: WorkspacePalette;
  scope: ChromeScope;
  existing: ColorMap;
}): ColorMap {
  const { palette: p, scope, existing } = opts;

  const regionsAll: Region[] = [
    { bg: TITLE_BG, fg: TITLE_FG, bgHex: p.titleBg, fgHex: p.titleFg },
    { bg: ACTIVITY_BG, fg: ACTIVITY_FG, bgHex: p.activityBg, fgHex: p.activityFg },
    { bg: STATUS_BG, fg: STATUS_FG, bgHex: p.statusBg, fgHex: p.statusFg },
  ];
  const regions: Region[] =
    scope === "all" ? regionsAll : regionsAll.filter((r) => r.bg !== ACTIVITY_BG);

  const activeBgKeys = new Set(regions.map((r) => r.bg));
  const activeFgKeys = new Set(regions.map((r) => r.fg));
  const activeKeys = new Set<string>([...activeBgKeys, ...activeFgKeys]);

  const next: ColorMap = { ...existing };

  for (const key of DEPRECATED_COLOR_KEYS) {
    delete next[key];
  }
  for (const key of ALL_CHROME_KEYS) {
    if (!activeKeys.has(key)) {
      delete next[key];
    }
  }

  for (const r of regions) {
    next[r.bg] = r.bgHex;
    next[r.fg] = r.fgHex;
  }

  if (scope === "all") {
    next["sideBar.background"] = p.sidebarBg;
    next["sideBar.border"] = p.border;
    next["sideBarSectionHeader.background"] = p.sidebarSectionBg;
    next["sideBarSectionHeader.border"] = p.border;
    next["list.activeSelectionBackground"] = p.listActiveBg;
    next["list.hoverBackground"] = p.listHoverBg;
    next["list.inactiveSelectionBackground"] = p.listInactiveBg;
    next["editor.background"] = p.editorBg;
    next["editor.lineHighlightBackground"] = p.editorHighlightBg;
    next["editorGutter.background"] = p.editorBg;
    next["editorGroupHeader.tabsBackground"] = p.tabsHeaderBg;
    next["editorGroupHeader.noTabsBackground"] = p.tabsHeaderBg;
    next["tab.inactiveBackground"] = p.tabInactiveBg;
    next["tab.activeBackground"] = p.tabActiveBg;
    next["tab.border"] = p.border;
    next["tab.activeBorder"] = p.border;
    next["panel.background"] = p.panelBg;
    next["panel.border"] = p.border;
    next["terminal.background"] = p.terminalBg;
    next["breadcrumb.background"] = p.breadcrumbBg;
    next["editorWidget.background"] = p.widgetBg;
    next["editorWidget.border"] = p.border;
    next["editorGroup.border"] = p.border;
    next["activityBar.border"] = p.border;
    next["titleBar.border"] = p.border;
    next["statusBar.border"] = p.border;
    next["welcomePage.background"] = p.editorBg;
    next["welcomePage.tileBackground"] = p.sidebarBg;
    next["walkThrough.embeddedEditorBackground"] = p.editorBg;
    next["editorGroup.emptyBackground"] = p.editorBg;
    next["editorPane.background"] = p.editorBg;
    next["sideBarTitle.background"] = p.sidebarBg;
    next["panelTitle.activeBorder"] = p.border;
    next["textBlockQuote.background"] = p.sidebarBg;
    next["input.background"] = p.sidebarBg;
    next["dropdown.background"] = p.sidebarBg;
    next["quickInput.background"] = p.widgetBg;
    next["notifications.background"] = p.widgetBg;
    next["debugToolBar.background"] = p.widgetBg;
  } else {
    for (const key of SURFACE_BG_KEYS) {
      delete next[key];
    }
  }

  return next;
}

export function stripManagedColorCustomizations(existing: ColorMap): ColorMap {
  const next: ColorMap = { ...existing };
  for (const key of ALL_MANAGED_KEYS) {
    delete next[key];
  }
  for (const key of DEPRECATED_COLOR_KEYS) {
    delete next[key];
  }
  return Object.keys(next).length ? next : {};
}
