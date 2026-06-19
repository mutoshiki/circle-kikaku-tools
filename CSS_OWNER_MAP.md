# CSS Owner Map

## Header/App Shell

| Selector/area | Owner | Notes |
| --- | --- | --- |
| `#app-header`, `.app-header-main` base | `assets/css/app-shell/header/01-header-base.css` | Structural header grid only. |
| Room/status controls | `assets/css/app-shell/header/02-room-status.css` | Sole base owner for `.app-room-control`, `.app-room-field`, `.app-room-input`, and `#syncStatusBadge`; other header files may contain responsive/state deltas only. |
| Header actions/tabs base | `assets/css/app-shell/header/03-tabs-actions.css` | Button sizing, lock state, action group baseline. |
| Mobile header layout | `assets/css/app-shell/header/04-mobile-layout.css` | Main mobile geometry only. |
| Mobile room/action tuning | `assets/css/app-shell/header/05-mobile-room.css` to `08-mobile-density.css` | Narrow breakpoint deltas; avoid redefining base. |
| Edge/wide responsive caps | `assets/css/app-shell/header/09-responsive-base.css` to `12-responsive-wide.css` | Last-mile viewport fixes only. |

## Settlement Inputs

| Selector/area | Owner | Notes |
| --- | --- | --- |
| Car form structure | `assets/css/settlement/car-inputs/01-car-form.css` | Base form and generic field layout. |
| Distance/fuel fields | `assets/css/settlement/car-inputs/02-distance-fuel.css` | Distance/fuel styling only; do not add modal breakpoint overrides. |
| Car edit modal mobile inputs | `assets/css/settlement/car-inputs/05-mobile-inputs.css` | Sole owner for `#settlementCarEditModal` narrow input and extra-cost grid behavior. |

## Theme

| Selector/area | Owner | Notes |
| --- | --- | --- |
| Shared line, border, and surface hierarchy | `assets/css/theme/08-border-hierarchy.css` | Owns `--app-line-*` aliases and cross-feature border/surface application. |
| Dark border tuning | `assets/css/theme/08-dark-border-softness.css` | Dark-only border tokens and scoped softness deltas. |
| Accent-filled labels and selected controls | `assets/css/theme/09-accent-application.css` | Accent application only; do not add generic border or surface normalization. |

## Breakpoint Policy

| Tier | Query | Use |
| --- | --- | --- |
| Ultra-narrow | `max-width: 360px` | Last-resort control padding and single-column fallbacks. |
| Narrow phone | `max-width: 380px`, `390px` | Proven overflow fixes for compact phone layouts. |
| Compact component | `max-width: 420px`, `430px`, `520px` | Feature-local card, modal, and tray fit. |
| Primary mobile | `max-width: 640px` | Main mobile layout boundary. Desktop complement starts at `min-width: 641px`. |
| Touch/tablet | `max-width: 768px` | Touch input sizing and tablet-safe layout. Desktop complement starts at `min-width: 769px`. |
| Wide settlement | `min-width: 860px` | Two-column settlement composition only. |

- Keep responsive rules in the selector's feature owner; breakpoint tiers are policy, not a separate cascade owner.
- Prefer an existing tier. New pixel values require a documented layout failure and an allow-list update in `tests/breakpoint-policy-check.js`.
- Do not overlap paired boundaries (`max-width: 768px` with `min-width: 768px`).
