"use strict";

const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { parseServerUrl } = require("./security.cjs");

// The packaged client never contains credentials. This is a public HTTPS origin.
const serverUrl = parseServerUrl(process.env.LIFE_LEVEL_SERVER_URL);
const destination = path.join(__dirname, "build", "server.json");
mkdirSync(path.dirname(destination), { recursive: true });
writeFileSync(destination, JSON.stringify({ serverUrl }, null, 2) + "\n", { mode: 0o644 });
console.log(`Desktop server origin: ${serverUrl}`);
