# Phase B App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat four-tab React shell with a lifecycle-oriented Carbon app shell, stable project navigation, and shared page anatomy while preserving URL, data, synchronization, and feature behavior.

**Architecture:** `App.jsx` remains the composition owner but delegates URL-backed section state to a small navigation service and shell rendering to shared shell/page-layout components. The shell exposes lifecycle destinations (overview, participants, organization, settlement, history/settings), renders feature interiors unchanged inside a common page anatomy, and uses Carbon UI shell/Grid primitives plus project-specific token-based CSS. Navigation is link-based, writes browser history, restores state on pop/refresh, identifies the current section semantically, and moves focus to the destination heading after in-app route changes.

**Tech Stack:** React 19, `@carbon/react` 1.115, Sass with Carbon tokens, Vite, Node test runner, Playwright (Chromium/WebKit desktop and 390px mobile).

**Spec:** `docs/design/SANPOKAI_PRODUCT_UI.md` is the sole normative Product UI specification. `docs/design/CARBON_PRODUCT_PRINCIPLES.md` and `docs/design/CARBON_PATTERNS.md` provide official evidence and selection guidance; `CURRENT_UI_AUDIT.md` is descriptive only; `CARBON_MIGRATION_ROADMAP.md` defines the phase boundary.

**Global Constraints:** Do not change Firebase schema/rules, persistence, synchronization, collaboration, participant/allocation/route/settlement/cost/payment domain behavior, or legacy UI. Do not redesign feature-internal workflows or modal patterns. Preserve direct/shared room URLs, old `view` URL compatibility, refresh/back/forward, protected files, and current feature data. Use observable behavior and semantics as contracts, not Carbon class names or source strings.

**Review Focus:** URL compatibility (including legacy query forms), browser history and initial-entry behavior, focus movement without stealing focus on initial load, mobile menu dismissal/focus, landmark and heading uniqueness, long-title overflow, dark theme, protected domain boundaries, and feature content remaining reachable.

## Task 1: Freeze Phase B behavior contracts

**Files:**

- Modify: `apps/react/tests/phase6.test.mjs`
- Modify: `apps/react/tests/browser/shell.spec.js`
- Add: `apps/react/tests/browser/app-shell-navigation.spec.js`

**Interfaces:** Existing `prepareCompatibleUrl` and `createShareUrl`; current rendered room and feature state; future `section` URL contract and navigation semantics.

1. Add unit tests specifying stable section parsing/serialization while retaining old `view=participants`, `view=seisan`, allocation, and room behavior.
2. Replace shell assertions that require four Carbon Tabs/source structure with user-observable shell, landmark, current-location, keyboard, focus, history, refresh, long-title, and mobile behavior.
3. Add persistence protection coverage that seeds state, navigates sections, and confirms participant/allocation/settlement values remain intact.
4. Run targeted unit and Chromium shell tests and record the expected RED failures caused by the missing Phase B shell.

## Task 2: Implement URL-backed navigation state

**Files:**

- Modify: `apps/react/src/services/url-compat.js`
- Modify: `apps/react/src/runtime.js`
- Add: `apps/react/src/services/project-navigation.js`
- Modify: `apps/react/src/App.jsx`

**Interfaces:** Produces canonical section IDs, link URLs, `pushState` navigation, and `popstate` restoration consumed by the shell. Maintains the current room ID and legacy query cleanup.

1. Implement only enough code to satisfy the Task 1 URL and history contracts.
2. Keep shared URLs room-scoped and old inbound query forms readable.
3. Ensure navigation never mutates room/domain state and initial render does not steal focus.
4. Run targeted unit and browser contracts to GREEN, then commit.

## Task 3: Build the Carbon app shell and project navigation

**Files:**

- Add: `apps/react/src/components/ProjectShell.jsx`
- Modify: `apps/react/src/components/AppHeader.jsx`
- Modify: `apps/react/src/App.jsx`
- Modify: `apps/react/src/styles.scss`

