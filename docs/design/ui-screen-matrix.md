# Integrated project screen and state matrix

Updated: 2026-10-31. “Automated” refers to repository tests. It does not claim manual, screen-reader, or production verification.

## Screen inventory

| Screen / workflow | Main content and actions | Covered states and evidence | Remaining limits |
|---|---|---|---|
| Project list | Browser-local history, open project, create project | `project-workspace.spec.js`: empty/list/create/open and history labels, Chromium + WebKit desktop/mobile | Cross-device account sync is not implemented by design |
| Template and project creation | Template choice, selected tool setup, project title | `project-workspace.spec.js`: creates template intent once and opens the selected initial view | Manual assistive-technology review |
| Project shell / tabs | Project name, shared link, pinned tools, always-present Tools tab | `shell.spec.js`, `project-workspace.spec.js`: route selection, long titles, tools manager, optional-tool open | Manual keyboard traversal across a very long tablist |
| Participants | Register manually or from application answers; edit, include/exclude, delete | `registration.spec.js`, `participants.spec.js`, `participants-accessibility.spec.js`: empty, selected, edited, validation, deletion, Japanese IME | Form source itself is synthetic in the all-tools debug sample |
| Car / team allocation | Group membership, capacities, roles, fixed member, random assignment | `allocation.spec.js`, `randomization-count.spec.js`: empty/full, moves, capacity, menu, pin/fixed state, count/reload/reset, long names and 200% zoom | Manual pointer and screen-reader review |
| Settlement | Collection, split/club payments, expenses, disclosure, memo | `settlement.spec.js`, `settlement-entry-mode.spec.js`, `settlement-negative-validation.e2e.spec.js`: normal and count-only modes, modal states, details open/closed, validation, toast, narrow layout and themes | Production service and money-entry verification intentionally use isolated synthetic fixtures |
| Tools manager | Enable/remove tools, pin/unpin, reorder, open unpinned tool | `project-workspace.spec.js`: no pinned tools, optional tool open, always available tools tab | Manual long-list drag/keyboard review |
| Form Maker inline | Form configuration, create/queued/result recovery | `project-workspace.spec.js` all-tools test plus package unit/browser tests: loaded inline; synthetic state is read-only and create/submit actions stay disabled | No real Google Form creation or response submission in this verification |
| Mountain Plan inline | Steps, image/route editing, draft save/restore, PDF | `project-workspace.spec.js` inline navigation + Mountain package tests: draft lifecycle and data preservation | Actual OCR/API call and PDF visual print inspection not performed with real external service |
| Academic documents | Local CSV preview from synthetic participants; production link remains an explicit external download | `project-workspace.spec.js` all-tools debug sample | Windows application is maintained separately; not embedded or launched by the debug fixture |

## Overlay and transient-state inventory

| Overlay/state | Automated coverage | Manual browser review |
|---|---|---|
| Project tools overview/history/guide | `project-workspace.spec.js`, `shell.spec.js`, `modal-layout.spec.js` | Pending final preview pass |
| Sample/reset menu and confirmation | Existing sample actions plus `debug-sample-project.test.mjs` and all-tools workspace spec | Debug sample isolation checked in browser tests; final preview pass pending |
| Registration/edit/delete dialogs | `registration.spec.js`, `participants-accessibility.spec.js` | Keyboard and focus assertions covered; screen reader not tested |
| Allocation add/move/capacity/random dialogs and menus | `allocation.spec.js`, `modal-layout.spec.js` | Automated phone/desktop and 200% cases; final preview pass pending |
| Settlement settings, expense, collection, collector prompt | `settlement-entry-mode.spec.js`, `settlement.spec.js`, `modal-scroll.spec.js`, `modal-accessibility.spec.js` | Automated light/dark, scrolling, focus, validation, collection success; final preview pass pending |
| Form Maker inline loading/error/recovery | package tests and inline tool project spec | No live worker request in this review |
| Mountain draft conflict, auto-save/restore, save-failure export recovery | Mountain package tests and `draft-controls.spec.js` | IndexedDB browser-denial/quota and Safari VoiceOver not exercised manually; normal manual save/import/delete controls are intentionally omitted |
| Toast/inline notification | Settlement success toast and shell notification tests | Actual copy and timing to be reviewed in final preview pass |

## Viewport/theme coverage

| Viewport | Theme | Automated evidence | Manual status |
|---|---|---|---|
| 390px mobile | Light and dark in screen-specific specs | `project-workspace.spec.js`, `settlement.spec.js`, `allocation.spec.js`, `visual-consistency.spec.js` | Pending final preview pass |
| 1280px desktop | Light and dark in screen-specific specs | Four Playwright projects (Chromium/WebKit × desktop/mobile) | Pending final preview pass |
| 200% browser zoom | Light theme | `allocation.spec.js` long Japanese/control-size case | Pending final preview pass |
| Long Japanese content | Light and dark in covered flows | `shell.spec.js`, `allocation.spec.js`, `settlement.spec.js`, modal layout specs | Pending final preview pass |

Do not mark a manual state complete until the latest build has been opened and inspected in the side browser. Do not use ordinary project data for debug sample, release smoke, or integration tests.

## Preview observation — 2026-10-31

- Latest Circle build opened at `http://127.0.0.1:4175/?debugSample=all-tools&view=seisan&room=DEBUG-74D88C53E24B40AF`.
- Side-browser inspection covered the dark all-tools sample, inline Mountain Plan form, allocation tab, Settlement summary, expanded payment details, and the settlement settings modal. The payment edit action remained visible beside the expanded summary; the disclosure label changed to `内訳を閉じる` and the detail rows remained aligned.
- This is a focused preview check, not a full manual pass. Project/history/registration, every overlay/menu, light theme, 390px and 1280px viewport overrides, 200% zoom, long Japanese text, and screen-reader behavior remain represented by automation or unverified as listed above.

## Preview observation — 2026-10-31 (updated integration build)

- Current dirty-tree build opened at `http://127.0.0.1:4176/?debugSample=all-tools&view=seisan&room=DEBUG-9CA506E9A5A44D8B`; preview identity check confirmed the build matches this worktree against baseline `2c3ec771c4912a3a74ba375e93e81bc36c08a0b9`.
- Side-browser checks opened the Applicants/Forms and Mountain Plan tabs without leaving the project URL. The Mountain Plan event-date field had the synthetic project's date (`2026-11-07`). No manual “apply date” button or sync explanation appeared in the inline tool. The date is used as a blank-field initial value after draft restoration; saved draft or entered value takes precedence.
- The focused project-workspace spec passed 44/44 across Chromium and WebKit desktop/mobile after adding assertions that the inline flow has no manual date-import copy or action. The earlier full browser run passed 502 with 2 skipped; this latest focused rerun covers the changed assertions.
- This remains a focused preview check, not release approval or a full manual screen pass. Production has not been updated from this worktree. Other manual states and release gates remain open as listed above.
