# JS modules

- `ui.js` is loaded as a classic script before `app.js`. It owns shared confirmation modals, alert modals, the sync-status badge, and the undo bar.
- `utils.js` and `state.js` are ES-module-safe pure helpers prepared for the next refactor step.

The main `app.js` is still loaded as a classic script because the current HTML intentionally keeps legacy `onclick` handlers for stability.
