# Changelog

All notable changes to **Auto Color** will be documented in this file.

## [Unreleased]

### Fixed

- Automatic coloring now remains blocked until workspace-file checks finish and fails closed on filesystem errors instead of treating every error as a missing settings file.
- Invalid random seeds from manually edited settings are rejected unless they are whole numbers in the documented unsigned 32-bit range.

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
