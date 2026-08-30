import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashWorkspaceIdentity, relativeLuminance } from "../core/palette";
import { computeThemePresetPalette } from "../core/themes";
import {
  renderZedSettings,
  ZED_SETTINGS_PATH,
} from "./zed-settings";

const HEX = /^#[0-9a-f]{6}$/;
const hash = hashWorkspaceIdentity("/Users/ron/project");

function overridesOf(text: string): Record<string, string> {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  return (parsed["experimental.theme_overrides"] ?? {}) as Record<
    string,
    string
  >;
}

describe("renderZedSettings", () => {
  it("exposes the workspace-relative settings path", () => {
    assert.equal(ZED_SETTINGS_PATH, ".zed/settings.json");
  });

  it("creates theme overrides for bars and surfaces when scope is all", () => {
    const text = renderZedSettings({
      existingText: undefined,
      hash,
      scope: "all",
      themeKind: "dark",
    });
    const overrides = overridesOf(text);
    assert.match(overrides["title_bar.background"] ?? "", HEX);
    assert.match(overrides["status_bar.background"] ?? "", HEX);
    assert.match(overrides["editor.background"] ?? "", HEX);
    assert.match(overrides["tab_bar.background"] ?? "", HEX);
    assert.ok(relativeLuminance(overrides["editor.background"]!) < 0.1);
  });

  it("writes only the title and status bars when scope is headFooter", () => {
    const overrides = overridesOf(
      renderZedSettings({
        existingText: undefined,
        hash,
        scope: "headFooter",
        themeKind: "dark",
      }),
    );
    assert.deepEqual(Object.keys(overrides).sort(), [
      "status_bar.background",
      "title_bar.background",
    ]);
  });

  it("paints the named theme palette when a preset is given", () => {
    const overrides = overridesOf(
      renderZedSettings({
        existingText: undefined,
        hash,
        scope: "all",
        themeKind: "dark",
        preset: "matrix",
      }),
    );
    const palette = computeThemePresetPalette("matrix", "dark");
    assert.equal(overrides["title_bar.background"], palette.titleBg);
    assert.equal(overrides["editor.background"], palette.editorBg);
  });

  it("uses light surfaces when themeKind is light", () => {
    const overrides = overridesOf(
      renderZedSettings({
        existingText: undefined,
        hash,
        scope: "all",
        themeKind: "light",
      }),
    );
    assert.ok(relativeLuminance(overrides["editor.background"]!) > 0.7);
  });

  it("preserves unrelated settings and unrelated override keys", () => {
    const text = renderZedSettings({
      existingText:
        '{"theme":"One Dark","experimental.theme_overrides":{"text":"#123456"}}',
      hash,
      scope: "all",
      themeKind: "dark",
    });
    const parsed = JSON.parse(text) as Record<string, unknown>;
    assert.equal(parsed["theme"], "One Dark");
    assert.equal(overridesOf(text)["text"], "#123456");
  });

  it("throws when the file cannot be parsed as strict JSON", () => {
    assert.throws(
      () =>
        renderZedSettings({
          existingText: '{\n  // comment\n  "theme": "One Dark"\n}',
          hash,
          scope: "all",
          themeKind: "dark",
        }),
      /settings/i,
    );
  });

  it("removes only managed keys and drops an emptied overrides object", () => {
    const painted = renderZedSettings({
      existingText: '{"theme":"One Dark"}',
      hash,
      scope: "all",
      themeKind: "dark",
    });
    const removed = renderZedSettings({
      existingText: painted,
      hash,
      scope: "all",
      themeKind: "dark",
      remove: true,
    });
    const parsed = JSON.parse(removed) as Record<string, unknown>;
    assert.equal(parsed["theme"], "One Dark");
    assert.equal("experimental.theme_overrides" in parsed, false);

    const withUserOverride = renderZedSettings({
      existingText:
        '{"experimental.theme_overrides":{"text":"#123456","title_bar.background":"#aabbcc"}}',
      hash,
      scope: "all",
      themeKind: "dark",
      remove: true,
    });
    assert.deepEqual(overridesOf(withUserOverride), { text: "#123456" });
  });
});
