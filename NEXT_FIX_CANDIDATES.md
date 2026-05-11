# Next fix candidates

## High priority

1. Remove template inline-event strings from settlement HTML
   - `onclick=` strings: still present in generated HTML strings
   - `onchange=` strings: still present in generated settlement inputs
   - `oninput=` strings: still present in generated settlement inputs
   - Best next target: settlement input event delegation on `#seisan-car-list`, `#seisan-collection-list`, and `#seisan-driver-pay-list`

2. Continue reducing legacy CSS
   - `03d-legacy-theme-mobile-overrides.css` still has the largest number of `!important` rules.
   - Next safe area: modal/dropdown/dark-mode compatibility rules now owned by `03b-modals.css` and `04-dark-highlight-fixes.css`.

3. Move remaining guide rules
   - `01-foundation-components-guide.css` and `03-app-layout-and-themes.css` still contain guide-related rules.
   - Continue moving obvious `.guide-*` rules into `03b-guide.css`.

## Medium priority

4. Reduce `innerHTML` in settlement rendering
   - Current count is still high because settlement rows are generated as strings.
   - Convert the highest-risk inputs first, not the whole view at once.

5. Replace more `document.getElementById` with `byId`
   - Current code already has `byId`.
   - Do this gradually in functions that are being edited anyway.

6. Add a small regression test for generated settlement markup
   - Verify `renderSettlementCarRowHtml` output still includes the required `data-field` attributes.
   - Verify `renderSheetCarColumnHtml` output still includes dropzone attributes.

## Avoid for now

- Drag behavior
- Waiting tray open/close conditions
- Firebase sync logic
- Large module conversion of `app.js`
