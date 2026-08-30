import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import {
  buildColorCustomizationsFromPalette,
  computeWorkspacePalette,
  generateSeedCandidates,
  hashToPastelBase,
  hashWorkspaceIdentity,
  hasManagedColorKeys,
  hslToHex,
  parseChromeScope,
  parseRandomSeed,
  shouldApplyChrome as chromeEnabled,
  stripManagedColorCustomizations,
  themeKindFromVsCode,
  type ChromeScope,
  type ColorMap,
} from "./core/palette";
import {
  computeThemePresetPalette,
  parseThemePreset,
  THEME_PRESET_CHOICES,
  type ThemePreset,
} from "./core/themes";
import { isNonEmptyPlainObject } from "./core/settings-shape";
import {
  AutomaticWriteGate,
  isFileNotFoundError,
  manualRemovalBlocksAutomaticColor,
  SelfWriteTracker,
  settingsPathExists,
  workspaceFileBlocksAutomaticColor,
} from "./workspace-eligibility";
import {
  folderNameFromPath,
  normalizeGitRemoteUrl,
  parseGitRemoteOriginUrl,
  parseIdentitySource,
} from "./core/workspace-identity";

const CONFIG_SECTION = "auto-color";

/** Watcher events within this window of one of our own writes are ignored. */
const SELF_WRITE_WINDOW_MS = 2000;

const selfWrites = new SelfWriteTracker(SELF_WRITE_WINDOW_MS);

/**
 * Persists whether this workspace currently holds colors the extension wrote,
 * so a manual deletion of them can be told apart from a never-painted
 * workspace. Bound to `workspaceState` in `activate`.
 */
let recordPaintedState: (painted: boolean) => Promise<void> = async () => {};

function extensionSettings(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(CONFIG_SECTION);
}

function isGloballyEnabled(): boolean {
  return extensionSettings().get<boolean>("enabled", true);
}

function isWorkspaceDisabled(): boolean {
  return extensionSettings().get<boolean>("workspaceDisabled", false);
}

function getChromeScope(): ChromeScope {
  return parseChromeScope(extensionSettings().get<string>("scope"));
}

function getRandomSeed(): number | undefined {
  return parseRandomSeed(extensionSettings().get<number>("randomSeed"));
}

function getThemePreset(): ThemePreset {
  return parseThemePreset(extensionSettings().get<string>("theme"));
}

function shouldApplyChrome(): boolean {
  return chromeEnabled(isGloballyEnabled(), isWorkspaceDisabled());
}

async function stripChromeFromWorkspace(): Promise<void> {
  const workbench = vscode.workspace.getConfiguration("workbench");
  const existing =
    workbench.get<Record<string, string | undefined>>("colorCustomizations") ??
    {};
  selfWrites.mark(Date.now());
  await workbench.update(
    "colorCustomizations",
    stripManagedColorCustomizations(existing),
    vscode.ConfigurationTarget.Workspace,
  );
  await recordPaintedState(false);
}

/** Normalized origin remote of the folder's git repo, or undefined when there is none. */
async function readGitRemoteIdentity(
  folderUri: vscode.Uri,
): Promise<string | undefined> {
  const configUri = vscode.Uri.joinPath(folderUri, ".git", "config");
  let raw: Uint8Array;
  try {
    raw = await vscode.workspace.fs.readFile(configUri);
  } catch (error) {
    // Not a git repo, or a worktree whose `.git` is a file: fall back.
    if (
      isFileNotFoundError(error) ||
      (error as { code?: unknown })?.code === "FileNotADirectory"
    ) {
      return undefined;
    }
    throw new Error("Unable to read the git config for the workspace color", {
      cause: error,
    });
  }
  const url = parseGitRemoteOriginUrl(new TextDecoder("utf-8").decode(raw));
  return url ? normalizeGitRemoteUrl(url) : undefined;
}

async function resolveIdentityHash(
  folder: vscode.WorkspaceFolder,
): Promise<number> {
  const source = parseIdentitySource(
    extensionSettings().get<string>("identitySource"),
  );
  const fsPath = folder.uri.fsPath;
  if (source === "gitRemote") {
    const remote = await readGitRemoteIdentity(folder.uri);
    return hashWorkspaceIdentity(remote ?? folderNameFromPath(fsPath));
  }
  if (source === "folderName") {
    return hashWorkspaceIdentity(folderNameFromPath(fsPath));
  }
  return hashWorkspaceIdentity(fsPath);
}

