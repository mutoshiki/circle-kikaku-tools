# React UI typography and spacing contract

This contract records the shared visual roles for the React app and the review steps that prevent typography and spacing regressions. It is based on the Carbon productive type scale, with role assignments chosen for this app's participant, allocation, and settlement workflows.

## Typography roles

Use `@include carbon-type.type-style('<name>')` from `@carbon/type` in `apps/react/src/styles.scss` for app-owned text. The mixin applies size, weight, line height, and letter spacing together.

| App role | Carbon type style | Use |
| --- | --- | --- |
| Project title and major settlement section heading | `heading-03` | Project identity; major settlement section titles |
| Main page heading, empty-state heading, confirmation heading | `heading-02` | Participant page title and empty/confirmation states |
| Vehicle/team title | `heading-compact-02` | Allocation group name, vehicle name |
| Vehicle payable amount | `heading-03` | Split/club amount at 20px/400/28px; keep the amount prominent by size and alignment, not extra bold weight |
| Per-person collection amount | `heading-03` + `carbon-type.font-weight('semibold')` | Collection amount is a primary decision value; pair it with the secondary label `1人あたりの集金額` and show the full amount |
| Payment adjustment amount | `body-compact-01` | Rounding and collection-offset amounts within the vehicle payment breakdown; use the same 14px/400/18px role as its label |
| Secondary group or task heading | `heading-compact-01` | Cost categories, route results, modal subheadings |
| Main body and cost description | `body-compact-01` | Names, descriptions, expense rows, supporting content |
| Form values on narrow screens | `body-02` | Text, textarea, number, select, and search input values |
| Metadata, status, and secondary count | `label-01` | Sync status, grades, helper text, allocation run count |

When a vehicle has a nonzero club contribution, keep split and club payment amounts as separate values in the collapsed summary and disclosure description. When club contribution is zero, show one total labeled `割勘から` and a flat breakdown without category headings or zero-value rows. Use regular weight for vehicle amounts; reserve semibold emphasis for the per-person collection amount. At 375px and wider, use two equal-width categories with each label above its amount; align labels to the category start and amounts to the category end. At 375px through 671px, stack the categories when either formatted amount is 10 characters or longer. At 374px and narrower, use two category rows with labels left and amounts right; let an amount wrap below its label if necessary. Never shrink currency text to fit. Keep participant and allocation row heights driven by their content; do not compress multi-line rows to match one-line rows.

Do not use guessed `--cds-*-font-size`, `--cds-*-font-weight`, or `--cds-*-line-height` custom properties. Carbon's published CSS variables for component internals are not a substitute for the typography mixins. Avoid setting only one typography property when a Carbon type style expresses the intended role.

## Spacing and alignment

- Use `@carbon/layout` spacing values for app-owned layout gaps, padding, and margins. Keep 1px borders and 1px list separators when they create a visual divider; for vehicle payment cards, use the Carbon Accordion divider without a second article border.
- In vehicle payment details, use one Carbon Accordion for the vehicle list and one disclosure row per vehicle. Let the Accordion own the divider; do not add a parallel article border or a nested disclosure. Keep expense rows 4px apart, separate split and club groups by 16px, and place adjustment rows in a 4px-spaced block with an 8px top gap after the expense rows. Keep the 16px vehicle-to-detail indentation. When a payment amount does not fit beside its label, let the amount move below without shrinking or overlapping the adjacent category.
  - In expanded vehicle payment details, label non-empty categories `割勘の内訳（¥金額）` and `部費の内訳（¥金額）`. Use the same adjusted totals shown in the vehicle summary so rounding and collection offsets remain consistent.
