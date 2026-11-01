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
| Tab editor | One checkbox controls whether each feature appears as a tab; shown tabs can move up/down; the editor remains available | Latest focused run: `project-workspace.spec.js` Chromium mobile; see 2026-11-01 audit below | Failure/conflict recovery and every legacy preference combination are covered by code/unit behavior, not all manually exercised |
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

## Tab and cross-screen consistency implementation — 2026-11-01

### Element presence and state rules

| Area / state | Visible elements and actions | Deliberately absent | Owner and verification |
|---|---|---|---|
| Project shell, normal connected/local state | Project header, utility actions, enabled tablist, selected panel | “同期完了” row and routine “保存中” row; neither means every embedded tool finished saving | `App.jsx`; `shell.spec.js` asserts the normal status row is absent |
| Project shell, sync error | Persistent status text from the sync service, followed by the selected tool | Success toast for background reconnection | `App.jsx`, `room-sync.js`; existing sync unit and screen status consumers |
| Tab editor, ready | One checked/unchecked `表示するタブ` checkbox per feature; shown items have up/down actions | Separate “利用する” checkbox, open action, Save/Cancel buttons, success toast | `ProjectToolsWorkspace.jsx`; workspace browser test and action unit tests |
| Tab editor, loading/error/save failure/conflict | Loading indicator or persistent inline error; controls disabled until ready and while writing | Editable stale snapshot while initial remote data is unresolved; transient success row | `ProjectToolsWorkspace.jsx`, `project-workspace.js`; browser and transaction contract tests |
| Hidden-tool deep link | Tab editor with the requested feature row highlighted | Silent enable, data deletion, confirmation modal | `project-workspace-routing.js`; navigation unit test |
| Tab panel surface | Tab list and panel share one Grid/Column gutter; content keeps its own component spacing | Second panel-level horizontal gutter | `App.jsx`, `styles.scss`; visual consistency browser spec |
| Inline Form Maker | Form fields and explicit form creation / existing job recovery | App-level second header; unrelated tool-history navigation | Existing package `FormMakerWorkspace`; focused browser flow verifies it remains in-project and no request is sent by sample mode |
| Inline Mountain Plan | Existing steps, automatic local draft, recovery controls only on conflict/error, PDF generation | Manual project-date import, routine draft-management menu, app-level second header | Existing package `MountainPlanWorkspace`; all-tools sample browser flow |
| Academic CSV | Explicit CSV preview/create and external Windows tool download | Claim that the Windows document builder is embedded in the tab | `ProjectToolsWorkspace.jsx`; project workspace browser test |

### Preserved workflow differences

| Screen/state | Elements retained and why | Evidence / owner |
|---|---|---|
| Project list: empty vs populated | Empty state offers project creation and link-sharing context; populated state adds project rows with visit/update timestamps and open action. These states do not share row actions because none exist in the empty state. | `project-workspace.spec.js`, `project-navigation.spec.js`; `ProjectEntry.jsx` |
| Template creation: built-in vs custom | Built-ins show the tabs they initially expose; custom template shows one checkbox group labeled “最初に表示するタブ”. All templates can be changed later in the tab editor. | `project-workspace.spec.js`; `ProjectEntry.jsx` |
| Participants: empty, manual, applicant import, editing | Registration actions depend on the data source; required fields/errors stay beside inputs; destructive exclusion/deletion use danger confirmation. A confirmation dialog is not added to routine edits. | `registration.spec.js`, `participants.spec.js`, `participants-accessibility.spec.js`; `Participants.jsx`, `RegistrationModal.jsx`, `ParticipantEditor.jsx` |
| Allocation: unassigned, group, full group | Capacity, owner/driver/leader roles, fixed tag, and row overflow actions appear only where they have meaning. Empty/waiting list uses assignment or registration actions; a full group disables unavailable destinations. | `allocation.spec.js`, `randomization-count.spec.js`; `Allocation.jsx` |
| Settlement: collection, vehicle payments, edit flows | Collection filters and collection record actions remain separate from vehicle expense editing. Each car always exposes its payment summary and expense action; disclosure controls only cost details. | `settlement.spec.js`, `settlement-entry-mode.spec.js`, `modal-scroll.spec.js`; `Settlement.jsx`, `settlement/` |
| Modal families | Destructive actions are danger-confirmed; multi-step settlement settings have Back/Next/Save; single-action previews may have only close; nested vehicle expense tools use Back to return to their parent step. Their differing footers match different consequences and navigation. | `react-typography-spacing.md` modal inventory; corresponding browser specs under `tests/browser/` |
| Embedded Form Maker and Mountain Plan | Form creation is explicit and job errors/recovery persist in Form Maker; Mountain Plan saves a local draft and only exposes recovery when needed. These feedbacks differ because one queues an external form job and the other saves a local document draft. | `project-workspace.spec.js`, package CI and `draft-controls.spec.js`; vendor package contracts |

### Presence checklist by screen and state

`有` means the element appears, `条件付き` means only the named state shows it, and `なし` means it is intentionally absent. Shared visual consistency does not mean forcing the same actions into every workflow.

