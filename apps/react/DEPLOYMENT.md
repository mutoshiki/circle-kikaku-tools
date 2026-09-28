# React production release

React is the normal development, test, and production path. The legacy site remains available as the pinned fallback and rollback artifact.

## Pull request checks

Use **React and Legacy CI**. Require **Release / Readiness** as the repository ruleset check. The workflow classifies changed paths and publishes separate React, shared, and legacy jobs:

- `apps/react/**` runs React build, unit, Chromium, WebKit, visual/layout, Firebase compatibility, and collaboration checks.
- Firebase rules and React domain/sync/store/service changes run React and shared compatibility checks plus legacy checks.
- Legacy app, test, and config changes run the legacy static and browser suites.
- Workflow/test infrastructure changes run every relevant React and legacy job. Legacy baseline comparisons use sets of test IDs/names (static contract, Playwright test title + project, or named collaboration case), never aggregate failure counts. A new failure blocks even if an old failure disappears and the total count stays unchanged.

Legacy browser reports compare exact test ID/name sets against the PR base. New failures block even when the total count is unchanged; unchanged failures remain visible in downloaded CI reports. React browser suites must be fully green on the PR head; temporary React baseline tolerance has been removed. Changes to shared/Firebase/schema/sync/persistence/calculation or legacy source additionally require a clean legacy result. The legacy tests are not deleted or skipped, and explicit legacy runs still execute the full suite.

The root `npm test` command runs React unit tests, and `npm run test:guard` runs React unit plus browser suites. Use `npm run test:legacy:static`, `npm run test:legacy:browser`, or `npm run test:legacy` to select legacy tests explicitly; `npm run test:legacy:guard` is the full legacy maintenance gate. Collaboration simulations have their own `npm run test:collab:*` scripts.

## Production release

1. Merge a PR after **Release / Readiness** passes.
2. On `main`, run **React Production Release**. It validates the production config and released Rules revision, builds React once with relative asset paths, and records the source SHA and asset digest. The exact same React `dist` files are packaged under `/react/` and `/` alongside the pinned legacy rollback artifact.
3. The workflow deploys compatibility first and runs real Chromium and WebKit smoke tests against `/react/`. It verifies the deployed build manifest matches the exact build SHA/digest, Firebase read/write/reload using only reserved smoke room `P9A93LMQ`, real Maps/Places/Routes requests, key app views, expense/gas dialogs, and legacy read compatibility. Firebase smoke-room setup and cleanup run from a browser page on the production origin so Firebase Auth receives the allowed referrer. It stops without writing if the room contains unmarked data, removes only marked smoke data, and verifies a null readback.
4. Only a successful compatibility smoke allows React root cutover. The workflow then repeats smoke tests at `/`. If root smoke fails after cutover, the workflow automatically deploys the pinned legacy rollback artifact.

The production Firebase web API key and restricted Maps browser key are repository Actions secrets so workflow logs mask their values. The remaining Firebase web config fields are fixed release constants. Released Rules SHA, rollback-ready Rules SHA, and the reserved smoke room are repository Actions variables. Values are validated without printing them. No ordinary room is used by the smoke test.

## Manual rollback

If a later production issue requires rollback, run **Legacy Root Rollback** on `main`. It restores the pinned legacy site at `/` without changing Firebase data or Rules. The `/react/` path is not a separate release path after root cutover.

## Current legacy baseline

Known legacy static and browser failures remain as test-identity maintenance signals when legacy source is unchanged. React Chromium and WebKit suites are production release blockers and must have every test pass.
