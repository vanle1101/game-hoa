# V16 verification — 2026-10-17

Implementation includes a 28-floor residence, apartment ceiling/cutaway, corridor navigation, city coverage, desktop camera modes, contextual character actions, furniture anchors, sidebar display modes, and creator framing.

## Verified

- Production build including TypeScript passes.
- ESLint: 0 errors; 12 existing warnings remain.
- Latest targeted camera, furniture interaction, anchor and accessory tests: 238 passed.
- Editor localization tests after movement-hint removal: 6 passed.
- Browser at 1440×900 renders the apartment with enclosed ceiling and warm lighting.
- Sidebar expanded, compact and hidden states work; hidden persists after reload.
- X starts draw animation and changes the contextual control to sheath.
- Public preview returns 401 without credentials, confirming the authentication gateway is active.
- The player save was not reset; `.local-data/local-player.json` remains preserved.

## Outstanding acceptance checks

- Complete manual movement, running, jump, sitting, lying, workstation and exit sequence checks.
- Capture all required camera compass directions, exterior/street/sky views and Character Creator views.
- Inspect browser runtime logs and verify build-mode sidebar restoration.
- The old automated Edge screenshot test timed out; it is not a pass.
- Current rendering remains visibly more stylized and less detailed than the supplied photographic references. V16 visual acceptance is not complete.

Preview: https://cylinder-bolt-kai-calls.trycloudflare.com
