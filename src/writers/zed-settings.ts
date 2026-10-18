import {
  type ChromeScope,
  type ThemeKind,
  type WorkspacePalette,
} from "../core/palette";
import {
  computePaletteWithPreset,
  type NamedThemePreset,
} from "../core/themes";
import {
  parseSettingsObject,
  sectionObject,
  stringifySettingsObject,
} from "./settings-json";

export const ZED_SETTINGS_PATH = ".zed/settings.json";

const OVERRIDES_KEY = "experimental.theme_overrides";

/** Zed theme-override keys this writer owns; removal clears exactly these. */
export const ZED_MANAGED_KEYS = [
  "title_bar.background",
  "status_bar.background",
  "background",
  "surface.background",
  "elevated_surface.background",
  "editor.background",
  "editor.active_line.background",
  "tab_bar.background",
  "tab.active_background",
  "tab.inactive_background",
  "panel.background",
  "terminal.background",
  "toolbar.background",
  "border",
  "border.variant",
] as const;

/**
 * Renders `.zed/settings.json` with this workspace's colors as
 * `experimental.theme_overrides` (or removed). Uses the same palette math as
 * the VS Code extension so both editors show the same workspace color.
 */
export function renderZedSettings(opts: {
  existingText: string | undefined;
  hash: number;
  scope: ChromeScope;
  themeKind: ThemeKind;
  preset?: NamedThemePreset;
  /** Explicit palette (e.g. from `--color`); wins over `preset` and `hash`. */
  palette?: WorkspacePalette;
  remove?: boolean;
}): string {
  const { existingText, hash, scope, themeKind, preset, palette, remove = false } = opts;
  const settings = parseSettingsObject(existingText, ZED_SETTINGS_PATH);
  const overrides = sectionObject(settings, OVERRIDES_KEY, ZED_SETTINGS_PATH);

  for (const key of ZED_MANAGED_KEYS) {
    delete overrides[key];
  }

  if (!remove) {
    const p = palette ?? computePaletteWithPreset({ hash, themeKind, preset });
    overrides["title_bar.background"] = p.titleBg;
    overrides["status_bar.background"] = p.statusBg;
    if (scope === "all") {
      overrides["background"] = p.sidebarBg;
      overrides["surface.background"] = p.sidebarBg;
      overrides["elevated_surface.background"] = p.widgetBg;
      overrides["editor.background"] = p.editorBg;
      overrides["editor.active_line.background"] = p.editorHighlightBg;
      overrides["tab_bar.background"] = p.tabsHeaderBg;
      overrides["tab.active_background"] = p.tabActiveBg;
      overrides["tab.inactive_background"] = p.tabInactiveBg;
      overrides["panel.background"] = p.sidebarBg;
      overrides["terminal.background"] = p.terminalBg;
      overrides["toolbar.background"] = p.breadcrumbBg;
      overrides["border"] = p.border;
      overrides["border.variant"] = p.border;
    }
  }

  if (Object.keys(overrides).length) {
    settings[OVERRIDES_KEY] = overrides;
  } else {
    delete settings[OVERRIDES_KEY];
  }
  return stringifySettingsObject(settings);
}
