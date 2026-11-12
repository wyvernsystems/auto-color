# Project constraints

## Purpose

Project-wide constraints every feature must respect.

## Requirements

- **PROJ-1** — License is MIT. Publisher is `WyvernSystemsLLC`; the
  marketplace id is `WyvernSystemsLLC.auto-color`.
- **PROJ-2** — Declared engine is VS Code `^1.85.0`; the CLI package
  declares Node `>=18`.
- **PROJ-3** — No network access: colors are computed locally and nothing
  is sent anywhere, by the extension or the CLI.
- **PROJ-4** — Auto Color reads only workspace folder paths, its settings,
  the settings files it manages, and (for `gitRemote` and branch alert)
  `.git/config` and `.git/HEAD`. It runs no shell commands and reads no
  project source files.
- **PROJ-5** — `src/core/` imports neither `vscode` nor `node:fs`; writers
  are pure text-to-text functions.
- **PROJ-6** — The VSIX excludes CLI and writer output (`out/cli*`,
  `out/writers/**`), tests, and tooling via `.vscodeignore`.
- **PROJ-7** — The marketplace icon is at most 128×128.
- **PROJ-8** — `CHANGELOG.md` follows Keep a Changelog with an
  `[Unreleased]` section at the top.

## Out of scope

- Telemetry or any cloud sync.

## Where it lives

- Code: `package.json`, `.vscodeignore`, `scripts/build-cli-package.mjs`,
  `.github/SECURITY.md`.
- No automated test for any PROJ ID; they are checked in review and at
  release ([`docs/RELEASING.md`](../RELEASING.md)).
