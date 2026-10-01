# Phase E validation — car and team allocation

Status: local implementation acceptance and independent review complete, 2026-10-02. Post-review cumulative gates pass; remote CI/integration are the separate final gate recorded below. This evidence is descriptive; [Product UI v1.3](./SANPOKAI_PRODUCT_UI.md) remains the only normative Product UI specification.

Integration base: `3fcdf5ead75fd984098f019ddacf290e5fb0b6d7` (`carbon-redesign`, Phase D / PR79). Work branch: `codex/phase-e-allocation-workflow`. No main merge, Production Release, compatibility deploy, root cutover, production smoke or production Firebase write.

Remote integration record: [PR80 — Phase E allocation workflow](https://github.com/mutoshiki/circle-kikaku-tools/pull/80), base `carbon-redesign`; [required CI run](https://github.com/mutoshiki/circle-kikaku-tools/actions/workflows/quality-guard.yml). The linked PR/check state is the authoritative remote gate; this document does not dispatch or certify a production release.

## Task and design traceability

Goal: confirmed participants can be assigned and corrected by manual or random operation, then the actual current car/team result can be read or copied for the morning announcement. Registration and participant confirmation remain Phase D; distance, individual driver costs and settlement remain Phases F–H.

- Product UI §2–6: existing sibling car/team destinations, shell title/current location and URL-owned nested tasks; no new Tabs, wizard or mandatory completion stage.
- §9: Desktop comparison of groups and unassigned people; Mobile list → group → assign, with direct one-person move. Repeated moves are not Modal tasks. URL task/group state survives refresh/Back/Forward; resize never navigates.
- §9: all-person count/limit includes the structural anchor. Stored capacity continues excluding it. Explicit driver/leader roles are independent of that anchor, including zero/multiple role holders. Fixed is shared across allocation types and constrains randomization, not manual moves.
- §16–19, §21–23: brief attribute/confirmation dialogs, operation-specific saving/failure, field validation, logical focus return, keyboard/touch alternatives, tokens/Grid, minimum review checklist and protected data behavior.
- Morning result is a live read-only projection and optional copy, not a published snapshot, finishing step or second editable roster. Same-name identities remain separate. Private memo/marks/grades/costs/tokens/IDs are excluded from copied text.
- User decision: no random-allocation provenance display/control in Phase E. It can be designed later; the old randomization label is not reliable evidence of how the current result was created.

**Official guidance:** [Contained list usage](https://carbondesignsystem.com/components/contained-list/usage/), [Contained list accessibility](https://carbondesignsystem.com/components/contained-list/accessibility/), [Modal usage](https://carbondesignsystem.com/components/modal/usage/), [2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/). Actual installed APIs checked: `@carbon/react` 1.115.0, icons 11.87.0; public ContainedList action slots, RadioButton label/input relation, Grid/Column and registered TaskModal composition.

**Project interpretation:** the comparison/drill-in structure, all-person adapter, scope review, exact operation receipts and private-safe morning copy follow Sanpokai's tasks. Carbon does not define allocation eligibility, storage capacity, random algorithm, role cardinality or URL names.

## Behavior acceptance matrix

| Contract | Owning evidence |
| --- | --- |
| Same commands/IDs/roles/fixed/normalization | `allocation-view.test.mjs`, existing `domain.test.mjs` / `store.test.mjs`; real store, deterministic clock/random and protected downstream comparisons |
| Defaults 4/6 displayed ⇔ 3/5 stored; bounds, legacy larger limits | Adapter tests and `browser/allocation-workflow.spec.js`; invalid field association/focus, no truncation of existing larger values |
| Anchor not invented as role, multiple/no roles, owner reanchoring | View/domain characterization and existing allocation browser contracts |
| Waiting→group→group→waiting, Cancel no mutation | New manual browser contract, fixed participant still manually movable, independent team state retained |
| Empty/full/locked waiting, shrink including fixed overflow | Existing/new allocation browser tests and canonical characterization; full target unselectable, latest full target disables manual submit |
| Remote deletion/full target during selection | Emulator stale-move test: only invalid local form/selection abandoned, current group retained, status announced and surviving h1 focused; no compensating write |
| Random actual eligibility/slots, Cancel, changed reviewed scope | View tests, browser review and real two-client Emulator test; changed scope issues zero commands on first decision, second explicit click may proceed once |
| Exact random/group retry across refresh | Receipt unit tests and denied-write Emulator tests; same payload/group identity, not another shuffle or group creation; unrelated team state kept |
| Accepted operation not replayed; missing/pruned ack unresolved | Receipt tests with real room-sync/fixture server; shared success requires this operation's authoritative marker, not empty outbox |
| Two clients compete for last slot | Emulator test: prepare against same old slot, commit A then B; compare both canonical client states, exactly one adjusted disposition and protected participant/settlement values |
| Reset discards in-flight operation | Emulator test and receipt tests; no unsafe replay, inspect actual outcome; deleted deep group falls back only after initial load, retains room/handoff token |
| Late acknowledgement does not steal another task's focus/input | Emulator test, repeated 3× per engine: wait for route focus, enter participant draft, release held acknowledgement, same focused input/value retained |
| Morning display/text fresh, privacy-safe, duplicate-safe | Presentation adapter/browser tests, another client name update reflected in current text, no mutable controls; issues retained without fake completion |
| Same-name group destinations identifiable | Duplicate-anchor adapter and car/team assignment/direct-move contracts in all four browser projects: consistent projected-order suffix across summary, heading, option and copy; private attributes excluded |
| Submitted editor payload stays fixed | Denied-write Emulator test holds the outgoing save, verifies all six editor fields disabled while pending and after failure, retries the original name/memo, checks authoritative shared result and receipt clearance |
| Copy failure/pending result | Browser clipboard rejection/selectable fallback; rejected/recovered relevant receipt blocks copy until proved resolved; unrelated allocation-only/memo-only receipt does not block |
| Linked applicant vehicle reconciliation | Separate Emulator test and dialog warning: existing source-owned capacity/group can be reapplied/recreated; domain listener unchanged |
| Direct/shared/legacy entry, refresh/history, current location | Existing shell/navigation tests plus new task/group URL contracts and real deleted-group load |
| Keyboard/menu/Modal focus, touch, long text/overflow | Four-project offline browser matrix, light/dark captures, direct CLI interaction and inspected screenshots; no drag/hover-only dependency |

## Executed commands

All test commands used explicit `SANPO_TEST_FIREBASE_TARGET`, demo project and localhost database URL. Browser offline mode additionally forces local sync and removes production Firebase/Maps configuration. Emulator: `demo-circle-react`, Auth 9098 / RTDB 9008, synthetic rooms only; Rules changes only to that local emulator and restored in each denial test's `finally`.

| Gate | Result and local evidence |
| --- | --- |
| Fresh local `npm.cmd run build` | Post-review PASS; `%TEMP%/phase-e-postreview-build.log`; existing large-bundle warning, not a failure |
| `npm.cmd test` | Post-review 89/89 PASS; `%TEMP%/phase-e-postreview-unit.log` |
| Full offline `npm.cmd run test:browser` | Post-review 316 PASS / 12 preexisting conditional skips / 0 failures (10.9m); `%TEMP%/phase-e-postreview-browser.log`. Earlier gates 308/12 passed before the eight duplicate-group cases were added |
| `npm.cmd run test:emulator` | Post-review 3/3 PASS; `%TEMP%/phase-e-postreview-emulator-unit.log`; Rules/schema6/legacy-reader compatibility and future-schema rejection preserved |
| Full `npm.cmd run test:browser:emulator` | Post-review 40/40 PASS (1.3m); `%TEMP%/phase-e-postreview-emulator-browser.log`; Chromium Desktop and WebKit iPhone/390px; earlier 38/38 plus two submitted-editor cases |
| Late acknowledgement repeat | 6/6 PASS; `%TEMP%/phase-e-late-repeat.log`; route-focus precondition proved before input and network release |
| Focused remote capacity/deletion + last slot | 4/4 PASS; `%TEMP%/phase-e-stale-green.log`; stale move first failed on enabled submit in both engines, then corrected |
| `git diff --check` | PASS; no whitespace errors |
| Protected source path diff against exact integration base | Empty for legacy `src/`, Firebase, React domain/store/sync/adapters; no dependency, schema, algorithm, calculation or persistence model change |
| Historical `npm.cmd run verify:legacy` manifest | NOT GREEN; same three paths already differ at the exact base: `docs/design/SANPOKAI_PRODUCT_UI.md`, root `package.json`, `tools/classify-release-changes.mjs`. Only the approved normative document changes further in Phase E. Root package/classifier unchanged from base. Manifest not recaptured or weakened. This is not a domain-source failure |
| Independent review | One fresh reviewer; two Important fixes verified RED→GREEN and all cumulative gates above rerun; one named Minor deferred to I |
| Remote required CI / integration | [PR80](https://github.com/mutoshiki/circle-kikaku-tools/pull/80) records the live check/merge outcome; base `carbon-redesign` only. No production-readiness dispatch or main/release operation |

The 12 offline skips are existing conditions: four opt-in Phase B evidence captures without their evidence environment, plus four mobile-only navigation/focus tests excluded from each desktop project. No Phase E behavior is skipped.

## Real-browser and visual evidence

- Before: actual Chromium desktop discovery on the Phase D implementation, synthetic room `PHASE-E-DESIGN-LOCAL-3`; `.playwright-cli/page-2026-10-01T07-57-44-445Z.yml` through `07-59-26-748Z.yml`, also recorded in the detailed design §3. This is before DOM/interaction evidence, not a claim of before screenshots in every engine/theme.
- After: Chromium/WebKit at 1280×900 and 390×844; light/dark images in `%TEMP%/circle-react-migration-evidence/allocation-{project}-{g10|g100}.png`, inspected individually. Group roles, upper limit, unassigned context, action slots and no document overflow retained. The browser matrix also covers long project names, duplicate identities, empty/full, short viewport, reduced motion and logical history/focus.
- Direct headed Chromium CLI: started empty; added six people/two drivers using registration UI, selected a waiting person, manually assigned, reviewed/executed random allocation, read/copied result, resized to 390×600, switched dark and refreshed current result URL. DOM snapshots and screenshots at `.playwright-cli/page-2026-10-01T09-52-47-759Z.yml`, `10-06-50-079Z.png`, `10-09-56-653Z.png`, `10-13-04-989Z.png`, `10-14-35-989Z.png`. Initial existing favicon 404 is the sole console error; Carbon feature-flag notices are informational. No blank, blocking overlay or horizontal overflow found.
- Direct headed WebKit interaction (2026-10-02 JST): fresh synthetic local room `PHASE-E-HUMAN-WK2`, empty → sample through UI → manual person-to-waiting move using Tab/Enter → 390×600 group detail/assign → Back/Forward with heading focus → radio keyboard Space → assignment → read result → dark theme → refresh with same result/data. No horizontal overflow or app warning/error; Carbon flag notices informational. Snapshots `.playwright-cli/page-2026-10-01T20-48-25-333Z.yml` through `20-52-44-593Z.yml` (UTC timestamps). Repository automated tests use pinned Playwright 1.61 WebKit; CLI additionally uses its own installed browser runtime. No package/lockfile was changed.
- WebKit final direct screenshots inspected at `%TEMP%/phase-e-webkit-{desktop|mobile}-dark-final.png` (1280×900 / 390×600, actual `g100`, no document overflow). Refresh preserves result/data; the existing theme state resets to `g10` after reload, so dark was explicitly selected again before these captures. The CLI initially stalled on unused font faces; restarted only the owned session with the repository's existing `PW_TEST_SCREENSHOT_NO_FONTS_READY` capture setting. Selected Japanese font readiness remains asserted by the full visual tests. Neither app font CSS nor a behavior assertion was altered to obtain screenshots.
- Two-client last-slot outcomes are retained as main-content text attachments alongside exact state/receipt assertions. Windows Playwright 1.61 multi-context routed-WebSocket trace finalization produced truncated ZIP/file-stream errors, and background screenshots stalled; this new Emulator test file disables traces only on Windows, retaining all assertions and attachments. Linux CI retains failure traces; existing other files retain their tracing. Four-project screenshots are the separate visual gate, not a replacement for shared-behavior checks.

## Minimum Product UI §23 review checklist

- [x] Goal/task, phase boundary, sole normative sections and protected domain separation stated above.
- [x] Pattern choice and rejected alternatives documented in detailed design §4–7: repeated Modal rejected, drag-first rejected, mandatory publication/wizard rejected; short edits/danger decisions retained.
- [x] Page title/context, assigned/unassigned hierarchy and action ownership explicit: add Primary only with no groups; assignment/move Primary in its own form; random/add otherwise Tertiary; rare role/fixed/edit/danger in Overflow; copy one Primary in read-only task.
- [x] Immediate-command vs local form draft/Save; Cancel vs Back vs retry; exact failed-operation ownership recorded. No page-wide allocation Save or success Toast for obvious row changes.
- [x] Japanese labels, empty/disabled/no-slots, invalid input, pending/rejected/adjusted/reset/unknown, copy failure and exact-name deletion checked.
- [x] Installed public Carbon API/keyboard behavior, Grid/spacing/type/color tokens; no new global `.cds--*` overrides or Carbon focus override.
- [x] Official guidance separated from Sanpokai interpretation; references above.
- [x] Desktop/mobile engines, light/dark, touch emulation, keyboard, headings/labels/status, focus entry/return, short viewport, reduced motion and no horizontal overflow checked in browser contracts.
- [x] Source-text/internal-class assertions replaced only where obsolete structure changed; domain outcomes, role/fixed/delete/memo/settlement regression retained. Geometry/semantics not snapshots alone.
- [x] No production/main operations; final redesign release is a separate Phase I gate.
- [ ] Physical software keyboard / iOS browser chrome / native safe-area behavior / native screen reader: NOT VERIFIED on real hardware. Viewport/touch emulation is not that evidence; mandatory final Phase I device/screen-reader gate remains open.
- [x] One independent fresh-context whole-branch review, with the two Important findings reproduced RED→GREEN (see below). Required CI/integration is tracked separately by PR80's live check and merge record.

## Follow-up boundary

Phase F owns route/movement and each driver's vehicle-cost inputs, including nested draft navigation and Maps/Places/Routes gates. Settlement logic/payments remain G/H. Final physical-device/accessibility/zoom and cumulative integration checks remain I. Random provenance is a separately scoped future enhancement, not a missing Phase E requirement.

## Independent review and fix pass

Fresh reviewer assessed `3fcdf5e..98036ae` against the sole normative document, approved design, plan, ledger and Review Focus. No Critical findings; two Important, one Minor. The author verified the code paths and re-graded by actual user impact. One fix pass only; no second review substituted for tests.

- Important: the allocation participant editor allowed newer input after its original payload was applied; an exact retry then closed the editor and discarded that newer input. Reproduced as enabled fields during a held save in both engines, then fixed by opt-in Carbon disabled props for pending/unresolved allocation saves. Default Phase D editor behavior unchanged. Targeted Emulator test 2/2 PASS; checks original authoritative name/memo, not merely the button state. Evidence `%TEMP%/phase-e-review-edit-{red|green}.log`.
- Important: two same-name anchors with equal vacancy counts had indistinguishable group destinations. Unit and four mobile car/team tests failed before the fix. One UI projection now applies duplicate-only ordinals in existing projected order, consistently consumed by headings, links, move/assignment options and copy. IDs and canonical state unchanged, no private attribute used. Unit 6/6 and all four-project car/team contracts 8/8 PASS. Evidence `%TEMP%/phase-e-review-duplicate-{red|green}.log`, `phase-e-review-duplicate-browser-{red|green}.log`.
- Deferred minor: copied waiting-person lines omit their explicit driver/leader role while the read-only result shows it. Names and waiting placements are not lost, but metadata differs. Track as a Phase I handoff consistency fix, with car/team adapter coverage, before final cumulative acceptance. No assertion was removed to conceal it.

Reviewer limits were explicitly ruled on: excluded provenance/publication/messaging/authorization/repository/schema workflows stay excluded; route/Maps/vehicle costs remain F; settlement/payment/history remain G/H (not independently hand-calculated here); algorithms/source reconciliation/sync remain protected; real-device/native SR remains an open I gate; allocation limit is not legal seating certification; production/main/live Firebase verification remains prohibited. Existing capabilities remain available, not declared unnecessary.
