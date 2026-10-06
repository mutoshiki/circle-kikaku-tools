# Phase H validation — settlement operations and safe recovery

Status: final author/local verification complete (2026-10-06). Automatic PR CI and integration remain separate gates; this pre-PR evidence does not claim they have completed.

Integration target: `carbon-redesign`. Base: `c33962ed9c28fd3cd94e4a63d52e111a026c7b0f`. Working branch: `codex/phase-h-settlement-operations`. Main must remain `e155d1cf1c4ce213b93f56e8e8c15969206d91ca`. No production/main action is authorized during this phase.

## Authority and product outcome

The sole normative Product UI specification is [SANPOKAI_PRODUCT_UI.md](../SANPOKAI_PRODUCT_UI.md) v1.6, particularly §4–6, §11, §14–16 and §19–23. The approved [design rationale](../../superpowers/specs/2026-10-05-phase-h-settlement-operations-design.md) and [execution plan](../../superpowers/plans/2026-10-05-phase-h-settlement-operations.md) explain implementation; neither becomes a second specification.

| User task | Implemented structure | Contract |
| --- | --- | --- |
| Understand the current amount and remaining work | Compact settlement parent: existing calculation, readiness/corrective links, collection/payment links, memo | §11/14 |
| Repeatedly record actual collection | Dedicated `section=settlement&task=collection`, outstanding/all filter, named row checkbox, standalone inline collector | §14 |
| Confirm payments to vehicles | Dedicated `task=payments`, one existing car-level record, signed amounts/details, same cost workspace | §12/14 |
| Correct a record | Target-row reverse operation, not whole-map Undo or invented ledger | §6/14 |
| Recover interrupted writes | Room-lifetime UI controller, existing exact receipt and single outbox barrier; no replayed command | §14 |
| Share a short settlement note | Inline raw draft, explicit memo-only save, conflict/recovery | §6/14 |
| Save and recover project state | Local history page, read-back, short impact confirmation, conditional memory-only Undo | §15 |
| Use development samples | Existing local/demo capability in secondary history utility; selection without write, separate danger confirmation | §16 |

Global navigation is unchanged. Collection/payment are related but different tasks, not a global workflow stage or a mandatory wizard. Overview/history remain secondary. No generic settings repository, project deletion API, bulk operation, historical monetary ledger, amount lock, completion flag or automatic archive was added.

Official guidance: Carbon permits related multi-line list content and interactive row actions; persistent list content uses the on-page variant. Its installed `ContainedListItem` explicitly keeps interactions in the `action` slot. Sources: [Contained list guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/contained-list/guidelines), installed `@carbon/react` 1.115.0 public API/SCSS.

Project interpretation: repeated collection/payment belongs on durable task pages, filters change a list view, and only a short high-impact confirmation interrupts a task. A list is not a mandatory Carbon component choice. The collection action uses the public action slot and public Checkbox `className`/`labelText` props; product-owned token spacing reserves text/action space. No new Carbon internal selector override or focus override was introduced.

## Protected behavior and source boundary

Byte diff against the integration base is empty for `domain/**`, `store/**`, `sync/**`, `services/**`, `runtime.js`, `ui/allocation-save.js`, existing `components/settlement/edit.js`, vehicle-cost/rules/route controllers, Firebase/Rules, legacy/assets, dependencies/lockfiles, guards/tools and workflows. UI orchestration consumes the unchanged owners; there is no schema, calculation, sync protocol or persistence model migration.

The unchanged collection helper normalizes legacy projection beyond a checkbox's target. The UI uses it once in a detached store, then publishes only the target's existing paid/collector paths through existing commitEdit. History preview uses existing restore and applicant reconciliation on a transport-free detached store. These technical constraints and their costs are explicit in normative §14/15 and the rulings below.

The raw legacy manifest guard reports the same four known mismatches as Phase G: `docs/design/CARBON_MIGRATION_ROADMAP.md`, `docs/design/SANPOKAI_PRODUCT_UI.md`, root `package.json`, `tools/classify-release-changes.mjs`. The two design documents are intentionally revised; the other two are unchanged from the base. This guard is **not claimed green**, recaptured or weakened. Executable/lockfile parity is checked separately. Existing classifier selects React checks and not legacy UI checks; automatic Firebase/shared compatibility remains required.

## Verification results

