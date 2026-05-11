# BUGFIX: person menu actions not opening

## Problem
After A-cleanup, the compact person menu could fail to open memo/name edit actions.

## Root causes
1. `setupCompactPersonMenu()` was bound after `await initFirebaseSync()`.
   If Firebase/network startup was slow or blocked, member menu buttons could remain unbound.
2. Person-menu item clicks were handled only by a temporary listener on the floating menu element.
   This was fragile after the event-owner cleanup because the menu is appended to `<body>` and can be removed or bypassed by global capture handlers.
3. Extracted core modules still referenced `window.showSaveStatus?.()` but the compatibility API was not exposed after status ownership changed.

## Fix
- Bound compact person menu delegation before Firebase/network startup.
- Added an active menu target (`activePersonMenuTarget`).
- Added shared handler `handleCompactPersonAction()` and exposed it on `window`.
- Added a global capture fallback in `assets/js/features/events.js` for `[data-person-action]`.
- Added `window.showSaveStatus()` compatibility wrapper.
- Added regression checks:
  - `tests/person-menu-action-handler-check.js`
  - `tests/window-api-compat-check.js`

## Verified
- JS syntax check passed.
- Existing Node static tests passed.
- New person-menu regression checks passed.
- Playwright browser test was not run because `@playwright/test` is not installed in this zip.
