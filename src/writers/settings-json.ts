/**
 * Strict-JSON read/write for editor settings files. Files that do not parse
 * as strict JSON (comments, trailing commas) are user-owned in a way we can't
 * safely rewrite, so parsing fails closed with a descriptive error.
 */
export function parseSettingsObject(
  text: string | undefined,
  description: string,
): Record<string, unknown> {
  if (text === undefined) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(
      `${description} is not strict JSON (comments and trailing commas are not supported); not touching it`,
      { cause: error },
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${description} is not a JSON object; not touching it`);
  }
  return { ...(parsed as Record<string, unknown>) };
}

export function stringifySettingsObject(
  settings: Record<string, unknown>,
): string {
  return `${JSON.stringify(settings, null, 2)}\n`;
}

export function sectionObject(
  settings: Record<string, unknown>,
  key: string,
  description: string,
): Record<string, unknown> {
  const value = settings[key];
  if (value === undefined) {
    return {};
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(
      `${description} has a non-object "${key}"; not touching it`,
    );
  }
  return { ...(value as Record<string, unknown>) };
}
