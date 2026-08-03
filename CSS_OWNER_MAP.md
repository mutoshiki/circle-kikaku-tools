# CSS Owner Map

| Responsibility | Owner |
|---|---|
| Light semantic colors | `assets/css/tokens/01-color-scheme.css` |
| Dark semantic colors | `assets/css/tokens/01-theme-modes.css` |
| Component palette aliases | `assets/css/tokens/01-component-palette.css` |
| Radius, spacing, type and focus | `assets/css/tokens/02-radius-spacing-type.css` |
| Carbon form field and state contracts | `assets/css/tokens/04-forms-inputs.css` |
| Shared control dimensions and surface hierarchy | `assets/css/tokens/05-control-surface-tokens.css` |
| Shared Carbon button placement and labels | `assets/css/components/buttons/` |
| Shared layer, empty-state and feedback surfaces | `assets/css/components/surfaces/` and `assets/css/components/feedback/` |
| Header shell and layout | `assets/css/app-shell/header/01-header-base.css` |
| Room title and sync status | `assets/css/app-shell/header/02-room-status.css` |
| Header Carbon actions | `assets/css/app-shell/header/03-tabs-actions.css` |
| Bottom Carbon Content Switcher navigation | `assets/css/app-shell/layout/03-bottom-navigation.css` |
| App panels, safe areas and layer order | `assets/css/app-shell/layout/` |
| Carbon modal shell and dynamic dialog lifecycle | `assets/css/guides-modals/modal/` and `assets/js/core/modal-controller.js` |
| Header overflow and local Carbon menus | `assets/css/guides-modals/modal/02-dropdowns.css` and feature owners |
| Participant import shell and fields | `assets/css/guides-modals/import-guide/` and `assets/js/features/batch-import.js` |
| Overview drawer and timetable | `assets/css/guides-modals/overview/` and `assets/js/features/overview-drawer.js` |
| Allocation cards and people | `assets/css/cars-members-tray/` |
| Person Carbon Menu lifecycle | `assets/css/cars-members-tray/person-card/03-person-menu.css` and `assets/js/features/person-menu.js` |
| Shared assigned/unassigned member surface | `assets/css/cars-members-tray/01-shared-card-primitives.css` |
| Unassigned bottom tray and Carbon Popover | `assets/css/cars-members-tray/waiting-tray/` and `assets/js/features/waiting-tray.js` |
| Settlement page hierarchy | `assets/css/settlement/page-shell/` |
| Settlement controls and settings modal | `assets/css/settlement/controls/` |
| Vehicle cost editing and validation | `assets/css/settlement/car-inputs/` and settlement feature/template files |
| Settlement status tags | `assets/css/settlement/cost-tags/` and `assets/css/settlement/payment-chip/` |
| Shared presentation frame and pan/zoom | `assets/css/sheet-view/layout/` and `assets/js/features/sheet/02-viewport-controls.js` |
| Shared presentation quick edit | `assets/css/sheet-view/edit/` |

## Integration Policy

- Product-wide override、skin、visual、repair ディレクトリは禁止する。
- 視覚変更は、構造と状態を管理する owner へ直接統合する。
- 汎用の操作・入力・選択・通知・モーダル・メニューは公式Carbon Web Componentsを使用する。
- 車両、座席、参加者、精算内訳などCarbonに直接対応部品がないドメイン面は、Carbon token、layer、type、spacing、focus、state契約で構成する。
- 白・黒の固定背景ではなく semantic surface を使用する。
- 可視のボタン、summary、アイコン操作はモバイルで原則48px以上を確保する。
- 選択、エラー、完了、ロック、無効は色以外の形・文字・アイコン・ARIAも併用する。
- `99-*`、`final-*`、`override-*` 等の包括的な修正 CSS を作らない。

## Breakpoint Policy

- Mobile rules end at `max-width: 768px`。
- Desktop complement starts at `min-width: 769px`。
- 狭幅補正は既存の実測境界だけを使用する。
- 新しい境界はレイアウト上の理由と回帰テストを伴う場合だけ追加する。
