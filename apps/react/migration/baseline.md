# React migration comparison baseline

Reference: `e37b8651eeba1cb52d2b7a98bc05674bb63591a8`, before any React changes.
The 1,296 tracked legacy files are protected by `protected-files.json` and
`npm run verify:legacy`. All implementation is under `apps/react/`.

## Existing failures

The initial static run had **35 passes / 6 failures**. The browser run had
**62 passes / 3 failures / 0 skips**. JSON summaries are checked in alongside
this document. Full logs, screenshots and traces are outside the repository at
`%TEMP%/circle-react-migration-evidence/`. These are baseline failures, not React
regressions. Do not edit legacy sources to satisfy obsolete source assertions.

| Test | Classification | Evidence and replacement contract |
| --- | --- | --- |
| run-static-tests: initial tab-list selected attribute | Obsolete test | Expects selection in literal HTML. Runtime selects the current tab. Verify rendered selected tab and keyboard navigation. |
| dark-accent-contract | Obsolete test | Fails an exact old cache-buster string. Verify current computed colors and theme interactions. |
| design-refinement-contract | Obsolete test | Fails an exact extra-row CSS grid declaration. Preserve readable amounts, burden/type and actions in actual rendered rows. |
| driver-reward-policy | Obsolete test | Expects content-switcher selection although current control is a radio group. Verify resulting reward type and calculations. |
| deep-five-device-suite | Obsolete role/capacity assertions | Requires owner `placement.kind === 'driver'` and counts owner against passenger capacity. Current schema uses member placement, independent `placement.driver` and structural `group.ownerId`. Retain convergence, capacity excluding owner and participant integrity checks. |
| five-device-network-soak-v46 | Obsolete role assertions | Same historical driver-placement assumption; preserve actual current role contract in new network suite. |
| carbon-complete: compact row height | Existing minor geometry deviation | Current reference renders 65px versus test maximum 64px. Treat conservatively as an existing visual defect against this assertion. It is not evidence of a React regression; new rows still require direct size/readability QA. |
| carbon-complete: passphrase panel close | Obsolete flow | Attempts to close `#passphrase-panel` after lock enforcement was disabled. Keep legacy lock data, do not restore lock UI. |
| carbon-complete: settlement save after rental switch | Obsolete setup | Private-car dist/eco/price remain blank; current positive-value validation correctly keeps editor open. Test must fill required fields before expecting save/close. Preserve failed-save draft and validation. |

No observed baseline failure was classified as environment-dependent. Live Maps
and production Firebase were not exercised; that absence is not a passing result.

## Semantic comparison contract

`tests/reference.mjs` executes unchanged source in a test-only VM. It is never
shipped to the browser. The application imports explicit ESM factories extracted
from reviewed declarations; `tools/extract-domain.mjs --check` verifies source
hashes and generated content. DOM adapters and classic script startup code are
excluded. The handwritten allocation command preserves the original action's
mutation order and is compared before transport side effects.

`tests/fixtures/legacy-v4.json` contains exclusively synthetic participants and
room data. Tests also derive schema-6, empty, multiple-driver, non-driver-owner,
standalone, tombstone and reset variants. No real response tokens or identities
are present. More browser/network fixtures are added at their feature gates.

Compare full canonical room, schema, participants, placement/roles, car and team
projections, settlement storage/UI forms, calculation and validation outputs,
patch paths and values, operation journal/version/revision, reset and replay.
Fixed action clocks, wall-clock migration annotations, UUIDs and random inputs
make protocol comparisons deterministic. The optional business projection
`semanticRoom` excludes only timing/version metadata; protocol tests compare
that metadata explicitly. Cross-realm array prototypes are normalized without
dropping undefined values or business fields. Expense arrays preserve order.

The settlement matrix currently covers 128 combinations of rounding, organizer
exemption, driver offset/free, split/club reward and standalone mode; its fixture
also includes positive/negative split/club expenses and Times rental charges.
Deletion tests replay a stale projected plan into both independent allocations.

## Risks that must remain explicit through the release gate

| Boundary | Required compatibility evidence |
| --- | --- |
| activeAllocationType / checked-in Rules | Preserve the observed cleanup patch (`null`) in domain comparison. Emulator tests must show the Rules mismatch; do not silently edit Rules. |
| update fallback | Preserve precise update/journal behavior and explicitly test the absence of transaction version/reset enforcement on this legacy path. |
| collection Undo | Compare the existing whole-map restore, including its concurrent-edit limitation. No unrequested semantics change. |
| applicationSync metadata | Separate owner, preserved through ordinary room edits; normal entity patch must not overwrite meta. |
| single outbox | One durable record per room; replacing, acknowledging and replaying it must be tested. |
| load implicit writes | Keep initial migration/cleanup/recovery behavior in an explicit service lifecycle; never treat a legacy load as a read-only production probe. |
| handoff token | Preserve token validation, one-time URL removal, local room scope and export protocol in isolated tests. |

## Independent application gate

The app has an independent npm lockfile, Vite build, React 19.2.8, Carbon React
1.115.0 and icons 11.87.0. Versions, peer dependencies, actual declarations and
official React/Carbon/Vite documentation were checked. Development uses port
5174, preview 4174 and the isolated legacy reference server 4183. Storage must
also use a React-specific namespace. No production config is imported.

Initial shell build and four Chromium/WebKit desktop/mobile tests passed in
both themes. This proves only the independent shell gate, not feature readiness.
Full visual fidelity and interaction coverage remain phase 4–7 work.
