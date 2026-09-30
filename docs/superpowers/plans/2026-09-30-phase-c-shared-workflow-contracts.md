# Phase C Shared Workflow Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish reusable, typed contracts for task feedback, form save/cancel behavior, validation focus, destructive risk, and Modal eligibility, then prove them through an inline Project Overview editing pilot without changing protected domain behavior.

**Architecture:** `App.jsx` remains the page-feedback and page-composition owner but receives typed notices instead of inferring severity from Japanese strings. Active dialogs own their contextual errors. Small UI contract modules define notice/status semantics, validation focus, and a reviewable Modal registry; destructive-risk selection follows the normative document, not an unused runtime helper. `ProjectOverview` becomes a read/edit page surface with a local draft, explicit save/cancel, contextual status, and one existing edit-session intent preserving the room shape. Existing feature workflows remain in place; their Modals are classified as approved brief tasks or time-bounded legacy migrations for later phases.

**Tech Stack:** React 19, `@carbon/react` 1.115.0 stable exports, Sass with Carbon tokens, Node test runner, Playwright Chromium/WebKit desktop and 390px mobile.

**Spec:** `docs/design/SANPOKAI_PRODUCT_UI.md` is the sole normative Product UI specification. Phase boundary and exit gates come from `docs/design/CARBON_MIGRATION_ROADMAP.md`. Official evidence comes from Carbon Modal, Forms, and Notifications guidance recorded in the design documents.

**Global Constraints:** Do not change Firebase schema/rules, synchronization protocol, persistence shape, collaboration, participant/allocation/route/settlement/cost/payment calculations, or legacy UI. Do not perform Phase D–H workflow migrations. Do not merge to `main`, deploy, run production smoke, or write production Firebase data. Tests assert user-observable behavior, serialized state, and semantic contracts rather than Carbon classes or exact source text.

**Review Focus:** Notice severity must be explicit; local draft and failed-save paths must not lose input; save/cancel labels must match their effects; invalid submit must focus the first invalid field; Modal tasks must be classified without blessing known long legacy workflows; Overview save must retain the exact room schema; desktop/mobile keyboard, focus, dark theme, overflow, and page navigation must remain intact.

## Task 1: Freeze typed feedback and shared task contracts

**Files:**

- Add: `apps/react/tests/ui-contracts.test.mjs`
- Add: `apps/react/src/ui/task-contracts.js`
- Add: `apps/react/src/ui/focus-first-invalid.js`

**Interfaces:** Produces typed notices (`kind`, `title`, optional `subtitle`, `placement`, `timeout`), Modal classifications, and a DOM-facing first-invalid focus helper. Async state belongs to the task owner; destructive-risk decisions follow the normative specification rather than an unused runtime policy helper.

1. Write unit tests with literal expectations for valid/invalid notice normalization, Toast eligibility, Modal policy lookup, and first-invalid focus behavior. Risk-tier confirmation outcomes are covered by actual flow tests.
2. Run the targeted unit test and record RED because the contract modules do not exist.
3. Implement the minimal pure contract modules. Invalid or unknown values must fail safe (`error` or persistent inline), never parse message text, and never infer destructive risk from labels.
4. Run the targeted test to GREEN and commit.

## Task 2: Route all app feedback through typed notices

**Files:**

- Modify: `apps/react/src/App.jsx`
- Modify: `apps/react/src/components/Allocation.jsx`
- Modify: `apps/react/src/components/ParticipantEditor.jsx`
- Modify: `apps/react/src/components/Participants.jsx`
- Modify: `apps/react/src/components/ProjectTools.jsx`
- Modify: `apps/react/src/components/RegistrationModal.jsx`
- Modify: `apps/react/src/components/Settlement.jsx`
- Add: `apps/react/tests/browser/shared-task-contracts.spec.js`

**Interfaces:** Existing `onNotice` callbacks now consume typed notice objects; page/task errors stay contextual and only eligible transient results render as Toasts.

1. Add browser tests proving clipboard success is a typed transient Toast, a feature error is rendered with error semantics without wording-based classification, visible state changes do not produce redundant success Toasts, and task drafts survive an error.
2. Run targeted Chromium tests and record RED against string notices/message parsing.
3. Replace `noticeKind(message)` with explicit notice factories and update callers without changing feature operations or wording except where title/subtitle separation is required for next-step clarity.
4. Run targeted unit/browser tests to GREEN and commit.

## Task 3: Implement the Project Overview page-form pilot

**Files:**

- Modify: `apps/react/src/components/ProjectOverview.jsx`
- Modify: `apps/react/src/App.jsx`
- Reuse unchanged: `apps/react/src/store/room-store.js` edit-session API
- Modify: `apps/react/src/services/overview-draft.js`
- Modify: `apps/react/src/components/ProjectTools.jsx`
- Modify: `apps/react/src/styles.scss`
- Modify: `apps/react/tests/store.test.mjs`
- Modify: `apps/react/tests/browser/shared-task-contracts.spec.js`
- Modify: affected existing browser tests that currently assume blur-save or the Overview Modal

