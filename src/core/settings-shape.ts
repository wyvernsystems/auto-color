/** True for a non-array object with at least one own key. */
export function isNonEmptyPlainObject(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value as object).length > 0
  );
}