- Keep each vehicle in three rows: vehicle heading with the always-visible expense editor, full-width separate split/club amounts, then a right-aligned disclosure button. Keep driver-name controls outside the disclosure button. Associate amounts with the disclosure using `aria-describedby`. If the club payment is zero, show one amount labeled `割勘から` and a flat breakdown without category headings or zero-value category rows.
- Give each vehicle header 12px top padding. Place `内訳を見る` immediately before the down arrow in the same button; when open, use `内訳を閉じる` and an up arrow. Keep both vertically centered and at most 12px apart. Do not reserve an expense-action column beside the amounts. Keep a rental label beside the vehicle name when it fits, wrapping only when needed.
- Label the per-person amount `1人あたりの集金額` so its purpose is clear without relying on the neighboring section title.
- The settlement summary is an accessible named region. Keep its per-person amount and collection action together, with settlement settings inside that region. For an empty memo, show only the add action; show the memo heading and content only when a nonblank memo exists.
- Format negative currency with the Unicode minus before the yen symbol (for example `−¥100`); a negative value that rounds to zero displays as `¥0`. Keep adjustment signs (`+` or `−`) to one leading sign.
- Align headings and their actions on a shared row where the viewport allows it. Allow wrapping without changing action order or clipping labels.
- Preserve indentation that communicates nesting, checkbox/action columns, and disclosure hierarchy. Do not force every text edge to the same coordinate.
- Keep the mobile empty state compact enough to align with surrounding page content; keep enough inset to distinguish it as a contained state.
- Keep forms grouped by task and retain visible input labels. On narrow screens, enlarge editable values consistently without scaling labels and radio copy along with them.
- Keep modal headers and footers visible while the body scrolls. Avoid horizontal scrolling at supported viewport widths.

## UI review checklist

For any React UI change involving these roles, review the affected path and at least one adjacent screen:

- [ ] Project title, page/section headings, group headings, body text, metadata, and currency values match the role table.
- [ ] Computed `font-size`, `font-weight`, `line-height`, and `letter-spacing` are non-empty and match the selected Carbon type style on rendered elements.
- [ ] Vehicle payment amounts remain 20px/400/28px; per-person collection alone uses 20px/600/28px. Adjustment rows use `body-compact-01` (14px/400/18px); a nonzero club contribution is separate, while a zero contribution uses the single-total display.
- [ ] Headings and actions align at desktop and mobile widths; wrapping, indentation, list rows, and amount columns remain intentional.
- [ ] Editable text, number, select, and search values follow the same narrow-screen size policy; labels and radio copy remain at their own Carbon roles.
- [ ] No horizontal page overflow or clipped dialog footer at approximately 390px and 1280px widths.
- [ ] Check both light and dark themes; retain semantic Carbon foreground, layer, border, and focus tokens.
- [ ] Repeated visible headings are reduced only when the fieldset/section still has a clear accessible name.
- [ ] Exercise the real empty, populated, expanded, and validation states affected by the change, using synthetic data when data entry is needed.

Record any intentionally different role or untested viewport/theme/state in the change summary. This checklist supplements the repository's release and browser-verification gates; it does not replace them.

## Modal inventory and review evidence

When a UI change touches a modal, keep a review record that identifies the rendered state and test evidence. A checkbox alone is not evidence that the state was exercised. List app-owned modals that can be opened through the current UI; for a modal that cannot be reached with safe synthetic data, record why it was not reached and do not mark it passed.

| Screen / modal | State | Width × height | Theme | Keyboard | Result | Evidence | Reason if unverified |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Example: Settlement / collection | Unpaid filter, one row checked | 393 × 852 | Dark | Tab, Space | Pass / Fail / Not run | Test name, screenshot, or computed values | State, browser, or device constraint |
| Settlement / collection | Opens with `すべて` selected; close restores focus to `集金を記録` | 1280 × 900 | Light | Pointer open/close; focus return observed | Pass | In-app side-browser DOM snapshot; `visual-consistency.spec.js` covers filter and close. Screenshot appeared inline in the work conversation and was not saved as a local file. | Modal keyboard traversal and screen reader were not exercised. |

### 2026-10-31 sitewide consistency implementation review

| Screen / modal | State | Width × height | Theme | Keyboard | Result | Evidence | Reason if unverified |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Form Maker inline | Synthetic filled inputs, edit-ready, local-only save action | 1280 × 720 | Light | Pointer inspection; no form submit | Pass | Final local preview Side browser; `project-workspace.spec.js` all-tools case | Save action was not triggered manually; unit/browser tests cover local save/restore |
| Form Maker inline | Filled inputs, narrow layout, no page overflow | 390 × 844 | Dark | Menu theme switch; no form submit | Pass | Side-browser screenshot and `documentElement.scrollWidth` | Physical phone and screen reader not tested |
| Settlement | Three vehicle totals, `割勘から` summary, disclosure affordances | 1280 × 900 | Dark | Pointer review | Pass | Final local preview Side browser; settlement browser specs | This is a synthetic project, not real money data |
| Settlement / vehicle expense | Open editor for first synthetic vehicle; cancel returns to workspace | 521px panel | Dark | Pointer open/cancel | Pass | Side-browser interaction; `settlement.spec.js` editor and focus cases | Not repeated manually in light theme |
| Settlement / settings | Settings wizard open and usable | 521px panel | Dark | Pointer inspection | Pass | Side-browser interaction; `settlement-entry-mode.spec.js` and `settlement.spec.js` | Validation/save branches rely on automated tests |
| Settlement / collection | `すべて` selected by default; rows and excluded-driver state visible | 521px panel | Dark | Pointer open/close | Pass | Side-browser interaction; `settlement.spec.js` filter, focus, toast cases | No actual collection recorded in the manually inspected sample |
| All tool tabs | All eight tabs and always-available Tools tab present with synthetic sample | 1280 × 900 | Dark | Tab selection by pointer; automation checks keyboard paths | Pass | Side-browser all-tools sample; final 524-case matrix (one allocation case passed on isolated rerun) | Not every tool state was manually opened after final build |

