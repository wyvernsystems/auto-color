/** Avoid hashing megabyte paths (pathological workspace roots). */
export const MAX_FOLDER_PATH_LEN = 4096;

export type ChromeScope = "all" | "headFooter";

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

export function parseRandomSeed(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return undefined;
  }
  const u = raw >>> 0;
  return u === 0 ? undefined : u;
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

export function hslToHex(h: number, s: number, l: number): string {
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

export function contrastingForegroundHex(bgHex: string): string {
  const lum = relativeLuminance(bgHex);
  return lum > 0.45 ? "#1e1e1e" : "#f3f3f3";
}

export function clampLightness(l: number): number {
  return Math.min(0.82, Math.max(0.42, l));
}

type Region = {
  bg: typeof TITLE_BG | typeof ACTIVITY_BG | typeof STATUS_BG;
  fg: typeof TITLE_FG | typeof ACTIVITY_FG | typeof STATUS_FG;
  bgHex: string;
};

export function buildColorCustomizations(opts: {
  hash: number;
  scope: ChromeScope;
  existing: ColorMap;
}): ColorMap {
  const { hash, scope, existing } = opts;
  const { h, s, l } = hashToPastelBase(hash);

  const titleBgHex = hslToHex(h, s, clampLightness(l - SHADE_DL));
  const activityBgHex = hslToHex(h, s, clampLightness(l));
  const statusBgHex = hslToHex(h, s, clampLightness(l + SHADE_DL));

  const tintS = Math.min(s * 1.6, 0.4);
  const editorL = 0.118;
  const surf = (sat: number, dl: number) => hslToHex(h, tintS * sat, editorL + dl);

  const editorBg = surf(0.55, 0);
  const editorHighlightBg = surf(0.7, 0.008);
  const sidebarBg = surf(1.0, 0.027);
  const sidebarSectionBg = surf(1.0, 0.04);
  const tabsHeaderBg = surf(0.65, 0.058);
  const tabInactiveBg = surf(0.6, 0.058);
  const tabActiveBg = editorBg;
  const panelBg = surf(0.45, 0);
  const terminalBg = editorBg;
  const breadcrumbBg = surf(0.55, 0.005);
  const widgetBg = surf(0.6, 0.027);
  const listActiveBg = surf(1.1, 0.05);
  const listHoverBg = surf(0.8, 0.02);
  const listInactiveBg = surf(0.9, 0.028);
  const borderHex = surf(0.4, 0.149);

  const regionsAll: Region[] = [
    { bg: TITLE_BG, fg: TITLE_FG, bgHex: titleBgHex },
    { bg: ACTIVITY_BG, fg: ACTIVITY_FG, bgHex: activityBgHex },
    { bg: STATUS_BG, fg: STATUS_FG, bgHex: statusBgHex },
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
    next[r.fg] = contrastingForegroundHex(r.bgHex);
  }

  if (scope === "all") {
    next["sideBar.background"] = sidebarBg;
    next["sideBar.border"] = borderHex;
    next["sideBarSectionHeader.background"] = sidebarSectionBg;
    next["sideBarSectionHeader.border"] = borderHex;
    next["list.activeSelectionBackground"] = listActiveBg;
    next["list.hoverBackground"] = listHoverBg;
    next["list.inactiveSelectionBackground"] = listInactiveBg;
    next["editor.background"] = editorBg;
    next["editor.lineHighlightBackground"] = editorHighlightBg;
    next["editorGutter.background"] = editorBg;
    next["editorGroupHeader.tabsBackground"] = tabsHeaderBg;
    next["editorGroupHeader.noTabsBackground"] = tabsHeaderBg;
    next["tab.inactiveBackground"] = tabInactiveBg;
    next["tab.activeBackground"] = tabActiveBg;
    next["tab.border"] = borderHex;
    next["tab.activeBorder"] = borderHex;
    next["panel.background"] = panelBg;
    next["panel.border"] = borderHex;
    next["terminal.background"] = terminalBg;
    next["breadcrumb.background"] = breadcrumbBg;
    next["editorWidget.background"] = widgetBg;
    next["editorWidget.border"] = borderHex;
    next["editorGroup.border"] = borderHex;
    next["activityBar.border"] = borderHex;
    next["titleBar.border"] = borderHex;
    next["statusBar.border"] = borderHex;
    next["welcomePage.background"] = editorBg;
    next["welcomePage.tileBackground"] = sidebarBg;
    next["walkThrough.embeddedEditorBackground"] = editorBg;
    next["editorGroup.emptyBackground"] = editorBg;
    next["editorPane.background"] = editorBg;
    next["sideBarTitle.background"] = sidebarBg;
    next["panelTitle.activeBorder"] = borderHex;
    next["textBlockQuote.background"] = sidebarBg;
    next["input.background"] = sidebarBg;
    next["dropdown.background"] = sidebarBg;
    next["quickInput.background"] = widgetBg;
    next["notifications.background"] = widgetBg;
    next["debugToolBar.background"] = widgetBg;
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
