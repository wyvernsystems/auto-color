import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import {
  buildColorCustomizationsFromPalette,
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
  parseThemePreset,
  THEME_PRESET_CHOICES,
  type ThemePreset,
} from "./core/themes";
import {
  applyBranchAlert,
  applyEnvironmentCast,
  COMMON_COLORS,
  DEFAULT_BRANCH_ALERT_COLOR,
  DEFAULT_PROTECTED_BRANCHES,
  environmentFromRemoteName,
  matchesBranchPattern,
  parseColor,
  parseCustomThemes,
  parseGitHead,
  type CustomThemeSpec,
} from "./core/colors";
import {
  computeChoicePalette,
  describeColorChoice,
  formatColorChoice,
  parseColorChoice,
  THEME_SETTING_COLOR,
  THEME_SETTING_CUSTOM,
  type ColorChoice,
} from "./core/choice";
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

const shownWarnings = new Set<string>();

/** Shows a warning once per distinct message per session. */
function warnOnce(message: string): void {
  if (shownWarnings.has(message)) {
    return;
  }
  shownWarnings.add(message);
  void vscode.window.showWarningMessage(`Auto Color: ${message}`);
}

/** Custom themes from settings; invalid entries are reported once each. */
function getCustomThemes(): Map<string, CustomThemeSpec> {
  const { themes, errors } = parseCustomThemes(
    extensionSettings().get<unknown>("customThemes"),
  );
  for (const error of errors) {
    warnOnce(error);
  }
  return themes;
}

/** The workspace's own auto choice: a locked random seed, else the identity hash. */
function autoChoice(): ColorChoice {
  const seed = getRandomSeed();
  return seed === undefined ? { kind: "auto" } : { kind: "seed", seed };
}

