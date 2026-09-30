# Phase C evidence

This directory records evidence for the shared workflow contracts introduced in Phase C. Screenshots supplement behavior and semantic assertions; they are not the contract by themselves.

## Scope and environment

- Product UI specification: `docs/design/SANPOKAI_PRODUCT_UI.md`
- Browsers: Chromium and WebKit, desktop 1280 × 900 and mobile 390 × 844 with touch enabled
- Data target: local/offline fixtures only; no production Firebase access
- Themes and preferences: Carbon `g10` and `g100`; `prefers-reduced-motion: reduce`
- User tasks: Overview read/edit/save/cancel, explicit feedback placement, participant validation, Modal close/focus return

## Repeatable evidence

| Contract | Assertion |
| --- | --- |
| Typed feedback | Severity and placement are supplied as metadata; Japanese wording is never parsed. Visible row/page updates do not add redundant Toasts. |
| Page form | Overview enters edit mode from the page action, keeps a local draft, commits only on Save, discards on Cancel, and restores focus. |
| Validation | Invalid participant submit marks the field, explains the error, and focuses the first invalid enabled control. |
| Dialog | Every Modal task is registered; Escape/cancel closes the dialog and returns focus to the launcher where it remains present. |
| Responsive | Long project content and form actions have no document-level horizontal overflow at 390px. Mobile action targets are at least 40px high. |
| Accessibility | Main landmark, one page `h1`, form heading hierarchy, keyboard field order, accessible dialog name, invalid association, and visible focus are asserted in browser tests. |
| Theme and motion | The page form works under `g100`; reduced-motion media preference is exposed without changing task completion. |

## Captured screenshots

The opt-in `phase-c-evidence.spec.js` run writes these images for each browser project:

- `phase-c-chromium-desktop-overview-edit-dark.png`
- `phase-c-chromium-mobile-overview-edit-dark.png`
- `phase-c-webkit-desktop-overview-edit-dark.png`
- `phase-c-webkit-mobile-overview-edit-dark.png`

They show the same long-content Overview edit state in dark theme at the four required browser/viewport combinations.

## Screen-reader limitation

Native NVDA automation is not available in the repository CI environment. Phase C therefore verifies the browser accessibility tree inputs—landmarks, headings, names, `aria-invalid`, focus movement, focus return, and notification semantics—with Chromium and WebKit. A human NVDA + Chromium smoke remains an explicit final integration check before the Carbon redesign reaches production.

## Verified results

- React unit/contract suite: 59 passed.
- Production build: passed; only the existing bundle-size advisory was reported.
- Protected legacy files: 1,332 unchanged.
- Offline browser matrix: 198 passed, 6 intended project-specific skips across Chromium/WebKit desktop/mobile.
- Auth/Realtime Database Emulator unit suite: 3 passed.
- Two-client Auth/Realtime Database Emulator browser suite: Chromium desktop and WebKit 390px both passed.
- Browser CLI inspection: Chromium at 390 × 844 confirmed the Overview editor focus entry, keyboard order from project name to memo, reduced-motion preference, and no horizontal overflow.
- Visual review: all four committed dark-theme screenshots were inspected; no clipping or document-level horizontal overflow was observed.
- Production release, deployment, smoke, and production Firebase writes: not run, per the Carbon redesign integration exception.
