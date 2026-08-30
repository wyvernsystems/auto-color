# Changelog

All notable changes to **Auto Color** will be documented in this file.

## [2.0.0] - 2026-08-30

### Added

- **Light themes:** the workbench tint now follows your color theme. Light themes get light tinted surfaces instead of the previous always-dark tint, and colors repaint automatically when you switch themes. Bar colors are unchanged.
- **`auto-color.identitySource` setting:** choose what the default color is derived from — the folder path (default, unchanged behavior), the folder name, or the git origin remote. The last two keep a project's color stable across machines and clones. `gitRemote` falls back to the folder name when the remote can't be read (no origin remote, or a linked git worktree).
- **Randomize color** now opens a palette picker with live preview: browse candidates to see them applied, press Enter to keep one, or Esc to restore the previous color.
- **Named theme palettes:** a new **Auto Color: Select theme** command (and `auto-color.theme` setting) picks a fixed theme palette for the workspace instead of the derived color — Matrix, GitHub Dark, GitHub Light, Dracula, Nord, Solarized Dark/Light, Monokai, Gruvbox Dark, One Dark, Synthwave, Ocean, Sunset, or Rainbow — with the same live-preview picker. **Auto** (the default) keeps the classic workspace-derived color; **Reset to default color** also clears the workspace theme choice.
- **Named themes in the CLI:** the CLI's `--theme` flag now also accepts a named theme (for example `--theme matrix`) in addition to `dark|light`, writing that fixed palette into every detected editor's settings.
- **`auto-color` CLI for other editors:** a command-line tool (in this repo, not yet on npm) that writes the same workspace palette into the native settings of each editor detected in a folder — the VS Code family via `.vscode/settings.json` and Zed via `experimental.theme_overrides` in `.zed/settings.json` — with `--dry-run`, `--remove`, and the same source/scope/theme options as the extension. See **Other editors** in the README.

### Changed

- Creating or deleting `.vscode/settings.json` (or editing the `.code-workspace` file) mid-session now updates automatic-coloring eligibility without reloading the window.
- Manually deleting Auto Color's color lines or settings file now sticks: the workspace remembers it was painted before, so automatic coloring stays off — including after window reloads and theme switches — until you opt back in with a command (for example **Enable for this workspace** or **Randomize color**).

### Fixed

- Automatic coloring now remains blocked until workspace-file checks finish and fails closed on filesystem errors instead of treating every error as a missing settings file.
- Invalid random seeds from manually edited settings are rejected unless they are whole numbers in the documented unsigned 32-bit range.

[2.0.0]: https://github.com/wyvernsystems/auto-color-vscode-extension/releases/tag/v2.0.0

## [1.0.5] - 2026-05-05

### Fixed

- **New window / multi-root:** Do not auto-apply tint when workspace-level `workbench.colorCustomizations` already exists (detected via configuration), or when a multi-root `.code-workspace` keeps colors only in a folder’s `.vscode/settings.json` while workspace `settings` is empty—previously automatic coloring could overwrite existing colors in those cases.

[1.0.5]: https://github.com/wyvernsystems/auto-color-vscode-extension/releases/tag/v1.0.5

## [1.0.4] - 2026-04-14

### Added

- **Existing workspace settings:** If `.vscode/settings.json` is already present, or a multi-root `.code-workspace` file already has a non-empty `settings` object, Auto Color **does not** read or write workspace settings on window open, when workspace folders change, or when `auto-color.*` settings change. That avoids silently merging into or overwriting configuration you already rely on. Run a command when you want the tint—for example **Auto Color: Enable for this workspace**, **Randomize color**, **Reset to default color**, **Set color scope**, or **Enable (all windows)** (with a folder open)—to merge colors into `workbench.colorCustomizations` as before.
- **Greenfield workspaces:** If there is no workspace settings file yet, automatic tint on load is unchanged; the extension still creates `.vscode/settings.json` when it applies colors.

### Changed

- **README:** Expanded **What it does** (when Auto Color stays hands-off vs when you use a command); **File it writes** cross-reference; spelling, grammar, and markdown fixes; **Examples** screenshots wired up again.

