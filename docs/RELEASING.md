# Releasing

Auto Color ships to the [VS Code Marketplace](https://marketplace.visualstudio.com/) and [Open VSX](https://open-vsx.org/) from the same VSIX.

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
