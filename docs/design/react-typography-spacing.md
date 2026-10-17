# React UI typography and spacing contract

This contract records the shared visual roles for the React app and the review steps that prevent typography and spacing regressions. It is based on the Carbon productive type scale, with role assignments chosen for this app's participant, allocation, and settlement workflows.

## Typography roles

Use `@include carbon-type.type-style('<name>')` from `@carbon/type` in `apps/react/src/styles.scss` for app-owned text. The mixin applies size, weight, line height, and letter spacing together.

| App role | Carbon type style | Use |
| --- | --- | --- |
| Project title and major settlement section heading | `heading-03` | Project identity; major settlement section titles |
| Main page heading, empty-state heading, confirmation heading | `heading-02` | Participant page title and empty/confirmation states |
| Vehicle/team title and primary payable amount | `heading-compact-02` | Allocation group name, vehicle name, split/club amount |
| Secondary group or task heading | `heading-compact-01` | Cost categories, route results, modal subheadings |
| Main body and cost description | `body-compact-01` | Names, descriptions, expense rows, supporting content |
| Form values on narrow screens | `body-02` | Text, textarea, number, select, and search input values |
| Metadata, status, and secondary count | `label-01` | Sync status, grades, helper text, allocation run count |

Keep the split and club payment amounts as separate values. Use tabular numbers and align currency values to a shared edge. Keep participant and allocation row heights driven by their content; do not compress multi-line rows to match one-line rows.

Do not use guessed `--cds-*-font-size`, `--cds-*-font-weight`, or `--cds-*-line-height` custom properties. Carbon's published CSS variables for component internals are not a substitute for the typography mixins. Avoid setting only one typography property when a Carbon type style expresses the intended role.

## Spacing and alignment

- Use `@carbon/layout` spacing values for app-owned layout gaps, padding, and margins. Keep 1px borders and 1px list separators when they create a visual divider.
- Align headings and their actions on a shared row where the viewport allows it. Allow wrapping without changing action order or clipping labels.
- Preserve indentation that communicates nesting, checkbox/action columns, and disclosure hierarchy. Do not force every text edge to the same coordinate.
- Keep the mobile empty state compact enough to align with surrounding page content; keep enough inset to distinguish it as a contained state.
- Keep forms grouped by task and retain visible input labels. On narrow screens, enlarge editable values consistently without scaling labels and radio copy along with them.
- Keep modal headers and footers visible while the body scrolls. Avoid horizontal scrolling at supported viewport widths.

## UI review checklist

For any React UI change involving these roles, review the affected path and at least one adjacent screen:

- [ ] Project title, page/section headings, group headings, body text, metadata, and currency values match the role table.
- [ ] Computed `font-size`, `font-weight`, `line-height`, and `letter-spacing` are non-empty and match the selected Carbon type style on rendered elements.
- [ ] Headings and actions align at desktop and mobile widths; wrapping, indentation, list rows, and amount columns remain intentional.
- [ ] Editable text, number, select, and search values follow the same narrow-screen size policy; labels and radio copy remain at their own Carbon roles.
- [ ] No horizontal page overflow or clipped dialog footer at approximately 390px and 1280px widths.
- [ ] Check both light and dark themes; retain semantic Carbon foreground, layer, border, and focus tokens.
- [ ] Repeated visible headings are reduced only when the fieldset/section still has a clear accessible name.
- [ ] Exercise the real empty, populated, expanded, and validation states affected by the change, using synthetic data when data entry is needed.

Record any intentionally different role or untested viewport/theme/state in the change summary. This checklist supplements the repository's release and browser-verification gates; it does not replace them.