[1.0.4]: https://github.com/wyvernsystems/auto-color-vscode-extension/releases/tag/v1.0.4

## [1.0.3] - 2026-04-13

### Changed

- README: **Examples** section at the bottom; removed privacy note under screenshots.

[1.0.3]: https://github.com/wyvernsystems/auto-color-vscode-extension/releases/tag/v1.0.3

## [1.0.2] - 2026-04-13

### Changed

- **Workspace Trust:** Removed `untrustedWorkspaces` manifest restrictions and all trust checks so Auto Color works immediately without requiring the user to trust the workspace (easier default experience). Other hardening (e.g. `crypto` random seed, path length cap, seed validation, `.vscodeignore` patterns) remains.

[1.0.2]: https://github.com/wyvernsystems/auto-color-vscode-extension/releases/tag/v1.0.2

## [1.0.1] - 2026-04-13

### Security

- **Workspace Trust:** `capabilities.untrustedWorkspaces` set to **limited**; workspace-level `auto-color.workspaceDisabled`, `scope`, and `randomSeed` are restricted until the workspace is trusted. No writes to `workbench.colorCustomizations` while untrusted; reapplies after trust is granted.
- **Commands** that mutate workspace settings require a trusted workspace (with user-visible warning otherwise). **Disable (all windows)** warns if workspace keys could not be cleared while untrusted.
- **Random seed:** `randomSeed` validated as finite; **Randomize** uses `crypto.randomBytes` instead of `Math.random`.
- **Path hash:** folder path length capped before hashing to limit CPU work on abnormal paths.
- **Packaging:** `.vscodeignore` excludes common secret filename patterns from the VSIX.
- **Repo:** [SECURITY.md](SECURITY.md), Dependabot for npm, README security summary.

[1.0.1]: https://github.com/wyvernsystems/auto-color-vscode-extension/releases/tag/v1.0.1

## [1.0.0] - 2026-04-13

### Added

- **New Marketplace extension** `WyvernSystemsLLC.auto-color` (package name `auto-color`, display name **Auto Color**).
- Commands and settings use the `auto-color.*` prefix (replaces `autocolor-workspace.*`).

### Notes

- Successor to **AutoColorWorkspace** (`WyvernSystemsLLC.autocolor-workspace`). Migrate by installing **Auto Color**, uninstalling the old extension, and updating User/Workspace JSON: `autocolor-workspace.*` → `auto-color.*` if you had overrides.

[1.0.0]: https://github.com/wyvernsystems/auto-color-vscode-extension/releases/tag/v1.0.0

---

Earlier releases shipped as **AutoColorWorkspace**; history below retains original setting/command names for reference.

## [0.2.1] - 2026-04-13

### Added

- Marketplace **icon** (`images/icon.png`) and README **hero** image (`images/readme-hero.png`)

### Changed

- **README** expanded for Marketplace / repo details (features, tables, artwork note)
- **galleryBanner** tint updated to complement the new artwork

[0.2.1]: https://github.com/wyvernsystems/auto-color-vscode-extension/releases/tag/v0.2.1

## [0.2.0] - 2026-04-13

### Added

- Per-bar **shades** of the same workspace hue (title / activity / status lightness steps)
- Setting `autocolor-workspace.scope`: `all` (default) or `headFooter` (title + status only)
- Command **AutoColorWorkspace: Set color scope** (Quick Pick)

### Removed

- **Reset colors (this workspace)** command (use **Disable for this workspace** or clear keys in settings if needed)

[0.2.0]: https://github.com/wyvernsystems/auto-color-vscode-extension/releases/tag/v0.2.0

## [0.1.0] - 2026-04-11

### Added

- Automatic workspace chrome colors (title bar, activity bar, status bar) from folder-path hash
- Golden-ratio–based pastel palette (golden-angle hue, φ-weighted saturation/lightness)
- Persistence via `workbench.colorCustomizations` in workspace `.vscode/settings.json`
- Commands: global enable/disable, per-workspace enable/disable, reset colors for this workspace
- Settings: `autocolor-workspace.enabled`, `autocolor-workspace.workspaceDisabled`

[0.1.0]: https://github.com/wyvernsystems/auto-color-vscode-extension/releases/tag/v0.1.0
