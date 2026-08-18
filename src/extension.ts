import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import {
  buildColorCustomizations,
  hashWorkspaceIdentity,
  parseChromeScope,
  parseRandomSeed,
  shouldApplyChrome as chromeEnabled,
  stripManagedColorCustomizations,
  type ChromeScope,
} from "./palette";
import { isNonEmptyPlainObject } from "./settings-shape";

const CONFIG_SECTION = "auto-color";

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

function shouldApplyChrome(): boolean {
  return chromeEnabled(isGloballyEnabled(), isWorkspaceDisabled());
}

async function stripChromeFromWorkspace(): Promise<void> {
  const workbench = vscode.workspace.getConfiguration("workbench");
  const existing =
    workbench.get<Record<string, string | undefined>>("colorCustomizations") ??
    {};
  await workbench.update(
    "colorCustomizations",
    stripManagedColorCustomizations(existing),
    vscode.ConfigurationTarget.Workspace,
  );
}

async function paintWorkspaceChrome(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    return;
  }

  const scope = getChromeScope();
  const primary = folders[0].uri.fsPath;
  const seed = getRandomSeed();
  const hash = seed ?? hashWorkspaceIdentity(primary);

  const workbench = vscode.workspace.getConfiguration("workbench");
  const existing =
    workbench.get<Record<string, string | undefined>>("colorCustomizations") ??
    {};

  await workbench.update(
    "colorCustomizations",
    buildColorCustomizations({ hash, scope, existing }),
    vscode.ConfigurationTarget.Workspace,
  );
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
    try {
      const raw = await vscode.workspace.fs.readFile(workspaceFile);
      const text = new TextDecoder("utf-8").decode(raw);
      const json = JSON.parse(text) as { settings?: unknown };
      if (isNonEmptyPlainObject(json.settings)) {
        return true;
      }
    } catch {
      return true;
    }
    for (const folder of folders) {
      const settingsUri = vscode.Uri.joinPath(folder.uri, ".vscode", "settings.json");
      try {
        await vscode.workspace.fs.stat(settingsUri);
        return true;
      } catch {
        /* try next folder */
      }
    }
    return false;
  }

  const settingsUri = vscode.Uri.joinPath(
    folders[0].uri,
    ".vscode",
    "settings.json",
  );
  try {
    await vscode.workspace.fs.stat(settingsUri);
    return true;
  } catch {
    return false;
  }
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

export function activate(context: vscode.ExtensionContext): void {
  /** When false, startup and auto-color config changes do not write workspace settings (existing files, workspace JSON, or workspace color customizations). Commands still apply. */
  let allowAutomaticWorkspaceChrome = true;

  const refreshAllowAutomaticWorkspaceChrome = async () => {
    if (!vscode.workspace.workspaceFolders?.length) {
      allowAutomaticWorkspaceChrome = false;
      return;
    }
    const hasSettingsFile = await hasExistingWorkspaceSettingsFile();
    const hasStoredColors = hasWorkspaceStoredColorCustomizations();
    allowAutomaticWorkspaceChrome = !hasSettingsFile && !hasStoredColors;
  };

  const runAutomaticSyncIfAllowed = async () => {
    if (!allowAutomaticWorkspaceChrome) {
      return;
    }
    await syncWorkspaceChrome();
  };

  void (async () => {
    await refreshAllowAutomaticWorkspaceChrome();
    await runAutomaticSyncIfAllowed();
  })();

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void (async () => {
        await refreshAllowAutomaticWorkspaceChrome();
        await runAutomaticSyncIfAllowed();
      })();
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration(CONFIG_SECTION)) {
        return;
      }
      void runAutomaticSyncIfAllowed();
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
        let seed = 0;
        do {
          seed = randomBytes(4).readUInt32BE(0);
        } while (seed === 0);
        await extensionSettings().update(
          "randomSeed",
          seed,
          vscode.ConfigurationTarget.Workspace,
        );
        if (shouldApplyChrome()) {
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
