# Commands and settings

## Purpose

Give every option both a command and a setting, applied to the current
workspace.

## Requirements

- **CMD-1** — **Enable (all windows)** sets `auto-color.enabled` and paints
  the current workspace if a folder is open; **Disable (all windows)**
  clears it and removes Auto Color's keys from the current workspace.
- **CMD-2** — **Enable / Disable for this workspace** toggle
  `auto-color.workspaceDisabled`; enabling still requires the global
  switch, and disabling removes Auto Color's keys there.
- **CMD-3** — **Set color scope** chooses `all` or `headFooter` (PAL-4).
- **CMD-4** — **Randomize color** opens a picker with live preview: moving
  through candidates applies each, **Enter** keeps one (saved as the seed
  in workspace settings and resetting the theme to Auto), and **Esc**
  restores the previous color.
- **CMD-5** — **Select theme** and **Pick a color** open pickers with live
  preview and the same keep / restore behavior as CMD-4.
- **CMD-6** — **Reset to default color** removes the seed and any
  workspace theme choice, so the color derives from the identity again.
- **CMD-7** — Every command is contributed with an `Auto Color:` title, and
  every option is also a setting in the Settings UI.

## Out of scope

- Requiring Workspace Trust; Auto Color runs in Restricted Mode too.

## Where it lives

- Code: `src/extension.ts`, `package.json` (`contributes`).
- No automated test for any CMD ID: `src/extension.ts` has no unit tests.
