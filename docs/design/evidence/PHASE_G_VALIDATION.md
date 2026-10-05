# Phase G validation evidence

Status at the local evidence checkpoint (2026-10-05): implementation through Task 8 at `8b7b2ac809ca04d3915d21dbafd6672a0b1bebef`; cumulative offline browser gate, independent whole-branch review, PR CI and integration are not yet complete. This is descriptive evidence, not a second Product UI specification. Normative owner: [SANPOKAI_PRODUCT_UI.md](../SANPOKAI_PRODUCT_UI.md), especially §6, §11–14, §20, §22–23.

## Scope and provenance

- Integration base: `dbd4d76c3456e344d13f2f36004303616b99b385` (`carbon-redesign`, Phase F).
- Candidate branch: `codex/phase-g-settlement-rules`. Worktree: `C:/Users/toshi/.codex/worktrees/phase-b-shell/circle-kikaku-tools`. Unrelated primary-checkout and historical untracked files remain untouched.
- Installed Carbon remains `@carbon/react` 1.115.0. No package/lockfile or protected-owner change.
- Before was captured from `c97c951`, before Product UI implementation. App, Settlement and styles were byte-identical to integration base at that checkpoint; no later build is labelled before.
- Equivalent before/after use `vehicle-cost-fixture.js`, Chromium/WebKit, 1280×900 or 390×844, light/dark, standalone-mode entry and raw driver/member/reward inputs `1`/`3`/`-300`. Neither capture saves shared settings. After capture uses Task 8 build `8b7b2ac`, document scrolled to its top before full-page capture to avoid misleading fixed-header placement.
- Local screenshot roots: `output/playwright/phase-g/before/` and `output/playwright/phase-g/after/`; filename `<chromium|webkit>-<1280|390>-<light|dark>-<mode|invalid>.png`, 16 images in each. Before WebKit and after use existing `PW_TEST_SCREENSHOT_NO_FONTS_READY=1`; font loading/device behavior is not proved by this bypass.
- Additional actual fixture form images: `%LOCALAPPDATA%/Temp/circle-react-migration-evidence/settlement-rules[-dark]-<project>.png`. Failure traces and JSON results stay in that test evidence directory, not production artifacts.

## Task-to-contract mapping

| User task | Implemented structure / interaction | Normative mapping |
| --- | --- | --- |
| Find and edit rules | Durable `section=settlement&task=rules`, contextual return, one App-owned main/h1 | §2–4, §13 |
| Set target and burden | One grouped form: target, rounding, reward/club, exemption/offset, effects | §11, §13 |
| Understand effects | Current/candidate full domain results, burden and cash-collection counts distinct; per-car disclosure with sources | §13–14 |
| Correct missing costs | Typed correction to existing current car/fee workspace, preserved rules draft on browser Back | §12–13 |
| Resume or cancel | Versioned raw local draft, explicit discard before publication, no shared undo on Cancel | §6, §13 |
| Save concurrently | Existing settings-only intent/receipt, changed paths, latest independent costs and payment maps retained | §13, §22 |
| Recover rejection/uncertainty | Frozen exact payload, proven operation outcome, exact retry; adjusted/reset explicit current-result review | §6, §13, §17 |
| Work on narrow screens | Carbon lg 1056px 10/6 Grid; below lg one DOM/form; document scroll and end actions | §20, §22 |

No collection/payment/history/danger workflow redesign, new business engine, global collector setting, personal exemption schema, shared lock or completion flag is introduced. Two limited repairs preserve the already-existing standalone collector behavior; see decisions below. Phase H owns its redesign.

## Observed checks

All runs use guarded offline or demo Firebase Emulator targets and synthetic rooms. No production data or ambient production Maps configuration is used.

