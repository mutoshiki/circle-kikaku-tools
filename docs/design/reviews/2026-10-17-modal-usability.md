# Modal usability review record — 2026-10-17

Worktree: `codex/site-typography-spacing`
Data target: synthetic legacy fixture and offline/local storage only. No production room was written.
Publication: held; this record does not authorize push, PR update, merge, or release.

## Recorded verification

| Screen / modal | State | Width × height | Theme | Keyboard | Result | Evidence | Reason if unverified |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Guide | Heading/description list; order; no horizontal overflow | 393 × 852 and 1280 × 900 | Default light | Menu activation and close | Pass | `modal-layout.spec.js` — `guide labels stay on one line at mobile width and retain their order on desktop` | Dark theme was not needed for this layout-only change |
| Settlement settings | First step, back disabled, 393/400 progress boundary, input retention, normal and count-only flow | 393 × 852 and 400 × 852 | Default light | Next, Back, Save/Cancel; focus to step heading | Pass | `modal-layout.spec.js` — `settlement settings use a medium progress dialog and disable back on the first step` | 1280 footer geometry also covered by `primary dialogs retain viewport margins and usable actions` |
| Settlement settings / short header | Short title, no independent header scrollbar | 393 × 667 | Default light | Cancel | Pass in Chromium | `modal-layout.spec.js` — `short modal headers do not scroll and long Japanese vehicle titles stay clear of close controls` | WebKit geometry assertion skipped: Playwright WebKit stalls during rendered measurement after `setViewportSize`; related WebKit modal cases remain covered |
| Vehicle expense | 80-character Japanese vehicle name; close control does not overlap title or clip | 393 × 667 and 1280 × 900 | Default light | Cancel/close | Pass in Chromium | Same `modal-layout.spec.js` test; waits for `document.fonts.ready` | Browser zoom at 125% was not exercised |
| Vehicle expense and movement | Fits, overflows with long expenses, body-only movement scroll, Times compact state | 390 × 852, 390 × 640, 390 × 500 | Default light | Scroll body; footer remains available | Pass | `modal-scroll.spec.js` — expense fit/long and movement fit/body-scroll/Times tests | Long validation-error copy at exactly 667px was not induced; a 500px viewport exercises body scrolling |
| Movement settings | Header/body host surface aligns; input and amount preview retain distinct surfaces | 390 × 852 | Light and dark | Back to expense, then cancel | Pass in Chromium | `modal-scroll.spec.js` — `movement settings keep aligned modal surfaces in both themes`; computed colors sampled on rendered nodes | WebKit palette measurement was not used as a pass criterion |
| Vehicle expense accessibility | Dialog/region names include car and current task; nested route-tool return; launcher focus restoration | Project viewport (1280 desktop, 390 mobile) | Default light | Back, close | Pass | `modal-accessibility.spec.js` — `vehicle expense dialog name includes the vehicle and current task` | Deleted-launcher fallback and Escape/save variants are not re-exercised by the final focused matrix |
| Collection | Unpaid and all filters; one checkbox per row; Space removes a collected row, focus advances through remaining rows then returns to selected filter; full row label toggles; checked state shown | 390 × 844 and desktop project | Default light | Tab, Space; row label | Pass | `modal-accessibility.spec.js` — `collection rows use one checkbox tab stop and Space records once`; settlement collection regression cases | Screen-reader announcement was not checked with VoiceOver/NVDA |
| Count-only collection | Collector name entry, save, and returned checked state | 390 × 844 | Default light | Checkbox then collector form | Pass | `settlement.spec.js` and `settlement-entry-mode.spec.js` collection flows | — |
| Other app-owned modals | Registration/edit/delete/sample/allocation/ProjectTools inventory | Not individually measured in this pass | — | — | Not verified individually | Source inventory confirms app-owned modal class scope; classes are enumerated by `rg '<Modal|<ComposedModal' apps/react/src` | The 393px common-header geometry assertion exercises settings, not every content-specific modal |

## Browser results

- Chromium mobile and desktop: current modal accessibility/layout/scroll matrix passed **24/24**. This includes short and long headers, vehicle-expense naming, collection keyboard operation, body-only scrolling and light/dark movement surfaces.
- WebKit mobile and desktop: current modal matrix passed **22**, skipped **2** header geometry cases. WebKit's viewport-resize automation issue remains recorded in `modal-layout.spec.js`; those geometry cases are not claimed as verified.
- Chromium mobile and desktop: focused settlement/count-only collection regression set passed **14/14**. Chromium mobile registration, participant accessibility, and visual consistency passed **13/13**.
- Chromium mobile and desktop: financial regression cases for saved expenses, signed extras, blank movement values, Times distance calculations, and collection persistence passed **8/8**. Expected amounts and saved states remained unchanged.
- Existing hidden 1px Carbon focus sentinel nodes trigger the broad type-size audit; this exploratory issue is unrelated to these modal changes and is excluded from the focused passing matrix. A separate pre-existing narrow-screen amount audit still expects at least 16px for `.settlement-car-amounts dt` while the documented body-compact role emits 14px. No type role was changed to silence the mismatch.
- The 125% browser zoom run, physical Safari, VoiceOver, and NVDA remain unverified.
- The test server emitted existing Vite large-chunk and plugin-timing warnings; they did not fail the passing suites.

## Scope notes

- The 500px movement test replaces a 667px viewport assertion because the default movement content fits at 667px. A long validation-error state at 667px was not successfully induced, so it is explicitly unverified.
- WebKit's viewport-resize automation timeout is a test-harness limitation observed in the geometry assertion; it is not recorded as a product pass. Chromium provides the current short/long header geometry evidence.
- No browser zoom was simulated by changing CSS or viewport dimensions.
- The first collection focus assertion used a positional locator that shifted when a row disappeared; it has been replaced by stable checkbox IDs and checks every unpaid row through the final selected-filter fallback.
