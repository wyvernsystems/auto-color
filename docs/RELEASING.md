# Releasing

Auto Color ships to the [VS Code Marketplace](https://marketplace.visualstudio.com/) and [Open VSX](https://open-vsx.org/) from the same VSIX.

## Tooling

Use Node.js 22 or newer: `@vscode/vsce` 4 requires it, and CI runs Node 22.
Two dev dependencies are deliberately held below their newest release:

| Package | Held at | Why | Lift when |
| --- | --- | --- | --- |
| `@types/vscode` | `~1.85.0` | Matches `engines.vscode`, so compiling rejects APIs newer than the oldest supported host | `engines.vscode` is raised (bump both together) |
| `@types/node` | `^20` | The CLI declares `engines.node: >=18`; newer majors type APIs that Node 18/20 lack | The CLI's Node floor moves up |

`overrides.minimatch` in `package.json` forces minimatch 11 under `vsce`,
which still asks for 10.x
([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)).
Remove it once `vsce` depends on 11.

## Prepare

1. Update `version` in `package.json` and run `npm install --package-lock-only` to sync the lockfile.
2. In `CHANGELOG.md`, retitle the `[Unreleased]` section to `[X.Y.Z] - YYYY-MM-DD` and add the matching link reference (`[X.Y.Z]: …/releases/tag/vX.Y.Z`).
3. Run `npm test` — it type-checks and runs every unit test; there is no separate lint step.

## Build

```bash
npm run package
```

This runs `vscode:prepublish` (clean + compile) and produces `auto-color-X.Y.Z.vsix`. The `.vscodeignore` keeps CLI and writer output out of the VSIX.

## Tag and GitHub release

```bash
git tag vX.Y.Z && git push origin main vX.Y.Z
```

```bash
gh release create vX.Y.Z auto-color-X.Y.Z.vsix --title "vX.Y.Z" --notes-file <notes>
```

Use the version's CHANGELOG section as the notes.

## Publish to both registries

- VS Code Marketplace (publisher `WyvernSystemsLLC`, needs an Azure DevOps PAT):

```bash
npx vsce publish --packagePath auto-color-X.Y.Z.vsix
```

- Open VSX (needs an [open-vsx.org](https://open-vsx.org/) access token; used by VSCodium, Windsurf, and other forks):

```bash
npx ovsx publish auto-color-X.Y.Z.vsix -p <token>
```

The two registries are independent: publish the same VSIX to both so versions stay in sync.

## Publish the CLI to npm

The CLI ships as `auto-color-cli` (the unscoped name `auto-color` is taken). Keep its version in sync with the extension; the build copies it from `package.json`.

```bash
npm run package:cli
cd dist/cli-package && npm pack --dry-run
```

Check the file list, then publish (requires `npm login`; the first publish claims the unscoped name `auto-color-cli`):

```bash
npm publish dist/cli-package
```
