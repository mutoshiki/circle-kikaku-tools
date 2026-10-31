# Integrated project screen and state matrix

Updated: 2026-10-31. “Automated” refers to repository tests. It does not claim manual, screen-reader, or production verification.

## Screen inventory

| Screen / workflow | Main content and actions | Covered states and evidence | Remaining limits |
|---|---|---|---|
| Project list | Browser-local history, open project, create project | Final 528-case browser run: `project-navigation.spec.js`, `project-workspace.spec.js`, Chromium + WebKit desktop/mobile | Cross-device account sync is not implemented by design; screen-reader review not performed |
| Template and project creation | Template choice, selected tool setup, project title | Final run: create intent and selected initial view; shared `SectionHeading` retains H1 semantics | Assistive-technology review not performed |
| Project shell / tabs | Project name, shared link, pinned tools, always-present Tools tab | Final run: `shell.spec.js`, `project-workspace.spec.js`; side preview shows all eight tools and the persistent Tools tab | Manual keyboard traversal through a very long tablist not performed |
| Participants | Register manually or from application answers; edit, include/exclude, delete | Final run: `registration.spec.js`, `participants.spec.js`, `participants-accessibility.spec.js`: empty, selected, edited, validation, deletion, Japanese IME | All-tools sample uses synthetic application answers; screen reader not tested |
| Car / team allocation | Group membership, capacities, roles, fixed member, random assignment | Final run: `allocation.spec.js`, `randomization-count.spec.js`: empty/full, moves, capacity, menus, fixed state, count/reload/reset, long names and zoom | Physical pointer and screen-reader review not performed |
| Settlement | Collection, split/club payments, expenses, disclosure, memo | Final run: `settlement.spec.js`, `settlement-entry-mode.spec.js`, `settlement-negative-validation.e2e.spec.js`: normal/count-only, modal states, details, validation, toast, responsive layout and themes; latest side preview opens populated settlement | Production money-entry verification remains isolated to synthetic fixture |
| Tools manager | Enable/remove tools, pin/unpin, reorder, open unpinned tool | Final run: `project-workspace.spec.js`; manual preview confirmed tool manager and all tools available | Long-list drag/keyboard behavior is automated only |
| Form Maker inline | Form configuration, create/queued/result recovery | Final run: all-tools sample has editable synthetic fields, local-only save/restore; source PR #26 build/browser and production smoke passed | No real Google Form creation or response submission; production account/job lifecycle not manually exercised |
| Mountain Plan inline | Steps, image/route editing, draft save/restore, PDF | Final run: inline navigation and draft tests; source PR #22 unit/E2E/build/deployed Pages smoke passed | Real OCR/API and physical print review not performed |
| Academic documents | Local CSV preview from synthetic participants; production link remains an explicit external download | Final run: project workspace all-tools fixture renders populated CSV preview | Windows application is maintained separately; not embedded or launched by the debug fixture |

## Overlay and transient-state inventory

| Overlay/state | Automated coverage | Manual browser review |
|---|---|---|
| Project tools overview/history/guide | `project-workspace.spec.js`, `shell.spec.js`, `modal-layout.spec.js` | Full browser run passed; manually checked project overview and sample menu. History/help/export sub-states automated only |
| Sample menu | `debug-sample-project.test.mjs` and all-tools workspace spec | Confirmed in browser; removed the unnecessary “初期状態に戻す” option as requested. No reset confirmation exists now |
| Registration/edit/delete dialogs | `registration.spec.js`, `participants-accessibility.spec.js` | Full browser run passed; focus/keyboard assertions automated; screen reader not tested |
| Allocation add/move/capacity/random dialogs and menus | `allocation.spec.js`, `modal-layout.spec.js` | Full browser run passed across Chromium/WebKit and desktop/mobile, including 200% boundary test; manual review remains partial |
| Settlement settings, expense, collection, collector prompt | `settlement-entry-mode.spec.js`, `settlement.spec.js`, `modal-scroll.spec.js`, `modal-accessibility.spec.js` | Full browser run passed; side preview manually opened settings, expense, and collection dialogs. Other branches automated only |
| Form Maker inline loading/error/recovery | package tests and inline tool project spec | Full browser run and package CI passed; live worker request intentionally not made |
| Mountain draft conflict, auto-save/restore, save-failure export recovery | Mountain package tests and `draft-controls.spec.js` | E2E and source CI passed; IndexedDB quota/denial and Safari VoiceOver not manually exercised. Manual save/import/delete controls remain omitted |
| Toast/inline notification | Settlement success toast and shell notification tests | Full browser run passed; success toast is asserted, actual timing not separately measured |

