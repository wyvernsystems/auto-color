import { parseArgs } from "node:util";
import {
  parseRandomSeed,
  type ChromeScope,
  type ThemeKind,
} from "../core/palette";
import { COMMON_COLORS, parseColor } from "../core/colors";
import { THEME_PRESET_IDS, type NamedThemePreset } from "../core/themes";
import { type IdentitySource } from "../core/workspace-identity";

export const CLI_TARGETS = ["vscode", "zed"] as const;

export type CliTarget = (typeof CLI_TARGETS)[number];

/** `dark`/`light` tint the derived palette; a preset name paints that theme. */
export type CliTheme = ThemeKind | NamedThemePreset;

export const CLI_THEMES: readonly CliTheme[] = [
  "dark",
  "light",
  ...THEME_PRESET_IDS.filter(
    (id): id is NamedThemePreset => id !== "auto",
  ),
];

export type CliOptions = {
  dir: string;
  source: IdentitySource;
  scope: ChromeScope;
  theme: CliTheme;
  seed: number | undefined;
  /** Normalized `#rrggbb` from `--color`, painted through the core palette. */
  color: string | undefined;
  targets: CliTarget[] | undefined;
  remove: boolean;
  dryRun: boolean;
  help: boolean;
};

function oneOf<T extends string>(
  flag: string,
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value === undefined) {
    return fallback;
  }
  if ((allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new Error(`${flag} must be one of: ${allowed.join(", ")}`);
}

/** Parses CLI arguments; unlike settings parsing, typos throw instead of defaulting. */
export function parseCliOptions(argv: string[]): CliOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      source: { type: "string" },
      scope: { type: "string" },
      theme: { type: "string" },
      seed: { type: "string" },
      color: { type: "string" },
      targets: { type: "string" },
      remove: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (positionals.length > 1) {
    throw new Error("Expected at most one directory argument");
  }

  let seed: number | undefined;
  if (values.seed !== undefined) {
    seed = parseRandomSeed(Number(values.seed));
    if (seed === undefined) {
      throw new Error("--seed must be a whole number from 1 to 4294967295");
    }
  }

  let color: string | undefined;
  if (values.color !== undefined) {
    color = parseColor(values.color);
    if (color === undefined) {
      throw new Error(
        `--color must be #rgb, #rrggbb, or one of: ${Object.keys(COMMON_COLORS).join(", ")}`,
      );
    }
    if (values.seed !== undefined) {
      throw new Error("--color cannot be combined with --seed");
    }
    if (
      values.theme !== undefined &&
      values.theme !== "dark" &&
      values.theme !== "light"
    ) {
      throw new Error(
        "--color cannot be combined with a named --theme preset (use --theme dark or light)",
      );
    }
  }

  let targets: CliTarget[] | undefined;
  if (values.targets !== undefined) {
    targets = values.targets.split(",").map((t) => t.trim()) as CliTarget[];
    for (const target of targets) {
      if (!CLI_TARGETS.includes(target)) {
        throw new Error(`--targets must be from: ${CLI_TARGETS.join(", ")}`);
      }
    }
  }

  return {
    dir: positionals[0] ?? ".",
    source: oneOf(
      "--source",
      values.source,
      ["path", "folderName", "gitRemote"] as const,
      "path",
    ),
    scope: oneOf("--scope", values.scope, ["all", "headFooter"] as const, "all"),
    theme: oneOf("--theme", values.theme, CLI_THEMES, "dark"),
    seed,
    color,
    targets,
    remove: values.remove,
    dryRun: values["dry-run"],
    help: values.help,
  };
}
