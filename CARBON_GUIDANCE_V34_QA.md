# Carbon guidance v34 QA

## Changes
- Removed the decorative `handle-bar` from the Carbon waiting-tray disclosure button so the stray gray bar cannot render as slotted button content.
- Reworked assignment-condition popover lifecycle around the official Carbon `cds-popover` / `cds-popover-content` / `cds-icon-button` upgrade lifecycle.
- Carbon owns outside-click/Escape dismissal; app code only toggles `open` and mirrors `aria-expanded` / tray layering.
- Popover prefers `top-end` with Carbon `autoalign` constrained to `#app-layout`.
- First-view notices are armed only after successful participant registration and appear after 6000 ms on the view that remains open.
- Guidance is consumed only when actually shown; leaving a view before six seconds does not consume it.

## Verification
- `npm test`: PASS.
- `node --check` for modified JS: PASS.
- Playwright component harness with production waiting-tray JS/CSS + bundled Carbon 2.60.0: PASS at 390x844 and 1280x900.
- Settings popover opens above the trigger, stays within viewport bounds, and closes on outside click: PASS.
- Guidance lifecycle harness: participant-registration gate PASS; shared-view delay 6000.4 ms; allocation delay 6000.3 ms; one-time behavior PASS.

The session browser environment blocks localhost/file navigation by administrator policy, so full-page navigation was not available. Component behavior was validated with Playwright `setContent` using the production scripts, styles, and Carbon bundle, while project integration was covered by the static regression suite.
