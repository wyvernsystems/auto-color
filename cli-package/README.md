# auto-color-cli

Give every project its own editor colors from the command line. It writes a
deterministic color palette (title bar, status bar, sidebar, tabs, and more)
into the native settings of VS Code and Zed, using the same palette engine as
the [Auto Color extension](https://github.com/wyvernsystems/auto-color-vscode-extension).

## Usage

```bash
npx auto-color-cli [directory] [options]
```

Or install it globally and use the `auto-color` command:

```bash
npm i -g auto-color-cli
auto-color ~/code/my-project
```

Requires Node.js 18 or newer. The directory defaults to the current one, and
editors are detected by their config folder (`.vscode`, `.zed`).

## Options

- `--targets vscode,zed`: editors to write for (default: detect by config dir)
- `--source path|folderName|gitRemote`: what the color is derived from
- `--scope all|headFooter`: paint everything, or only title and status bars
- `--theme dark|light|<name>`: surface style, or a named theme preset
- `--color <hex|name>`: build the palette around one color (`#rgb`, `#rrggbb`,
  or a name such as `red`, `blue`, `teal`); cannot be combined with `--seed` or
  a named `--theme` preset
- `--seed N`: use a fixed palette seed instead of the identity
- `--remove`: remove Auto Color's keys instead of writing them
- `--dry-run`: report what would be written without writing
- `-h, --help`: show all options

## Links

- Source and issues: <https://github.com/wyvernsystems/auto-color-vscode-extension>
- License: MIT
