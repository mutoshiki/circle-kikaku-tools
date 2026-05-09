# CSS ownership notes

Current late-stage owners:

- `04-header-tabs.css`
  - `#app-header`
  - `.app-header-main`
  - `.header-actions`
  - `.header-action`
  - `#view-toggle-bar`
  - `.view-tab`

- `04-dark-highlight-fixes.css`
  - dark-mode active view tabs
  - dark-mode seisan active/primary button highlights
  - `+ 諸経費を追加` dark-mode highlight

- `04-person-cards.css`
  - `.member-card`
  - `.driver-seat`
  - person menu/card common details

- `04-waiting-tray.css`
  - `#bottom-tray`
  - `#tray-handle`
  - `#waiting-list`
  - waiting-tray drag feedback

Old files still contain compatibility rules, but new edits should be added to the owner files above first.


- `04-status-badge.css`
  - `#syncStatusBadge`
  - local/cloud save status badge
  - top-right fixed badge placement

- 保存状態は `04-status-badge.css` のみで管理します。`showMiniToast()` は保存状態表示には使いません。


## Experimental full cleanup

- `100-owner-overrides.css` is loaded last in the experimental build.
- It should only contain high-level owner safeguards.
- No project CSS should use `important` in this experimental branch.


## Split owner overrides

`100-owner-overrides.css` was split into:

- `100-owner-safety.css`: final safety layer for header, tabs, cards, buttons, drag-menu safeguards
- `101-guide-fixes.css`: guide modal centering and guide layout repair
- `102-appearance-modal.css`: theme preview and appearance modal footer repair
- `103-modal-fixes.css`: general popup/modal centering and overflow repair
- `104-room-input.css`: dark-mode project title input repair

`100-owner-overrides.css` is kept only as a migration note and is not loaded.


- `105-dark-badge-fixes.css`
  - dark-mode capacity badge frame removal
  - dark-mode check icon/mock check frame cleanup
