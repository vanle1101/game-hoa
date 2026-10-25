"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseServerUrl, isAllowedNavigationUrl, isAllowedDownloadUrl } = require("./security.cjs");

test("packaged desktop accepts only an HTTPS origin", () => {
  assert.equal(parseServerUrl("https://life.example.com/"), "https://life.example.com");
  for (const url of [
    "http://life.example.com/", "file:///tmp/index.html", "https://user:pass@life.example.com/",
    "https://life.example.com/path", "https://life.example.com/?token=x", "https://life.example.com/#x"
  ]) assert.throws(() => parseServerUrl(url));
  assert.equal(parseServerUrl("http://127.0.0.1:3000/", true), "http://127.0.0.1:3000");
  assert.throws(() => parseServerUrl("http://example.com/", true));
});

test("navigation cannot escape the configured origin", () => {
  const origin = "https://life.example.com";
  assert.equal(isAllowedNavigationUrl(`${origin}/quests`, origin), true);
  for (const url of ["https://evil.example/", "https://life.example.com.evil.example/", "file:///C:/secrets", "javascript:alert(1)"]) {
    assert.equal(isAllowedNavigationUrl(url, origin), false);
  }
});

test("download accepts same-origin responses and object URLs only", () => {
  const origin = "https://life.example.com";
  assert.equal(isAllowedDownloadUrl(`${origin}/api/backup`, origin), true);
  assert.equal(isAllowedDownloadUrl(`blob:${origin}/123`, origin), true);
  assert.equal(isAllowedDownloadUrl("blob:https://evil.example/123", origin), false);
  assert.equal(isAllowedDownloadUrl("https://evil.example/file", origin), false);
});