## Viewport/theme coverage

| Viewport | Theme | Automated evidence | Manual status |
|---|---|---|---|
| 390px mobile | Light and dark in screen-specific specs | Final 4-project Playwright run; side preview checked 390px light and dark with no horizontal overflow | Manual check limited to Form Maker and shared shell; other states automated |
| 1280px desktop | Light and dark in screen-specific specs | Final 4-project Playwright run; side preview checked 1280px and computed typography | Manual check limited to representative workspace, not every tool-state combination |
| 200% browser zoom | Light theme | Final run included `allocation.spec.js` long Japanese/control-size boundary | Automated only |
| Long Japanese content | Light and dark in covered flows | Final run: `shell.spec.js`, `allocation.spec.js`, `settlement.spec.js`, modal layout specs | Physical device and assistive technology not tested |

## Final preview observation — 2026-10-31

- Built source preview was identity-checked against public baseline `1936ea8dc7ff260e348946c25f295d8ce6563577` with `check:preview` before the browser comparison.
- Side browser opened the local all-tools synthetic project. The Form Maker fields were populated and editable; the project tabs remained in-app. The final visible tab is the populated Settlement screen. No form creation, submission, Firebase write, or ordinary project mutation was performed.
- Manual checks: all eight tools appeared in the tablist, sample Form Maker values rendered, the menu no longer offered sample reset, settlement displayed all three vehicle amounts, and the disclosure text was `内訳を見る`. At 390px the Form Maker view showed no horizontal page overflow in either theme; at 1280px the active theme's emitted heading font values were read from computed styles.
- Historical 4-project matrix: 528 tests, 526 passed, 2 skipped, 0 failed. Final Circle matrix after the last changes: 524 tests, 521 passed, 2 existing WebKit-only skips, and one Chromium desktop allocation summary case failed once; rerunning that exact case alone passed. The skips are known WebKit viewport-resize geometry cases; Chromium covers the assertion. Full unit suite: 179/179. Form Maker source CI and production smoke passed; Mountain Plan source CI/E2E/build and Pages smoke passed.
- Manual limitations: not every dialog success/error branch was opened by pointer in the side browser; those branches are represented by automated tests. Screen readers, physical phones, OCR/API calls, real form creation, and print output were not exercised. Local preview is not itself production publication.

Do not mark a manual state complete until the latest build has been opened and inspected in the side browser. Do not use ordinary project data for debug sample, release smoke, or integration tests.

## Full UI state audit — 2026-10-31

Task 1 inventory used `tests/browser/ui-audit-current-run.spec.js` as a temporary copy of the existing audit flow. It was run against the offline test server in Chromium desktop and mobile. The temporary runner is not a product test; the durable coverage remains in the named screen specs below. Its screenshots are stored separately under `artifacts/ui-audit-2026-10-31-run1/` and are review aids only. The capture flow reaches the project shell/header menu, guide and sample dialogs, participant empty/search/filter/edit/delete, car and team allocation, capacity/add/random/overflow states, settlement settings steps, expense entry, movement options, route search/options/result, expanded payment details, and paid state. Some post-sample captures retain a previous header notification/menu layer, so those images are not treated as visual pass evidence.

