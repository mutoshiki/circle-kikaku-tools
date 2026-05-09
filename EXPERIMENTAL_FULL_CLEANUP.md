# Experimental full cleanup

This is a trial build.

What changed:

- Removed all `important` from project CSS.
- Kept legacy/compatibility CSS files loaded, but marked them as compatibility layers.
- Added `100-owner-overrides.css` loaded last to protect important visual owners.
- Preserved drag, waiting tray behavior, settlement logic, and Firebase logic.
- Added tests to prevent `important` and duplicated save-status displays from returning.

Manual checks needed:

1. Header buttons and top-right save badge
2. View tabs in light/dark mode
3. Waiting tray open/close and card drag
4. Member card lock state
5. Settlement inputs, extra rows, collection checkboxes
6. Guide modals and theme modal
7. Mobile scrolling and long-press drag
