# Agent notes

Facts about this repo that an AI coding agent needs and cannot infer from a
single file.

## Commands

- `npm test` — cleans `out/`, compiles with `tsc`, and runs the unit tests (`node --test "out/**/*.test.js"`). This is also the type check; there is no separate lint step and no ESLint config. CI (`.github/workflows/ci.yml`) runs exactly this.
- `npm run compile` — type-check and emit to `out/` (extension entry `out/extension.js`, CLI entry `out/cli.js`).
- `npm run package` — build the VSIX with `vsce`.

## Layout and conventions

- `src/core/` is the pure, editor-agnostic engine — color math (`palette.ts`, including `computeWorkspacePalette`), named theme presets (`themes.ts`), workspace identity (`workspace-identity.ts`) — with no `vscode` or `node:fs` imports.
- `src/writers/` renders `core` palettes into one editor's settings-file format as pure text-to-text functions (`vscode-settings.ts`, `zed-settings.ts`). A new editor means a new writer here plus a `TARGETS` entry in `src/cli/main.ts`.
- `src/cli/` + `src/cli.ts` are the `auto-color` CLI (bin entry `out/cli.js`); `src/extension.ts` and `src/workspace-eligibility.ts` are the VS Code extension. Both are thin consumers of `core`.
- The extension and every writer must produce identical colors for the same hash/scope/theme/preset — share `core` computations (`computeWorkspacePalette`, `computeThemePresetPalette`), never re-derive them.
- Tests are colocated (`src/**/foo.test.ts`) and use `node:test` with `node:assert/strict`. CLI end-to-end tests run against temp dirs (`src/cli/main.test.ts`).
- The `.vscodeignore` excludes `out/cli*` and `out/writers/**` from the VSIX; keep it in sync when adding top-level output.
- The engineering rules under `.claude/rules/ai-rules/` are mirrored per tool in `.cursor/rules/`, `.clinerules/`, and `.opencode/rules/` by the AI Rulebook extension. Treat `.claude/rules/ai-rules/` as one mirror among equals; do not edit one mirror without the others.

## Behavior invariants

- The extension must never automatically write workspace settings when a user-owned `.vscode/settings.json`, a `.code-workspace` `settings` block, or existing `workbench.colorCustomizations` are present (see `AutomaticWriteGate`). Commands may write; window-open sync may not.
- Writes touch only the managed keys in `src/core/palette.ts` (`ALL_MANAGED_KEYS`, `DEPRECATED_COLOR_KEYS`) and, for Zed, `ZED_MANAGED_KEYS` in `src/writers/zed-settings.ts`; everything else in the user's settings must survive untouched.
