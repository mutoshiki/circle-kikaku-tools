# Phase E Allocation Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The repository's autonomous execution policy applies; implementation stays in the existing isolated worktree. Use one independent whole-branch review before integration, not parallel implementers sharing these owners.

**Goal:** Make manual/random car and team allocation efficient, accurately reviewable and readable for the event-morning handoff without changing existing domain behavior.

**Architecture:** Keep room-store commands and canonical projection as the only data owners. Add a read-only allocation view adapter, operation-specific UI receipts and narrow URL destinations; compose compact Desktop comparison and Mobile drill-in from the same model. Keep short editors/confirmations separate from repeated moves and result presentation.

**Tech Stack:** React 19.2.8, `@carbon/react` 1.115.0, `@carbon/icons-react` 11.87.0, Carbon Sass tokens/Grid, Node test runner, Playwright 1.61.0 and Firebase Emulator.

**Spec:** [approved implementation design](../specs/2026-10-01-phase-e-allocation-workflow-design.md); [sole normative Product UI specification](../../design/SANPOKAI_PRODUCT_UI.md) §1–6, §9, §16–23.

## Global Constraints

- Out of scope: route/cost editors, Maps/Places/Routes implementation, settlement rules/calculations/payments, history workflow, project repository, messaging service, authentication roles, publication state, new schema, assignment algorithm, store commands, sync protocol or legacy UI.
- Allocation remains a series of existing immediate commands, not a new page-wide draft/Save.
- Count all displayed people in the group, including the anchor: `1 + projected members.length`.
- Present the all-person limit: `stored capacity + 1`; editor accepts displayed 2–100, defaults car 4/team 6, existing larger values remain readable.
- `ownerId` is a structural anchor, not an asserted driver/leader; explicit roles can be multiple or absent. Fixed is shared across car/team and excludes randomization, not manual moves or all normalization.
- Manual placement is one person → one destination → one existing `move`; no bulk transaction, mandatory drag or intermediate waiting mutation.
- Desktop at Carbon `lg` and above: simultaneous group/member and unassigned columns, document scrolling. Below `lg`: list → group → assign. Resize changes layout, never the URL or committed state.
- Preserve participant task APIs and all direct/shared/legacy URLs, Back/Forward, refresh, logical focus return and no initial focus steal.
- No random provenance display/control in Phase E, as requested on 2026-10-01. No fake publication/completion flag, fairness guarantee or undo.
- No main merge, Production Release dispatch, compatibility deploy, cutover, production smoke or production Firebase write. PR base and merge target are `carbon-redesign`.

## Review Focus

1. Role-free anchor, multiple role holders, owner movement and group reanchoring: totals remain correct and actual roles remain independent (Task 1/3/4 tests).
2. Acknowledgement pruning, rejected/replaced outbox and unrelated saves: never falsely claim this operation saved, repeat a shuffle or replay accepted edits (Task 2 tests).
3. Deleted group/person during selection, initial remote loading and breakpoint changes: retain valid context, abandon only invalid selection, no premature fallback (Task 1/3/6 tests).
4. Duplicate names and long text: preserve each identity, warn rather than fabricate identity, omit private metadata from copy and avoid overflow (Task 1/5/6 tests).
5. Repeated assignment removes the focused row; async completion after navigation: restore a surviving local target without stealing a new page's focus (Task 3/4/6 tests).

## File responsibilities

- `apps/react/src/ui/allocation-view.js`: read-only projection/count/role/presentation/random-review adapters; no commands or UI state.
- `apps/react/src/ui/allocation-save.js`: exact allocation operation receipt, acknowledgement/retry disposition; existing sync API only.
- `apps/react/src/hooks/useAllocationOperation.js`: UI lifecycle/cache/disposition; no alternate room subscription or persistence model.
- `apps/react/src/navigation/project-navigation.js`: URL destinations only; participant APIs preserved.
- `apps/react/src/components/Allocation.jsx`: task orchestration, ephemeral selection/dialog state.
- `apps/react/src/components/allocation/AllocationWorkspace.jsx`: groups/pool and contextual one-person move form.
- `apps/react/src/components/allocation/AllocationPerson.jsx`: read metadata plus public action slot, move/Overflow triggers.
- `apps/react/src/components/allocation/AllocationDialogs.jsx`: brief group/capacity/random/danger controls using registered TaskModal.
- `apps/react/src/components/allocation/AllocationPresentation.jsx`: live read-only results, text preview/copy fallback.
- `apps/react/src/App.jsx`: shell-owned title/metadata/back/focus, allocation URL subscription.
- `apps/react/src/styles.scss`: only replaced allocation-owned styles; use public Grid/Column/spacing/type/layer/breakpoint APIs.
- Existing `ParticipantEditor.jsx` is reused for current editing capability. Extend it only with an optional allocation save callback if required for exact intent tracking; default participant callers and behavior remain intact.

