export type IdentitySource = "path" | "folderName" | "gitRemote";

export function parseIdentitySource(value: unknown): IdentitySource {
  return value === "folderName" || value === "gitRemote" ? value : "path";
}

/** Last non-empty path segment (unix or windows separators), or the input when there is none. */
export function folderNameFromPath(folderPath: string): string {
  const segments = folderPath.split(/[\\/]+/).filter((s) => s.length > 0);
  return segments.length ? segments[segments.length - 1] : folderPath;
}

/** `url` of `[remote "origin"]` in a `.git/config` text, if present. */
export function parseGitRemoteOriginUrl(configText: string): string | undefined {
  let inOrigin = false;
  for (const line of configText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[")) {
      inOrigin = /^\[remote\s+"origin"\]$/.test(trimmed);
      continue;
    }
    if (!inOrigin) {
      continue;
    }
    const match = /^url\s*=\s*(.+)$/.exec(trimmed);
    if (match) {
      return match[1].trim();
    }
  }
  return undefined;
}

/**
 * Reduces a git remote URL to a stable `host/path` identity: protocol,
 * credentials, trailing `.git`, and trailing slashes are dropped, and
 * scp-like `git@host:path` is treated the same as `ssh://git@host/path`.
 */
export function normalizeGitRemoteUrl(url: string): string {
  let rest = url.trim();
  const protocol = /^[a-z][a-z0-9+.-]*:\/\//i.exec(rest);
  if (protocol) {
    rest = rest.slice(protocol[0].length);
  } else {
    // scp-like syntax: user@host:path
    rest = rest.replace(/^([^@/]+@[^:/]+):/, "$1/");
  }
  rest = rest.replace(/^[^@/]+@/, "");
  rest = rest.replace(/\.git$/i, "");
  rest = rest.replace(/\/+$/, "");
  return rest.toLowerCase();
}