| Gate | Observed result |
| --- | --- |
| Build after final source fixes | exit 0 |
| Final unit suite including cache submission binding | 295/295, no skips, exit 0 |
| Task 9 four-project H browser matrix | 64/64 at `dce71a6` (earlier source, not final gate) |
| Task 10 SDK / full browser Emulator | 3/3 and 106/106 at `c8d6741` |
| Final SDK / full browser Emulator after recovery/history/focus fixes | 3/3 and 110/110, exit 0; subsequent change is collection action composition/CSS only |
| Final affected four-project browser suite | All H and both caller files covered by final cumulative suite below; earlier 110/120 is not claimed green |
| Final cumulative offline four-project suite | 504 passed / 12 existing conditional skips / 0 failed (516 selected), exit 0, 15.6m |
| WebKit mobile H repeat-each=2 | 40/40, no skips, exit 0 (58.9s) |
| Diff whitespace / protected executable parity / change classifier | exit 0 / empty protected diff / React=true, shared=false, legacy=false, infrastructure=false |
| Automatic PR CI / integration | pending; do not dispatch release/readiness |

Browser configurations: Chromium and WebKit, 1280×900 desktop and 390×844 touch-enabled mobile. Responsive tests additionally cover 390×500, 1055/1056px Carbon breakpoint boundaries, long project/person/car names, light/dark, reduced motion, one main/h1 and document overflow. Geometry checks protect text/action separation and at least 44px collection label hit area (actual measured 49px), not a magic source-string layout.

The 12 existing skips are four mobile-only shell cases on the two desktop projects (8), and opt-in Phase B screenshot capture on all four projects (4). No H or protected behavior case is newly skipped. The existing test named “production preview” runs only on guarded offline `127.0.0.1:4176` with synthetic local data; it is not production smoke or a production write.

Emulator uses only demo project `demo-circle-react`, Auth 9098, RTDB 9008 and guarded preview 4175. Cases use separate synthetic rooms, real SDK transactions, held WebSocket messages and dedicated-room denied writes. Successful finally assertions close clients, release messages, restore/read back original Rules, delete each exact room and check null read-back. No export; emulators shut down. Expected permission-denied logs are negative-case evidence, not suppressed errors.

Coverage includes independent collection rows and same-row correction; payment with other-car/rules/memo edits; exact rejected/expired retry; refresh with original operation identity; unknown outbox acceptance proven by another actual SDK client; foreign-outbox barrier; rename/delete/reset; collector slot/mode context; local history versus shared restore; stale confirmation; whole-business Undo concurrency; failed Undo backup consumption; forbidden shared sample with zero H writes; unchanged legacy-reference financial calculation and protected state after both clients reload.

Final collector regressions cover delayed acceptance after navigating away (no focus steal), failed → refresh → exact retry → editor cleared, old accepted input versus newer raw draft, stale slot population, next/previous/filter focus after Enter, and cancellation to the re-enabled row.

## Honest failure history

- Task 9: local broad current-review initialization was incorrectly downgraded to unknown; real WebKit failure and unit RED reproduced it, fixed without changing shared acceptance rules.
- Task 10: first Emulator run 12 pass/4 fixture failures; second 22 pass/4 fixture/assertion timing failures; final expanded 30/30 passed. Unknown cache must be loaded by a fresh controller; shared sample fixture must be reconciled before seeding; expiry requires waiting for actual outbox deletion; absent paid key is not invented false. Protected owners were not disabled or modified.
- First Task 11 cumulative offline run: 480 pass/8 fail/12 existing skips, 19.2m. All eight failures were two former settlement-parent car-button assumptions across four projects. Successor tests enter payment/all → same car cost task and retain exact draft/distance/Cancel assertions. Neither the former Tile structure nor the button role is protected behavior.
- The initial focused rerun exposed that changing button to link alone was insufficient: the old per-car surface no longer belongs on the parent. Tests now traverse the actual task entry rather than restoring obsolete UI merely to pass tests.
- The focused suite loaded those caller modules before their final edit: 110 pass/10 fail. Its other two WebKit mobile failures read checkbox collections before async initial render (zero measured targets; undefined accessible name). Explicit visible/count condition waits fix the test setup; every geometry/focus assertion remains. Latest-source cumulative and repeat gates are recorded separately.
- One unit invocation stopped at the explicit offline target guard before tests. Rerun uses required target variables; guard is unchanged.
- Before capture first used the old memo's wrong accessible label; then unused WebKit font faces caused screenshot wait timeout. Corrected label and existing screenshot no-unused-faces flag; final capture also runs real selected-Japanese-face and canvas fallback assertions via `expectFontsLoaded`. No font assertion or test safety guard is disabled.
- An evidence audit found independent fixture preparation produced different full hashes (reconciliation timestamps and generated identity). A fixed clock alone did not eliminate the difference. Both sets were recaptured from one prepared canonical JSON file: exact full fixture SHA256 `1c634075dc493511438baa168101ec0204a032a77c0ff8bd91f9f8ec5d0b16ae`, 32/48 scenarios, zero browser errors. Those verified images/manifests replace the initial captures. No product clock or source changed.
- Collection geometry initially compared reserved summary padding with the label. Final assertion compares actual text Range rectangles, so deliberate spacing is not mistaken for content collision. Original rendered source still fails it (text overlap, 20px label); corrected source passes (no overlap, 49px label).

