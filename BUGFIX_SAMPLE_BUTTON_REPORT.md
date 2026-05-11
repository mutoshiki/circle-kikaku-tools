# Sample Button Bugfix Report

A cleanup moved event bindings out of `app.js`, but the debug sample-data handlers were accidentally removed from the active runtime path.

Fixed:
- Restored `seedDebugData()`.
- Restored `window.executeDebugMode()`.
- Restored `window.executeDebugMissingCostMode()`.
- Restored `window.showHistory()` because the same removed block also owned the history modal.
- Updated `assets/js/features/events.js` to call restored handlers through `window.*` safely.

Verified:
- JS syntax checks pass.
- Structural CSS/JS cleanup checks pass.
- Theme preset renderer check passes.
- Event owner check passes.
- Unused module cleanup check passes.
- No `!important` check passes.

Not run:
- Playwright UI tests, because `@playwright/test` is not included in this zip/environment.
