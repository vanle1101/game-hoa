"use strict";

const { readFileSync } = require("node:fs");

function parseServerUrl(raw, allowLocalHttp = false) {
  if (typeof raw !== "string" || !raw.trim()) throw new Error("LIFE_LEVEL_SERVER_URL is required.");
  let url;
  try { url = new URL(raw); } catch { throw new Error("The server URL is invalid."); }
  const localHttp = allowLocalHttp && url.protocol === "http:" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  if (url.protocol !== "https:" && !localHttp) throw new Error("The desktop server URL must use HTTPS.");
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("The server URL must be an origin without credentials, path, query, or fragment.");
  }
  return url.origin;
}

function isAllowedNavigationUrl(raw, serverOrigin) {
  try {
    const url = new URL(raw);
    return url.origin === serverOrigin && (url.protocol === "https:" || url.protocol === "http:");
  } catch { return false; }
}

function isAllowedDownloadUrl(raw, serverOrigin) {
  try {
    const url = new URL(raw);
    if (url.protocol === "blob:") return url.origin === serverOrigin;
    return isAllowedNavigationUrl(raw, serverOrigin);
  } catch { return false; }
}

function readServerOrigin(configPath, allowLocalHttp = false) {
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  return parseServerUrl(config.serverUrl, allowLocalHttp);
}

module.exports = { parseServerUrl, isAllowedNavigationUrl, isAllowedDownloadUrl, readServerOrigin };
