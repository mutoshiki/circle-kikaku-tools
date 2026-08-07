# v36 UI consistency and interaction QA

## Scope

This revision is limited to the requested interaction and visual consistency issues:

- Person Overflow Menu scroll affordance and nested choices (`しるし`, `学年`, `性別`)
- Nested choices while the waiting tray is minimized
- Stale/duplicated focus and accent shadows
- Shared-view pointer focus and pan affordance
- Allocation criteria popover placement
- Participant registration overflow shadow
- Carbon component/action runtime versions used by Quality Guard

No participant data shape, saved-room format, allocation algorithm, settlement calculation, or navigation order was changed.

## Root causes and fixes

1. The nested Carbon menu item click propagated to the parent Overflow Menu trigger. The root trigger closed while the submenu opened, leaving the child menu hidden and untappable. Submenu parent activation is now intercepted before the root trigger, and the Carbon submenu remains open inside the active Overflow Menu.
2. A manually fixed root-menu surface was not reset when Carbon removed `open`. The close path and mutation observer now reset the surface and all submenus.
3. A constrained menu had only a subtle scrollbar. A neutral semantic-token indicator (`下に続きます`) is displayed only while more content remains below and disappears after scrolling or closing.
4. Pointer/touch focus was receiving the same custom focus treatment as keyboard focus. App-specific focus rings are now gated by keyboard modality. Keyboard focus remains visible.
5. Shared view added an accent inset shadow over the existing neutral edge affordance. The extra shadow was removed.
6. Allocation settings manually transformed the internal Carbon Popover surface. The custom transform/clamp owner was removed; `cds-popover` `autoalign` with `top-end` is now the placement owner.
7. Participant registration used the accent border token for horizontal overflow shadows. It now uses a neutral semantic text mix.
8. Quality Guard action runtimes were upgraded to the current Node 24 action majors: `actions/checkout@v6`, `actions/setup-node@v6`, and `actions/upload-artifact@v6`.

## Browser verification method

- Source under test: repository-external copy at `/tmp/v36verify/circle-kikaku-tools-carbon-ui-consistency-v36`
- Verification script and screenshots: `/tmp/v36verify`, outside the source copy
- Browser binary: `/usr/bin/chromium` (Chromium 144.0.7559.96)
- Chromium child-process policy reads were redirected to an empty directory using an `LD_PRELOAD` path shim.
- The repository/source copy, `/etc/chromium/policies`, and other system policy files were not modified.

## Rendered browser result

39 / 39 checks passed.

Covered states:

- 390 × 844 light and dark, touch/mobile context
- 360 × 800 light, touch/mobile context
- 1280 × 900 light and dark, desktop context
- 車割・班割, 共有画面, 精算
- Normal and minimized waiting tray
- Touch fallback without a synthetic click
- Actual nested menu clicks and value application
- Pointer focus and keyboard focus
- Allocation settings popover placement
- Participant registration modal
- Horizontal document overflow, page errors, and console errors

Key measured results:

- Constrained person menu: fully inside viewport; scroll affordance visible while content remains
- Nested submenu with minimized tray: choice rectangle fully inside 390 × 844 viewport and tappable
- Closed person menu: Carbon surface visibility returned to hidden; no stale indicator
- Shared pointer focus: no outline and no extra box shadow
- Shared keyboard focus: 3 px visible focus outline retained
- Allocation settings: no inline transform; Carbon `autoalign`, `top-end`; fully inside viewport
- Participant registration overflow shadow: neutral semantic color
- Horizontal document overflow: 0 px in all tested view/theme combinations
- Page errors: 0
- Console errors: 0

## Static and code checks

Passed:

- `npm test`
- Google route planner lint
- Google route planner TypeScript check
- Google route planner contract
- Driver reward policy contract
- Share links/OGP contract
- JavaScript syntax: 92 files
- CSS parser validation: 121 files

Environment limitation:

- A fresh `npm ci` could not be completed because the execution environment's package mirror did not provide `@carbon/web-components@2.60.0`. Therefore the Node-installed Stylelint command, Carbon rebuild/diff command, and repository's Node Playwright runner were not claimed as executed here. Equivalent requested browser paths were tested directly with the fixed `/usr/bin/chromium` method above.

## GitHub-hosted deployment limitation

The supplied Pages screenshots contain hosted-runner acquisition and GitHub internal-server errors. Those are platform-side failures and cannot be reproduced or resolved from the local source copy. The workflow's Node 20 action warnings were addressed by the action-major upgrades above. An actual Pages deployment rerun was not performed because GitHub interaction was not authorized for this task.