**Interfaces:** Read mode exposes Tertiary page-level `編集`; edit mode owns a local draft, baseline, status, form fields, `保存` and `キャンセル`. One existing `commitEdit` intent writes the user's changed fields, preserving unrelated remote values and the existing `overview` storage owner. Save awaits existing sync acknowledgement before clearing its draft and returning to read mode; failure retains the editor for retry. Cancel discards local changes and restores focus to `編集`. A local optional baseline records draft ownership across navigation/reload; old drafts remain readable. No new store command or sync protocol is introduced.

1. Add store tests proving the existing edit-session intent changes only `roomName` and `overview`, preserves participant/allocation/settlement/meta data, and serializes the existing schema shape. Add real Emulator tests for disjoint users, delayed acknowledgement, and permanent rejection/retry.
2. Add browser tests for read→edit, local draft, explicit save, cancel, focus return, no blur-save, refresh persistence after save, no redundant success Toast, keyboard order, long content, and 390px overflow.
3. Run targeted tests and record RED against the current always-editable name field and Overview Modal.
4. Implement the page form using stable Carbon Form/TextInput/TextArea/Button components and spacing/type/layer tokens. Do not add custom dialog, shadow, color, radius, or focus treatment.
5. Remove the Overview Modal entry point while retaining later-phase Modals unchanged; keep draft storage backward-compatible.
6. Run targeted unit/browser tests to GREEN and commit.

## Task 4: Enforce validation focus and classify Modal tasks

**Files:**

- Add: `apps/react/src/components/TaskModal.jsx`
- Modify: existing React components that directly render Carbon `Modal`
- Modify: `apps/react/src/components/ParticipantEditor.jsx`
- Modify: `apps/react/src/components/RegistrationModal.jsx`
- Modify: `apps/react/tests/browser/shared-task-contracts.spec.js`
- Modify: `apps/react/tests/browser/modal-layout.spec.js` only where behavior contracts supersede implementation assumptions
- Add: `docs/design/evidence/phase-c/modal-classification.md`

**Interfaces:** `TaskModal` requires a registered task ID and exposes the installed Carbon Modal behavior. The registry distinguishes `approved-brief` from `legacy-migration` with target phase and rationale. Existing long Modals remain behavior-compatible but cannot be mistaken for approved patterns. Shared invalid-submit handling focuses the first invalid control.

1. Add browser tests for participant-edit validation focus, Escape/cancel focus return, Modal accessible name, and unchanged destructive confirmation outcome.
2. Run the tests and record RED for missing validation focus/registry enforcement.
3. Wrap existing Modals with registered task IDs, classify every current task, and apply the focus helper to current form validation without changing feature save boundaries.
4. Document classification evidence with user task, status, reason, target phase, and preserved behavior.
5. Run targeted Modal and feature tests to GREEN and commit.

## Task 5: Complete responsive, accessibility, and regression validation

**Files:**

- Modify: `apps/react/tests/browser/shared-task-contracts.spec.js`
- Modify: `apps/react/src/styles.scss` only for verified token-based responsive defects
- Add: `docs/design/evidence/phase-c/README.md`
- Add: reviewed screenshots under `docs/design/evidence/phase-c/`

**Interfaces:** Validates the shared contracts and Overview pilot at 1280px and 390px in Chromium/WebKit, light/dark, keyboard-only, reduced motion, long content, empty/populated states, refresh/back/forward, and no horizontal overflow.

1. Add missing behavior/semantic/geometry assertions and watch each new assertion fail before the corresponding fix.
2. Validate with the real browser CLI for before/after inspection and Playwright tests for repeatable Chromium/WebKit desktop/mobile coverage.
3. Perform an NVDA + Chromium semantic smoke where available; if native screen-reader automation is unavailable, record manual structure/live-region/focus evidence and the exact limitation.
4. Run Node unit tests, production build, protected-files check, relevant emulator tests, and the four-project browser matrix.
5. Write an evidence index with environment, state, action, expected result, and artifact links; commit verified evidence.

## Task 6: Review and integrate the verified SHA into `carbon-redesign`

**Files:**

- Modify only if whole-branch review or CI identifies a Phase C defect.

**Interfaces:** GitHub PR/checks and the long-lived `carbon-redesign` branch. Production workflows remain forbidden through Phase I.

1. Perform whole-branch review against the normative spec and Phase C boundary; fix Critical/Important findings with RED→GREEN tests.
2. Push the branch, open a PR targeting `carbon-redesign`, attach it to this task, and wait for required CI.
3. Merge only after required checks pass and verify the resulting `carbon-redesign` SHA.
4. Do not merge to `main`, dispatch React Production Release, deploy compatibility/root, run production smoke, or write production Firebase data.
