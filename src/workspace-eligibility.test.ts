import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AutomaticWriteGate,
  isFileNotFoundError,
  settingsPathExists,
  workspaceFileBlocksAutomaticColor,
} from "./workspace-eligibility";

describe("isFileNotFoundError", () => {
  it("accepts only errors with the FileNotFound code", () => {
    assert.equal(isFileNotFoundError({ code: "FileNotFound" }), true);
    assert.equal(isFileNotFoundError({ code: "NoPermissions" }), false);
    assert.equal(isFileNotFoundError(new Error("missing")), false);
    assert.equal(isFileNotFoundError(null), false);
  });
});

describe("settingsPathExists", () => {
  it("returns true when stat succeeds", async () => {
    assert.equal(
      await settingsPathExists(async () => undefined, "workspace settings"),
      true,
    );
  });

  it("returns false only for an explicit FileNotFound error", async () => {
    assert.equal(
      await settingsPathExists(
        async () => {
          throw { code: "FileNotFound" };
        },
        "workspace settings",
      ),
      false,
    );
  });

  it("wraps other filesystem errors with path context", async () => {
    const cause = { code: "NoPermissions" };
    await assert.rejects(
      settingsPathExists(
        async () => {
          throw cause;
        },
        ".vscode/settings.json",
      ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "Unable to inspect .vscode/settings.json");
        assert.equal(error.cause, cause);
        return true;
      },
    );
  });
});

describe("workspaceFileBlocksAutomaticColor", () => {
  it("allows a valid workspace file without persisted settings", () => {
    assert.equal(workspaceFileBlocksAutomaticColor("{}"), false);
    assert.equal(
      workspaceFileBlocksAutomaticColor('{"settings":{},"folders":[]}'),
      false,
    );
  });

  it("blocks a workspace file with non-empty settings", () => {
    assert.equal(
      workspaceFileBlocksAutomaticColor(
        '{"settings":{"editor.fontSize":14}}',
      ),
      true,
    );
  });

  it("fails closed for malformed or unexpected workspace JSON", () => {
    assert.equal(workspaceFileBlocksAutomaticColor("{ comments: true }"), true);
    assert.equal(workspaceFileBlocksAutomaticColor("null"), true);
    assert.equal(workspaceFileBlocksAutomaticColor("[]"), true);
  });
});

describe("AutomaticWriteGate", () => {
  it("denies writes until a refresh confirms the workspace is unblocked", async () => {
    let finishRefresh: ((blocked: boolean) => void) | undefined;
    const blocked = new Promise<boolean>((resolve) => {
      finishRefresh = resolve;
    });
    const gate = new AutomaticWriteGate();

    const refresh = gate.refresh(() => blocked);
    assert.equal(gate.isAllowed(), false);

    finishRefresh?.(false);
    await refresh;
    assert.equal(gate.isAllowed(), true);
  });

  it("keeps writes denied when the workspace is blocked", async () => {
    const gate = new AutomaticWriteGate();
    await gate.refresh(async () => true);
    assert.equal(gate.isAllowed(), false);
  });

  it("ignores an older refresh that finishes after a newer one", async () => {
    let finishFirst: ((blocked: boolean) => void) | undefined;
    const firstResult = new Promise<boolean>((resolve) => {
      finishFirst = resolve;
    });
    const gate = new AutomaticWriteGate();

    const firstRefresh = gate.refresh(() => firstResult);
    await gate.refresh(async () => true);
    finishFirst?.(false);
    await firstRefresh;

    assert.equal(gate.isAllowed(), false);
  });
});
