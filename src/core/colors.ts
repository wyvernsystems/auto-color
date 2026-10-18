import {
  composeWorkspacePalette,
  hslToHex,
  readableForegroundHex,
  SHADE_DL,
  type Hsl,
  type ThemeKind,
  type WorkspacePalette,
} from "./palette";

/** Named colors offered by Pick a color, in picker order. */
export const COMMON_COLORS = {
  red: "#e53935",
  orange: "#fb8c00",
  yellow: "#fdd835",
  green: "#43a047",
  teal: "#00897b",
  cyan: "#00acc1",
  blue: "#1e88e5",
  indigo: "#3949ab",
  purple: "#8e24aa",
  pink: "#d81b60",
  brown: "#6d4c41",
  gray: "#757575",
} as const;

export type CommonColorName = keyof typeof COMMON_COLORS;

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Normalizes a user color to lowercase `#rrggbb`. Accepts `#rgb`, `#rrggbb`,
 * or a `COMMON_COLORS` name (any case). Returns `undefined` for anything else.
 */
export function parseColor(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(COMMON_COLORS, trimmed)) {
    return COMMON_COLORS[trimmed as CommonColorName];
  }
  if (!HEX_PATTERN.test(trimmed)) {
    return undefined;
  }
  if (trimmed.length === 4) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return trimmed;
}

/** `#rrggbb` → HSL with hue in degrees and saturation/lightness in 0..1. */
export function hexToHsl(hex: string): Hsl {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) {
    return { h: 0, s: 0, l };
  }
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) {
    h = ((g - b) / d) % 6;
  } else if (max === g) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }
  return { h: (h * 60 + 360) % 360, s, l };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Three bar shades around one color, kept in a range where bars read as that color. */
function barShades(base: Hsl): [Hsl, Hsl, Hsl] {
  const l = clamp(base.l, 0.3, 0.75);
  return [
    { h: base.h, s: base.s, l: l - SHADE_DL },
    { h: base.h, s: base.s, l },
    { h: base.h, s: base.s, l: l + SHADE_DL },
  ];
}

/** Full palette built around one color: bars in its shades, surfaces tinted with its hue. */
export function computeColorPalette(hex: string, themeKind: ThemeKind): WorkspacePalette {
  const base = hexToHsl(hex);
  const [title, activity, status] = barShades(base);
  return composeWorkspacePalette({
    bars: { title, activity, status },
    surface: { h: base.h, s: Math.min(base.s * 0.6, 0.4) },
    themeKind,
  });
}

/**
 * A user-defined theme from `auto-color.customThemes`. Only `title` is
 * required; `activity` defaults to `title` and `status` to `activity`.
 */
export type CustomThemeSpec = {
  title: string;
  activity: string;
  status: string;
  /** Surface tint color; its lightness becomes the editor lightness. */
  surface?: string;
  kind?: ThemeKind;
  foreground?: string;
};

/** Longest custom theme name accepted, so settings cannot bloat pickers. */
export const MAX_CUSTOM_THEME_NAME_LEN = 64;

/**
 * Validates `auto-color.customThemes`. Invalid entries are skipped and
 * described in `errors` so the caller can tell the user instead of
 * silently ignoring them.
 */
export function parseCustomThemes(raw: unknown): {
  themes: Map<string, CustomThemeSpec>;
  errors: string[];
} {
  const themes = new Map<string, CustomThemeSpec>();
  const errors: string[] = [];
  if (raw === undefined || raw === null) {
    return { themes, errors };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { themes, errors: ["customThemes must be an object of theme name to colors."] };
  }
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    const trimmed = name.trim();
    if (trimmed === "" || trimmed.length > MAX_CUSTOM_THEME_NAME_LEN) {
      errors.push(`Custom theme names must be 1-${MAX_CUSTOM_THEME_NAME_LEN} characters ("${name.slice(0, 20)}").`);
      continue;
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      errors.push(`Custom theme "${trimmed}" must be an object with at least a "title" color.`);
      continue;
    }
    const spec = value as Record<string, unknown>;
    const title = parseColor(spec.title);
    if (!title) {
      errors.push(`Custom theme "${trimmed}" needs a "title" color such as "#3366cc" or "blue".`);
      continue;
    }
    const optional = (key: string): string | undefined | null => {
      if (spec[key] === undefined) {
        return undefined;
      }
      const color = parseColor(spec[key]);
      if (!color) {
        errors.push(`Custom theme "${trimmed}" has an invalid "${key}" color.`);
        return null;
      }
      return color;
    };
    const activity = optional("activity");
    const status = optional("status");
    const surface = optional("surface");
    const foreground = optional("foreground");
    if (activity === null || status === null || surface === null || foreground === null) {
      continue;
    }
    if (spec.kind !== undefined && spec.kind !== "dark" && spec.kind !== "light") {
      errors.push(`Custom theme "${trimmed}" has "kind" set to something other than "dark" or "light".`);
      continue;
    }
    themes.set(trimmed, {
      title,
      activity: activity ?? title,
      status: status ?? activity ?? title,
      surface,
      kind: spec.kind as ThemeKind | undefined,
      foreground,
    });
  }
  return { themes, errors };
}

