import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildColorCustomizations,
  buildColorCustomizationsFromPalette,
  hashWorkspaceIdentity,
  TITLE_BG,
  TITLE_FG,
} from "../core/palette";
import { computeThemePresetPalette } from "../core/themes";
import {
  renderVsCodeSettings,
  VSCODE_SETTINGS_PATH,
} from "./vscode-settings";

const HEX = /^#[0-9a-f]{6}$/;
const hash = hashWorkspaceIdentity("/Users/ron/project");

function colorsOf(text: string): Record<string, string> {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  return (parsed["workbench.colorCustomizations"] ?? {}) as Record<
    string,
    string
  >;
}

describe("renderVsCodeSettings", () => {
  it("exposes the workspace-relative settings path", () => {
    assert.equal(VSCODE_SETTINGS_PATH, ".vscode/settings.json");
  });

  it("creates settings with color customizations when no file exists", () => {
    const text = renderVsCodeSettings({
      existingText: undefined,
      hash,
      scope: "all",
      themeKind: "dark",
    });
    assert.ok(text.endsWith("\n"));
    assert.match(colorsOf(text)[TITLE_BG] ?? "", HEX);
  });

  it("produces exactly the extension's color map", () => {
    const text = renderVsCodeSettings({
      existingText: '{"workbench.colorCustomizations":{"editor.cursor":"#ff0000"}}',
      hash,
      scope: "all",
      themeKind: "light",
    });
    assert.deepEqual(
      colorsOf(text),
      buildColorCustomizations({
        hash,
        scope: "all",
        existing: { "editor.cursor": "#ff0000" },
        themeKind: "light",
      }),
    );
  });

  it("paints the named theme palette when a preset is given", () => {
    const text = renderVsCodeSettings({
      existingText: undefined,
      hash,
      scope: "all",
      themeKind: "dark",
      preset: "matrix",
    });
    const colors = colorsOf(text);
    assert.equal(colors[TITLE_FG], "#00ff41");
    assert.deepEqual(
      colors,
      buildColorCustomizationsFromPalette({
        palette: computeThemePresetPalette("matrix", "dark"),
        scope: "all",
        existing: {},
      }),
    );
  });

  it("preserves unrelated settings keys", () => {
    const text = renderVsCodeSettings({
      existingText: '{"editor.fontSize":14}',
      hash,
      scope: "all",
      themeKind: "dark",
    });
    const parsed = JSON.parse(text) as Record<string, unknown>;
    assert.equal(parsed["editor.fontSize"], 14);
  });

  it("throws when the file cannot be parsed as strict JSON", () => {
    assert.throws(
      () =>
        renderVsCodeSettings({
          existingText: '{\n  // comment\n  "a": 1\n}',
          hash,
          scope: "all",
          themeKind: "dark",
        }),
      /settings/i,
    );
  });

  it("throws when colorCustomizations is not an object", () => {
    assert.throws(() =>
      renderVsCodeSettings({
        existingText: '{"workbench.colorCustomizations":"oops"}',
        hash,
        scope: "all",
        themeKind: "dark",
      }),
    );
  });

  it("removes only managed keys and drops an emptied color object", () => {
    const painted = renderVsCodeSettings({
      existingText: '{"editor.fontSize":14}',
      hash,
      scope: "all",
      themeKind: "dark",
    });
    const removed = renderVsCodeSettings({
      existingText: painted,
      hash,
      scope: "all",
      themeKind: "dark",
      remove: true,
    });
    const parsed = JSON.parse(removed) as Record<string, unknown>;
    assert.equal(parsed["editor.fontSize"], 14);
    assert.equal("workbench.colorCustomizations" in parsed, false);

    const withUserColor = renderVsCodeSettings({
      existingText:
        '{"workbench.colorCustomizations":{"editor.cursor":"#ff0000","titleBar.activeBackground":"#aabbcc"}}',
      hash,
      scope: "all",
      themeKind: "dark",
      remove: true,
    });
    assert.deepEqual(colorsOf(withUserColor), { "editor.cursor": "#ff0000" });
  });
});
