# Branch and environment colors

## Purpose

Warn when a protected branch is checked out, and mark remote windows.

## Requirements

- **ALERT-1** — With `auto-color.branchAlert` on (default off), while the
  checked-out branch matches `auto-color.protectedBranches`, every bar
  turns `auto-color.branchAlertColor` (default `#c62828`) with readable
  text; surfaces are unchanged. It switches live on checkout by watching
  `.git/HEAD`.
- **ALERT-2** — Branch patterns match the full name; `*` is the only
  wildcard, and regex metacharacters match literally. Defaults are `main`,
  `master`, `production`, `prod`, and `release/*`. No patterns means no
  match.
- **ALERT-3** — `HEAD` parsing reads a branch name (slashes kept, trailing
  newline or CRLF ignored); a detached SHA or unreadable content means no
  branch.
- **ALERT-4** — With `auto-color.environmentColors` on (default), a remote
  window's status bar takes the environment color: SSH amber, Dev
  Container blue, WSL orange, Codespaces purple, Remote Tunnel teal, any
  other remote slate. Title and activity keep the project color; local
  windows are unchanged.
- **ALERT-5** — Branch alert wins over the environment color.
- **ALERT-6** — Overlays never mutate the palette they are applied to.

## Out of scope

- Detecting branches in linked worktrees, where `.git` is a file.

## Where it lives

- Code: `src/core/colors.ts`, `src/extension.ts`.
- Tests: `src/core/colors.test.ts`.
- No automated test: ALERT-5 (overlay order, in `src/extension.ts`).
