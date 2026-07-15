# CSS Owner Map

| Responsibility | Owner |
|---|---|
| Light semantic colors | `assets/css/tokens/01-color-scheme.css` |
| Dark semantic colors | `assets/css/tokens/01-theme-modes.css` |
| Component palette aliases | `assets/css/tokens/01-component-palette.css` |
| Radius, spacing, type and focus | `assets/css/tokens/02-radius-spacing-type.css` |
| Bootstrap controls | `assets/css/tokens/03-bootstrap-controls.css` |
| Form controls | `assets/css/tokens/04-forms-inputs.css` |
| Shared control dimensions and surface hierarchy | `assets/css/tokens/05-control-surface-tokens.css` |
| Shared button behavior | `assets/css/components/buttons/` |
| Shared surface hierarchy and empty states | `assets/css/components/surfaces/` |
| Header shell and layout | `assets/css/app-shell/header/01-header-base.css` |
| Room title and sync status | `assets/css/app-shell/header/02-room-status.css` |
| Primary navigation and header actions | `assets/css/app-shell/header/03-tabs-actions.css` |
| App panels and responsive frame | `assets/css/app-shell/layout/` |
| Modal, dropdown, guide and drawer | `assets/css/guides-modals/` |
| Participant import shell and touch targets | `assets/css/guides-modals/import-guide/` |
| Allocation cards and people | `assets/css/cars-members-tray/` |
| Shared assigned/unassigned member surface | `assets/css/cars-members-tray/01-shared-card-primitives.css` |
| Unassigned bottom tray | `assets/css/cars-members-tray/waiting-tray/` |
| Settlement page hierarchy | `assets/css/settlement/page-shell/` |
| Settlement controls and settings | `assets/css/settlement/controls/` |
| Vehicle cost editing | `assets/css/settlement/car-inputs/` |
| Settlement status tags | `assets/css/settlement/cost-tags/` and `payment-chip/` |
| Shared presentation frame and scaling | `assets/css/sheet-view/layout/` and `assets/js/features/sheet/02-viewport-controls.js` |
| Shared presentation quick edit | `assets/css/sheet-view/edit/` |

## Integration Policy

- Product-wide override、skin、visual、repair ディレクトリは禁止する。
- 視覚変更は、構造と状態を管理する owner へ直接統合する。
- 白・黒の固定背景ではなく semantic surface を使用する。
- 可視のボタン、summary、アイコン操作はモバイルで48px以上を確保する。
- 選択、エラー、完了、ロック、無効は色以外の形・文字・アイコン・ARIAも併用する。
- `99-*`、`final-*`、`override-*` 等の包括的な修正 CSS を作らない。

## Breakpoint Policy

- Mobile rules end at `max-width: 768px`。
- Desktop complement starts at `min-width: 769px`。
- 狭幅補正は 360、380、390、420、430、520、640px の既存境界だけを使用する。
- 新しい境界はレイアウト上の理由と回帰テストを伴う場合だけ追加する。
