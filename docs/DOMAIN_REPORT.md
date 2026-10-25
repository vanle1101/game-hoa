# Domain implementation report

Scope: `src/domain` and `tests/domain`. These are domain capabilities, not a claim that every capability has a complete UI, production database deployment, or end-to-end verification.

## Contracts and security boundaries

- `createInitialState(userId, now)` creates zero XP, zero Game Gold, one starter weapon and one active daily boss. It grants no purchased furniture or pets. Hardcore starts enabled to match the selected experience; equipment loss is disabled until explicitly accepted.
- `createDemoState` is explicitly separate and creates sample task content through the same action reducer. It does not preload currency balances.
- `applyAction(state, action, context)` returns an immutable next state, journal events and a message. Context carries authenticated user ID, server time, event ID and server RNG. Ownership is checked before action handling.
- `actionSchema` is strict Zod validation and also runs inside the reducer. Clients cannot submit XP, Gold, attack results, loot or ownership fields. Calendar dates must exist; task timezones must be recognized IANA zones.
- `task.edit` takes `{ taskId, task: Partial<TaskInput> }`. It validates partial edits, rejects empty patches, cannot reopen a completed/canceled occurrence, and protects deadline, recurrence, difficulty, duration and commitment changes on committed tasks. Overdue tasks must be reconciled first. Campaign membership cannot be reassigned through editing.
- Database locking, authenticated route enforcement, distributed concurrency and durable command deduplication belong to the server layer. Pure reducer tests alone do not establish those properties.

## Implemented gameplay

- One-time, daily, weekly, positive-habit, negative-habit, campaign, farming and recovery task kinds. Negative-habit completion means the user reports avoiding that habit for the occurrence. It is logged as `Avoided` and receives at most one reward.
- Task title, description, difficulty, skill, duration, priority, due date, timezone, checklist and commitment. Edit, archive, cancel, reschedule and checklist actions are supported.
- Recurrence creates stable date-scoped occurrence IDs. Each task uses its own stored timezone. Reconciliation records missed occurrences, creates the current recurring occurrence and preserves canceled-date exceptions.
- Server-calculated XP, skill XP, Gold and boss damage. XP levels follow `floor(sqrt(totalXp / 100)) + 1`. Duration multipliers and equipment modifiers are bounded.
- A profile-local daily budget caps task and boss reward XP at 600 and Gold at 300, with at most 20 reward-bearing task completions. Boss loot is limited to three rewarded defeats per profile-local day. Career rewards are a separate finite progression mechanism.
- Daily, weekly, campaign, elite and legendary boss definitions; level gates, defense, resistance, crits, phases, cooldowns, defeat state and persisted loot result references.
- Campaign milestone gates are based on actual mandatory task completion. Real milestones advance boss progress, and the last required task can finish the campaign even when the day's currency reward budget is exhausted.
- Weighted equipment loot by rarity and eligible level; guaranteed boss fragments; first clear grants three fragments and repeat clear grants two. Boss rewards and loot are granted once per encounter.
- Equipment ownership, slot and level validation, equip/unequip, enhancement +0 through +10, material-based crafting, buying equipment and derived-stat recalculation.
- Apartment purchases, quantity ownership, room unlocks, object placement/removal, rotated dimensions, room bounds, object collision and fixed living-room fixture collision. Catalog includes Training, Workshop, Gaming, Trophy and Premium rooms.
- Pet adoption and once-per-day care; six skill categories with prerequisite nodes; career selection and promotion; persistent achievements.
- Character name, skin, outfit, hair color and hairstyle; daily rest; graphics, reduced-motion, timezone and rest-day settings.

## Hardcore and undo: exact current behavior

Only missed **committed** tasks incur hardcore HP penalties. Standard mode, uncommitted work and declared rest dates are exempt. At zero HP, the reducer deducts 20% of current Game Gold, drops one character level, respawns at 50 HP and removes one equipped item only if equipment-loss consent was already accepted. Apartment ownership, pets and career progress survive. There is no real-finance state in this reducer.

Undo is available for task completion or reconciliation penalties for five minutes, until a subsequent meaningful action. A no-op reconciliation preserves the same state object, revision and undo eligibility. Undo restores the pre-action character, boss, loot, materials and Gold, while retaining the original journal/ledger history and appending a compensating event and Gold delta.

**An undone completed occurrence becomes canceled and remains closed.** It cannot be completed again or reopened through edit/reschedule. Thus a retry cannot roll new loot or mint repeated rewards. This is deliberately restrictive: it is not a general reopen-and-replay feature. If that occurrence was a mandatory campaign milestone, the campaign cannot currently reopen that milestone; the user must replace the campaign. This limitation must be visible in the undo UI before confirmation.

Penalty undo retains the missed-occurrence/penalty marker, so another reconciliation does not charge the same miss again. Any dependent action blocks undo. The reducer does not delete historical economic transactions.

## Verification

Domain tests cover initialization, ownership and schema rejection, immutable completion, duplicate event retry, duplicate occurrence rewards, XP/Gold/material budgets, campaign gates and farming abuse, crits and damage preview, invalid RNG rollback, loot weights, new-player task-to-boss-to-loot-to-equipment-to-next-damage progression, crafting rollback, equipment slots/levels, furniture bounds/overlap/fixtures, pets, avatar validation, timezone boundaries, weekly delayed reconciliation, per-task timezones, canceled commitments, hardcore exhaustion, compensation undo and finance isolation.

Verification on 2026-10-15: 42 domain tests passed; domain ESLint passed with no warnings; the full project `tsc --noEmit` passed. The test invocation is `npx vitest run tests/domain`. This report describes tested domain behavior; it does not claim production concurrency, browser accessibility, real finance calculations or deployed services are verified by these tests.

## Supported simplifications and missing features

- Recurrence supports daily and weekly schedules, not arbitrary RRULEs, monthly schedules, weekday selections or task-specific time-of-day deadlines. Reconciliation scans at most 3,660 recurrence iterations per task.
- Negative habits support an avoided occurrence, not a separate logged-slip action or multi-count daily counter.
- Checklist completion is stored on the task and resets when the current recurring occurrence is generated. Individual historical checklist snapshots are not stored.
- Campaigns use one task per milestone and one boss. Chapters, branching milestone dependencies and reopening an undone mandatory milestone are not implemented.
- Loot has weights and first/repeat fragments, but no pity tracker or full per-boss configurable reward table. Legendary and mythic definitions are available through catalog purchases; the current highest boss's level eligibility does not include every mythic item.
- Buffs, consumable recovery purchases, cosmetic item ownership, custom real-life reward redemption and pet equipment are not implemented in this module.
- Career rank is global across selected paths, not separate persistent rank per career. Skill nodes are a small configured tree.
- Room unlocks are persisted; how a room is visualized belongs to the 3D layer. Furniture collision definitions must remain synchronized with actual rendered dimensions.
- Reward budgets use the profile timezone. Changing profile timezone can change the active date key; a production abuse-resistant timezone-change policy is still advisable.
- State history is not pruned or normalized by this module. Snapshot size and command retention must be managed by the persistence layer.

## API GET recommendation

The reducer returns `input` unchanged when reconciliation does no work. The API should recognize that no-op and avoid inserting a command record containing the full state on every GET. A read/reconcile transaction can persist only when the revision actually changes, and command records should have a documented retention policy. No server/API files were modified by this domain audit.