## Task 1: Freeze domain outcomes and add view/URL adapters

**Files:** Create `apps/react/src/ui/allocation-view.js`, `apps/react/tests/allocation-view.test.mjs`; modify `apps/react/src/navigation/project-navigation.js`, `apps/react/tests/project-navigation.test.mjs`, `docs/design/SANPOKAI_PRODUCT_UI.md` §9.

**Interfaces:**

- `allocationView(room, type, canonical)` → `{ type, groups, waiting, assignedCount, participantCount, issues }`; group → `{ id, name, people, roles, peopleCount, totalLimit, vacancies, issues }`. People retain canonical participant IDs and explicit role/fixed attributes. Issues are structured types, not Japanese-message parsing.
- `storedAllocationCapacity(totalLimit)` → integer 1–99 or validation error. Does not clamp an invalid submitted value.
- `randomAllocationReview(room, type, assignment)` → `{ eligibleCount, fixedCount, roleCount, fixedWaitingCount, slotCount, scope }`; `scope` is a deterministic fingerprint of reset generation, IDs, locks, allocation placements and groups/limits/order, excluding memo/cost updates. Use existing eligibility/slot helpers.
- `allocationPresentation(view, projectName)` → `{ text, duplicateNames }`, shared by read/copy surfaces. No private attributes in text.
- `readAllocationTask(href)` → `{ type, task, groupId, invalid }`, recognized tasks `''`, `group`, `assign`, `unassigned`, `presentation`; group/assign require group ID. Other sections yield no allocation destination.
- Navigation adds `getAllocationTaskSnapshot()` (stable JSON string for external-store subscription), `allocationTaskHrefFor(type, task, groupId = '')`, `navigateAllocationTask(type, task, groupId = '')` and `replaceAllocationTask(type, task, groupId = '')`. Existing `getTaskSnapshot`/`navigateTask` remain participant-only. Section navigation clears both `task` and `group`. Replace dispatches the same navigation event without pushing history.

- [ ] Write domain characterization tests first using real room-store with deterministic clock/random: role-free anchor, non-anchor roles, multiple roles, locked waiting, manual group→group, owner move/reanchor and capacity shrink including fixed overflow. Compare equivalent command results and protected settlement/route/payment fields rather than old DOM.
- [ ] Write failing adapter assertions with hand-derived fixtures: stored capacity 3 + anchor + 2 members → count 3/limit 4/vacancy 1; role-free anchor not listed as driver; input 2/100 → stored 1/99, 1/101/decimal/empty rejected; existing stored 120 → displayed 121 without truncation; duplicate labels retain both IDs. Random review excludes locks/roles and includes eligible assigned people; memo/cost changes leave scope equal, lock/role/group/reset changes do not.
- [ ] Write URL tests: `room=A&handoffToken=secret&section=organization-car&task=assign&group=g1` survives read/refresh/popstate; selecting Participants removes allocation parameters but keeps launch identity; participant import/announcement unchanged; invalid group/task is marked without changing room; replace adds no history entry.
- [ ] Run `node --test tests/allocation-view.test.mjs tests/project-navigation.test.mjs tests/store.test.mjs tests/domain.test.mjs` from `apps/react`; record missing behavior RED separately from already-passing characterization.
- [ ] Implement adapters/navigation interfaces and normative §9 clarifications from design §12. Keep Product UI as sole normative owner and record the no-provenance boundary; do not duplicate target authority in Audit/Roadmap.
- [ ] Rerun the same command: all pass. Commit `feat(react): define allocation view and destination contracts`.

