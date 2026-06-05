# CSS Unused Selector Candidates

Static scan only. Do not bulk-delete from this list. Confirm each candidate in the browser DOM after opening the relevant screen or modal.

Method:
- Compare selectors in `assets/css/**/*.css` against strings in `index.html`, root JS, assets JS, and docs.
- Ignore common state/framework classes such as `.active`, `.show`, `.modal`, `.btn`, `.paid`, `.done`, `.split`, `.club`.
- Treat guide/mockup classes as lower confidence because many are generated in script templates.

High-confidence ID candidates:
- `#app-main` in `assets/css/app-shell/header/03-tabs-actions.css`
- `#main-container` in `assets/css/app-shell/header/03-tabs-actions.css`
- `#roomInput` in `assets/css/app-shell/header/10-responsive-small.css`

High-confidence class candidates to inspect first:
- `.app-brand-mark`, `.app-header-illustration` in `assets/css/app-shell/layout/*` and `assets/css/app-shell/edit/01-edit-base.css`
- `.batch-spreadsheet-head`, `.guide-modal-header`, `.guide-section-head`, `.member-meta`, `.car-subtitle` in `assets/css/settlement/dark/01-dark-surfaces.css`
- `.capacity-edit-row` in `assets/css/components/surfaces/01-surface-tokens.css`
- `.drop-target-active` in `assets/css/components/surfaces/01-surface-tokens.css`
- `.cost-payment-tag` in `assets/css/theme/06-palette-toolbar.css`

Large low-confidence clusters:
- `app-guide-*`, `guide-*`, `global-guide-*`, `batch-*` mockup classes. These need modal DOM inspection before deletion.
- `edit-*` classes in `app-shell/layout/*`. These may be legacy from the old edit header.
- Bootstrap utility selectors such as `.bg-light-subtle`, `.btn-link`, `.btn-outline-danger` may be framework hooks and should not be removed without rendered DOM confirmation.
