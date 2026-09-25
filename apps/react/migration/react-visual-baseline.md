# React visual regression source

The React UI is evaluated against the Phase 8 React + Carbon implementation and its rendered behavior. `tests/browser/visual-consistency.spec.js` and the React browser suite assert current React DOM, interaction, layout, and responsive behavior; they do not load legacy screenshots or legacy test reports.

`migration/legacy.playwright.config.mjs` is reserved for legacy-root compatibility checks. Its `legacy-browser-baseline.json` is a legacy Playwright report, not a React screenshot golden. Do not use it to judge `/react/`.

There is no `toHaveScreenshot` golden-image comparison in `apps/react/tests`. Failure screenshots are diagnostics only. If a React screenshot baseline is introduced later, capture it from the Phase 8 React + Carbon app and store it under a React-specific test path, separate from legacy evidence.
