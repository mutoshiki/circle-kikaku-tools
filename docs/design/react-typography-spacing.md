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

Keep split and club payment amounts as separate values, including zero. In vehicle payments, use the labels `割勘から` and `部費から`, keep both visible in the collapsed summary, and include each label with its value in the disclosure button description. Use regular weight for both zero and nonzero vehicle amounts; reserve semibold emphasis for the per-person collection amount. At 375px and wider, use two equal-width categories with each label above its amount; align labels to the category start and amounts to the category end. At 375px through 671px, stack the categories when either formatted amount is 10 characters or longer. At 374px and narrower, use two category rows with labels left and amounts right; let an amount wrap below its label if necessary. Never shrink currency text to fit. Keep participant and allocation row heights driven by their content; do not compress multi-line rows to match one-line rows.

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
- [ ] Vehicle payment amounts remain 20px/600/28px as a site-specific role, while adjustment rows use `body-compact-01` (14px/400/18px); both split and club values remain visible, including zero.
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
