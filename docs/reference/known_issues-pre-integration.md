# Known issues and incomplete acceptance

Updated: 2026-10-15. Product status remains partial.

- Construction system is under active implementation. The prior apartment is a procedural prototype; its placement controls alone do not satisfy the new wall/floor/opening/grid editor requirements.
- All 61 construction functional scenarios need explicit evidence. Desktop/mobile operation, geometry cutouts, dynamic navigation, atomic cost/refund and revision races are not inferred from screenshots or source presence.
- Existing 26-screen feature matrix contains incomplete features. Construction completion must not hide or waive those gaps.
- Procedural assets remain prototypes pending visual-quality review and reusable modular asset polish.
- Production guest-session lifecycle, Neon migration/concurrency/restore, Vercel deployment and remote AI inference remain unverified. No services were provisioned and no production deployment was performed by this audit.
- Local store is single-process development persistence. Production requires Postgres; `LOCAL_DATA_DIR` is honored only in explicit local development.
- AI rate limiting is per process, not distributed across Vercel instances. Accountless public access needs a shared limiter before paid AI is enabled. Guest sessions have no recovery or cross-device linking; clearing cookies loses access to the save.
- Current browser preview and test environments do not establish target desktop/mobile FPS. Measure on representative devices.
- Construction migration now preserves legacy ownership/records and produces a valid plan in the outer-room regression fixture. Visual migration and clear stored-object recovery feedback remain pending browser review.
- Construction pathfinding now builds one navigation index per path query and uses indexed neighbor expansion. The repeated per-node floor/wall map allocation is corrected; representative-device frame timing and larger-layout benchmarks remain pending.
- Construction conflict recovery now fetches the latest server game state before resetting the draft. Failed reload preserves the draft. Buy retries retain the same idempotency key after an ambiguous network/server failure, and definitive client rejection clears it. Browser loss-of-response/conflict-recovery verification remains pending.
- Duplicate installation through legacy/new-house placement paths is now blocked by the domain fix; the enabled isolated-store regression passes. Browser migration and inventory presentation still need integration review.
- Desktop browser evidence at 1087×836 now covers entering Build Mode, adding a 3×4 adjacent room through coordinate controls, derived two-room/28-tile/26-wall state, 320 Gold estimate, and disabled Save at zero Gold. This is a partial functional check, not saved/reloaded architecture or mobile acceptance. The palette/undo overlap found in that review was corrected by the lead.
