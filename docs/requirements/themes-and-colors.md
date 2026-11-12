# Themes, colors, and favorites

## Purpose

Let a workspace use a fixed look instead of the derived one: a named theme,
a picked color, or a custom theme, and cycle saved looks.

## Requirements

- **THEME-1** — `auto-color.theme` is `auto` (default, derived), one of the
  33 named theme ids, `color`, or `custom`; the setting's enum lists every
  preset plus `color` and `custom`, in order. A missing or unknown value
  means `auto`.
- **THEME-2** — The theme picker lists Auto first and every named theme
  exactly once, each with a label and description, plus each valid custom
  theme as `Custom: <name>`.
- **THEME-3** — A named theme paints a fixed palette; the identity and seed
  are ignored. Themes with a fixed style force their own light or dark
  surfaces; Rainbow follows the active theme kind and gives each bar a
  distinct color.
- **THEME-4** — `auto-color.color` accepts one of 12 common color names
  (red, orange, yellow, green, teal, cyan, blue, indigo, purple, pink,
  brown, gray) in any case, or a `#rgb` / `#rrggbb` hex; Auto Color builds
  the full palette around it, keeping its hue and readable bars.
- **THEME-5** — Color parsing rejects malformed values, non-strings, and
  prototype keys (such as `constructor`).
- **THEME-6** — `auto-color.customThemes` maps a name to a palette: `title`
  is required; `activity` defaults to `title`, `status` to `activity`;
  `surface`, `foreground`, and `kind` (`dark` or `light`) are optional. A
  theme without `kind` follows the active theme kind.
- **THEME-7** — Invalid custom themes are skipped with a warning naming
  each error; valid themes in the same map still apply. A non-object root
  is reported. Selecting an undefined custom theme fails with its name.
- **THEME-8** — A color choice has one string form: `auto`, `seed:<n>`, a
  theme id, `#rrggbb`, or `custom:<name>`. Parsing and formatting
  round-trip for every kind, and garbage is rejected.
- **THEME-9** — **Add current colors to favorites** saves the workspace's
  current choice to the user setting `auto-color.favorites`; **Next
  favorite** cycles the workspace through them; **Remove a favorite**
  deletes a picked entry.

## Out of scope

- Exact reproductions of third-party color schemes; community-named themes
  are approximations.

## Where it lives

- Code: `src/core/themes.ts`, `src/core/colors.ts`, `src/core/choice.ts`,
  `src/extension.ts`.
- Tests: `src/core/themes.test.ts`, `src/core/colors.test.ts`,
  `src/core/choice.test.ts`.
- No automated test: THEME-9 (favorites commands, in `src/extension.ts`).