/** Palette for a custom theme; follows `activeKind` unless the theme forces one. */
export function computeCustomThemePalette(
  spec: CustomThemeSpec,
  activeKind: ThemeKind,
): WorkspacePalette {
  const surfaceHsl = spec.surface ? hexToHsl(spec.surface) : undefined;
  const titleHsl = hexToHsl(spec.title);
  return composeWorkspacePalette({
    bars: {
      title: titleHsl,
      activity: hexToHsl(spec.activity),
      status: hexToHsl(spec.status),
    },
    surface: surfaceHsl
      ? { h: surfaceHsl.h, s: surfaceHsl.s, editorL: surfaceHsl.l }
      : { h: titleHsl.h, s: Math.min(titleHsl.s * 0.5, 0.35) },
    themeKind: spec.kind ?? activeKind,
    barFg: spec.foreground,
  });
}

/** Replaces bar backgrounds and re-derives readable foregrounds for them. */
function withBars(
  palette: WorkspacePalette,
  bars: { title?: string; activity?: string; status?: string },
): WorkspacePalette {
  const next = { ...palette };
  if (bars.title) {
    next.titleBg = bars.title;
    next.titleFg = readableForegroundHex(bars.title);
  }
  if (bars.activity) {
    next.activityBg = bars.activity;
    next.activityFg = readableForegroundHex(bars.activity);
  }
  if (bars.status) {
    next.statusBg = bars.status;
    next.statusFg = readableForegroundHex(bars.status);
  }
  return next;
}

/** Branches that get the alert color when branch alerts are on. */
export const DEFAULT_PROTECTED_BRANCHES = ["main", "master", "production", "prod", "release/*"];

/** Default alert color for protected branches: a strong red. */
export const DEFAULT_BRANCH_ALERT_COLOR = "#c62828";

/** Branch name from the text of `.git/HEAD`, or `undefined` when HEAD is detached or unreadable. */
export function parseGitHead(text: string): string | undefined {
  const match = /^ref:\s*refs\/heads\/(.+?)\s*$/m.exec(text);
  return match ? match[1] : undefined;
}

/** Whether `branch` matches any pattern; `*` matches any run of characters. */
export function matchesBranchPattern(branch: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => {
    const regex = new RegExp(
      `^${pattern.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`,
    );
    return regex.test(branch);
  });
}

/** Paints every bar in shades of the alert color; surfaces keep the project tint. */
export function applyBranchAlert(palette: WorkspacePalette, alertHex: string): WorkspacePalette {
  const [title, activity, status] = barShades(hexToHsl(alertHex)).map((c) =>
    hslToHex(c.h, c.s, c.l),
  );
  return withBars(palette, { title, activity, status });
}

/** Where the window runs, from `vscode.env.remoteName`. */
export type RemoteEnvironment = "ssh" | "container" | "wsl" | "codespaces" | "tunnel" | "other";

export function environmentFromRemoteName(name: string | undefined): RemoteEnvironment | undefined {
  switch (name) {
    case undefined:
    case "":
      return undefined;
    case "ssh-remote":
      return "ssh";
    case "dev-container":
    case "attached-container":
      return "container";
    case "wsl":
      return "wsl";
    case "codespaces":
      return "codespaces";
    case "tunnel":
      return "tunnel";
    default:
      return "other";
  }
}

/** Status bar color per remote environment. */
export const ENVIRONMENT_COLORS: Record<RemoteEnvironment, string> = {
  ssh: "#f9a825",
  container: "#0277bd",
  wsl: "#e65100",
  codespaces: "#5e35b1",
  tunnel: "#00897b",
  other: "#546e7a",
};

export const ENVIRONMENT_LABELS: Record<RemoteEnvironment, string> = {
  ssh: "Remote SSH",
  container: "Dev Container",
  wsl: "WSL",
  codespaces: "Codespaces",
  tunnel: "Remote Tunnel",
  other: "Remote",
};

/**
 * Marks a remote window by painting its status bar in the environment's
 * color, keeping the title and activity bars on the project color.
 */
export function applyEnvironmentCast(
  palette: WorkspacePalette,
  environment: RemoteEnvironment,
): WorkspacePalette {
  return withBars(palette, { status: ENVIRONMENT_COLORS[environment] });
}
