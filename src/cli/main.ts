import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { hashWorkspaceIdentity, type ThemeKind } from "../core/palette";
import { type NamedThemePreset } from "../core/themes";
import {
  folderNameFromPath,
  normalizeGitRemoteUrl,
  parseGitRemoteOriginUrl,
} from "../core/workspace-identity";
import {
  renderVsCodeSettings,
  VSCODE_SETTINGS_PATH,
} from "../writers/vscode-settings";
import { renderZedSettings, ZED_SETTINGS_PATH } from "../writers/zed-settings";
import {
  CLI_TARGETS,
  parseCliOptions,
  type CliOptions,
  type CliTarget,
} from "./options";

export const USAGE = `Usage: auto-color [directory] [options]

Writes the directory's Auto Color workspace colors into the native settings
of each supported editor found there (same palette as the VS Code extension).

Options:
  --targets vscode,zed     Editors to write for (default: detect by config dir)
  --source path|folderName|gitRemote
                           What the color is derived from (default: path)
  --scope all|headFooter   Paint everything, or only title/status bars
  --theme dark|light|<name>
                           Tint surfaces for a dark or light editor theme, or
                           paint a named theme palette instead of the derived
                           color: matrix, githubDark, githubLight, dracula,
                           nord, solarizedDark, solarizedLight, monokai,
                           gruvboxDark, oneDark, synthwave, ocean, sunset,
                           rainbow (presets pick their own light/dark
                           surfaces; rainbow uses dark surfaces in the CLI)
  --seed N                 Use a fixed palette seed instead of the identity
  --remove                 Remove Auto Color's keys instead of writing them
  --dry-run                Report what would be written without writing
  -h, --help               Show this help`;

type Log = (line: string) => void;

type RenderSettings = (opts: {
  existingText: string | undefined;
  hash: number;
  scope: CliOptions["scope"];
  themeKind: ThemeKind;
  preset?: NamedThemePreset;
  remove?: boolean;
}) => string;

const TARGETS: Record<
  CliTarget,
  { markerDir: string; settingsPath: string; render: RenderSettings }
> = {
  vscode: {
    markerDir: ".vscode",
    settingsPath: VSCODE_SETTINGS_PATH,
    render: renderVsCodeSettings,
  },
  zed: {
    markerDir: ".zed",
    settingsPath: ZED_SETTINGS_PATH,
    render: renderZedSettings,
  },
};

function isMissingError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory();
  } catch (error) {
    if (isMissingError(error)) {
      return false;
    }
    throw new Error(`Unable to inspect ${target}`, { cause: error });
  }
}

async function readTextIfExists(target: string): Promise<string | undefined> {
  try {
    return await readFile(target, "utf8");
  } catch (error) {
    if (isMissingError(error)) {
      return undefined;
    }
    throw new Error(`Unable to read ${target}`, { cause: error });
  }
}

async function resolveHash(dir: string, options: CliOptions): Promise<number> {
  if (options.seed !== undefined) {
    return options.seed;
  }
  if (options.source === "folderName") {
    return hashWorkspaceIdentity(folderNameFromPath(dir));
  }
  if (options.source === "gitRemote") {
    const configText = await readTextIfExists(path.join(dir, ".git", "config"));
    const url = configText ? parseGitRemoteOriginUrl(configText) : undefined;
    return hashWorkspaceIdentity(
      url ? normalizeGitRemoteUrl(url) : folderNameFromPath(dir),
    );
  }
  return hashWorkspaceIdentity(dir);
}

export async function runCli(
  argv: string[],
  cwd: string,
  log: Log,
  logError: Log,
): Promise<number> {
  let options: CliOptions;
  try {
    options = parseCliOptions(argv);
  } catch (error) {
    logError(error instanceof Error ? error.message : String(error));
    logError(USAGE);
    return 1;
  }
  if (options.help) {
    log(USAGE);
    return 0;
  }

  const dir = path.resolve(cwd, options.dir);
  if (!(await isDirectory(dir))) {
    logError(`Not a directory: ${dir}`);
    return 1;
  }

  let targets = options.targets;
  if (!targets) {
    targets = [];
    for (const target of CLI_TARGETS) {
      if (await isDirectory(path.join(dir, TARGETS[target].markerDir))) {
        targets.push(target);
      }
    }
    if (!targets.length) {
      logError(
        `No supported editor config found in ${dir} ` +
          `(looked for ${CLI_TARGETS.map((t) => TARGETS[t].markerDir).join(", ")}). ` +
          `Pass --targets ${CLI_TARGETS.join(",")} to choose explicitly.`,
      );
      return 1;
    }
  }

  const hash = await resolveHash(dir, options);
  // --theme carries either the surface style or a preset name; presets pick
  // their own light/dark, so the kind only matters for follow-style presets.
  let themeKind: ThemeKind = "dark";
  let preset: NamedThemePreset | undefined;
  if (options.theme === "dark" || options.theme === "light") {
    themeKind = options.theme;
  } else {
    preset = options.theme;
  }

  let failed = false;
  for (const target of targets) {
    const { settingsPath, render } = TARGETS[target];
    const filePath = path.join(dir, settingsPath);
    try {
      const existingText = await readTextIfExists(filePath);
      if (options.remove && existingText === undefined) {
        log(`${settingsPath}: nothing to remove`);
        continue;
      }
      const nextText = render({
        existingText,
        hash,
        scope: options.scope,
        themeKind,
        preset,
        remove: options.remove,
      });
      if (nextText === existingText) {
        log(`${settingsPath}: already up to date`);
        continue;
      }
      const action = options.remove ? "remove Auto Color keys" : "write colors";
      if (options.dryRun) {
        log(`${settingsPath}: would ${action} (dry run)`);
        continue;
      }
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, nextText, "utf8");
      log(`${settingsPath}: ${options.remove ? "removed Auto Color keys" : "wrote colors"}`);
    } catch (error) {
      failed = true;
      logError(
        `${settingsPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return failed ? 1 : 0;
}
