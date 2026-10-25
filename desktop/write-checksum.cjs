"use strict";

const { createHash } = require("node:crypto");
const { createReadStream, existsSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { version } = require("./package.json");

const filename = `LIFE-LEVEL-${version}-Setup.exe`;
const installer = path.join(__dirname, "dist", filename);
if (!existsSync(installer)) throw new Error(`Installer not found: ${installer}`);
const hash = createHash("sha256");
const stream = createReadStream(installer);
stream.on("data", chunk => hash.update(chunk));
stream.on("error", error => { throw error; });
stream.on("end", () => {
  const digest = hash.digest("hex");
  writeFileSync(`${installer}.sha256`, `${digest}  ${filename}\n`, "ascii");
  console.log(`SHA256 ${filename}: ${digest}`);
});
