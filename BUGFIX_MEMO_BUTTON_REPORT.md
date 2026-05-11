# Memo button and event-regression audit

## Issue
After the A cleanup, the person operation menu still used `data-action` for local menu commands such as memo, grade, gender, lock, return, and name. The A cleanup also introduced a central `data-action` event owner in `assets/js/features/events.js`.

Even when local propagation should normally stop the event, sharing the same `data-action` namespace made the person menu fragile and easy to break during future event edits.

## Fix
- Changed person-menu commands from `data-action` to `data-person-action` in `assets/js/app.js`.
- Updated the person-menu click handler to read `dataset.personAction`.
- Added a defensive guard in the central generated-HTML event delegation so `.person-pop-menu` actions are ignored by the global dispatcher.

## Verified by static audit
- All central `data-action` values are handled by `assets/js/features/events.js`.
- Person menu no longer uses global `data-action`.
- Static bound button IDs exist in `index.html`.
- JS syntax checks pass.
