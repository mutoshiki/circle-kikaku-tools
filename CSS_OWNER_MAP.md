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
