import { isNonEmptyPlainObject } from "./settings-shape";

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