Final matrix: 528 cases across Chromium/WebKit desktop/mobile; 526 passed, 2 skipped, 0 failed. The skipped cases are the explicit WebKit viewport-resize geometry skip in `modal-layout.spec.js`; the geometry assertion runs in Chromium. Modal accessibility, focus return, scroll, validation, and keyboard flows are otherwise covered by existing specs. Screen readers, physical devices, all modal states in both themes by manual interaction, external Form Maker create/submit, OCR/API, and printed PDF remain unverified.

Include at minimum the following inventory when the change surface includes modals. Add repeated rows for materially different states or viewport/theme conditions; do not imply that one row covers every state.

| Screen / modal | States to consider |
| --- | --- |
| Guide and sample data | Short guide, regular sample, reset confirmation |
| Participant registration and editing | Form input, validation error, save/cancel |
| Participant exclusion and deletion | Confirmation, cancel and confirm actions |
| Car/team add and capacity editing | Empty values, validation, save/cancel |
| Allocation move and random confirmation | Available/full destinations, confirm/cancel |
| Settlement settings | All three steps, back/next/save, validation |
| Vehicle expense | Expense list, individual expense, movement, route tool |
| Collection and collector prompt | All/unpaid filter, excluded person, checked row, count-only collector name |
| Standalone driver name | Blank and populated name |
| Project tools | Overview, history, guidance, export, bug report |

For each entry state the actual viewport, color theme, keyboard actions, observed result, and evidence path or test name. Mark browser zoom, physical-device behavior, screen-reader behavior, or unavailable UI routes as unverified when they were not exercised. Keep synthetic-room and local-only-data constraints explicit.

### 2026-10-31 cross-site typography and spacing audit

The rendered audit flow was exercised in Chromium at 390×844 and 1440×1000, and the current `@carbon/react` 1.115.0 installation plus Carbon MCP documentation and code audit were reviewed. Existing screen-specific tests remain the evidence for 1280px, WebKit, dark mode, 320px, and 200% cases; this run did not manually exercise all those combinations. Detailed screen-to-owner decisions are in `ui-screen-matrix.md`.

| Finding | Current role / evidence | Implementation disposition |
|---|---|---|
| Shared section heading and action rows do not share one layout primitive. | Component structures vary across the participants page, tools manager, and settlement sections; type roles themselves are mostly intentionally distinct. | Add a small stateless SectionHeading and spacing variables in Task 2, then adopt only on semantically matching sections. Keep project-title, vehicle, amount, and tab roles distinct. |
| Participant, allocation and settlement group spacing differs in rhythm. | Screenshots and DOM inspection show whitespace varies by owner; allocation person rows are deliberately denser than monetary details. | Reuse Carbon spacing values for page/field/group/section boundaries. Preserve dense row-specific spacing unless the mobile or long-label geometry fails (Tasks 2–3). |
| Modal owner composition and scroll handling are not identical across dialogs. | Modal list spans Carbon `Modal`, `ComposedModal`, and custom step content. Carbon MCP reports some dynamic props/composition as warnings without following runtime conditions. | Verify installed prop types and rendered dialog before editing. Scope shared header/body/footer adjustments to app-owned elements; retain keyboard/focus/validation behavior (Tasks 3–6). |
| Embedded maker workspaces have separate CSS and lifecycle boundaries. | Form Maker and Mountain Plan load as package workspaces under `ProjectToolsWorkspace`; each also has a standalone route/build. | Use an embedded-root modifier and fallback shared spacing vars. Do not alter worker state, autosave, form creation, or PDF/print units (Tasks 4–5). |
| MCP spacing findings are mixed. | The batch returned arbitrary pixel/rem declarations, responsive breakpoints, `outline:none` patterns, grid usage, dynamic modal-size, Button default-size and custom Accordion composition warnings. | Treat the 120 findings as a triage list. Confirm a real contract or rendered defect before changing any declaration; no bulk token replacement (Tasks 2–3). |

