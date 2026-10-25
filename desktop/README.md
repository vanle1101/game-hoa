# LIFE//LEVEL Windows shell

This Electron application loads the existing Next.js UI from a configured HTTPS origin. The game and database stay on the server. The installer contains no game save, API key, database URL, or server source.

## Build on Windows

Use Node.js 22.12.0 or newer in the Node 22 LTS line. From the project root:

```powershell
npm --prefix desktop ci
$env:LIFE_LEVEL_SERVER_URL = "https://your-approved-domain.example"
npm --prefix desktop test
npm --prefix desktop run build:win
Get-FileHash desktop/dist/LIFE-LEVEL-0.1.0-Setup.exe -Algorithm SHA256
```

`prepare-config.cjs` rejects HTTP, credentials, paths, queries, and fragments. The public origin is written to the generated `desktop/build/server.json` and bundled as a resource. It is not a secret. Do not set the origin to an unapproved deployment. `APP_ORIGIN` on the server must match this origin. Build does not publish an installer. A matching `.exe.sha256` file is emitted next to the installer.

A successful packaging test using `https://life-level.invalid` only demonstrates that Electron and NSIS can build; that installer cannot reach the application and must not be distributed to users. Rebuild with the approved live hostname after deployment. The installer is currently unsigned.

For a local development server only, set `LIFE_LEVEL_SERVER_URL=http://127.0.0.1:3000/` and `LIFE_LEVEL_ALLOW_LOCAL_HTTP=true`, then run `npm --prefix desktop start`. Packaged builds always require HTTPS.

The browser partition is persistent so a server-issued HttpOnly session cookie survives app restarts. Navigation and downloads are restricted to the configured origin; popups, Node integration, webviews, and runtime permissions are disabled. WebGL remains enabled. There is no auto-updater yet; new releases use a new signed installer after signing infrastructure is arranged.

## Acceptance checks on a Windows test machine

1. Install and launch the `.exe` from a verified checksum. Confirm the real TLS certificate is accepted without bypass.
2. Log in, close and reopen the app, and confirm the account session remains. Log in on another machine and confirm the same server state appears without sharing local files.
3. Open Home, Build Mode and Boss Arena. Check WebGL rendering, pointer/keyboard input, graphics quality, and restart after a GPU error.
4. Export the JSON backup and verify the native save dialog and file contents. Test the CSV picker/import preview against a test account.
5. Try an external navigation and popup link; the shell must block them. Check that server API actions are still protected by the server, not by Electron alone.
6. Disconnect/reconnect the network. A server-accepted job must be visible after reconnect even if the Electron process was closed.

These UI checks require Electron dependencies, an HTTPS server, and a Windows test machine. They are not established by the pure Node security tests.
