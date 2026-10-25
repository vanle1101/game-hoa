# Initial repository audit

Date: 2026-10-15. Audited location: `E:\Game hoa cuoc song`.

The working directory was empty at the initial inspection: no `.git`, package manifest, source files, tests, assets, database configuration, migrations, deployment configuration, or existing UI. Files created concurrently by this build are new implementation, not pre-existing reusable code. No legacy PixiJS implementation or existing user data was found to migrate.

## Environment observed

| Item | Evidence |
| --- | --- |
| Host | Windows; PowerShell; workspace readable |
| Node | v25.8.1 available locally |
| npm | 11.11.0 available locally |
| Git | 2.54.0.windows.1 executable available; initial directory was not a Git repository |
| Python | Executable available; not required for the planned web runtime |
| Multi-agent support | Used for foundation, domain implementation, and audit/documentation work with separate file ownership |
| Existing production/database secrets | None present in the initially empty target directory |
| Existing assets | None; any procedural geometry is an explicitly replaceable development asset |

Local Node availability does not itself verify Vercel runtime compatibility. Select and document a supported deployment Node version in the application configuration and verify the production build.

## Reuse assessment

The separately authorized `E:\Dịch video` directory contains an active OpenCode Muse integration plus an optional Chrome Muse bridge. See [AI_PROVIDER_AUDIT.md](AI_PROVIDER_AUDIT.md). Only integration knowledge is reusable without further work: neither inspected transport establishes a direct remote Muse API that can simply be deployed to Vercel. The old project was not modified and its environment was not copied.

## Initial risks and required controls

- A new codebase needs a real vertical slice before expanding screen coverage. Navigation to 26 pages is not proof that 26 features work.
- Persistent game mutations must be owned by authenticated server services, transactions, constraints, and idempotency controls. A local/demo store cannot stand in for production durability or cross-tab consistency.
- Finance uses integer minor units and a separate ledger. It must not alter Gold, combat, or AI context.
- The user subsequently requested removal of Google login. Guest sessions now identify each browser through a server-created HttpOnly cookie; OAuth configuration is no longer required. Database provisioning and production deployment remain external configuration steps; no service changes or fees were authorized by the build specification.
- The 3D scene requires direct visual inspection and measured performance. FPS targets must not be reported as achieved without measurements.
- Tests, assets, offline safety, backup/restore, accessibility, and all required screens need explicit acceptance evidence.

This is the initial-state audit, not a completion report. Use [FEATURE_MATRIX.md](FEATURE_MATRIX.md), implementation evidence, and test results to assess the current build.
