# Workspace settings writes

## Purpose

Write colors only when the user wants them, never overwrite their settings,
and respect them taking colors out.

## Requirements

- **WRITE-1** — On window open, Auto Color never writes when the workspace
  already has user-owned settings: a `.vscode/settings.json`, a
  `.code-workspace` with a non-empty `settings` block, a `.vscode/settings.json`
  in any folder of a multi-root workspace, or existing
  `workbench.colorCustomizations` at workspace or folder level. Commands
  may still write.
- **WRITE-2** — With no workspace settings file, Auto Color paints on load
  and creates `.vscode/settings.json`.
- **WRITE-3** — Workspace-file checks fail closed: malformed or unexpected
  `.code-workspace` JSON blocks automatic writes.
- **WRITE-4** — Automatic writes are denied until a refresh confirms the
  workspace is unblocked; a slower, older refresh never overrides a newer
  result.
- **WRITE-5** — When a workspace Auto Color painted no longer has its
  managed colors (the user deleted the keys or the file), Auto Color does
  not add them back, including after a reload or theme switch, until a
  command asks again.
- **WRITE-6** — Settings writes merge Auto Color's managed keys into
  `workbench.colorCustomizations` and leave everything else in the file
  untouched (PAL-6). Disabling or clearing removes only managed keys
  (PAL-7).
- **WRITE-7** — Auto Color ignores the settings-change events caused by its
  own recent writes, so they do not trigger another paint.
- **WRITE-8** — A missing settings file counts as absent only for an
  explicit `FileNotFound` error; any other filesystem error is reported
  with the affected path.

## Out of scope

- Merging into or reformatting settings outside
  `workbench.colorCustomizations`.

## Where it lives

- Code: `src/workspace-eligibility.ts`, `src/core/settings-shape.ts`,
  `src/extension.ts`.
- Tests: `src/workspace-eligibility.test.ts`,
  `src/core/settings-shape.test.ts`.
- No automated test: WRITE-2 and WRITE-6 (the write path in
  `src/extension.ts`; the merge itself is tested as PAL-6 and PAL-7).