| Screen / workflow | Current comparison | Decision / owner | Evidence and status |
|---|---|---|---|
| Project list, template selection, create/open | Distinct list entry and project workspace remain clear; opening and creation use a new tab as designed. | Keep behavior. Review shared heading and action spacing in Task 3 (`ProjectEntry.jsx`). | `project-navigation.spec.js`, `project-workspace.spec.js`; automated, no browser zoom or assistive technology claim. |
| Project shell and tab strip | Narrow layout uses a horizontally scrollable Carbon tablist; all tab panels keep the selected tool. Header and tab labels are compact. | Keep navigation semantics; Task 3 aligns shell spacing and focus affordance without changing pin/tool behavior (`AppHeader.jsx`, `App.jsx`, `styles.scss`). | `shell.spec.js`, project-workspace tests; capture at 390×844 and 1440×1000. |
| Participants and registration | Summary, search/filter controls, participant rows, and toolbar actions have different spacing conventions; modal coverage is distributed across several specs. | Normalize heading/control groups and row metadata only; preserve applicant import, selection, and participant semantics (Task 3). | `registration.spec.js`, `participants.spec.js`, accessibility spec; audit screenshots 6–13. |
| Car/team allocation | Shared allocation owner already renders both, with dense person rows and separate overflow actions. | Preserve dense row pattern and capacity display. Fix only actual alignment/heading inconsistencies found at mobile boundaries (Task 3), not by expanding row height globally. | `allocation.spec.js`, `randomization-count.spec.js`; audit screenshots 14–20. |
| Settlement | Payment totals intentionally stand out; breakdowns are a separate disclosure. The summary action and vehicle-row details use distinct hierarchy. | Keep numeric hierarchy and current zero/contribution semantics. Normalize repeated vehicle header/expense/disclosure spacing and narrow wrapping (Task 3). | Settlement specs; audit screenshots 21–35. |
| Tools manager / overview / history / help / export | Overlay and workspace states are covered by separate specs; manual long-list drag review remains open. | Keep tools optional and independent. Align shared section/action groups; do not add explanatory copy (Task 3). | `project-workspace.spec.js`, `shell.spec.js`, modal specs. |
| Form Maker inline | All-tools sample has become an editable form workspace with synthetic values and local-only persistence; earlier “read-only” matrix text is obsolete. | Scope visual changes to the embedded root in the Form Maker package; keep explicit enqueue/create semantics and standalone UI (Task 4). | Task 0 browser evidence plus `ui-audit-form.spec.js`; no real form/job was submitted. |
| Mountain Plan inline | Existing draft/autosave and PDF boundary are independent of Circle screen styling. | Scope changes to app workspace styles; leave document/PDF units and print composition untouched (Task 5). | `draft-controls.spec.js`, package suite; real OCR/API and physical print remain unverified. |
| Academic CSV / handoff | Preview and download are separate states; Windows app stays external. | Keep current integration boundary; only shared modal/heading alignment if confirmed in the rendered state (Task 3). | Workspace project spec; Windows application itself is outside this repository. |

### Audit limits

- Automated audit run: Chromium desktop and mobile, one sample-driven path each; does not establish every control's manual pass or every modal's success/error path.
- Existing screen specs cover WebKit, themes, keyboard, and specialized boundary cases, but old results are regression coverage rather than fresh manual observations. Task 6 must rerun the relevant suites against the final source.
- The app's modal inventory in `react-typography-spacing.md` remains the authoritative list of known dialogs. No claim is made that all dialogs were manually opened in this audit. Use the final review to mark each reachable state pass, fail, or not run.
- Carbon MCP flagged many spacing declarations as token deviations and several custom Carbon patterns as AST-level issues. Task 2/3 must inspect ownership, rendered DOM, and installed Carbon contracts before any edit; a report alone is not a defect.

## Preview observation — 2026-10-31

- Latest Circle build opened at `http://127.0.0.1:4175/?debugSample=all-tools&view=seisan&room=DEBUG-74D88C53E24B40AF`.
- Side-browser inspection covered the dark all-tools sample, inline Mountain Plan form, allocation tab, Settlement summary, expanded payment details, and the settlement settings modal. The payment edit action remained visible beside the expanded summary; the disclosure label changed to `内訳を閉じる` and the detail rows remained aligned.
- This is a focused preview check, not a full manual pass. Project/history/registration, every overlay/menu, light theme, 390px and 1280px viewport overrides, 200% zoom, long Japanese text, and screen-reader behavior remain represented by automation or unverified as listed above.

## Preview observation — 2026-10-31 (updated integration build)

- Current dirty-tree build opened at `http://127.0.0.1:4176/?debugSample=all-tools&view=seisan&room=DEBUG-9CA506E9A5A44D8B`; preview identity check confirmed the build matches this worktree against baseline `2c3ec771c4912a3a74ba375e93e81bc36c08a0b9`.
- Side-browser checks opened the Applicants/Forms and Mountain Plan tabs without leaving the project URL. The Mountain Plan event-date field had the synthetic project's date (`2026-11-07`). No manual “apply date” button or sync explanation appeared in the inline tool. The date is used as a blank-field initial value after draft restoration; saved draft or entered value takes precedence.
- The focused project-workspace spec passed 44/44 across Chromium and WebKit desktop/mobile after adding assertions that the inline flow has no manual date-import copy or action. The earlier full browser run passed 502 with 2 skipped; this latest focused rerun covers the changed assertions.
- This remains a focused preview check, not release approval or a full manual screen pass. Production has not been updated from this worktree. Other manual states and release gates remain open as listed above.