## Task 2: Preserve exact operation disposition and safe retry

**Files:** Create `apps/react/src/ui/allocation-save.js`, `apps/react/src/hooks/useAllocationOperation.js`, `apps/react/tests/allocation-save.test.mjs`; reuse existing `createParticipantTaskDraft` storage utility with a distinct task namespace `allocation:<type>` and receipt-only data, not participant input.

**Interfaces:**

- `allocationSaveReceipt(runtime, intent, { type, label })` → `{ type, label, resetGeneration, operationId, patch, before, disposition }` or null for a no-op. Capture only intent changed paths and original values. In shared mode associate the just-created outbox only after verifying it belongs to that intent. Do not retain args/whole room/token or generated UI-only group identities.
- `settleAllocationSave(runtime, receipt, { retry = false, onReceipt })` → `{ receipt, disposition }` where disposition is `local`, `saved`, `adjusted`, `failed`, `unresolved` or `reset`. `saved` in shared mode requires this operation's acknowledgement from existing authoritative base/operation markers, not empty outbox. Compare committed outcome when available; adjusted is not intended-result success. Absent/pruned evidence remains unresolved.
- Retry drains a still-pending exact entry; only explicitly rejected/unacknowledged retryable work can enqueue the receipt's original changed paths through existing sync APIs. Do not automatically reissue an acknowledged operation, invoke its domain command, or apply fallback over later accepted edits. Reset invalidates replay. If original acceptance cannot be safely distinguished after reload, keep unresolved and show the current result rather than inventing a retry authorization.
- `useAllocationOperation(runtime, type)` → `{ receipt, busy, recoverable, run(command, args, label), retry(), inspect() }`. `run` uses a synchronous ref guard, existing store command once, bounded receipt storage before awaiting sync. `inspect` never removes committed data and cannot hide unknown disposition as success. Prevent a newer mounted attempt being cleared by an older completion.

- [ ] Write failing tests with real `createRoomSync` and `createFixtureServer`: one shuffle when shared write is rejected and retried; same created group ID after retry; unrelated rename does not consume failed allocation; accepted receipt after later manual edit issues no writes; last-slot normalization produces adjusted outcome; acknowledgement absent/pruned stays unresolved; reset blocks retry; cache navigation/refresh retains exact receipt and storage failure preserves memory.
- [ ] Run `node --test tests/allocation-save.test.mjs tests/participant-save.test.mjs`; confirm new-contract RED and existing participant coverage green.
- [ ] Implement the receipt/hook boundary using `subscribeIntents`, `runtime.storage.read('outbox'/'base')`, `runtime.sync.flush/enqueue/getSnapshot` and canonical sync helpers. Do not modify runtime/store/sync to invent acknowledgements. If an API constraint contradicts the planned result, record a ruling in the execution ledger before changing this plan.
- [ ] Rerun tests: all pass. Commit `feat(react): preserve allocation operation retry identity`.

## Task 3: Replace repeated candidate disclosures with responsive manual workspace

**Files:** Modify `apps/react/src/components/Allocation.jsx`, `apps/react/src/App.jsx`, `apps/react/src/styles.scss`; create `apps/react/src/components/allocation/AllocationWorkspace.jsx`, `AllocationPerson.jsx`, `apps/react/tests/browser/allocation-workflow.spec.js`; modify existing `apps/react/tests/browser/allocation.spec.js` only where it protects obsolete structure rather than behavior.

**Interfaces:**

- `Allocation` consumes `{ runtime, room, type, destination, onReturn, onNotice, onParticipants }`; URL owns destination, local state owns only selected person/target/dialog. Use Task 1 adapters and Task 2 operation controller.
- `AllocationWorkspace` consumes `{ view, destination, selectedId, targetId, busy, onSelect, onTarget, onMove, onNavigate, onPersonAction, onGroupAction }`. Below `lg`, show root summaries, group members or candidates for the explicit destination; at `lg+`, compare groups/pool. Resize retains selection and URL.
- `AllocationPerson` consumes `{ person, roleLabel, busy, onMove, onAction }`; interactive content is in ContainedListItem public `action` slot, not ordinary children. Fixed/roles remain read metadata, rare actions move into Overflow; frequent Move remains visible.
- App subscribes to allocation destination separately from participant tasks; shell owns one `h1` and unique assigned/unassigned/group metadata. Parent link restores surviving group/task trigger and scroll location; history targets heading. Use stable IDs for focus targets, never names.

