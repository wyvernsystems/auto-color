# Security

## Scope

Auto Color reads workspace folder paths, extension settings, the workspace settings files it manages, and — only when `auto-color.identitySource` is set to `gitRemote` — the `url` lines of the workspace's `.git/config`. It computes colors locally and updates `workbench.colorCustomizations` via the official VS Code configuration API. It does not open network connections, execute shell commands, or read project source files.

The optional `auto-color` CLI in this repository behaves the same way: it reads and writes only the editor settings files listed in the README (`.vscode/settings.json`, `.zed/settings.json`), refuses files it cannot parse as strict JSON, and opens no network connections.

## Workspace Trust

The extension does **not** require you to mark a folder as “trusted” for Auto Color to run. It applies the same way whether VS Code / Cursor opened the repo in Restricted Mode or full trust. (If the editor itself blocks certain workspace writes in restricted scenarios, that is platform behavior outside this extension.)

## Reporting issues

Report suspected vulnerabilities via [GitHub Issues](https://github.com/wyvernsystems/auto-color/issues). Include editor version, extension version, and steps to reproduce.
