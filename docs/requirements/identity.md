# Workspace identity

## Purpose

Decide what a workspace's default color is derived from, so a project keeps
its color across reloads and, optionally, across machines and clones.

## Requirements

- **IDENT-1** — `auto-color.identitySource` selects the identity: `path`
  (default) is the folder path, `folderName` its last path segment, and
  `gitRemote` the normalized `origin` remote URL. A missing or unknown
  value means `path`.
- **IDENT-2** — A multi-root workspace is one workspace; its identity comes
  from the first folder.
- **IDENT-3** — `folderName` handles Unix and Windows paths and ignores
  trailing separators.
- **IDENT-4** — `gitRemote` reads only the `url` of the `origin` remote in
  `.git/config`, ignoring other remotes. HTTPS and scp-style SSH URLs of
  the same repository normalize to one identity (lowercase host and path,
  no `.git` suffix, credentials, or trailing slash).
- **IDENT-5** — `gitRemote` falls back to the folder name when the remote
  cannot be read: no `origin` URL, or a linked worktree whose `.git` is a
  file, which is not followed.

## Out of scope

- Following git worktree `.git` files or reading any git data beyond the
  `origin` URL and `HEAD` (ALERT-1).

## Where it lives

- Code: `src/core/workspace-identity.ts`, `src/extension.ts`,
  `src/cli/main.ts`.
- Tests: `src/core/workspace-identity.test.ts`, `src/cli/main.test.ts`.
- No automated test: IDENT-2 and IDENT-5 (the fallback and first-folder
  choice live in `src/extension.ts`, which has no unit tests).
