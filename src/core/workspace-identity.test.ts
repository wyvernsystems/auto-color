import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  folderNameFromPath,
  normalizeGitRemoteUrl,
  parseGitRemoteOriginUrl,
  parseIdentitySource,
} from "./workspace-identity";

describe("parseIdentitySource", () => {
  it("returns the source when the value is a known source", () => {
    assert.equal(parseIdentitySource("path"), "path");
    assert.equal(parseIdentitySource("folderName"), "folderName");
    assert.equal(parseIdentitySource("gitRemote"), "gitRemote");
  });

  it("returns path when the value is missing or unknown", () => {
    assert.equal(parseIdentitySource(undefined), "path");
    assert.equal(parseIdentitySource("remote"), "path");
    assert.equal(parseIdentitySource(1), "path");
  });
});

describe("folderNameFromPath", () => {
  it("returns the last segment for unix and windows paths", () => {
    assert.equal(folderNameFromPath("/Users/ron/project"), "project");
    assert.equal(folderNameFromPath("C:\\work\\Project"), "Project");
  });

  it("ignores trailing separators", () => {
    assert.equal(folderNameFromPath("/Users/ron/project/"), "project");
    assert.equal(folderNameFromPath("C:\\work\\project\\"), "project");
  });

  it("returns the input when there is no named segment", () => {
    assert.equal(folderNameFromPath("/"), "/");
    assert.equal(folderNameFromPath(""), "");
  });
});

describe("parseGitRemoteOriginUrl", () => {
  it("returns the url of the origin remote", () => {
    const config = [
      "[core]",
      "\trepositoryformatversion = 0",
      '[remote "origin"]',
      "\turl = https://github.com/wyvernsystems/auto-color-vscode-extension.git",
      "\tfetch = +refs/heads/*:refs/remotes/origin/*",
    ].join("\n");
    assert.equal(
      parseGitRemoteOriginUrl(config),
      "https://github.com/wyvernsystems/auto-color-vscode-extension.git",
    );
  });

  it("ignores other remotes even when they come first", () => {
    const config = [
      '[remote "upstream"]',
      "\turl = https://github.com/other/upstream.git",
      '[remote "origin"]',
      "  url = git@github.com:owner/repo.git",
    ].join("\n");
    assert.equal(parseGitRemoteOriginUrl(config), "git@github.com:owner/repo.git");
  });

  it("returns undefined when there is no origin url", () => {
    assert.equal(parseGitRemoteOriginUrl(""), undefined);
    assert.equal(parseGitRemoteOriginUrl("[core]\n\tbare = false"), undefined);
    assert.equal(
      parseGitRemoteOriginUrl('[remote "origin"]\n\tfetch = +refs/*:refs/*'),
      undefined,
    );
  });
});

describe("normalizeGitRemoteUrl", () => {
  it("normalizes https urls to lowercase host/path without .git", () => {
    assert.equal(
      normalizeGitRemoteUrl("https://github.com/Owner/Repo.git"),
      "github.com/owner/repo",
    );
  });

  it("normalizes scp-like ssh urls to the same identity as https", () => {
    assert.equal(
      normalizeGitRemoteUrl("git@github.com:Owner/Repo.git"),
      "github.com/owner/repo",
    );
    assert.equal(
      normalizeGitRemoteUrl("ssh://git@github.com/Owner/Repo.git"),
      "github.com/owner/repo",
    );
  });

  it("strips credentials and trailing slashes", () => {
    assert.equal(
      normalizeGitRemoteUrl("https://user:secret@example.com/team/repo/"),
      "example.com/team/repo",
    );
  });
});