async function paintWorkspaceChrome(override?: {
  hash?: number;
  theme?: ThemePreset;
}): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    return;
  }

  const scope = getChromeScope();
  const theme = override?.theme ?? getThemePreset();
  const themeKind = themeKindFromVsCode(vscode.window.activeColorTheme.kind);

  let palette;
  if (theme === "auto") {
    const hash =
      override?.hash ??
      getRandomSeed() ??
      (await resolveIdentityHash(folders[0]));
    palette = computeWorkspacePalette(hash, themeKind);
  } else {
    palette = computeThemePresetPalette(theme, themeKind);
  }

  const workbench = vscode.workspace.getConfiguration("workbench");
  const existing =
    workbench.get<Record<string, string | undefined>>("colorCustomizations") ??
    {};

  selfWrites.mark(Date.now());
  await workbench.update(
    "colorCustomizations",
    buildColorCustomizationsFromPalette({ palette, scope, existing }),
    vscode.ConfigurationTarget.Workspace,
  );
  await recordPaintedState(true);
}

async function syncWorkspaceChrome(): Promise<void> {
  if (!vscode.workspace.workspaceFolders?.length) {
    return;
  }
  if (shouldApplyChrome()) {
    await paintWorkspaceChrome();
  } else {
    await stripChromeFromWorkspace();
  }
}

/**
 * Workspace-persisted `workbench.colorCustomizations` (not User/global). When non-empty, automatic
 * tint must not run so opening a new window does not replace existing bar/theme colors.
 */
function hasWorkspaceStoredColorCustomizations(): boolean {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    return false;
  }

  const rootInspect = vscode.workspace
    .getConfiguration("workbench")
    .inspect<Record<string, unknown>>("colorCustomizations");

  if (isNonEmptyPlainObject(rootInspect?.workspaceValue)) {
    return true;
  }
  if (isNonEmptyPlainObject(rootInspect?.workspaceFolderValue)) {
    return true;
  }

  for (const folder of folders) {
    const ins = vscode.workspace
      .getConfiguration("workbench", folder.uri)
      .inspect<Record<string, unknown>>("colorCustomizations");
    if (isNonEmptyPlainObject(ins?.workspaceFolderValue)) {
      return true;
    }
    if (isNonEmptyPlainObject(ins?.workspaceValue)) {
      return true;
    }
  }

  return false;
}

/**
 * True when any workspace-persisted `workbench.colorCustomizations` (workspace
 * or folder scope, not User/global) still contains a key the extension manages.
 */
function workspaceHasManagedColorCustomizations(): boolean {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    return false;
  }

  const inspections = [
    vscode.workspace
      .getConfiguration("workbench")
      .inspect<ColorMap>("colorCustomizations"),
    ...folders.map((folder) =>
      vscode.workspace
        .getConfiguration("workbench", folder.uri)
        .inspect<ColorMap>("colorCustomizations"),
    ),
  ];

  return inspections.some(
    (ins) =>
      (ins?.workspaceValue !== undefined &&
        hasManagedColorKeys(ins.workspaceValue)) ||
      (ins?.workspaceFolderValue !== undefined &&
        hasManagedColorKeys(ins.workspaceFolderValue)),
  );
}

/**
 * True when workspace settings are already persisted (user-owned file).
 * Folder workspace: `.vscode/settings.json` exists.
 * Multi-root: `.code-workspace` JSON has a non-empty `settings` object, **or** any folder has
 * `.vscode/settings.json` (colors often live only in a folder when workspace-level `settings` is empty).
 * If the workspace file cannot be parsed (e.g. JSON with comments), treat as existing to avoid overwriting.
 */
