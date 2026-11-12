# CLI (`auto-color-cli`)

## Purpose

Write a project's Auto Color palette into the native settings of every
supported editor, so the project looks the same everywhere.

## Requirements

- **CLI-1** — `auto-color <dir>` writes the palette for each editor whose
  config directory it detects (`.vscode`, `.zed`); `--targets vscode,zed`
  overrides detection and creates the editor directory. With no editor
  detected or targeted it fails with guidance.
- **CLI-2** — Flags mirror the extension: `--source path|folderName|gitRemote`,
  `--scope all|headFooter`, `--seed N`, `--color <hex|name>`, and `--theme`
  as `dark` (default), `light`, or any named theme id except `auto`.
  `--help` prints usage.
- **CLI-3** — Invalid flag values throw with the accepted values instead of
  falling back to defaults. `--color` cannot be combined with `--seed` or a
  named theme; it may be combined with `dark` or `light`.
- **CLI-4** — `--dry-run` reports what would change and writes nothing.
- **CLI-5** — `--remove` takes out only Auto Color's managed keys and drops
  an emptied color object.
- **CLI-6** — The CLI merges only into files it can parse as strict JSON; a
  file it cannot parse (for example, one with comments), or one whose
  color object is not an object, is left alone with a message. It never
  touches keys it does not own.
- **CLI-7** — A target that fails does not block the others, and the run
  reports the failure.
- **CLI-8** — The VS Code writer targets `.vscode/settings.json`
  `workbench.colorCustomizations`; the Zed writer targets
  `.zed/settings.json` `experimental.theme_overrides`, writing bars and
  surfaces for `all` and only title and status bars for `headFooter`.
- **CLI-9** — `npm run package:cli` builds `dist/cli-package/` as
  `auto-color-cli`, with the `auto-color` bin, the root version, no tests,
  and nothing that depends on `vscode`; the packaged CLI runs `--help`.

## Out of scope

- Reading or writing comment-bearing settings files.
- Editors other than the VS Code family and Zed.

## Where it lives

- Code: `src/cli.ts`, `src/cli/`, `src/writers/`,
  `scripts/build-cli-package.mjs`, `cli-package/README.md`.
- Tests: `src/cli/main.test.ts`, `src/cli/options.test.ts`,
  `src/cli/package.test.ts`, `src/writers/vscode-settings.test.ts`,
  `src/writers/zed-settings.test.ts`.