- [ ] Add failing browser tests: waiting→group and direct group→group call one committed move, group→waiting and Cancel, full target disabled/rechecked, fixed/role manual move allowed, repeat assignment focuses a surviving candidate/heading, no participants routes to Participants. Assert persisted canonical placements and actual outcome, not button variant/classes.
- [ ] Add responsive/URL tests: 390px root has summary links not all full group member lists; group→assign repeat flow; 1280px shows pool alongside members; resizing does not change history/selection; deep group URL reloads; browser Back/Forward and explicit parent return focus; deleted group fallback waits for resolved initial load, uses replace, retains room/token.
- [ ] Run `npm.cmd run test:browser -- allocation-workflow.spec.js --project chromium-desktop --project chromium-mobile`; verify new behavior RED.
- [ ] Implement workspace/components/App wiring, short local move selection form and Carbon Grid columns. Remove only replaced allocation CSS including hidden internal list header, 28rem arbitrary grid and obsolete candidate/footer styles. Use Carbon public `lg` breakpoint (1056px) in JS/media alignment and token Sass spacing/type.
- [ ] Adapt existing allocation browser assertions to new route/control labels while retaining registration, multiple roles, fixed, independent team, memo, capacity shrink, menu Escape, refresh, delete, both-theme and overflow coverage. Remove source/class/ghost-width change detectors; replace with observable navigation/action/geometry outcomes. Never skip a protected behavior.
- [ ] Rerun new + existing allocation tests on Chromium desktop/mobile; all pass. Commit `feat(react): implement responsive manual allocation workspace`.

## Task 4: Short editors, role/fixed/danger controls and accurate random review

**Files:** Create `apps/react/src/components/allocation/AllocationDialogs.jsx`; modify allocation orchestration, optional `ParticipantEditor.jsx` save callback, `apps/react/tests/browser/allocation-workflow.spec.js`; keep current registered `allocation-group-edit` and `allocation-group-confirm` TaskModal policies.

**Interfaces:** Dialogs receive current view/room, editor state, Task 2 run/retry, launcher reference and close/focus callbacks. Group editor converts all-person limit once, preserves values on failure and returns to logical trigger only when locally appropriate. Random state retains the Task 1 reviewed scope; submit recalculates it before issuing a command.

- [ ] Write failing browser tests: car/team default limits 4/6 persist as 3/5; min/max/invalid values associate error and focus; lower limit warns overflow including fixed people without guessing victims; exact-name group deletion returns members to waiting but keeps participants. Preserve role add/remove/multiple/no-role, pin shared constraint and all participant editor fields.
- [ ] Add random tests: Cancel leaves normalized state unchanged; review counts/existing assignment warning; no groups/no eligible explains disabled; constrained slots/fixed waiting remains visible; cost/memo updates do not invalidate scope but membership/role/lock/group/reset changes refresh summary and issue zero commands on that click; second explicit click may run once; result focus after dismissal, late completion after navigation never steals focus. Retry uses Task 2 result, no new shuffle.
- [ ] Run focused Chromium allocation workflow tests for editor/random/danger; verify new-contract RED.
- [ ] Implement brief dialogs, labeled inline errors/focus, exact commands and post-random actual result review. Explain that fixed is shared across both allocation types. Do not remove functionality from existing participant editor or create an independent group-name field/schema.
- [ ] Rerun allocation tests plus participant-workflow regression; all pass. Commit `feat(react): clarify allocation editing and random review`.

## Task 5: Event-morning read-only result and copy

**Files:** Create `apps/react/src/components/allocation/AllocationPresentation.jsx`; modify allocation/App task wiring and `apps/react/tests/browser/allocation-workflow.spec.js`.

**Interfaces:** Presentation consumes `{ view, projectName, receipt, busy, onNotice }`; uses `allocationPresentation` text and same current model as workspace. No mutable secondary roster or publish state. Clipboard uses current user gesture with selectable TextArea fallback.