async function hasExistingWorkspaceSettingsFile(): Promise<boolean> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    return false;
  }

  const workspaceFile = vscode.workspace.workspaceFile;
  if (workspaceFile) {
    let raw: Uint8Array;
    try {
      raw = await vscode.workspace.fs.readFile(workspaceFile);
    } catch (error) {
      throw new Error(
        "Unable to read the workspace file before applying Auto Color",
        { cause: error },
      );
    }
    const text = new TextDecoder("utf-8").decode(raw);
    if (workspaceFileBlocksAutomaticColor(text)) {
      return true;
    }
    for (const folder of folders) {
      const settingsUri = vscode.Uri.joinPath(
        folder.uri,
        ".vscode",
        "settings.json",
      );
      if (
        await settingsPathExists(
          async () => vscode.workspace.fs.stat(settingsUri),
          "workspace folder settings file",
        )
      ) {
        return true;
      }
    }
    return false;
  }

  const settingsUri = vscode.Uri.joinPath(
    folders[0].uri,
    ".vscode",
    "settings.json",
  );
  return settingsPathExists(
    async () => vscode.workspace.fs.stat(settingsUri),
    "workspace settings file",
  );
}

function requireFolder(): boolean {
  if (!vscode.workspace.workspaceFolders?.length) {
    void vscode.window.showInformationMessage(
      "Auto Color: open a folder in this window first.",
    );
    return false;
  }
  return true;
}

/**
 * Quick pick whose highlighted item repaints the workspace as a preview.
 * Previews are queued in order so the last highlighted choice is the one
 * left on screen; resolves once the pick closes and all previews settle.
 */
async function pickWithLivePreview<T extends vscode.QuickPickItem>(opts: {
  title: string;
  placeholder: string;
  items: T[];
  activeItem?: T;
  canPreview: boolean;
  preview: (item: T) => Promise<void>;
}): Promise<T | undefined> {
  let previews = Promise.resolve();
  const enqueuePreview = (item: T) => {
    previews = previews
      .then(() => opts.preview(item))
      .catch((error: unknown) => {
        console.error("Auto Color: palette preview failed", error);
      });
  };

  const picked = await new Promise<T | undefined>((resolve) => {
    const quickPick = vscode.window.createQuickPick<T>();
    quickPick.title = opts.title;
    quickPick.placeholder = opts.placeholder;
    quickPick.items = opts.items;
    if (opts.activeItem) {
      quickPick.activeItems = [opts.activeItem];
    }
    let accepted: T | undefined;
    quickPick.onDidChangeActive((active) => {
      if (opts.canPreview && active[0]) {
        enqueuePreview(active[0]);
      }
    });
    quickPick.onDidAccept(() => {
      accepted = quickPick.selectedItems[0] ?? quickPick.activeItems[0];
      quickPick.hide();
    });
    quickPick.onDidHide(() => {
      quickPick.dispose();
      resolve(accepted);
    });
    quickPick.show();
  });

  await previews;
  return picked;
}

function runInBackground(
  operation: string,
  task: () => Promise<void>,
): void {
  void task().catch((error: unknown) => {
    console.error(`Auto Color: ${operation} failed`, error);
    void vscode.window.showErrorMessage(
      `Auto Color could not ${operation}. See the extension host log for details.`,
    );
  });
}

