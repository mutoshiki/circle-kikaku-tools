# CSS Unused Selector Candidates

Static scan only. Do not bulk-delete from this list. Confirm each candidate in the browser DOM after opening the relevant screen or modal.

Method:
- Compare selectors in `assets/css/**/*.css` against strings in `index.html`, root JS, assets JS, and docs.
- Ignore common state/framework classes such as `.active`, `.show`, `.modal`, `.btn`, `.paid`, `.done`, `.split`, `.club`.
- Treat guide/mockup classes as lower confidence because many are generated in script templates.

High-confidence ID candidates to inspect first:
- `#app-main` in `assets/css/app-shell/header/03-tabs-actions.css`
- `#main-container` in `assets/css/app-shell/header/03-tabs-actions.css`
- Header selectors formerly assigned to deleted responsive files must be re-scanned before removal; the header now has only three canonical owner files.

High-confidence class candidates to inspect first:
- `.app-brand-mark`, `.app-header-illustration` in `assets/css/app-shell/layout/*` and `assets/css/app-shell/edit/01-edit-base.css`
- `.batch-spreadsheet-head`, `.guide-modal-header`, `.guide-section-head`, `.member-meta`, `.car-subtitle` in settlement and guide owners
- `.capacity-edit-row` in `assets/css/components/surfaces/01-surface-tokens.css`
- `.drop-target-active` in `assets/css/components/surfaces/01-surface-tokens.css`

Large low-confidence clusters:
- `app-guide-*`, `guide-*`, `global-guide-*`, `batch-*` mockup classes. These need modal DOM inspection before deletion.
- `edit-*` classes in `app-shell/layout/*`. These may be legacy from the old edit header.
- Bootstrap utility selectors such as `.bg-light-subtle`, `.btn-link`, `.btn-outline-danger` may be framework hooks and should not be removed without rendered DOM confirmation.
