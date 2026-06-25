# CSS Owner Map

| Responsibility | Owner |
|---|---|
| Color, text, border, shadow and semantic values | `assets/css/tokens/01-color-scheme.css` and `assets/css/tokens/01-component-palette.css` |
| Radius, spacing, type and focus | `assets/css/tokens/02-radius-spacing-type.css` |
| Shared control dimensions | `assets/css/tokens/05-control-surface-tokens.css` |
| Shared floating-surface backdrop | `assets/css/tokens/05-control-surface-tokens.css` |
| Shared button behavior | `assets/css/components/buttons/` |
| Shared surface hierarchy | `assets/css/components/surfaces/` |
| Header shell and shared header layout | `assets/css/app-shell/header/01-header-base.css` |
| Room title and sync status | `assets/css/app-shell/header/02-room-status.css` |
| Navigation tabs and header actions | `assets/css/app-shell/header/03-tabs-actions.css` |
| App panels and responsive frame | `assets/css/app-shell/layout/` |
| Modal, dropdown, guide and drawer | `assets/css/guides-modals/` |
| Modal surface, border and equal corner radius | `assets/css/guides-modals/modal/01-modal-base.css` |
| Modal viewport fit and stacking | `assets/css/guides-modals/z-layer/01-z-layer.css` |
| Lock/passphrase panel | `assets/css/guides-modals/notices/01-copy-lock.css` |
| Overview drawer and panels | `assets/css/guides-modals/overview/` |
| Allocation cards and people | `assets/css/cars-members-tray/` |
| Shared assigned/unassigned member-card surface | `assets/css/cars-members-tray/01-shared-card-primitives.css` |
| Member-card structure and content layout | `assets/css/cars-members-tray/person-card/` |
| Unassigned tray layout and tray-only states | `assets/css/cars-members-tray/waiting-tray/` |
| Presentation quick-edit action | `assets/css/sheet-view/edit/01-quick-edit.css` |
| Settlement UI | `assets/css/settlement/` |
| Presentation UI | `assets/css/sheet-view/` |

## Integration Policy

- Product-wide override、skin、visualディレクトリは禁止する。
- 視覚変更は、そのコンポーネントの構造と状態を管理するownerへ直接統合する。
- 共通値はtokensまたはcomponentsへ移し、画面固有値は画面ownerに残す。
- assigned／未割当など表示場所だけが異なる同一カードは、context側で表面・角丸・影を再定義しない。
- ダークモード対応を妨げないよう、component ownerでは白固定値ではなくsemantic tokenを使用する。
- `99-*`、`final-*`、`override-*`、`repair-*`等の包括的な修正CSSを作らない。
- 既存ownerの末尾へ無条件に追記せず、同一セレクタとメディア条件の正規定義へ統合する。

## Breakpoint Policy

- Mobile rules end at `max-width: 768px`.
- Desktop complement starts at `min-width: 769px`.
- Narrow-device corrections use only the approved 360px, 380px, 390px, 420px, 430px, 520px and 640px boundaries.
- New boundaries require a layout reason and regression coverage.
