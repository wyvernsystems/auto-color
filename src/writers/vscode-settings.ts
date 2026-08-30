import {
  buildColorCustomizationsFromPalette,
  stripManagedColorCustomizations,
  type ChromeScope,
  type ColorMap,
  type ThemeKind,
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

export const VSCODE_SETTINGS_PATH = ".vscode/settings.json";

const COLORS_KEY = "workbench.colorCustomizations";

/**
 * Renders `.vscode/settings.json` with this workspace's colors merged in
 * (or removed), producing exactly the color map the extension would write.
 */
export function renderVsCodeSettings(opts: {
  existingText: string | undefined;
  hash: number;
  scope: ChromeScope;
  themeKind: ThemeKind;
  preset?: NamedThemePreset;
  remove?: boolean;
}): string {
  const { existingText, hash, scope, themeKind, preset, remove = false } = opts;
  const settings = parseSettingsObject(existingText, VSCODE_SETTINGS_PATH);
  const existing = sectionObject(
    settings,
    COLORS_KEY,
    VSCODE_SETTINGS_PATH,
  ) as ColorMap;

  const next = remove
    ? stripManagedColorCustomizations(existing)
    : buildColorCustomizationsFromPalette({
        palette: computePaletteWithPreset({ hash, themeKind, preset }),
        scope,
        existing,
      });

  if (Object.keys(next).length) {
    settings[COLORS_KEY] = next;
  } else {
    delete settings[COLORS_KEY];
  }
  return stringifySettingsObject(settings);
}
