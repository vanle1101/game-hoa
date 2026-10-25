# AI provider audit

Audit date: 2026-10-15. Scope: configuration and Muse-related source inside `E:\Dịch video`. The old project was inspected read-only. No credentials, cookies, profiles, or complete environment files were copied into LIFE//LEVEL.

## Findings

Muse configuration **was found**. There are two different integrations, which must not be conflated:

| Integration | Evidence | Execution and endpoint category | Vercel implication |
| --- | --- | --- | --- |
| Active OpenCode Muse | `config.py:100-105`; selected names in `.env`; `core/engines/translation/opencode_client.py` | `LLM_PROVIDER=opencode`, model `muse-spark-1.3-contributor-free`. Starts a native OpenCode CLI process using `opencode run --pure --format json --model opencode/<model> --agent plan`. Credentials are provided through the child environment. | The present adapter depends on native executables, per-request temporary directories, local runtime configuration, and process lifecycle management. It is not a verified Vercel HTTP adapter. |
| Optional browser Muse | `core/services/muse_service.py`; `integrations/muse/bridge.mjs`, `chat_adapter.mjs`, `chrome_connection.mjs`, `setup_muse.py` | Authenticated loopback bridge on an ephemeral `127.0.0.1` port controls Chrome at `https://muse.ai/`. Current configured browser mode is `dedicated`; optional `existing` mode uses a consent-based local CDP connection. | Requires an interactive Chrome login/browser session, Node, Playwright Core, and a local profile. It cannot be deployed unchanged as a normal Vercel Function. |

The environment contains a nonempty `OPENCODE_API_KEY` value. This confirms configuration presence only, not validity, scope, entitlement, balance, or current provider availability. Its value was not displayed or copied. The CLI can alternatively resolve its own API login from OpenCode's local authentication store; this audit did not inspect that store.

### OpenCode details verified from source

- The code declares `https://opencode.ai/zen/v1` as `OPENCODE_BASE_URL`, but the request implementation does **not** issue HTTP requests against this constant. It launches the official CLI. A declared URL is insufficient evidence that a direct Muse request is supported or permitted.
- The model is checked against an explicit free-model allowlist. The code recognizes `FreeTierError` / “free tier can only be used from within opencode” as a non-retryable provider rejection. Bypassing that restriction is not a migration strategy.
- Prompts are sent as JSON text on stdin. The response is parsed from CLI JSON event lines; text events are accumulated into one final answer. This is not an exposed application streaming API.
- Default request timeout is 60 seconds; construction accepts a positive deadline no greater than 300 seconds. Per-task deadlines, process-tree termination, queue admission, circuit-breaker configuration, classified failures, and bounded retries exist in the implementation.
- Validation is caller-owned through `response_validator` and a versioned `schema_id`. Structured text can be requested and validated, but the code does not demonstrate a provider-enforced JSON Schema response mode.
- Provider-imposed rate limits are not established by this source. Local concurrency/queue limits are application settings, not a provider service guarantee.
- The code isolates request configuration, disables plugins/MCP/sharing, and rejects tool-use events. It explicitly describes this as **not an OS sandbox**.

### Browser bridge details verified from source

- `MuseService` starts a Node bridge with a random per-process bearer token, and strips inherited secret-shaped environment variables from that child.
- The bridge binds exclusively to loopback and refuses requests with an `Origin` header. Its API has `GET /health`, `POST /login`, `POST /chat`, and `POST /shutdown`. `/chat` accepts `{prompt, system}` and returns `{reply}`. This is a custom local protocol, not OpenAI Chat Completions.
- Browser login is separate from the bridge bearer token. The bearer token only authorizes the local bridge; it is not a remote Muse credential.
- Browser requests use a 240-second driver timeout and a 260-second Python chat request timeout. Replies requiring approval, timed-out partial text, and empty replies are rejected.
- Setup pins a reviewed Muse driver revision and Playwright Core, with checksum checks and a dedicated Chrome launch patch. Existing-browser mode is separately installed and uses Chrome's consent-based connection.
- The local browser reply is plain text. The bridge does not provide streaming or provider-enforced structured output, and does not document a remote public inference endpoint.

## Verification status

| Check | Status |
| --- | --- |
| Read permitted project directory and relevant source | Verified |
| Discover selected provider/model and credential presence without displaying secrets | Verified |
| Determine actual transport from implementation | Verified: local CLI and optional local browser bridge |
| Live authentication / simple inference | Not run by this audit; no inference success claimed |
| Live JSON/schema result | Not run |
| Live timeout/retry behavior | Not exercised; source behavior inspected only |
| Streaming | No application streaming interface in either inspected Muse adapter |
| Direct remote Muse / OpenAI-compatible Muse | Not established |
| Vercel execution | Not verified; current local adapters require a different deployment contract |

## Adapter decision and safe production path

LIFE//LEVEL must use a server-only planning-provider contract with validated proposal output, bounded input, timeout/error mapping, and explicit user approval before mutations. Finance and credentials must never enter planning context. AI output cannot authorize rewards, combat, penalties, or ledger changes.

Use a clearly identified demo provider for local behavior tests, and a separately configured remote OpenAI-compatible provider only when its real endpoint, model, credentials, protocol, and permitted use have been verified. Demo output is not evidence of a live AI connection. Do not silently fall back from a failed production provider to demo output.

Muse can be reconsidered as a development integration behind that contract. Reusing the old CLI credential with a guessed HTTP endpoint is not authorized by the available evidence. Do not copy Chrome sessions into the frontend or deploy persistent browser automation inside Vercel Functions. A separately hosted, authorized remote Muse service would require its own verified contract and operations plan; none was discovered here.

Blockers for live production Muse: no verified standalone remote transport in the inspected implementation, no live authentication/inference test, and no verified Vercel-compatible execution path. These blockers do not prevent development of the game or provider-independent proposal/approval workflow.

## LIFE//LEVEL implementation evidence

`src/server/ai.ts` now provides an explicit nonproduction demo mode and a server-only OpenAI-compatible Chat Completions adapter selected with `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL`. The remote adapter requires a public HTTPS hostname without credentials, query, custom port, or local/IP literal destination. All DNS answers must be public, and the HTTPS connection pins the checked address to prevent a second DNS lookup from changing the destination. Redirects are not followed. Requests have a 15-second deadline, no more than two attempts, a 64 KiB response cap, and sanitized failures. Successful responses must satisfy the strict plan schema; no live failure is converted into a demo response. Provider compatibility remains unverified until configured and exercised against the intended service.

`src/app/api/ai/route.ts` requires authenticated ownership and same-origin mutations, saves proposals separately from finance, and accepts `propose`, `approve`, or `reject`. Approval obtains a compare-and-set transition to `applying` before applying an idempotent `campaign.create` command; interrupted application can be resumed with the same key. Rejection cannot race a successful approval transition. AI cannot directly grant Gold/XP/items, complete tasks, mutate finance, change committed deadlines, or alter penalties. Planning sends only the submitted prompt and fixed planning instructions; it never reads finance storage.

Focused verification: `npx vitest run tests/ai` passed **44 tests** across permission/schema checks, approval transitions, retry/timeout/redaction, and DNS/endpoint validation. The transport tests mock the provider and are not live inference evidence. `npm run typecheck` passed after integration. The rate limiter is per process; with accountless guest access, a shared production abuse limiter is needed before enabling paid AI publicly. Browser AI interaction and a real remote connection remain unverified by this audit.