- [ ] Add failing tests for `task=presentation`: actual role-free/multiple-role output, totals, unassigned and missing-role information; each duplicate participant retained and warning shown; private notes/marks/grades/costs/tokens/IDs omitted from copy. Assert fresh read/copy match after another client changes allocation. No provenance text/control.
- [ ] Add clipboard success/error/fallback tests, optional copy (no mandatory finish), pending/failed relevant save disables copy with reason, refresh/direct link and return focus. No fabricated completion message when people are waiting or roles missing.
- [ ] Run focused presentation browser tests; verify RED, implement view and one copy Primary; rerun all allocation browser tests: pass. Commit `feat(react): add read-only allocation handoff and copy`.

## Task 6: Cumulative acceptance, review and integration

**Files:** Create `apps/react/tests/browser-emulator/allocation-workflow.spec.js`, `docs/design/PHASE_E_VALIDATION.md`; adjust existing affected browser tests through actual behavior assertions; update normative version/review date only with implemented contract and roadmap phase evidence. Evidence does not introduce a second Product UI authority.

- [ ] Write Emulator tests using synthetic `demo-circle-react` rooms only: two clients moving into last slot; independent car/team operations; role/fixed/capacity persistence; rejected save and refresh/retry; reset/conflict; accepted operation followed by another edit; protected participant/route/settlement/payment data matches existing domain effects. Include rules restoration and room cleanup in `finally`; never production URLs.
- [ ] Run targeted offline tests first, then all four Chromium/WebKit desktop/390px projects on allocation-workflow + navigation/participants; capture light/dark before/after, long/duplicate names, empty/full, short viewport, touch/keyboard, heading/Modal/menu focus and overflow. Resize alone is not touch/software-keyboard proof. Report native screen-reader/physical-keyboard/safe-area gaps for Phase I.
- [ ] Run fresh local build and `npm.cmd test` with explicit offline safety variables; run full offline browser matrix and Emulator suites with explicit emulator targets. Use the existing Emulator launcher/config and required checks, not custom production smoke. Preserve all protected baseline/calculation tests. Compare any failures to the exact `carbon-redesign` base by test ID before classifying them as unrelated; do not recapture protected manifests to hide intentional doc drift.
- [ ] Complete Product UI §23 checklist and acceptance matrix from design §11 in validation evidence, with commands/results/artifact paths and honest NOT VERIFIED states. `git diff --check` and a protected-source path diff must confirm no domain/store/Firebase/schema/sync/calculation/legacy changes.
- [ ] Run one independent whole-branch review of code, spec/plan and ledger rulings. Resolve important findings with reproducing RED→GREEN tests, rerun affected/full gates. Review covers especially Review Focus, unknown acknowledgement and normalized outcomes, not just happy screenshots.
- [ ] Commit acceptance evidence, push `codex/phase-e-allocation-workflow`, create PR with explicit `--base carbon-redesign`, attach created PR to this task, wait for required CI. Merge only when phase gates/checks/review are green. Verify remote integration SHA and merged content. Do not dispatch release/readiness-to-production, main merge, deploy or smoke.

## Self-review and handoff

- Spec coverage: §1–4 → Tasks 1/3; §5 → Task 3; §6–7 → Tasks 2/4; §8 → Tasks 1/5; §9 → Task 2/6; §10–11 → Tasks 3–6; §12 → Tasks 1/6.
- Interface dependency: Tasks 3–5 consume the same view/receipt/navigation interfaces from Tasks 1–2. Task 4 does not own a second retry implementation. Task 5 uses the same model/text and blocks only unresolved relevant allocation disposition.
- Existing participant route/editor APIs are preserved; any optional editor callback is opt-in, with participant regression tests. Generated source and store command semantics are not migration owners.
- The uncertain endpoint disposition is explicitly tested and remains unresolved if unprovable; implementation cannot simplify this to a globally drained outbox.
- All five Review Focus items have named owning tests. Plan self-review completed against the approved design; no placeholder tasks or deferred protected behavior.
- Baseline before implementation planning: React unit `npm.cmd test` on 2026-10-01 passed 71/71. This is not post-implementation browser or Phase E acceptance evidence.
