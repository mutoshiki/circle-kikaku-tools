# Usability and visual consistency QA — v33

## Scope

This release implements the 17 items from the v32 usability audit without changing stored room data, Firebase document shape, URL parameters, the three primary destinations, or existing allocation/settlement workflows.

## Implementation ledger

| # | Audit issue | Implemented resolution |
|---|---|---|
| 1 | Shared view interaction was hard to discover | Added a labelled Carbon tertiary **全体表示** action. The normal readable view exposes the horizontal-pan affordance; the explicit action calculates the exact fit scale, recentres the canvas, updates `aria-pressed`, and changes the label to **全体表示中**. |
| 2 | Toast could cover modal controls | `AppUI.showStatus` now creates a Carbon Inline Notification inside the currently open modal. Outside a modal it continues to use the global Toast above bottom navigation. |
| 3 | Participant registration was too dense | Split the existing workflow into **スプレッドシート（推奨）** and **手入力** with Carbon Content Switcher. Help content uses Carbon Accordion. Existing textarea IDs and import logic remain unchanged. |
| 4 | Route map was too tall on mobile | Replaced the fixed mobile map minimum with `clamp(300px, 44dvh, 460px)`. Desktop geometry and route data remain unchanged. |
| 5 | Header icon meaning was ambiguous | Added a compact Carbon status Tag for non-default edit-lock states: **一部ロック** / **全体ロック**. Icon buttons retain accessible names; no tooltip was restored. |
| 6 | Small text sizes were fragmented | Consolidated visible small copy into shared 13px caption and 12px micro tokens. Static and rendered audits reject visible text below 12px. |
| 7 | Shared summary was too dense | Condensed each allocation summary into a primary `人数・待機` line and a secondary role breakdown while preserving the same counts. |
| 8 | Content Switcher carried unrelated setting meanings | Settlement rounding and driver-reward funding now use Carbon Select. Main page/view switching continues to use Content Switcher. Stored values are unchanged. |
| 9 | Blue represented too many metadata meanings | Gender metadata moved to neutral Carbon tag families. Blue remains focused on interaction, selection, links, and the established driver emphasis. |
| 10 | Settlement summary used large saturated surfaces | Summary cards now use a neutral layer with a semantic top rule and label color. Existing collect/club/pay categories and amounts are unchanged. |
| 11 | Memo/timetable drawer differed from modal conventions | Added a labelled dialog heading, focus entry/return, Escape handling, keyboard containment, and a consistent full-screen mobile surface. Existing drawer and saved fields remain intact. |
| 12 | Edit affordances varied | Shared presentation editing now uses one labelled Carbon Button: **編集** / **完了**. Existing card- and section-level edit actions retain their established location. |
| 13 | Modal heading icon usage was inconsistent | Standardised app-modal headings to text-only. Context icons remain in body content and actions where they carry meaning. |
| 14 | Raw URLs broke timetable rhythm | Display mode renders concise **地図を開く** / **リンクを開く** labels while preserving the original URL in `href`, title, and edit value. |
| 15 | Feedback surfaces lacked a shared rule | Added `UI_FEEDBACK_RULES.md` and implemented field invalid state, modal Inline Notification, outside Toast, destructive Modal, and persistent undo-bar ownership. |
| 16 | Participant action naming differed | All actions are named **参加者登録**. Recommendation is separate metadata in a Carbon **推奨** Tag. |
| 17 | Mixed asset versions increased regression risk | All application CSS/JS references use the single `usability-v33` cache key. A contract test rejects mixed keys and guards the 17 changes. |

## Browser environment

- Browser plugin: not available in this session; Playwright fallback used.
- Source under test: repository-outside copy.
- Chromium binary: `/usr/bin/chromium`.
- Policy directory: an empty repository-outside directory supplied through `CHROME_POLICY_PATH` and `--policy-path`.
- Repository and system policy: not modified.
- Direct localhost/file navigation remained blocked by `ERR_BLOCKED_BY_ADMINISTRATOR`; the same isolated Chromium rendered a repository-outside, fully inlined copy of the app.
- Local IBM Plex Sans / IBM Plex Sans JP assets were embedded and `document.fonts.ready` was awaited before screenshots.
- Firebase and Google Maps remote configuration were disabled only in the QA copy. The application source was not changed for this purpose.

## Rendered checks

| Check | Result |
|---|---|
| 390×844 light | PASS |
| 390×844 dark | PASS |
| 360×800 dark | PASS |
| 1440×900 dark | PASS |
| Empty-state naming and recommendation metadata | PASS |
| Participant mode switching and Accordion | PASS |
| Lock status Tag | PASS |
| Drawer role, heading focus, close and return focus | PASS |
| Shared normal view and exact full-canvas fit | PASS |
| Shared timetable link labels | PASS |
| Shared quick edit label/state | PASS |
| Neutral settlement summary in light/dark | PASS |
| Settlement settings use 3 Selects and 0 Content Switchers | PASS |
| Modal feedback remains inside modal | PASS |
| Outside feedback remains Toast | PASS |
| Mobile route map height | PASS — 371.36px at 844px viewport |
| Horizontal page overflow | PASS — 0px in all audited viewports |
| Visible text below 12px | PASS — 0 elements in all audited viewports |
| Relevant console warnings/errors | PASS — 0 |
| Page errors | PASS — 0 |

### Shared fit evidence

- Before: `scale(0.9)`, `needsPan=true`, label **全体表示**, `aria-pressed=false`.
- After: `scale(0.455665)`, complete content bounds `x=10…380` inside a 390px viewport, `needsPan=false`, label **全体表示中**, `aria-pressed=true`.

## Static checks

- `npm test`: PASS
- `npm run test:share`: PASS
- `npm run lint:maps`: PASS
- `npm run typecheck:maps`: PASS
- `npm run test:maps:contract`: PASS
- `npm run test:driver-reward`: PASS
- JavaScript syntax: PASS — 87 project files
- CSS parsing: PASS — 121 files, 0 parse errors
- `npm run lint:css`: NOT RUN successfully because the uploaded project does not contain the `stylelint` executable (`stylelint: not found`). No dependency was installed or changed.

## Remaining unverified areas

- Physical iOS Safari interaction and keyboard behaviour.
- Live Firebase multi-device synchronisation.
- Real Google Maps route requests with the production API key.
- Screen-reader output on physical assistive-technology combinations.

These are explicitly unverified and are not represented as passing.
