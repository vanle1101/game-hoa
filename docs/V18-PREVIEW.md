# V18 preview connectivity

## Diagnosis (2026-10-17)

The original owner-backed tunnel remains unchanged and is still password protected. A separate read-only showcase tunnel is now running at:

**https://board-ready-suse-get.trycloudflare.com/showcase/apartment-v18**

This route was checked over HTTPS: it returns `200 OK` without credentials, while `/api/game` returns `403 Forbidden` without credentials. The URL is intended to be opened from another machine; it does not expose the player save.

The existing Cloudflare hostname was reachable with HTTPS: `https://cylinder-bolt-kai-calls.trycloudflare.com`.
Next.js listened on `127.0.0.1:3333`; the gateway listened on `127.0.0.1:3334`.

Read-only requests established the gateway origin mismatch:

| Request | Result |
| --- | --- |
| Unauthenticated public `/` | 401 |
| Authenticated public `/` without browser Origin/Referer | 200 |
| Authenticated public `/api/game` without browser Origin/Referer | 200 |
| Authenticated public `/` with actual HTTPS Origin and Referer | 403 |
| Authenticated public `/api/game` with actual HTTPS Origin and Referer | 403 |

Therefore a shell-only status check did not establish that a remote browser could load the game. The running gateway's public origin allowlist needs to match the current Quick Tunnel hostname. No game command was sent during diagnosis.

## Public showcase implementation

Gateway source: `C:/Users/phamc/.dsh/workai/life-level-v12/preview/gateway.js`.
Pre-change backup: `gateway.pre-v18.js` in the same directory.

The new opt-in `PREVIEW_PUBLIC_SHOWCASE=1` mode allows unauthenticated GET/HEAD only for:

- `/showcase` and `/showcase/apartment-v18`.
- `/_next/static/`.
- GLB/GLTF and texture resources under the explicit `/assets/apartment/` asset namespace.
- The favicon and icon SVGs.

Unauthenticated `/` redirects to `PREVIEW_SHOWCASE_PATH` (default `/showcase/apartment-v18`; `/showcase` can be used during scene production). Private APIs, arbitrary routes, server actions and public WebSockets are denied. Rejections do not trigger a Basic-auth password dialog. Authenticated owner routes retain their existing access restrictions. The tunnel must continue to target the gateway, never Next directly.

Required environment for the dedicated read-only showcase gateway:

```text
PREVIEW_PUBLIC_ORIGIN=not-required-on-the-dedicated-3335-process
PREVIEW_PUBLIC_SHOWCASE=1
PREVIEW_SHOWCASE_PATH=/showcase/apartment-v18
```

Switch the last setting to `/showcase/apartment-v18` when the new scene is ready. Credentials remain in their protected existing location; none are written to this report.

## Verification

The new dedicated gateway on loopback port 3335 forwards only to the existing Next process and is paired with a new Quick Tunnel. Public HTTPS checks returned `200` for the showcase and `403` for the private API. The original gateway on port 3334 and its owner-backed tunnel were left running.

The public route and asset checks were re-run after the gateway allowlist fix: the showcase returns `200`, the encoded Next chunk used by the scene returns `200`, the bed GLB returns `200`, and unauthenticated `/api/game` returns `403`. The dedicated public process is separate from the original owner-backed gateway.