/** The choice the settings currently describe, falling back to auto with a warning. */
function currentChoice(): ColorChoice {
  const raw = extensionSettings().get<string>("theme");
  if (raw === THEME_SETTING_COLOR) {
    const hex = parseColor(extensionSettings().get<string>("color"));
    if (hex) {
      return { kind: "color", hex };
    }
    warnOnce(
      'theme is "color" but auto-color.color is empty or not a valid hex color or color name. Using the automatic color.',
    );
    return autoChoice();
  }
  if (raw === THEME_SETTING_CUSTOM) {
    const name = (extensionSettings().get<string>("customTheme") ?? "").trim();
    const themes = getCustomThemes();
    if (name && themes.has(name)) {
      return { kind: "custom", name };
    }
    warnOnce(
      name
        ? `custom theme "${name}" is not defined in auto-color.customThemes. Using the automatic color.`
        : 'theme is "custom" but auto-color.customTheme is not set. Using the automatic color.',
    );
    return autoChoice();
  }
  const preset = getThemePreset();
  return preset === "auto" ? autoChoice() : { kind: "preset", preset };
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

/** Current branch of the folder's git repo, or undefined (no repo, worktree, detached HEAD). */
async function readGitBranch(
  folderUri: vscode.Uri,
): Promise<string | undefined> {
  const headUri = vscode.Uri.joinPath(folderUri, ".git", "HEAD");
  let raw: Uint8Array;
  try {
    raw = await vscode.workspace.fs.readFile(headUri);
  } catch (error) {
    if (
      isFileNotFoundError(error) ||
      (error as { code?: unknown })?.code === "FileNotADirectory"
    ) {
      return undefined;
    }
    throw new Error("Unable to read the git HEAD for the branch alert", {
      cause: error,
    });
  }
  return parseGitHead(new TextDecoder("utf-8").decode(raw));
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

async function paintWorkspaceChrome(override?: ColorChoice): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    return;
  }

  const scope = getChromeScope();
  const choice = override ?? currentChoice();
  const themeKind = themeKindFromVsCode(vscode.window.activeColorTheme.kind);

  let palette = computeChoicePalette(choice, {
    hash: choice.kind === "auto" ? await resolveIdentityHash(folders[0]) : 0,
    themeKind,
    customThemes: getCustomThemes(),
  });

  const settings = extensionSettings();
  const environment = environmentFromRemoteName(vscode.env.remoteName);
  if (environment && settings.get<boolean>("environmentColors", true)) {
    palette = applyEnvironmentCast(palette, environment);
  }
  if (settings.get<boolean>("branchAlert", false)) {
    const branch = await readGitBranch(folders[0].uri);
    const protectedBranches = settings.get<string[]>(
      "protectedBranches",
      DEFAULT_PROTECTED_BRANCHES,
    );
    if (branch && matchesBranchPattern(branch, protectedBranches)) {
      palette = applyBranchAlert(
        palette,
        parseColor(settings.get<string>("branchAlertColor")) ??
          DEFAULT_BRANCH_ALERT_COLOR,
      );
    }
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
 * Saves a choice to the workspace settings, then repaints when Auto Color is
 * active. Commands use this so every picker stores choices the same way.
 */
async function applyChoiceToWorkspace(choice: ColorChoice): Promise<void> {
  const settings = extensionSettings();
  const target = vscode.ConfigurationTarget.Workspace;
  switch (choice.kind) {
    case "auto":
      await settings.update("theme", "auto", target);
      await settings.update("randomSeed", undefined, target);
      break;
    case "seed":
      await settings.update("theme", "auto", target);
      await settings.update("randomSeed", choice.seed, target);
      break;
    case "preset":
      await settings.update("theme", choice.preset, target);
      break;
    case "color":
      await settings.update("theme", THEME_SETTING_COLOR, target);
      await settings.update("color", choice.hex, target);
      break;
    case "custom":
      await settings.update("theme", THEME_SETTING_CUSTOM, target);
      await settings.update("customTheme", choice.name, target);
      break;
  }
  if (shouldApplyChrome()) {
    await paintWorkspaceChrome();
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Quick pick of common colors with live preview; applies the choice. */
async function pickColorCommand(): Promise<void> {
  if (!requireFolder()) {
    return;
  }
  const canPreview = shouldApplyChrome();
  type ColorItem = vscode.QuickPickItem & { hex?: string };
  const items: ColorItem[] = [
    ...Object.entries(COMMON_COLORS).map(([name, hex]) => ({
      label: capitalize(name),
      description: hex,
      hex,
    })),
    { label: "Custom hex…", description: "Enter #rgb or #rrggbb" },
  ];

  const picked = await pickWithLivePreview({
    title: "Auto Color: Pick a color",
    placeholder: canPreview
      ? "Browse to preview, Enter to keep, Esc to restore"
      : "Pick a color to save for this workspace",
    items,
    canPreview,
    preview: async (item) => {
      if (item.hex) {
        await paintWorkspaceChrome({ kind: "color", hex: item.hex });
      }
    },
  });

  let hex = picked?.hex;
  if (picked && !hex) {
    const input = await vscode.window.showInputBox({
      title: "Auto Color: Custom hex color",
      prompt: "Enter a hex color such as #1e88e5, or a color name such as blue",
      validateInput: (value) =>
        parseColor(value) ? undefined : "Enter #rgb, #rrggbb, or a color name",
    });
    hex = parseColor(input);
  }

  if (hex) {
    await applyChoiceToWorkspace({ kind: "color", hex });
  } else if (canPreview) {
    await paintWorkspaceChrome();
  }
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

  let headWatcher: vscode.FileSystemWatcher | undefined;

  const onGitHeadEvent = () => {
    if (!extensionSettings().get<boolean>("branchAlert", false)) {
      return;
    }
    runInBackground("update the branch alert", runAutomaticSyncIfAllowed);
  };

  const rebuildHeadWatcher = () => {
    headWatcher?.dispose();
    headWatcher = undefined;
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      return;
    }
    headWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(folder, ".git/HEAD"),
    );
    headWatcher.onDidCreate(onGitHeadEvent);
    headWatcher.onDidChange(onGitHeadEvent);
    headWatcher.onDidDelete(onGitHeadEvent);
  };

  rebuildSettingsWatchers();
  rebuildHeadWatcher();

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
      headWatcher?.dispose();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      rebuildSettingsWatchers();
      rebuildHeadWatcher();
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
      // Favorites are a saved list only; they never change the painted colors.
      if (
        e.affectsConfiguration(`${CONFIG_SECTION}.favorites`) &&
        ![
          "enabled", "scope", "workspaceDisabled", "identitySource", "theme",
          "randomSeed", "color", "customThemes", "customTheme", "branchAlert",
          "protectedBranches", "branchAlertColor", "environmentColors",
        ].some((key) => e.affectsConfiguration(`${CONFIG_SECTION}.${key}`))
      ) {
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
            paintWorkspaceChrome({ kind: "seed", seed: item.seed }),
        });

        if (picked) {
          await applyChoiceToWorkspace({ kind: "seed", seed: picked.seed });
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
        const current = formatColorChoice(currentChoice());
        const canPreview = shouldApplyChrome();
        type ThemeItem = vscode.QuickPickItem & { choice?: ColorChoice };
        const items: ThemeItem[] = [
          ...THEME_PRESET_CHOICES.map((choice) => ({
            label: choice.label,
            description: choice.description,
            choice:
              choice.id === "auto"
                ? autoChoice()
                : ({ kind: "preset", preset: choice.id } as ColorChoice),
          })),
          ...[...getCustomThemes().keys()].map((name) => ({
            label: `Custom: ${name}`,
            description: "From auto-color.customThemes",
            choice: { kind: "custom", name } as ColorChoice,
          })),
          {
            label: "Pick a color…",
            description: "Choose a single color for every bar",
          },
        ];

        const picked = await pickWithLivePreview({
          title: "Auto Color: Select theme",
          placeholder: canPreview
            ? "Browse to preview, Enter to keep, Esc to restore"
            : "Pick a theme to save for this workspace",
          items,
          activeItem: items.find(
            (item) => item.choice && formatColorChoice(item.choice) === current,
          ),
          canPreview,
          preview: async (item) => {
            if (item.choice) {
              await paintWorkspaceChrome(item.choice);
            }
          },
        });

        if (picked?.choice) {
          await applyChoiceToWorkspace(picked.choice);
        } else if (picked) {
          if (canPreview) {
            await paintWorkspaceChrome();
          }
          await vscode.commands.executeCommand("auto-color.pickColor");
        } else if (canPreview) {
          await paintWorkspaceChrome();
        }
      },
    ),
    vscode.commands.registerCommand("auto-color.pickColor", pickColorCommand),
    vscode.commands.registerCommand(
      "auto-color.addFavorite",
      async () => {
        const choice = currentChoice();
        const value = formatColorChoice(choice);
        const favorites = extensionSettings().get<string[]>("favorites", []);
        if (favorites.includes(value)) {
          void vscode.window.showInformationMessage(
            `Auto Color: ${describeColorChoice(choice)} is already a favorite.`,
          );
          return;
        }
        await extensionSettings().update(
          "favorites",
          [...favorites, value],
          vscode.ConfigurationTarget.Global,
        );
        void vscode.window.showInformationMessage(
          `Auto Color: added ${describeColorChoice(choice)} to favorites.`,
        );
      },
    ),
    vscode.commands.registerCommand(
      "auto-color.nextFavorite",
      async () => {
        if (!requireFolder()) {
          return;
        }
        const favorites = extensionSettings().get<string[]>("favorites", []);
        if (favorites.length === 0) {
          void vscode.window.showInformationMessage(
            "Auto Color: no favorites yet. Run Auto Color: Add current colors to favorites to save the current colors.",
          );
          return;
        }
        const current = formatColorChoice(currentChoice());
        const currentIndex = favorites.findIndex((entry) => {
          const parsed = parseColorChoice(entry);
          return parsed !== undefined && formatColorChoice(parsed) === current;
        });
        for (let step = 1; step <= favorites.length; step += 1) {
          const entry = favorites[(currentIndex + step) % favorites.length];
          const choice = parseColorChoice(entry);
          if (!choice) {
            warnOnce(`skipping invalid favorite "${entry}".`);
            continue;
          }
          await applyChoiceToWorkspace(choice);
          return;
        }
      },
    ),
    vscode.commands.registerCommand(
      "auto-color.removeFavorite",
      async () => {
        const favorites = extensionSettings().get<string[]>("favorites", []);
        if (favorites.length === 0) {
          void vscode.window.showInformationMessage(
            "Auto Color: no favorites to remove.",
          );
          return;
        }
        type FavoriteItem = vscode.QuickPickItem & { index: number };
        const items: FavoriteItem[] = favorites.map((entry, index) => {
          const choice = parseColorChoice(entry);
          return {
            label: choice ? describeColorChoice(choice) : entry,
            description: choice ? entry : "Invalid entry",
            index,
          };
        });
        const picked = await vscode.window.showQuickPick(items, {
          title: "Auto Color: Remove a favorite",
          placeHolder: "Choose a favorite to remove",
        });
        if (!picked) {
          return;
        }
        await extensionSettings().update(
          "favorites",
          favorites.filter((_, index) => index !== picked.index),
          vscode.ConfigurationTarget.Global,
        );
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
        for (const key of ["theme", "color", "customTheme"]) {
          await extensionSettings().update(
            key,
            undefined,
            vscode.ConfigurationTarget.Workspace,
          );
        }
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