## Browser operations and visual evidence

Equal canonical domain fixture is seeded into base/current offline builds; no production data. [Before manifest](./phase-h/before-manifest.json) and [after manifest](./phase-h/after-manifest.json) include base SHA, capture HEAD plus source-diff SHA256, equal fixture SHA256, engine, viewport, theme, geometry and console/page errors. Capture HEAD is not falsely presented as the base build SHA; baseline is `git archive c33962e`. Current captured source includes the final author fix diff. Four before scenarios and six after scenarios × eight configurations = **80 screenshots**, all retained locally with semantic snapshots. Fourteen representative images and both manifests are versioned here.

| State | Before | After |
| --- | --- | --- |
| Desktop settlement parent | [before](./phase-h/before-chromium-desktop-light-parent.png) | [after](./phase-h/after-chromium-desktop-light-parent.png) |
| Desktop collection | [Modal](./phase-h/before-chromium-desktop-light-collection.png) | [page](./phase-h/after-chromium-desktop-light-collection.png) |
| 390px settlement parent | [before](./phase-h/before-chromium-mobile-light-parent.png) | [after](./phase-h/after-chromium-mobile-light-parent.png) |
| 390px collection | [Modal](./phase-h/before-chromium-mobile-light-collection.png) | [page](./phase-h/after-chromium-mobile-light-collection.png) |
| 390px WebKit dark collection | [before](./phase-h/before-webkit-mobile-dark-collection.png) | [after](./phase-h/after-webkit-mobile-dark-collection.png) |
| 390px WebKit dark history | [Modal](./phase-h/before-webkit-mobile-dark-history.png) | [page](./phase-h/after-webkit-mobile-dark-history.png) |

Additional: [mobile payments](./phase-h/after-chromium-mobile-light-payments.png), [short restore confirmation](./phase-h/after-webkit-mobile-dark-restore-confirmation.png).

Unified in-app browser operations independently exercised baseline utility/sample and collection Modal; final local sample selection/impact confirmation, history save, main navigation, collection keyboard Space → next row, Arrow filter, reverse record, refresh retaining filter/value, 390px layout and dark theme. This manual rendered pass found the checkbox/text overlap that a document-width assertion did not detect. Final Native inspection verifies separated controls; automated interaction, recovery and semantic/geometry assertions complement screenshots.

Initial/direct/shared/legacy URLs, browser Back/Forward/refresh/current page, task return focus, no asynchronous focus steal, empty/loading/failure/unresolved/reset, long labels, copy fallback, IME and short viewport remain covered by browser/unit/Emulator contracts. A viewport screenshot is not software-keyboard or native-screen-reader proof.

Native operations additionally exercised memo raw-draft refresh/save, restore Escape returning to its row, actual restore followed by confirmed Undo, and the heading fallback after the Undo entry disappears. On resume, reconnecting the same local in-app tab was rejected by Browser Use security policy; no alternate browser surface or workaround was used for that rejected action. Existing Native observations are retained as prior-session evidence, not a new pass on reconnect. The separately authorized guarded automated browser gate runs against the final source.

## Obsolete assertion replacement ledger

| Former structure assumption | Observable successor / retained protection |
| --- | --- |
| Settlement parent car Tile and car-button selector | Payment/all or vehicle-cost list link → same canonical car workspace; 200km raw draft across both callers, 18km route Apply, 186km after Cancel; numeric/protected state assertions unchanged |
| Collection large Modal / prompt | Dedicated task, immediate registered checkbox, short inline standalone form, raw/IME/fallback/Cancel/reload/context and exact shared receipt tests |
| History open Modal / footer | Dedicated local history page, header save/read-back, row/current marker, short restore/Undo impact confirmation and logical focus return |
| Sample item in global utility and long SampleModal | Secondary history development task; selection without write, strong confirmation, cancel/stale/shared denial and all existing sample factories |
| Settlement `.settlement-car-breakdown` / three-page wizard screenshots | Existing signed totals and detail content through payment disclosure and rules page; zero-row preserves totals, negative validation and fee IME/deletion remain |
| Modal-layout, Phase A/B shell, Phase 6 and audit screenshot navigation | Same published destinations, one main/h1, current semantics, route local-only/shared distance boundary, theme and protected behavior through current task links |

