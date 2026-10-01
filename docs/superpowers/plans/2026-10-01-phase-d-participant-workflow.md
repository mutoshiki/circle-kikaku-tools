# Phase D participant workflow implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make participant registration, confirmation and handoff natural durable tasks without changing domain behavior.
**Architecture:** URL-owned participant child pages reuse the shell and single h1. Inline registration review calls existing commands; room-scoped local drafts survive navigation. Parent list state remains mounted across child visits.
**Tech Stack:** React 19.2.8, Carbon React 1.115.0, Node tests, Playwright Chromium/WebKit, Firebase Emulator.
**Spec:** `docs/design/SANPOKAI_PRODUCT_UI.md` §§4–8,16–23; approved implementation design `docs/superpowers/specs/2026-10-01-phase-d-participant-workflow-design.md`.

## Global constraints

- Merge only into `carbon-redesign`; never main, production release/deploy/cutover/smoke/Firebase writes.
- No store/domain/parser/Firebase/schema/sync/calculation/legacy changes.
- Manual registration directly adds canonical participants; automatic applicants use existing selection identity.
- One page primary, normal scroll, Carbon tokens/public APIs, no global internal selectors.
- No mandatory manual confirmation step. Paste preview remains editable before commit.

## Review focus

- Concurrent reset during save: never clear a draft or announce successful registration of a reset project (Task 2 browser test).
- Source edits after corrected preview: never apply stale corrections to different people (Task 2 browser test).
- Duplicate names / applicant identity: labels disambiguate without changing IDs or merge policy (Task 3 browser test).
- Browser storage failure: keep in-memory input and make refresh limitation explicit (Task 2 browser test).
- Navigation while shared save is pending: no duplicate submit, false success, or unhandled async state after unmount (Task 4 Emulator test).

### Task 1: Participant task navigation

**Files:** `apps/react/src/navigation/project-navigation.js`, `App.jsx`, `components/ProjectPage.jsx`; tests `tests/project-navigation.test.mjs` (create if absent), `tests/browser/participant-workflow.spec.js`.
**Interfaces:** Produces `navigation.getTaskSnapshot(): string`, `taskHrefFor(task): string`, `navigateTask(task): boolean`. Tasks `import`, `announcement`, or empty; only Participants owns them. Section navigation clears task. App derives title/focus from section+task; ProjectPage accepts `back` React node.

- [ ] Add unit contracts for child direct URL, room/token preservation, same-section return and popstate; browser heading/refresh/back/current semantics.
- [ ] Run unit/browser contracts: expected RED for missing task behavior, not syntax.
- [ ] Implement URL adapter, child h1/return slot, retain parent Participants element identity. Unknown task resolves parent.
- [ ] Run contracts and entire unit suite: expected PASS. Commit navigation foundation.

### Task 2: Registration page and local recovery

**Files:** create `components/ParticipantRegistration.jsx`, `ui/participant-registration.js`, `ui/participant-task-draft.js`; replace/remove `RegistrationModal.jsx` entry; add unit/browser contracts.
**Interfaces:** Consumes Task 1 `navigateTask`; registration component `({runtime,onCancel,onSaved})`. UI input mapping `registrationPeople(draft)` returns existing parser result or preserved manual normalization. UI-local draft cache `createParticipantTaskDraft({storage,roomId,task})` exposes `read`, `write`, `clear`; errors return false, memory remains. No runtime/domain protocol changes.

- [ ] Freeze manual driver-only/grade-only and duplicate/paste outcomes, room-scoped recovery and storage-failure contracts; browser inline correction/source reset/invalid focus/cancel/back/refresh and sync failure.
- [ ] Run tests: expected RED for missing page/correction/recovery.
- [ ] Build labeled source form, all manual capabilities, live paste editable preview/warnings, single submit. Await existing flush/outbox; guard stale/reset completion. Keep drafts on error, clear on explicit cancel/success.
- [ ] Run unit suite and targeted four-project browser suite: expected PASS. Update old registration test setup to observable page behavior, not preserve dialog. Commit.

### Task 3: Participant list, selection and handoff page

**Files:** `components/Participants.jsx`, create `components/ParticipantAnnouncement.jsx`; `ProjectTools.jsx`, `ui/task-contracts.js`, participant/browser contracts and approved task policy tests.
**Interfaces:** Participants consumes URL task, renders child component without losing search/filter/choices; announcement `({runtime,room,onNotice})` uses existing project bodyText unchanged and local fields cache. Short export/edit/delete remain existing registered dialogs.

- [ ] Browser contracts: confirmed list remains visible, linked-room manual add, collapsed active filters/reset, selection cancel, duplicate labels, announcement copy/error/return, exact domain output.
- [ ] Run targeted tests: expected RED for current hidden list and dialog announcement.
- [ ] Implement read/selection list with result summary, cancel and grouped Cars/Teams/announcement/export handoff. Remove dead old ProjectTools default/GuidanceModal only after confirming no consumers. Mark removed long tasks forbidden in Modal policy. Preserve downstream removal warnings/identity.
- [ ] Run complete unit and participant/shared targeted browser suites: expected PASS. Commit.

### Task 4: Cumulative validation and integration

**Files:** affected browser setup assertions, Phase D evidence document, migration progress if warranted.
**Interfaces:** Consumes Tasks 1–3; protects existing commands/persistence and no new protected-file modifications.

- [ ] Update old UI-specific tests to real page contracts without deleting domain assertions; add shared two-client registration/selection/ack failure contracts.
- [ ] Run React unit/build, relevant static/classifier/protected-files, full Chromium/WebKit desktop/mobile suite and Emulator checks. Expected all affected checks PASS; known unrelated baseline named, never hidden.
- [ ] Real interactive before/after browser evidence: four projects, themes, keyboard/touch/focus/overflow/long names/short viewport; state actual native keyboard/NVDA limitation.
- [ ] Fresh independent whole-branch review; important fixes RED→GREEN and full suite.
- [ ] Scoped commit/push; PR base `carbon-redesign`, attach PR; all relevant CI green; merge only integration branch. Verify main unchanged; report E–H deferred and no production.

## Execution decision

Native inline execution, one independent final review. The user approved implementation and repository rules require autonomous continuation without routine approval checkpoints. Preserve unrelated untracked evidence.