| Gate | Actual result at this checkpoint |
| --- | --- |
| Full React unit, Task 9 | 227/227, zero failure/skip |
| Task 1 golden full-result/settings characterization | 64 calculation combinations plus identity/raw/legacy cases; complete legacy-reference equality, not independent formulas |
| Task 7 affected four-project matrix | 140/140 before subsequent Task 8 corrections |
| Task 8 rules workspace four-project matrix | 24/24, including organizer clear/reload and protected standalone collector |
| Latest-source first-edit controller/model/parity | 85/85; controller first-edit regression observed RED before owner-local correction |
| Task 8 final cumulative real browser Emulator | 72/72: 18 rules plus 54 prior participant/allocation/vehicle/sync cases; Chromium desktop/WebKit mobile |
| React real SDK/Auth/RTDB Emulator | 3/3 |
| Shared Firebase Rules | PASS: rooms, private reports, notification lease/retry/terminal sent |
| Task 9 React build | PASS, local sync; existing bundle-size warning retained |
| Initial full offline browser | 423 passed / 1 failed / 12 existing conditional skips (436 cases); failure is WebKit desktop first-added-fee input lost before route round trip. Not a green candidate; focus race investigation follows |
| Focus correction affected matrix | 88 passed / 8 pre-existing applicability skips / zero failures, four projects; deterministic held-rendering callback test now preserves field focus and input |
| Final full offline browser / focused WebKit repeat | Pending; no result inferred from affected suites |
| Change classifier | React true; shared/legacy/infrastructure false; automatically selected React/Firebase/shared collaboration checks still required |
| Protected executable/lockfile diff against integration base | Empty for assets, Firebase, domain, store, sync, services, runtime, existing settlement edit owner and lockfiles |
| Historical raw `verify:legacy` | Same four failing paths as Phase F base: design Product UI/Roadmap, root package.json, classifier. Each is already a manifest mismatch at base. No recapture/skip; executable parity and shared tests are independently required |

## Browser interaction evidence

Configured Playwright runs actual Chromium/WebKit desktop and 390px, both themes, short viewport, 1055/1056 boundary, long Japanese names, large money amounts and 99 repeated driver fields. Assertions cover one form, landmarks/headings, native radio arrows, touch, IME, error association/first-invalid focus, current navigation, direct/shared/legacy/task URLs, Back/Forward/refresh, corrective links, no unintended writes, action reachability and document overflow. Semantic/geometry/interaction checks are the contract; class names and screenshots are not.

Unified browser control is available in this session; no Browser plugin installation is required. Actual IAB interaction at Task 8 build, offline dedicated room `PHASE-G-CUA-LOCAL`: raw reward 1500, radio ArrowDown, unsaved state, Back returning focus to the real rules link, reload preserving raw 1500 without stealing initial focus, and Cancel returning focus to that link. Earlier interaction also reproduced invalid reward focus, candidate-only correction problem and standalone collector focus/input/save. Current browser error/warning list is empty; all agent-created tabs close. IAB does not substitute for the explicit WebKit test projects.

Real Emulator cases hold outbound or inbound WebSocket messages and temporarily deny only their dedicated synthetic room. They verify exact one-operation payload, refusal/reload/retry, independent driver costs and settings, dirty-path conflict, first edit after an observed unrelated setting update, delayed completion after navigation, reset fencing, removed/duplicate organizer identity, full protected-state projection and legacy-reference financial equality. Every finally closes clients/releases sockets, restores and reads back original Rules, deletes the exact room and checks authenticated null readback. Successful cases check outbox quiescence.

Unknown/lost-outbox and accepted-then-changed recovery tests deliberately use narrow cached UI-receipt fixtures after real denied/accepted transport events. They are not claimed as physical network-loss experiments; own operation proof is checked independently from a later unrelated operation draining the outbox.

## Obsolete assertions and replacement coverage

| Former UI assumption | Preserved behavior / replacement |
| --- | --- |
| Three wizard steps / Next enabled / modal footer | One named page form, one Save, all-group invalid submit and first-active-field focus |
| Settings dialog / viewport mask | No rules dialog, reachable 44px-or-greater end Save/Cancel, one main/h1 and document overflow checks |
| Ghost settings button/class | Durable rules link outside car-payment heading, accessible name and measured target |
| Mode-specific hidden wizard inputs | Raw names/counts/reward retained on mode alternation, Back, refresh and receipt recovery |
| Three step screenshots | Equivalent mode/invalid page evidence and actual domain current/candidate/detail presentation |

