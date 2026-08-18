import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isNonEmptyPlainObject } from "./settings-shape";

describe("isNonEmptyPlainObject", () => {
  it("returns true when the value is a non-array object with keys", () => {
    assert.equal(isNonEmptyPlainObject({ settings: true }), true);
    assert.equal(isNonEmptyPlainObject({ "editor.background": "#111" }), true);
  });

  it("returns false when the value is empty, null, an array, or a primitive", () => {
    assert.equal(isNonEmptyPlainObject({}), false);
    assert.equal(isNonEmptyPlainObject(null), false);
    assert.equal(isNonEmptyPlainObject(undefined), false);
    assert.equal(isNonEmptyPlainObject([]), false);
    assert.equal(isNonEmptyPlainObject([{ a: 1 }]), false);
    assert.equal(isNonEmptyPlainObject("settings"), false);
    assert.equal(isNonEmptyPlainObject(1), false);
  });
});