**Interfaces:** Consumes canonical section state and emits section navigation callbacks. Produces global Header, responsive project SideNav, read-only project context, skip link, and main-content landmark.

1. Use Carbon Header, HeaderMenuButton, SideNav, SideNavItems/Link/Menu, SkipToContent, and Content/Grid where appropriate.
2. Implement lifecycle navigation: Overview; Participants; Organization with Car and Team allocation; Settlement; History and settings.
3. Expose one current destination with link semantics and accessible current-state semantics.
4. On mobile, use Carbon responsive navigation behavior, close after selection, avoid fixed action footers, and preserve document scrolling.
5. Use Carbon tokens/breakpoints for shell CSS and avoid global internal-selector overrides.
6. Run shell/navigation contracts in Chromium desktop/mobile to GREEN, then commit.

## Task 4: Establish shared page anatomy without redesigning features

**Files:**

- Add: `apps/react/src/components/ProjectPage.jsx`
- Add: `apps/react/src/components/ProjectOverview.jsx`
- Add: `apps/react/src/components/ProjectHistorySettings.jsx`
- Modify: `apps/react/src/components/Participants.jsx`
- Modify: `apps/react/src/components/Allocation.jsx`
- Modify: `apps/react/src/components/Settlement.jsx`
- Modify: `apps/react/src/App.jsx`
- Modify: `apps/react/src/styles.scss`

**Interfaces:** Produces exactly one page `h1`, optional metadata/status and page actions, main/secondary content regions. Feature components accept an embedding/heading-level contract but retain internal actions and domain behavior.

1. Create a shared page header/anatomy using Carbon Grid/Column and semantic headings.
2. Move project-name editing into Overview while keeping the existing rename/save command and read-only project context elsewhere.
3. Connect Overview and History/settings destinations to existing overview/history modal workflows without redesigning their contents.
4. Suppress or demote duplicate feature page headings only; leave feature workflows and actions in place for later phases.
5. Run heading/landmark/current-location/focus contracts plus existing targeted feature tests to GREEN, then commit.

## Task 5: Complete responsive, accessibility, and regression validation

**Files:**

- Modify: `apps/react/tests/browser/app-shell-navigation.spec.js`
- Modify: affected existing browser specs only where they encode the removed Tabs contract
- Modify: `apps/react/src/styles.scss`
- Add: `docs/design/evidence/phase-b/README.md`
- Add: generated screenshots under `docs/design/evidence/phase-b/`

**Interfaces:** Validates the shell at 1280px and 390px in Chromium/WebKit, light/dark themes, empty/populated/long-title states, keyboard navigation, focus after route changes, direct URL, refresh/back/forward, and no horizontal overflow.

1. Add any missing behavior/semantic/geometry assertions and watch each new assertion fail before its fix.
2. Run targeted desktop/mobile Chromium tests, then the four-project Playwright matrix.
3. Capture before/after evidence and write a concise evidence index containing environment, state, action, and expected result.
4. Run Node unit tests, production build, protected-files/compatibility checks, and relevant emulator tests.
5. Fix only Phase B regressions; ledger later-phase issues without changing feature interiors.
6. Commit verified implementation and evidence.

## Task 6: Review and integrate the verified SHA into `carbon-redesign`

**Files:**

- Modify only if verification finds a Phase B defect or a required runbook correction.

**Interfaces:** GitHub PR/checks and the long-lived Carbon redesign integration branch. Production workflows are out of scope until Phase I and the final integration gate complete.

1. Perform whole-branch review against the normative spec and phase boundary; fix Important/Critical findings with RED→GREEN tests.
2. Push the branch, open a PR targeting `carbon-redesign`, attach it to the task, and wait for required CI.
3. Merge only after required checks pass; verify the Phase B commit is integrated into `carbon-redesign`.
4. Do not merge to `main`, dispatch React Production Release, compatibility deploy, root cut over, run production smoke, or write production Firebase data during Phases B–I.
