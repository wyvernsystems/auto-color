# Palette engine

## Purpose

Compute one workspace's bar colors and workbench tint, identically for the
extension and every editor writer.

## Requirements

- **PAL-1** — The default palette is a pastel derived from a hash of the
  workspace identity (IDENT-1). The same identity always yields the same
  palette; path casing and slash direction do not change the hash, and
  identities are truncated to a fixed maximum length before hashing.
- **PAL-2** — A non-zero `auto-color.randomSeed` (a valid uint32) replaces
  the identity hash; `0` or an invalid value means derive from the
  identity. Randomize offers unique, non-zero candidate seeds.
- **PAL-3** — Surfaces follow the active color theme: dark themes get dark
  tinted surfaces, light and high-contrast-light themes get light ones.
  Switching theme kind changes the surfaces only, never the bar colors.
- **PAL-4** — `auto-color.scope` `all` paints the title, activity, and
  status bars plus the workbench tint; `headFooter` paints only the title
  and status bars and clears any activity and surface keys left from `all`.
  A missing or unknown scope means `all`.
- **PAL-5** — Every bar's foreground meets WCAG AA contrast (4.5:1) against
  its background, for derived palettes, every named theme in both theme
  kinds, picked colors, custom themes, and branch and environment overlays.
  An unreadable foreground override falls back to black or white text.
- **PAL-6** — Painting writes only the managed keys (`ALL_MANAGED_KEYS`)
  into `workbench.colorCustomizations`, keeps every other key in that
  object, and drops the deprecated keys it used to set
  (`DEPRECATED_COLOR_KEYS`). Painting is idempotent.
- **PAL-7** — Clearing removes only managed and deprecated keys and leaves
  every other customization.
- **PAL-8** — The extension and every writer produce identical colors for
  the same identity, seed, scope, theme, and choice by sharing the `core`
  computations (`computeWorkspacePalette`, `computeThemePresetPalette`,
  `computeChoicePalette`); none re-derives them.
- **PAL-9** — Painting happens only while Auto Color is enabled globally
  (`auto-color.enabled`) and not disabled for the workspace
  (`auto-color.workspaceDisabled`).
- **PAL-10** — Every computed color is a valid lowercase six-digit hex,
  with out-of-range inputs clamped.

## Out of scope

- Changing syntax or text colors; Auto Color tints backgrounds and bars.

## Where it lives

- Code: `src/core/palette.ts`, `src/core/choice.ts`.
- Tests: `src/core/palette.test.ts`, `src/core/choice.test.ts`.
