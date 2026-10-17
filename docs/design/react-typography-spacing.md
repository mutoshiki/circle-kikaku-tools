# React UI typography and spacing contract

This contract records the shared visual roles for the React app and the review steps that prevent typography and spacing regressions. It is based on the Carbon productive type scale, with role assignments chosen for this app's participant, allocation, and settlement workflows.

## Typography roles

Use `@include carbon-type.type-style('<name>')` from `@carbon/type` in `apps/react/src/styles.scss` for app-owned text. The mixin applies size, weight, line height, and letter spacing together.

| App role | Carbon type style | Use |
| --- | --- | --- |
| Project title and major settlement section heading | `heading-03` | Project identity; major settlement section titles |
| Main page heading, empty-state heading, confirmation heading | `heading-02` | Participant page title and empty/confirmation states |
| Vehicle/team title | `heading-compact-02` | Allocation group name, vehicle name |
| Primary payable amount | `heading-03` + `carbon-type.font-weight('semibold')` | Split/club amount at 20px/600/28px; this is a site-specific emphasis role above its label while keeping the categories separate |
| Payment adjustment amount | `body-compact-01` | Rounding and collection-offset amounts within the vehicle payment breakdown; use the same 14px/400/18px role as its label |
| Secondary group or task heading | `heading-compact-01` | Cost categories, route results, modal subheadings |
| Main body and cost description | `body-compact-01` | Names, descriptions, expense rows, supporting content |
| Form values on narrow screens | `body-02` | Text, textarea, number, select, and search input values |
| Metadata, status, and secondary count | `label-01` | Sync status, grades, helper text, allocation run count |

Keep the split and club payment amounts as separate values. Use tabular numbers and align currency values to a shared edge. Keep participant and allocation row heights driven by their content; do not compress multi-line rows to match one-line rows.

Do not use guessed `--cds-*-font-size`, `--cds-*-font-weight`, or `--cds-*-line-height` custom properties. Carbon's published CSS variables for component internals are not a substitute for the typography mixins. Avoid setting only one typography property when a Carbon type style expresses the intended role.

## Spacing and alignment

- Use `@carbon/layout` spacing values for app-owned layout gaps, padding, and margins. Keep 1px borders and 1px list separators when they create a visual divider; for vehicle payment cards, use the Carbon Accordion divider without a second article border.
- In vehicle payment details, keep expense rows 4px apart, separate split and club groups by 16px, and place adjustment rows in a 4px-spaced block after the expense rows. Keep the 8px label-to-amount gap and 16px vehicle-to-detail indentation. When a payment amount does not fit beside its label, let the amount move below without shrinking or overlapping the adjacent category.
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