export function activate(context: vscode.ExtensionContext): void {
  const automaticWriteGate = new AutomaticWriteGate();

  const PAINTED_STATE_KEY = "paintedWorkspace";
  recordPaintedState = async (painted) => {
    await context.workspaceState.update(PAINTED_STATE_KEY, painted);
  };
  const wasPainted = () =>
    context.workspaceState.get<boolean>(PAINTED_STATE_KEY, false);

  /** User deleted our color lines or file: stay hands-off until a command. */
  const userRemovedManagedColors = () =>
    manualRemovalBlocksAutomaticColor(
      wasPainted(),
      workspaceHasManagedColorCustomizations(),
    );

  const refreshAllowAutomaticWorkspaceChrome = async () => {
    await automaticWriteGate.refresh(async () => {
      if (!vscode.workspace.workspaceFolders?.length) {
        return true;
      }
      const hasSettingsFile = await hasExistingWorkspaceSettingsFile();
      const hasStoredColors = hasWorkspaceStoredColorCustomizations();
      return hasSettingsFile || hasStoredColors;
    });
  };

  const runAutomaticSyncIfAllowed = async () => {
    if (!automaticWriteGate.isAllowed()) {
      return;
    }
    if (userRemovedManagedColors()) {
      return;
    }
    await syncWorkspaceChrome();
  };

  let settingsWatchers: vscode.FileSystemWatcher[] = [];

  const onSettingsFileEvent = () => {
    if (selfWrites.isRecent(Date.now())) {
      return;
    }
    // Refresh eligibility only; never paint or strip here, so a file the user
    // just deleted is not recreated and a file they just created is respected.
    runInBackground(
      "refresh workspace eligibility",
      refreshAllowAutomaticWorkspaceChrome,
    );
  };

  const rebuildSettingsWatchers = () => {
    for (const watcher of settingsWatchers) {
      watcher.dispose();
    }
    settingsWatchers = [];

    const patterns: vscode.RelativePattern[] = (
      vscode.workspace.workspaceFolders ?? []
    ).map((folder) => new vscode.RelativePattern(folder, ".vscode/settings.json"));

    const workspaceFile = vscode.workspace.workspaceFile;
    if (workspaceFile?.scheme === "file") {
      const name = workspaceFile.path.split("/").pop();
      if (name) {
        patterns.push(
          new vscode.RelativePattern(
            vscode.Uri.joinPath(workspaceFile, ".."),
            name,
          ),
        );
      }
    }

    for (const pattern of patterns) {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      watcher.onDidCreate(onSettingsFileEvent);
      watcher.onDidChange(onSettingsFileEvent);
      watcher.onDidDelete(onSettingsFileEvent);
      settingsWatchers.push(watcher);
    }
  };

  rebuildSettingsWatchers();

  runInBackground("initialize workspace colors", async () => {
    // Colors applied before the painted flag existed (or by the CLI) count as
    // painted, so deleting them later is recognized as the user's choice.
    if (
      vscode.workspace.workspaceFolders?.length &&
      workspaceHasManagedColorCustomizations()
    ) {
      await recordPaintedState(true);
    }
    await refreshAllowAutomaticWorkspaceChrome();
    await runAutomaticSyncIfAllowed();
  });

  context.subscriptions.push(
    new vscode.Disposable(() => {
      for (const watcher of settingsWatchers) {
        watcher.dispose();
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      rebuildSettingsWatchers();
      runInBackground("refresh workspace colors", async () => {
        await refreshAllowAutomaticWorkspaceChrome();
        await runAutomaticSyncIfAllowed();
      });
    }),
    vscode.window.onDidChangeActiveColorTheme(() => {
      runInBackground("repaint colors for the new theme", async () => {
        if (!vscode.workspace.workspaceFolders?.length) {
          return;
        }
        if (!shouldApplyChrome()) {
          return;
        }
        if (userRemovedManagedColors()) {
          return;
        }
        const existing =
          vscode.workspace
            .getConfiguration("workbench")
            .get<ColorMap>("colorCustomizations") ?? {};
        if (automaticWriteGate.isAllowed() || hasManagedColorKeys(existing)) {
          await paintWorkspaceChrome();
        }
      });
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration(CONFIG_SECTION)) {
        return;
      }
      runInBackground("update workspace colors", runAutomaticSyncIfAllowed);
    }),
    vscode.commands.registerCommand(
      "auto-color.enableGlobal",
      async () => {
        await extensionSettings().update(
          "enabled",
          true,
          vscode.ConfigurationTarget.Global,
        );
        if (requireFolder()) {
          await syncWorkspaceChrome();
        }
      },
    ),
    vscode.commands.registerCommand(
      "auto-color.disableGlobal",
      async () => {
        await extensionSettings().update(
          "enabled",
          false,
          vscode.ConfigurationTarget.Global,
        );
        if (vscode.workspace.workspaceFolders?.length) {
          await stripChromeFromWorkspace();
        }
      },
    ),
    vscode.commands.registerCommand(
      "auto-color.enableWorkspace",
      async () => {
        if (!requireFolder()) {
          return;
        }
        await extensionSettings().update(
          "workspaceDisabled",
          false,
          vscode.ConfigurationTarget.Workspace,
        );
        if (isGloballyEnabled()) {
          await paintWorkspaceChrome();
        }
      },
    ),
    vscode.commands.registerCommand(
      "auto-color.disableWorkspace",
      async () => {
        if (!requireFolder()) {
          return;
        }
        await extensionSettings().update(
          "workspaceDisabled",
          true,
          vscode.ConfigurationTarget.Workspace,
        );
        await stripChromeFromWorkspace();
      },
    ),
    vscode.commands.registerCommand(
      "auto-color.randomize",
      async () => {
        if (!requireFolder()) {
          return;
        }
        const seeds = generateSeedCandidates(
          () => randomBytes(4).readUInt32BE(0),
          8,
        );
        const canPreview = shouldApplyChrome();
        type SeedItem = vscode.QuickPickItem & { seed: number };
        const items: SeedItem[] = seeds.map((seed, index) => {
          const { h, s, l } = hashToPastelBase(seed);
          return {
            label: `Palette ${index + 1}`,
            description: hslToHex(h, s, l),
            seed,
          };
        });

        const picked = await pickWithLivePreview({
          title: "Auto Color: Randomize color",
          placeholder: canPreview
            ? "Browse to preview, Enter to keep, Esc to restore"
            : "Pick a palette to save for this workspace",
          items,
          canPreview,
          // Preview as auto so the seed shows through a selected theme.
          preview: (item) =>
            paintWorkspaceChrome({ hash: item.seed, theme: "auto" }),
        });

        if (picked) {
          if (getThemePreset() !== "auto") {
            await extensionSettings().update(
              "theme",
              "auto",
              vscode.ConfigurationTarget.Workspace,
            );
          }
          await extensionSettings().update(
            "randomSeed",
            picked.seed,
            vscode.ConfigurationTarget.Workspace,
          );
          if (shouldApplyChrome()) {
            await paintWorkspaceChrome();
          }
        } else if (canPreview) {
          await paintWorkspaceChrome();
        }
      },
    ),
    vscode.commands.registerCommand(
      "auto-color.selectTheme",
      async () => {
        if (!requireFolder()) {
          return;
        }
        const current = getThemePreset();
        const canPreview = shouldApplyChrome();
        type ThemeItem = vscode.QuickPickItem & { theme: ThemePreset };
        const items: ThemeItem[] = THEME_PRESET_CHOICES.map((choice) => ({
          label: choice.label,
          description: choice.description,
          theme: choice.id,
        }));

        const picked = await pickWithLivePreview({
          title: "Auto Color: Select theme",
          placeholder: canPreview
            ? "Browse to preview, Enter to keep, Esc to restore"
            : "Pick a theme to save for this workspace",
          items,
          activeItem: items.find((item) => item.theme === current),
          canPreview,
          preview: (item) => paintWorkspaceChrome({ theme: item.theme }),
        });

        if (picked) {
          await extensionSettings().update(
            "theme",
            picked.theme,
            vscode.ConfigurationTarget.Workspace,
          );
          if (shouldApplyChrome()) {
            await paintWorkspaceChrome();
          }
        } else if (canPreview) {
          await paintWorkspaceChrome();
        }
      },
    ),
    vscode.commands.registerCommand(
      "auto-color.resetColor",
      async () => {
        if (!requireFolder()) {
          return;
        }
        await extensionSettings().update(
          "randomSeed",
          undefined,
          vscode.ConfigurationTarget.Workspace,
        );
        await extensionSettings().update(
          "theme",
          undefined,
          vscode.ConfigurationTarget.Workspace,
        );
        if (shouldApplyChrome()) {
          await paintWorkspaceChrome();
        }
      },
    ),
    vscode.commands.registerCommand(
      "auto-color.setScope",
      async () => {
        if (!requireFolder()) {
          return;
        }
        const current = getChromeScope();
        const picked = await vscode.window.showQuickPick(
          [
            {
              label: "All (title, activity, status)",
              description:
                "Default — color every chrome bar, with lightness shades",
              value: "all" as const,
              picked: current === "all",
            },
            {
              label: "Head and footer only",
              description:
                "Title + status only; activity bar and workbench tint use your theme",
              value: "headFooter" as const,
              picked: current === "headFooter",
            },
          ],
          {
            title: "Auto Color: Color scope",
            placeHolder: "Choose which bars get the workspace color",
          },
        );
        if (!picked) {
          return;
        }
        await extensionSettings().update(
          "scope",
          picked.value,
          vscode.ConfigurationTarget.Workspace,
        );
        if (shouldApplyChrome()) {
          await paintWorkspaceChrome();
        }
      },
    ),
  );
}

export function deactivate(): void {}