| Screen/state | Heading / intro / supporting text | Required marker / example | Count / empty state | Main / secondary actions | Save / feedback | Back / close | Content inset and reason |
|---|---|---|---|---|---|---|---|
| Project list, empty | Page heading 有; empty heading and one-line next step 有 | N/A | Count なし; empty state 有 | Create link 有; project row action なし | N/A | N/A | One shared page gutter |
| Project list, populated | Page heading 有; row name and activity label 有 | N/A | Project rows 有; empty state なし | Create link and open-project links 有 | N/A | N/A | Row actions only appear with rows |
| Template creation, built-in | Project name label and template label 有; selected template's initial tabs shown | Project name 任意; no example | Template choices 有 | Create project 有 | Creation progress only during creation | N/A | Form fields grouped together |
| Template creation, custom | Same as built-in; custom prompt says “最初に表示するタブ” | Project name 任意; no example | Chosen tabs visible as checkboxes | One checkbox group and create action | Creation progress only during creation | N/A | No duplicate “available vs shown” controls |
| Participants, empty/populated | Workflow heading and section context 有 | Registration modal markers follow validation; examples only where useful | Participant count when list exists; empty-state instructions when not | Add/import/selection actions depend on form link and current state | Explicit registration/update feedback; validation stays inline | Modal close/cancel where applicable | Same shared tab-panel gutter; list rows retain dense content inset |
| Allocation, empty/unassigned/populated | Allocation heading and unassigned summary when applicable | Dialog labels correspond to their validation | Group capacities and member counts when groups exist; empty-state prompt otherwise | Add/move/random/fix actions depend on available people and capacity | Assignment result toast; rejected capacity/conditions remain actionable | Confirmation dialogs only for consequential actions | Same shared tab-panel gutter; dense member rows preserved |
| Settlement, normal/count-only | Collection summary and per-car payment summary appear for configured mode | Amount validation appears in its settings/editor only | Collection counts and totals when available; no artificial empty card for zero-cost detail | Record collection, edit cost, view breakdown are separate actions | Explicit collection and committed edit may notify; routine reading has no feedback | Modal close or nested Back follows dialog workflow | Same shared tab-panel gutter; payment detail rows retain their own inset |
| Tab editor, loading/ready/error | “タブを編集”; “表示するタブ” only when ready | N/A | All seven registered non-system features | One checkbox each; reorder buttons for shown tabs only | Immediate shared save; persistent error only on failure/conflict | No save/cancel footer | Single panel gutter |
| Form Maker, configured/creating/job-error | Maker's own title and state-specific next step | Required/optional labels match form validation; email-sharing explanation stays by that field | Job history/results only for the current project's provable association; no unrelated history | Form create is explicit; result recovery appears for unknown/partial job | Queue/result/recovery states persist in maker | Maker overlay controls only; no second app header | Shared shell gutter, form retains field spacing |
| Mountain Plan, loading/edit/draft-error | Existing step heading; short draft state only when it informs action | Optional markers correspond to validation; no global “everything else required” repeated per field | Upload and route counts only when files exist | Step/PDF actions follow workflow | Autosave success can be quiet; conflict/quota failures expose recovery | Step navigation stays within document flow | Shared shell gutter; `.doc-page` and print margins excluded |
| Academic CSV, preview/blocked/ready | “学務書類” and CSV operation title | N/A | Preview rows only after explicit preview action | Preview/create/download according to mode | Error or file result is shown only in corresponding state | Dialog close button; external Windows app remains a download | Shared shell gutter; generated document layout is external |

#### Modal state coverage owner map

The app-owned modal inventory in `react-typography-spacing.md` remains authoritative. Its rows map to these owners and existing state specs: project name/guide/sample/history/overview/announcement/bug/CSV (`AppHeader.jsx`, `App.jsx`, `ProjectTools.jsx`, `shell.spec.js`, `project-workspace.spec.js`); participant registration/edit/exclusion/delete (`RegistrationModal.jsx`, `ParticipantEditor.jsx`, `Participants.jsx`, `registration.spec.js`, `participants-accessibility.spec.js`); group create/capacity/move/random (`Allocation.jsx`, `allocation.spec.js`, `modal-layout.spec.js`); settlement settings/vehicle expense/movement/route/collector/collection/standalone name (`SettlementSettingsModal.jsx`, `Settlement.jsx`, `StandaloneDriverNameModal.jsx`, settlement and modal specs). For the current implementation change, those modal owners have no shown/absent-control defect found in source or existing browser contracts, so they remain unchanged. The latest full matrix rerun records final regression status; only actually opened modal states are marked manually reviewed above.

### 2026-11-01 change-driven evidence

- `npm test` passed 182/182 with `SANPO_TEST_FIREBASE_TARGET=offline`, demo project `demo-circle-tools`, and loopback-only database URL.
- The final browser matrix has 532 cases across Chromium/WebKit desktop/mobile: 530 passed, 2 skipped, 0 failed (20.1 minutes). First run: 529 passed, 2 skipped, 1 WebKit-mobile timeout in the all-tools sample flow. The exact case passed alone in 18.9 seconds; a 60-second test limit was added because the combined run exceeded its existing 30-second budget. It passed alone again in 19.0 seconds, then the full matrix passed with the same case completing successfully.
- Browser coverage includes tab visibility and deep-link behavior, failed tab-setting save, inline maker navigation and sample workflows, normal shell status absence, and shared panel gutters. It is automated regression evidence, not a manual full-modal review.
- No Form Maker or Mountain Plan package source change was justified by this pass: their integrated workflows already keep task-specific form/draft feedback and preserve their own persistence and recovery states. Do not copy their standalone header or unrelated history into the project workspace.
- Modal inventory remains the one in `react-typography-spacing.md`. Rows without a 2026-11-01 browser interaction remain “not manually checked”; previous automated coverage is regression evidence, not fresh manual evidence.
- Side-browser preview at `http://127.0.0.1:4292/?debugSample=all-tools&view=tools&room=DEBUG-BA87E067528B4EEA` was checked with synthetic local data. Tab editor, hidden/show tool toggle, Form Maker, Mountain Plan, participant selection, allocation overflow/capacity, and settlement settings were opened. The embedded tools stayed in the project URL with no iframe. Light/dark and representative dialogs were inspected at the browser's fixed approximately 536px width; exact desktop/manual viewport overrides, physical devices, screen reader, and every modal branch were not exercised.