No new skip, timeout relaxation, snapshot-only substitute or protected domain assertion removal. Original whole-map collection helper characterization remains even though new UI intentionally uses narrow row reversal.

## Independent review and author fix pass

One fresh whole-branch reviewer (`gpt-6-astra`, `c33962e..c8d6741`), read-only, independently passed 52 focused units. Critical: none. Important: three. Minor: none. Executor regraded by user effect and used one TDD fix pass, not a second review.

1. Accepted standalone draft cleanup was view-lifetime dependent, leaving all checkboxes disabled after navigation/retry. Owner tests reproduced RED; cleanup now requires exact accepted/local receipt plus current target/context/reset and matching submitted raw draft. Optional narrow submission binding survives reload; CAS/disposal protect newer input. No full room/token is duplicated.
2. Inline Enter and Cancel lost focus. Rendered RED; post-commit restoration waits for controls to unfreeze and follows next → previous → filter or re-enabled trigger. Navigation/unmounted view is never refocused by completion.
3. A snapshot with object-valued roomName passed validation and crashed React. Model and rendered RED; optional name validation plus safe display fallback leaves malformed rows visible/unavailable and storage byte-preserved, while valid history remains accessible.

The author's additional rendered overlap finding joins the same pass: public Carbon action-slot composition, reserved token spacing and 49px label fix; text-intersection RED→GREEN. Final unit 295/295, offline browser 504 pass/12 existing skips/0 failures and repeated WebKit mobile 40/40 passed after that single author pass. CI remains mandatory.

## Rulings (exhaustive) and costs if wrong

1. Detached collection helper → target-path publish: prevents unintended cost/settings/route normalization during a money checkbox. Cost: incidental normalization waits for its existing feature owner. Normative §14 records the constraint.
2. Broad receipt capture excludes only known `syncApplicantDetails` derived intents: preserves real form-linked sample/restore without inventing a combined outbox. Cost: a derived owner change can require current review instead of exact-success; no safe Undo claim.
3. Detached restore preview runs existing applicant reconciliation: command-only preview understated actual allocation impact. Cost: local computation/subscription overhead, synchronously disposed; no live write.
4. Final review occurs within Task 11 before integration, not after its completion record: integration requires review first. Cost: completion bookkeeping occurs later; no gate waived.
5. Reviewer declined physical keyboard/browser chrome/safe area/native assistive technology: mandatory Phase I device evidence, not emulated PASS. Cost: device-specific defects may remain before final release.
6. Reviewer declined live Maps/Places/Routes: unchanged deterministic local contract stands only for local behavior; mandatory Phase I provider validation remains. Cost: live integration defects could remain until that gate.
7. Reviewer declined running cumulative browser/CI/integration outcome: executor must prove actual final exits/remote SHA. Cost if ignored: falsely reported integration; prior counts do not establish it.
8. Reviewer declined production deployment/smoke readiness: no-production boundary stands. Cost: Phase H does not prove production/device runtime; final Phase I/release gates remain mandatory.

No Phase H reviewer minor was deferred. No declined Important was left unfixed.

## Phase I carry-forward

Retain Phase G's documented deferred findings: malformed v1 rules receipt missing lifecycle can freeze; readiness copy may imply rule Save despite form/safety error; intermittent WebKit mobile menu trigger outside viewport during unknown-recovery setup has unconfirmed cause. A later passing run is not proof that these were repaired in H.

Physical software keyboard/browser chrome/safe area, native NVDA/VoiceOver, live safe Maps/Places/Routes, cross-product content/contrast/reflow and full B–H cumulative compatibility are Phase I gates. Do not infer them from touch emulation, short viewport or ARIA assertions. All calculations/domain capabilities and legacy data compatibility remain protected. Only after I and a separate final PR to main can the authorized standard same-SHA/same-artifact/rollback/dedicated-smoke-room release path begin.

## Integration record

[PR #83](https://github.com/mutoshiki/circle-kikaku-tools/pull/83) targets `carbon-redesign`. Locally verified implementation/evidence commit: `264988993407e3e1dd97d14776dac1755b053982`; the PR's final documentation-inclusive head must pass automatic CI. CI/merge outcome is recorded by that PR and the final execution report, not assumed by this pre-integration evidence. No manual workflow dispatch; no main merge, production release/deploy/cutover/smoke or production Firebase write. Final report must name actual integration SHA, checked head and CI result, with protected main unchanged.