Manual limits for this audit: the one-off audit flow captured key reachable states in both viewport classes but is not proof that every modal state was opened. Screen-reader, physical-device, and manual browser zoom behavior remain unverified. Task 6 must record changed modal families individually and rerun relevant Chromium/WebKit tests against the final source.

For page headings, distinguish the first-use empty state (`heading-03` when it introduces the whole workflow) from a regular no-results or empty subsection state (`heading-02`). Use the role that matches the hierarchy and scope of the rendered state rather than styling every empty heading identically.

### 2026-10-26 site copy implementation modal review

Synthetic data was loaded only in the local preview room `COPY-REVIEW-20261026` on origin `http://127.0.0.1:4284`; no production room or Firebase data was used. Screenshots were inspected through `cua_repl` in the in-app browser and were not saved as workspace files.

| Screen / modal | State | Width × height | Theme | Keyboard | Result | Evidence | Reason if unverified |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sample data | Regular sample replacement | 636 × 616 | Dark | Pointer; not exercised | Pass; toast confirmed the replacement | `cua_repl` accessibility tree and screenshot; preview room localStorage only | Reset confirmation not exercised |
| Participant registration | Manual name entry state, then cancel | 393 × 852 | Dark | Escape closed dialog and focus returned to `参加者を追加` | Pass | `cua_repl` accessibility tree | Form validation and spreadsheet paste were not exercised |
| Settlement settings | Steps 1, 2, and 3; navigated with Next, then Escape | 393 × 852 | Light | Escape closed dialog; focus returned to `精算設定` | Pass | `cua_repl` accessibility tree; computed viewport/theme; screenshot | Save and validation states were not exercised |
| Settlement collection | `すべて` selected, one synthetic participant marked collected | 393 × 852 | Light | Checkbox operated by pointer; dialog closed with button | Pass; status and named confirmation toast appeared | `cua_repl` accessibility tree; toast text `武内 樹を集金済みにしました。` | Count-only payer prompt and copy action were not exercised |
| Vehicle expense | Expense list and add-expense view | 393 × 852 | Light | Escape closed dialog and focus returned to the vehicle edit button | Pass | `cua_repl` accessibility tree and screenshot | Validation and route helper states were not exercised |
| Guide, participant editor/deletion, allocation capacity/move confirmation, standalone driver name, route helper, project overview/history/export/bug report | Not exercised | — | — | — | Not run | — | Outside this focused modal sample; no result is claimed |

Viewport evidence: computed `innerWidth`/`innerHeight` were 393×852 and 1280×900; document `scrollWidth` matched each viewport. Settlement and participant screens were inspected in both light and dark themes. Screen-reader behavior, physical-device rendering, and browser zoom were not verified.

### 2026-10-28 focused settlement correction

The local-only `COPY-REVIEW-20261026` preview was rebuilt and identity-checked against published baseline `f16105eca49f32da769b126f81825b8591dcd509`. Vehicle rows were operated in the side browser at 393×852 and 1280×900 in light/dark themes: disclosure pointer/Space, collapsed-row expense editor, Escape and focus restoration. Values remained 20px/400/28px and there was no horizontal overflow. A geometry regression checks that amounts retain full width and the label and arrow stay adjacent. Screen readers and physical devices were not manually exercised.

| Screen / modal | State | Width × height | Theme | Keyboard | Result | Evidence | Reason if unverified |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Settlement settings | Step 1: collection rounding; selected explanatory paragraph removed | 393 × 852 | Light | Pointer navigation to next step | Pass | Side-browser accessibility tree after verified build | Zoom and screen readers not exercised |
| Settlement settings | Step 2: driver reward; helper sentence removed | 393 × 852 | Light | Escape closed the modal and restored focus to settlement settings | Pass | Side-browser accessibility tree and screenshot | No values changed or saved; validation unchanged |

### 2026-10-28 cross-screen visual consistency

The shared tab content inset is 16px. Participant summaries and names use body-01 (14px/400/20px); allocation summaries use body-01, while grade and run-count metadata use label-01 (12px/400/16px). Vehicle/team names use heading-compact-02 (16px/600/22px). Settlement vehicle amounts use heading-03 at 20px/400/28px, the per-person collection amount remains 20px/600/28px, and rental-car notes use label-01 at 12px/400/16px. The settlement heading row gap is 8px and label/value gap is 4px. The WebKit tests compare computed line-height to two decimal places because its returned computed values can differ by subpixel fractions (for example, `19.999979px`) from the declared 20px token; the rendered type role remains unchanged.

