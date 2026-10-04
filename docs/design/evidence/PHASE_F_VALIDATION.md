# Phase F validation evidence

Status: implementation candidate; independent whole-branch review, cumulative browser result, PR CI and integration are still pending. This file records evidence, not a second Product UI specification. Normative owner: [SANPOKAI_PRODUCT_UI.md](../SANPOKAI_PRODUCT_UI.md), especially §10, §12, §20–23.

## Scope and provenance

- Integration base: `f232d8d7de2c2077255c47e7f6e02f0085cfda77` (`carbon-redesign`, Phase E).
- Candidate branch: `codex/phase-f-vehicle-cost-workspace`; Task 8 commit: `4cb73e9e61f1b7700e5643e118fd8b0bfc2ea496`.
- Worktree: `C:/Users/toshi/.codex/worktrees/phase-b-shell/circle-kikaku-tools`; unrelated primary-checkout changes are untouched.
- Before screenshots were captured at `652ea5e`, after target/draft characterization but before any Phase F Product UI implementation. Its rendered UI still contained the Phase E expense/movement/route dialogs. Four configured browser projects passed the temporary before-evidence capture (4/4); that capture was removed after collection.
- Before directory: `%LOCALAPPDATA%/Temp/circle-react-migration-evidence/phase-f-before`. After: sibling `phase-f-after`. The route Carbon test and responsive test produce after screenshots; snapshots are evidence, not the acceptance contract.
- `@carbon/react` stays at 1.115.0. Existing ContainedList public action slot, native RadioButtonGroup keyboard behavior, Grid/Column and `lg=1056px` were checked before composition. No dependency/lockfile change.

## Task-to-contract mapping

| Task | Implemented structure / interaction | Normative mapping |
| --- | --- | --- |
| Find the car to input | Primary vehicle-cost destination; exact owner-labelled entrances from car allocation and settlement | §2–4 navigation/context, §12 car workspace |
| Enter meter distance and cost | Private/Times movement and standard/additional/signed/reused expense capability retained; one active car-wide form | §10 movement, §12 cost detail, §22 protected behavior |
| Calculate a distance | Dedicated stops → search → textual candidates/optional map → Apply | §12 route task; Apply edits only the selected car draft |
| Return or resume | Durable task URL; logical parent-return focus; raw per-car cache across reload/navigation/resize | §6 Save/Apply/Back, §12 draft recovery |
| Save alongside other drivers | Existing scoped settlement-car intent and existing acknowledgement proof; no new domain or sync protocol | §12 save boundary, §22 protected invariants |
| Handle rejection / uncertain outcome | Frozen exact payload and extra identities; exact retry; explicit current-cost confirmation only for acknowledged adjustment/reset | §12 failure/recovery, §17 feedback |
| Use narrow screens | Below lg one task surface; lg+ list/editor in one Grid, native fieldset with inner input Grid, document scroll | §20 responsive, §22 a11y |

No participant/allocation algorithm, rule wizard, payment, collection, history or destructive workflow redesign was included. Route/SDK service and data owners are unchanged. No random-allocation provenance UI was added.

## Verified runs

All tests use synthetic data, guarded offline or demo Emulator configuration. No ambient production Firebase or Maps config is used.

| Gate | Command / suite | Observed result |
| --- | --- | --- |
| Full unit after Task 9 owner-local corrections | Root `npm test` | 126/126, zero fail/skip |
| Golden financial characterization | `vehicle-cost-calculation.test.mjs` | 5/5 against unchanged legacy reference; complete result equality, not invented formulas |
| Affected feature matrix at Task 7 | workspace/route/settlement/negative/route-Carbon files, all four projects | 116/116 |
| Cost/route after Task 8 recovery corrections | workspace + route, all four projects | 36/36 |
| Responsive/empty/reduced-motion additions | `vehicle-cost-responsive.spec.js`, all four projects | 8/8 |
| React Emulator unit | `npm --prefix apps/react run test:emulator` in Auth/RTDB emulators | 3/3 |
| Cumulative real multi-client browser Emulator | `npm --prefix apps/react run test:browser:emulator` | 54/54 (14 vehicle-cost + 40 participant/allocation/sync), Chromium desktop and WebKit mobile |
| Shared Firebase Rules | Root `npm run test:firebase:emulator` | PASS: rooms, private reports, atomic notification lease/retry/terminal sent |
| React build | `npm --prefix apps/react run build`, local sync | PASS; existing bundle-size warning retained |
| Protected owner comparison | `git diff f232d8d..HEAD` plus working changes over assets/Firebase/domain/store/sync/route/runtime/services | Empty |
| Change classifier | `node tools/classify-release-changes.mjs f232d8d HEAD` | React true; shared/legacy/infrastructure false; React CI and shared collaboration/Firebase gates remain required |
| Initial cumulative offline browser | `npm --prefix apps/react run test:browser`, four projects | 356 passed / 4 failed / 12 pre-existing conditional skips. All failures: `phase-ab-review` current-section canonicalization focus, one per project; correction and final rerun pending |

Safety target variables are set in each runner process. Offline uses `demo-circle-react` with a loopback database URL; Emulator uses Auth 9098/RTDB 9008 and the same demo project. Preview ports are 4176 offline and 4175 Emulator. The temporary absolute-path Emulator config is not committed and does not alter repository Rules.

