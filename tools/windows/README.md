# LIFE//LEVEL local startup

Run `install-lifelevel-startup.ps1` once in PowerShell. It registers a per-user Task Scheduler task that starts the Next.js development server on `127.0.0.1:3333` at sign-in, restarts it if it exits, and opens the local app after `/api/health/live` responds. The local server uses `.next-local-dev` for its Webpack cache, separate from `.next` used by production builds.

Server logs are written to `%LOCALAPPDATA%\LIFELEVEL\logs`. The task runs in the signed-in user's session, so the browser can open normally. It does not run before sign-in, deploy the application, or expose the development server to the network.

To remove automatic startup, run:

```powershell
Unregister-ScheduledTask -TaskName "LIFELEVEL Local Dev Server" -Confirm:$false
```
