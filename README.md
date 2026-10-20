# Auto Color

Product page: [wyvernsystems.com/products/auto-color](https://wyvernsystems.com/products/auto-color/).

## What it does

Auto Color picks a **color theme per workspace** and applies it to the window: pastel **title, activity, and status** bars and a matching **tint** on the editor, sidebar, tabs, terminal, and related UI. Your syntax theme still controls most text; this mainly changes **backgrounds** so each project looks distinct. The tint follows your color theme—**dark themes get dark tinted surfaces, light themes get light ones**—and repaints automatically when you switch themes. Prefer a fixed look for a workspace? **Auto Color: Select theme** paints a **named theme** instead—one of **32 named themes** (Matrix, Dracula, Nord, Catppuccin, Tokyo Night, and more), a **color you pick**, or your own **custom theme** (see **Commands**, **Colors and custom themes**).

**What counts as a “workspace” here:** whatever VS Code or Cursor treats as the current workspace—almost always **a folder you opened** (**File → Open Folder**). That one folder (and its `.vscode/settings.json`) gets one palette. If you open **another window** with a **different** folder, that’s a **different** workspace and can have a **different** color. A **multi-root workspace** (a `.code-workspace` file with several folders) is still **one** workspace for this extension: colors and settings are stored with that workspace, and the **first** folder in the list is what the default tint is derived from (unless you use **Randomize**).

**Where the default color comes from:** by default, from the **folder path**, so the same folder always gets the same color on your machine. The `auto-color.identitySource` setting can switch that to the **folder name** or the **git origin remote**—useful if you want a repo to keep one color across machines and clones. `gitRemote` falls back to the folder name when the remote can’t be read: no origin remote, or a linked git worktree (whose `.git` is a file this extension does not follow).

**Existing workspace settings:** If `.vscode/settings.json` is already there—or, for a multi-root setup, the workspace JSON already has a **non-empty `settings`** block, **any** folder in that workspace has its own `.vscode/settings.json`, or workspace/folder settings already contain **`workbench.colorCustomizations`** (including colors stored only under a folder while the workspace file’s `settings` is empty)—Auto Color **does not run on window open**. It never touches that file automatically, so nothing is merged or overwritten while you are not asking for a tint. **When you do want colors**, use a command (for example, **Auto Color: Enable for this workspace**, **Randomize**, **Reset to default color**, **Set color scope**, or **Enable (all windows)** with a folder open). Only then does it write workspace settings: it updates **`workbench.colorCustomizations`** by **merging** in its keys next to any you already had in that object. It changes **only** the bar and tint keys it owns (and clears deprecated keys it used to set); everything else in `settings.json` stays as you left it. Disabling Auto Color or clearing colors removes **only** those managed keys, not the rest of your file. **If there is no workspace settings file yet**, it still applies the palette on load and creates **`.vscode/settings.json`**, so a new folder gets a tint without an extra step.

**TL;DR:** It should work when you want it to, not when you don't, and it should make your life easier.

## Why it’s useful (VS Code and Cursor)

**VS Code:** With several windows open, you can see **which folder** you’re in from the bar color and overall cast instead of reading the title.

**Cursor:** Same idea when you run **multiple Cursor windows** (different repos, or one “agent” window and one “editing” window). The tint makes it harder to paste, run terminal commands, or continue the wrong chat in the wrong project.

## File it writes

The extension saves colors through **workspace settings**. That usually creates or updates:

**`.vscode/settings.json`**

Inside that file, it adds a `workbench.colorCustomizations` object with the hex colors for this workspace. Anything else in that file is left alone. If you disable Auto Color for the workspace or turn it off globally, it **removes only the keys it added** (and a few legacy keys), not your whole settings file. **If you delete the color lines or the file yourself**, Auto Color takes the hint and does not add them back — not even after a reload or theme switch — until you ask again with a command such as **Enable for this workspace** or **Randomize color**. If you already have workspace settings and Auto Color does not apply on open, see **What it does** above.

## Security

- **No network** — colors are computed locally; nothing is sent to a server.
- **No trust prompt required** — Auto Color runs without asking you to “trust” the workspace first.
- **Reporting** — see [SECURITY.md](SECURITY.md).

## Commands

Open the Command Palette (**Cmd+Shift+P** on Mac, **Ctrl+Shift+P** on Windows/Linux):

| Command                                    | What it does                                                                                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Auto Color: Enable (all windows)**       | Turns the extension on everywhere. Applies colors in the current workspace if you have a folder open.                                                                                                              |
| **Auto Color: Disable (all windows)**      | Turns it off for all windows and clears this extension’s color keys from the current workspace’s `workbench.colorCustomizations`.                                                                                  |
| **Auto Color: Enable for this workspace**  | Turns coloring back on for **this** workspace only (still requires the global switch to be on).                                                                                                                    |
| **Auto Color: Disable for this workspace** | Stops coloring **this** workspace and clears this extension’s keys here.                                                                                                                                           |
| **Auto Color: Set color scope**            | **All bars**: title + activity + status plus the workbench tint. **Head and footer only**: title + status only; activity bar, editor, sidebar, tabs, panel, and other tinted areas go back to your theme defaults. |
| **Auto Color: Randomize color**            | Opens a palette picker with **live preview**: browse candidates to see them applied, press **Enter** to keep one (saved in workspace settings), or **Esc** to restore the previous color. Keeping one switches the theme back to **Auto**. |
| **Auto Color: Select theme**               | Opens a **theme picker** with live preview: **Auto** (workspace-derived, the default), any of your **Custom: <name>** themes, or a named theme (full list under **Themes**). A named theme paints its fixed palette for this workspace; most bring their own light/dark surfaces, while **Rainbow** follows your color theme. |
| **Auto Color: Pick a color**               | Choose a common color (red … gray) or a custom hex with live preview; Auto Color builds the full palette around it. See **Colors and custom themes**. |
| **Auto Color: Add current colors to favorites** | Saves this workspace's current look (auto, seed, theme, color, or custom theme) to your favorites. See **Favorites**. |
| **Auto Color: Next favorite**              | Cycles this workspace through your favorites. |
| **Auto Color: Remove a favorite**          | Picks a saved favorite to delete. |
| **Auto Color: Reset to default color**     | Removes the random override and any workspace theme choice so the color is derived from the workspace identity again (folder path by default—see **Where the default color comes from**).                          |

## Themes

**Select theme** offers **Auto** plus these named themes:

- **Editor and terminal classics:** Matrix, GitHub Dark, GitHub Light, Dracula, Nord, Solarized Dark/Light, Monokai, Gruvbox Dark, One Dark
- **Community palettes:** Catppuccin Latte, Catppuccin Mocha, Tokyo Night, Rosé Pine, Kanagawa, Everforest, Ayu Dark, Night Owl
- **Mood and style:** Synthwave, Vaporwave, Cyberpunk, Retro Amber, Ocean, Deep Ocean, Sunset, Sakura, Coffee, Rainbow
- **Seasonal:** Halloween, Holiday
- **Pride:** Trans Pride, Bi Pride, Pan Pride

Catppuccin, Tokyo Night, Rosé Pine, Kanagawa, Everforest, Ayu, and Night Owl are independent open-source color schemes. Auto Color's versions are approximations, and the names belong to their projects.

## Colors and custom themes

**Auto Color: Pick a color** (setting: `auto-color.theme: "color"` plus `auto-color.color`) takes one of red, orange, yellow, green, teal, cyan, blue, indigo, purple, pink, brown, gray, or a hex like `#3366cc`, and builds title, activity, status, and tint around it.

**Custom themes** live in `auto-color.customThemes`: a map of name to palette. Colors are hex or color names. Only `title` is required; `activity` defaults to `title` and `status` to `activity`. `surface` and `foreground` tint the workbench, and `kind` is `dark` or `light`.

```json
{
  "auto-color.customThemes": {
    "brand": {
      "title": "#1b5e20",
      "activity": "green",
      "status": "#2e7d32",
      "surface": "#102a14",
      "foreground": "#ffffff",
      "kind": "dark"
    }
  },
  "auto-color.theme": "custom",
  "auto-color.customTheme": "brand"
}
```

- Select one with **Select theme** (**Custom: brand**) or the two settings above.
- Put `customThemes` in the repo's `.vscode/settings.json` to share it with your team.
- Invalid entries are skipped with a warning.

## Favorites

Save looks you like and cycle through them. **Add current colors to favorites**, **Next favorite** (cycles), and **Remove a favorite** edit the user setting `auto-color.favorites`, a list of entries: `auto`, `seed:<n>`, a theme id, `#rrggbb`, or `custom:<name>`.

## Branch and environment colors

- **Branch alert** (`auto-color.branchAlert`, default off): while a branch matching `auto-color.protectedBranches` is checked out, all bars turn `auto-color.branchAlertColor` (default `#c62828`). Defaults for `protectedBranches`: `main`, `master`, `production`, `prod`, `release/*` (`*` is a wildcard). It switches live on checkout by watching `.git/HEAD`. Caveats: it rewrites `.vscode/settings.json` when you move to or from a protected branch, so if that file is committed the color keys change in git; linked worktrees (where `.git` is a file) are not detected.
- **Environment colors** (`auto-color.environmentColors`, default on): in remote windows the status bar takes the environment color while title and activity keep the project color.

| Environment     | Status bar |
| --------------- | ---------- |
| Remote SSH      | amber      |
| Dev Container   | blue       |
| WSL             | orange     |
| Codespaces      | purple     |
| Remote Tunnel   | teal       |
| Other remotes   | slate      |

Branch alert wins over the environment color.

## Accessibility

Every bar's text meets WCAG AA contrast (4.5:1) automatically. Theme foregrounds that would be unreadable fall back to black or white text. Some palettes (Ocean, Sunset, Rainbow, and some auto pastel colors) therefore have darker or lighter bar text than in earlier versions.

## Settings UI

Open **Settings** (**Cmd+,** / **Ctrl+,**), search **Auto Color**, or browse **Extensions → Auto Color**. You get the same options as the commands: **global on/off**, **color scope** (dropdown with short descriptions), **disable for this workspace**, **identity source** (path, folder name, or git remote—see **What it does**), **theme** (auto, color, custom, or a named theme palette), **color**, **custom themes**, **favorites**, **branch alert** options, **environment colors**, and **random seed**. Use the **Workspace** tab when you want scope or per-workspace options for the current folder only.

## Install

Requires **VS Code 1.85+** (Cursor is compatible). Search the [VS Code Marketplace](https://marketplace.visualstudio.com/) or [Open VSX](https://open-vsx.org/) (used by VSCodium, Windsurf, and other forks) for **Auto Color**, or install from a `.vsix`. In Cursor, search for the ID `WyvernSystemsLLC.auto-color` if other color extensions bury it.

Marketplace icon: color wheel from [UXWing](https://uxwing.com/color-wheel-icon/) ([license](https://uxwing.com/license/)), resized to 128×128.

## Other editors (`auto-color` CLI)

The same palette engine also ships as a small CLI that writes a project's colors into the native settings of each supported editor found in the folder, so the project looks the same everywhere. Supported today:

- **VS Code family** (VS Code, Cursor, Windsurf, VSCodium, …) — `.vscode/settings.json`
- **Zed** — `.zed/settings.json` via `experimental.theme_overrides` (an experimental Zed setting; keys may change between Zed releases)

Run it with `npx auto-color-cli /path/to/project --dry-run`, or install it with `npm i -g auto-color-cli` and use the `auto-color` command. From a checkout of this repo:

```bash
npm run compile && node out/cli.js /path/to/project --dry-run
```

Drop `--dry-run` to write. Editors are detected by their config directory (`.vscode`, `.zed`), or forced with `--targets vscode,zed`. Other flags mirror the extension's settings: `--source path|folderName|gitRemote` (use `gitRemote` or `folderName` so every clone of a repo gets the same color), `--scope all|headFooter`, `--seed N`, `--color <hex|name>` (build the palette around one color), and `--remove` to take Auto Color's keys back out. The CLI only merges into files it can parse as strict JSON and never touches keys it does not own; a settings file with comments is left alone with a message.

`--theme` accepts either a surface style for the derived palette—`dark` (default) or `light`—or one of the **named themes** from the extension's **Select theme** command: `matrix`, `githubDark`, `githubLight`, `dracula`, `nord`, `solarizedDark`, `solarizedLight`, `monokai`, `gruvboxDark`, `oneDark`, `synthwave`, `ocean`, `sunset`, `rainbow`, and the newer themes listed under **Themes** (ids are camelCase, such as `tokyoNight`). A named theme paints that fixed palette (the workspace identity and `--seed` are ignored); most bring their own light or dark surfaces, and `rainbow`—which follows your color theme in the extension—uses dark surfaces in the CLI. For example:

```bash
node out/cli.js /path/to/project --theme matrix
```

## Examples

### Visual Studio Code example

![Visual Studio Code example — Auto Color, teal tint](images/readme-hero-vscode.png)

### Cursor example

![Cursor example — Auto Color, purple tint](images/readme-hero-cursor.png)

Repository: [wyvernsystems/auto-color](https://github.com/wyvernsystems/auto-color) · [MIT](LICENSE) · [Security](SECURITY.md) · [Releasing](docs/RELEASING.md)

Built by Ron Picard at [Wyvern Systems](https://wyvernsystems.com).
