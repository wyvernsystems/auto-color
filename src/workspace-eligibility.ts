import { isNonEmptyPlainObject } from "./core/settings-shape";

type ErrorWithCode = {
  code?: unknown;
};

export function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as ErrorWithCode).code === "FileNotFound"
  );
}

export async function settingsPathExists(
  stat: () => Promise<unknown>,
  pathDescription: string,
): Promise<boolean> {
  try {
    await stat();
    return true;
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return false;
    }
    throw new Error(`Unable to inspect ${pathDescription}`, { cause: error });
  }
}

export function workspaceFileBlocksAutomaticColor(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return true;
    }
    return isNonEmptyPlainObject(
      (parsed as Record<string, unknown>).settings,
    );
  } catch {
    // Invalid JSON is an existing user-owned workspace file, so fail closed.
    return true;
  }
}

/**
 * True when the user manually removed Auto Color's keys: the extension painted
 * this workspace before (and did not strip it itself), yet no managed color key
 * remains in workspace settings. Automatic coloring must then stay off until an
 * explicit command opts back in, so deleted color lines or files are not
 * recreated — even across window reloads.
 */
export function manualRemovalBlocksAutomaticColor(
  previouslyPainted: boolean,
  workspaceHasManagedColors: boolean,
): boolean {
  return previouslyPainted && !workspaceHasManagedColors;
}

/**
 * Remembers when the extension last wrote workspace settings so filesystem
 * watcher events caused by its own writes can be told apart from the user's.
 */
export class SelfWriteTracker {
  private lastWriteAt: number | undefined;

  constructor(private readonly windowMs: number) {}

  mark(now: number): void {
    this.lastWriteAt = now;
  }

  isRecent(now: number): boolean {
    return (
      this.lastWriteAt !== undefined && now - this.lastWriteAt <= this.windowMs
    );
  }
}

export class AutomaticWriteGate {
  private allowed = false;
  private refreshVersion = 0;

  isAllowed(): boolean {
    return this.allowed;
  }

  async refresh(isBlocked: () => Promise<boolean>): Promise<void> {
    const version = ++this.refreshVersion;
    this.allowed = false;
    const blocked = await isBlocked();
    if (version === this.refreshVersion) {
      this.allowed = !blocked;
    }
  }
}
