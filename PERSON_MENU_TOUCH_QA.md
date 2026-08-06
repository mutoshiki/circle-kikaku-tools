# v35 Person Menu Touch QA

## Finding

The person-card Overflow Menu still depended on the synthetic `click` generated after a touch sequence. On iPhone, Sortable and the Carbon trigger can observe the same gesture, and that synthetic `click` can be omitted for an individual card. When that happened, the menu context was prepared on `pointerdown`, but the menu was never opened.

## Root fix

- Kept Carbon `cds-overflow-menu` and `cds-menu` as the official components.
- Added a touch/pen-only `pointerdown` → `pointerup` activation fallback.
- Treats movement over 10 px or a press over 900 ms as a drag/long press, not a menu tap.
- Opens or closes the Carbon menu explicitly when the synthetic click is absent.
- Suppresses only the duplicate click when the browser does generate one.
- Leaves mouse and keyboard activation on Carbon's normal path.
- Does not intercept touches on menu items or submenus.

## Browser method

- Tested from a copy outside the repository.
- Executed the same `/usr/bin/chromium` binary.
- Redirected only the child Chromium process's policy reads to an empty policy directory.
- Did not modify the repository source used as the original, `/etc/chromium/policies`, or any system policy file.

## Rendered checks

| Check | Result |
|---|---|
| First/top car person menu, normal touch tap | PASS |
| First/top car person menu, pointer sequence with no click | PASS |
| Same trigger second tap closes the menu | PASS |
| All sample participant menus | 13 / 13 PASS |
| Menu surface visible and inside viewport/tray boundary | PASS |
| 390×844 dark | PASS |
| 390×844 light | PASS |
| 360×800 dark | PASS |
| 1440×900 mouse activation | PASS |
| 1440×900 Carbon internal-button keyboard activation | PASS |
| Horizontal document overflow | 0 px |
| Page errors | 0 |

## Static checks

- `npm test`: PASS
- Google route planner lint: PASS
- Google route planner typecheck: PASS
- Google route planner contract: PASS
- Driver reward policy contract: PASS
- Share links/OGP contract: PASS
- JavaScript syntax: 89 files, 0 failures
- CSS parse: 121 files, 0 failures

`stylelint` could not be executed because the uploaded package did not contain its executable in `node_modules/.bin`. No CSS was changed in v35; all CSS files were parsed with `tinycss2`.

## Remaining limit

Real iOS Safari is not available in this environment. The specific failure path was reproduced directly by omitting the synthetic click after a touch pointer sequence, in addition to normal touch-tap testing.