Every new cost Emulator test releases held sockets, closes clients, restores and verifies original Rules, deletes only its own synthetic room, and asserts that room is absent in `finally`. Deliberately denied writes produce expected permission-denied warnings; those warnings are visible in logs, not suppressed. Browser page errors are not silently ignored.

## Browser interaction / geometry evidence

- Automated projects: Chromium desktop 1280×900, Chromium touch 390×844, WebKit desktop 1280×900, WebKit touch 390×844. Responsive cases additionally test 1055/1056/390×500 in light and dark with reduced motion.
- Long project/car/expense/place names and a 15-digit raw amount: no horizontal document overflow; one active form across lg; unchanged draft URL/value; Save is reachable and not covered; actual OverflowMenu hit area ≥44×44; menu usable by touch/keyboard.
- WebKit exposed native legend overflow when the fieldset itself used Grid. Actual measured failure: viewport 1056, legend x=576/right=1567, parent width 448. Native fieldset layout plus an inner input Grid fixes the cause without a Carbon internal override or hidden content.
- Empty cost page now has a task link to car allocation; Enter changes section and focuses its heading. No empty-state wrapper Tile or added success notification.
- Existing feature tests cover direct/shared/legacy inbound URLs, Back/Forward/refresh, current navigation, main/h1, invalid-fee focus, IME, raw input, logical parent/accepted-return focus, and unaffected payment/memo/settings.
- Initial full run exposed a shell focus gap also present at the Phase E base: first selecting the already current section from a room-only URL pushes its canonical URL but does not change the logical section. The shell now explicitly focuses that selected current section, preserving initial-load non-focus-stealing behavior. A new keyboard regression first failed on the unchanged owner. Existing A/B focus assertions were retained, not adjusted to fit the bug.
- Actual Unified CUA browser control worked in this session (no plugin install required): IAB Chromium at exact 390×844 light/dark and 1280×900 dark. A synthetic sample car's 210km draft survived reload, nested Back and resize. Route Back focused `vehicle-route-launch`; one form; no overflow. SDK-unavailable search retained its query and exposed Retry/Back, with no console warning/error in the captured log. Temporary viewport override was reset.
- Actual Google Maps service calls were not made. Deterministic search/resolve/route/map doubles replace only the external adapter in automated cases; room store, edit/receipt and actual Emulator transport remain real.

## Replaced guards and retained protection

1. Old cost dialog existence, internal modal scroll/mask and 72px rows → observable main/h1/form, durable task URL/current item, logical parent focus, document scroll/responsive non-overlap.
2. Old nested movement footer Apply → car-wide Save/Cancel, raw/IME input, intermediate Back and route Apply change only unfinished input. Settings/payment/memo modal assertions retained.
3. Old route button-role radio/dialog styling → native Arrow-key route candidates, current query empty/error/delay/reload ownership, options/manual/map fallback, local itinerary versus shared distance.
4. Generic old cost button name → exact car-labelled entrances and same draft from nav/allocation/settlement, accepted-return focus. Existing table/payment/rules behavior retained.
5. Fixed six navigation items → functioning named current destination including vehicle costs, not count alone.
6. Old walk-through cost screenshots → equivalent after states; screenshot updates are not a substitute for interaction assertions.

Historical `verify:legacy` is still red for four paths already mismatched on the Phase E base: `CARBON_MIGRATION_ROADMAP.md`, `SANPOKAI_PRODUCT_UI.md`, root `package.json`, `tools/classify-release-changes.mjs`. Their base mismatch was verified; the manifest was not recaptured or weakened. Protected executable owner bytes, golden comparison, Rules and cumulative collaboration are separate current evidence. Do not call that historical command green.

The full browser configuration already contains eight desktop skips of mobile-only shell tests and four opt-in Phase B screenshot-capture skips. No Phase F test adds a skip, and no failing behavior was skipped. Report those applicability skips separately from failures; CI's existing report checker does so too.

## Decisions and remaining gates

- Extra fee locators use `extra:<opaque ID>` to prevent movement locator collisions; id-less rows are UI-local and never guessed as a durable financial identity.
- Blank pending extras remain visible and block Save as existing readiness requires; they are not silently dropped.
- A standalone exact name matching exactly one participant uses the canonical conversion's existing participant path; duplicates remain blocked, not guessed.
- Acknowledged-adjusted/reset receipts expose a disclosed “current costs” action that closes only the local input record; no inverse shared write or unproved retry. Pending/unknown receipts cannot discard through that action.
- Existing canonical base permits cost recovery on sync write error while global failure remains visible; cached values are never presented as proof of shared acceptance.
- Denied-reload test first waits for persisted rejection proof and enabled Retry. Rendering a Retry button while pending is not rejection proof; unknown reload is separately protected.
- Final review occurs after local candidate evidence but before Task 9 completion/CI/merge because Task 9 itself contains those gates. It does not mark unfinished integration complete.

Pending: single fresh-context whole-branch review and any verified Critical/Important TDD fixes, final cumulative browser result, PR CI, safe merge only to `carbon-redesign` and remote SHA verification.

Retained Phase I checks: live Google Maps/Places/Routes under approved safe configuration, physical software-keyboard/browser chrome, device safe-area, native NVDA/VoiceOver and final integration regression. Synthetic taps, screenshots, semantic assertions and reduced-motion emulation do not constitute those device/SR checks.

Production: no main merge, Readiness/Production Release dispatch, compatibility deploy, root cutover, production smoke or production Firebase write.
