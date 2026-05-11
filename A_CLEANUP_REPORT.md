# A cleanup report

## Scope

Priority A cleanup only. No intentional UI, calculation, Firebase room, or localStorage format changes.

## 1. Theme registry unified

`assets/js/modules/theme-presets.js` now owns:

- theme preset card data
- light/dark allowed palette ids
- palette labels
- legacy palette aliases
- palette normalization

`assets/js/features/appearance.js` now consumes `window.SanpoThemeRegistry` instead of keeping duplicate `LIGHT_THEME_IDS`, `DARK_THEME_IDS`, and `APPEARANCE_PALETTE_LABELS` arrays.

## 2. Event binding owner added

`assets/js/features/events.js` now owns static control bindings, generated HTML delegated events, and startup form/pointer event bindings.

`app.js` keeps app logic and startup flow, while event wiring is grouped in one owner file.

## 3. Unused future modules removed

Removed files that were not loaded by `index.html`:

- `assets/js/modules/future/*`
- `assets/js/modules/schema.js`
- `assets/js/modules/state.js`
- `assets/js/modules/storage.js`
- `assets/js/modules/utils.js`

This avoids AI edits landing in files that do not affect the running site.

## Debug priority

1. Theme modal open/reset/select.
2. Header menu buttons.
3. Batch import and debug sample data.
4. Tab switching.
5. Settlement input while keyboard is open.
6. Generated buttons in settlement and route helper.