Existing monetary/signed-extra/paid/collector/memo assertions remain. No new test skip or protected assertion removal. Existing conditional browser skips, if present in the full run, will be listed separately.

## Verified defects repaired during implementation

- Candidate-only standalone cars originally produced correction links to nonexistent shared targets. Model RED now requires intersecting with current canonical editable cars; show Save-first explanation until the real target exists. No new vehicle draft is invented.
- Rules page omitted global sync metadata. Real Emulator entry failed on missing semantic status; App now appends existing sync separately from draft/readiness/receipt state.
- Clearing organizer reverted the displayed Select to the saved ID. Browser RED; snapshot now supplies exact selected identity, including explicit empty selection, across reload. Canonical duplicate order cannot silently choose a different displayed person.
- First edit of a remotely updated but untouched field used page-opening baseline and falsely blocked Save. Unit RED; original baseline is now acquired when that field first becomes dirty. Already-dirty paths retain their original conflict protection. Real two-client test additionally observes remote 700 then local first edit 1600.
- Initial cumulative WebKit desktop run lost an added fee name despite successful fill. The next-click trace shows the empty input. Ordinary eight repeats passed, so they did not disprove the race. A deterministic held-rendering-callback regression then failed when App's queued animation-frame focus stole focus after task input began. Navigation focus is now committed in the destination layout effect before user input, with initial direct entry still unchanged. This is an App-owner page-anatomy correction, not vehicle/domain redesign.

## Decisions made during execution

1. Restore the existing short CollectionPrompt accidentally removed in `ef744a3`: an actual standalone collection test reproduced the broken reference. This is protected behavior repair, not Phase H redesign. If wrong, the former brief prompt returns; payment/sync owners remain unchanged.
2. Retain the original per-value `(Number(raw) || 0)` count sum instead of the plan's simplified Number sum: source and failing model test show invalid/comma count with zero counterpart cannot pass the old guard. If wrong, malformed count may be rejected unnecessarily; fractional counts and reward commas retain existing interpretation.
3. Temporarily suspend collection review while its collector prompt is active, preserving review/filter state, and omit the parent launcher ref only during suspension: WebKit initial-focus test failed 8/8; installed Carbon public Modal behavior schedules parent launcher focus after the child focuses its input. Final repeated test passed 8/8. If wrong, review focus timing changes; payment/calculation/sync stay untouched. [Official modal accessibility guidance](https://www.carbondesignsystem.com/building-blocks/core/components/modal/accessibility) requires meaningful initial focus and constrained modal focus. The public-prop orchestration is Project interpretation, not an official blanket statement about nested dialogs.
4. Perform the one fresh final review after focused candidate gates, in parallel with the corrected cumulative matrix, before Task 9 completion/CI/integration: read-only review changes no candidate code; Task 9 itself includes those gates. If wrong, chronology differs from the generic execution skill; every cumulative/review/CI gate must still pass before integration.
5. Repair the shared App navigation-focus timing in this phase: the new rules task and protected earlier cost fields both reproduce focus theft. If wrong, navigation focus happens earlier; direct entry, history and return-focus contracts must still pass. No business logic or cost workflow is changed.

## Independent review and integration

Pending. Native execution uses one fresh whole-branch reviewer, not per-task implementation delegation. Critical/Important findings require reproduced RED→GREEN corrections and cumulative checks before integration. Minor findings and declined judgments will be recorded explicitly.

PR CI/integration status is separate from local test success. The implementation PR targets only `carbon-redesign`; main must remain unchanged. No readiness/release/deploy workflow is manually dispatched.

## Phase H / I remaining gates

- Phase H: collection and recipient payouts, their distinct state/status/undo/failure, memo/history/restore/danger workflows. Current protected flows are preserved, not certified as the final redesign.
- Phase I: physical software keyboard, browser chrome/safe area on real devices, native NVDA/VoiceOver, actual safe Maps/Places/Routes provider validation, cross-product content/contrast/reflow hardening and the final cumulative release gate. Touch emulation, short viewport and semantic assertions are not physical/SR/provider proof.
- No main merge, Production Release dispatch, compatibility deploy, root cutover, production smoke or production Firebase write.