| Check | Viewports / themes | Interaction and result | Evidence |
| --- | --- | --- | --- |
| Cross-screen browser suite | Playwright's four configured projects; included 320, 393, 676 and desktop widths and light/dark variants | 200 unique tests passed across the original Chromium-mobile run, the other three projects, and six WebKit line-height assertions rerun with subpixel-safe comparison | `visual-consistency.spec.js`, `participants.spec.js`, `allocation.spec.js`, `randomization-count.spec.js`, `settlement.spec.js` |
| Accessibility and modal regression | Chromium and WebKit, mobile and desktop projects | 32/32 passed, including participant search/deletion focus behavior, expense dialog naming and collection keyboard behavior | `participants-accessibility.spec.js`, `modal-accessibility.spec.js` |
| Side-browser visual and interaction check | Approximately 420×594 in the in-app browser; light and dark themes | Participants, car allocation, team allocation, and settlement viewed. Synthetic empty-seat add and pin/unpin were operated. Settlement expense editor and disclosure were opened; displayed amounts/details were checked. Preview-origin local storage only. | `http://127.0.0.1:4285/?room=CONSISTENCY-LOCAL-20261028&view=seisan`; screenshot was inspected inline, not saved to the repository |

The CUA in-app browser did not expose viewport resizing, so exact 393×852 and 1280×900 side-browser measurements are not claimed. Playwright covers the target widths. No modal component or modal styling changed; modal regressions were included in the accessibility suite. Browser zoom, physical devices, and screen-reader behavior remain unverified.

### 2026-10-29 allocation fixed status and row action clearance

The grade metadata must remain separated from the row-end Carbon overflow action. Pin/unpin is now inside that menu; a gray `固定` Tag appears beside the name when locked and uses the same Carbon style as the `運転手` Tag. A geometry assertion requires at least 4px between `.person-grade` and the row's overflow action.

| Check | Viewports / themes | Result | Evidence |
| --- | --- | --- | --- |
| Allocation row geometry and pin menu | 1280px light/dark, 390px, and 320px; Chromium and WebKit desktop/mobile projects | Pass, 8/8 checks across both browser specs and all four projects. Fix/unfix through the overflow menu and 320px document width check also pass. | `allocation.spec.js` and `carbon-remediation.spec.js` |
| Side-browser visual check | In-app browser, preview room `CONSISTENCY-LOCAL-20261028`, light theme | Pass; fixed status uses the driver Tag style, and the row action area no longer competes with grade text. | `http://127.0.0.1:4285/?room=CONSISTENCY-LOCAL-20261028&view=car` |

The dedicated pin button was removed from each row. This is an interaction and density change, not a type scale change. Browser zoom, physical devices, and screen-reader behavior were not exercised.

### 2026-10-31 project list and header name

The verified local-only preview was built from this worktree against published baseline `c233cb26d81023f4249eee415173578a6a46c033` and checked at `http://127.0.0.1:4288/`. A synthetic project (`UI確認用 2026-10-31`) was created only in that preview origin's local storage. The entry list remained in its original tab; project creation opened in a new tab and submission navigated that same tab into the new project. Opening the listed project also created a separate tab. The workspace header displayed the project name; the old project identity row and its `企画一覧へ`/`変更` controls were absent.

| Screen / modal | State | Width × height | Theme | Keyboard | Result | Evidence | Reason if unverified |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Project name | Save a renamed synthetic project from the header overflow menu | 390 × 844 and 1280 × 900 | Light and dark | Pointer open/save; browser suite also covers focus return on cancel and Escape during/after Japanese composition | Pass | In-app side-browser DOM snapshot; `shell.spec.js` and `project-navigation.spec.js` | Browser zoom, physical devices, and screen readers were not exercised |
| Project list / project creation | Open recent project and create a project in a new tab | 390 × 844 and 1280 × 900 | Light and dark | Pointer; native link new-tab behavior | Pass | `project-navigation.spec.js`, `project-workspace.spec.js` | Browser zoom, physical devices, and screen readers were not exercised |

Targeted Playwright suite: 84/84 checks passed across Chromium and WebKit on desktop and mobile, including both Carbon themes for shell/modal states. The local project data is isolated to preview-origin local storage; no production room or Firebase write was used.
