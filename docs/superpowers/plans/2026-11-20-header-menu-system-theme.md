# Header Menu and System Theme Implementation Plan

> **For agentic workers:** Executed natively in this task as explicitly requested.

**Goal:** Replace the related-app switcher with a compact Carbon overflow menu and make React screens follow the device color scheme automatically.

**Architecture:** Keep Carbon Header, Menu, MenuItem, MenuItemDivider, and Popover. Route project-list navigation through the base URL, keep external tools as the last menu actions, and share one system-theme hook between the project screen and project entry.

**Tech Stack:** React 19, Carbon React 1.115.0, Vite, Playwright.

**Spec:** User's confirmed requirements in the delegated request.

## Global Constraints

- Preserve share eligibility on project, sample, and project-list screens.
- Do not write to ordinary production projects; production smoke uses P9A93LMQ and cleanup.
- Preserve existing untracked `apps/react/dist-offline-test/`.
- Build local previews against the freshly fetched published `sourceSha` and keep them offline.

## Review Focus

- Menu order, external link destinations, and project-list same-tab route — shell browser tests.
- Carbon keyboard, Escape, outside click, action close, and focus handoff — shell browser tests and local preview.
- Device theme on initial render, media changes, and legacy saved overrides on both screen owners — theme browser tests.
- 390px and desktop popover/title geometry, project and non-project screens — shell browser tests and local preview.

---

### Task 1: Header menu and navigation

**Files:** Modify `apps/react/src/components/AppHeader.jsx`, `apps/react/src/App.jsx`, `apps/react/src/styles.scss`; update `apps/react/tests/browser/shell.spec.js` and `modal-layout.spec.js`.

- [x] Write failing shell expectations for exact menu order, removal of the Switcher, project-list navigation, external links, and menu keyboard/focus behavior.
- [x] Run focused browser specs to confirm the expectations fail against the current shell.
- [x] Replace Switcher state/components with ordered Popover Menu items and a same-tab project-list callback; preserve project-only actions and sample share suppression.
- [x] Verify focused browser specs and responsive menu geometry.

### Task 2: Automatic system theme

**Files:** Create `apps/react/src/hooks/useSystemTheme.js`; modify `apps/react/src/App.jsx`, `apps/react/src/components/ProjectEntry.jsx`, and `apps/react/tests/browser/theme-preference.spec.js`.

- [x] Update tests for both screen owners to assert initial system theme, live color-scheme changes, and ignoring saved legacy `light`/`dark` values.
- [x] Run the theme spec to confirm current behavior fails for legacy overrides.
- [x] Use the shared media-query hook, remove preference storage and theme controls, and preserve theme-aware Carbon surfaces.
- [x] Verify theme tests across project/list, light/dark, and 390px/desktop.

### Task 3: Preview and release

**Files:** Modify `docs/development/current-workspace.md` with refreshed published manifest and review evidence.

- [x] Run release classification after commit and verify the required CI checks without repeating unchanged successful SHA checks.
- [x] Build and verify an offline local preview against the fetched published source SHA; inspect project and non-project screens in the side browser.
- [x] Commit, push, open/update PR, merge, verify `Release / Readiness`, run the existing React Production Release workflow, and confirm published manifest and P9 cleanup.
