# Integrated project UI consistency audit

Updated: 2026-10-31
Scope: React project shell, Participant / Allocation / Settlement screens, Tools manager, inline Form Maker and Mountain Plan workspace, and project-level overlays.

## Method

Reviewed the user task flow first (create or open a project → choose tools → register participants → allocate → settle → optional application form / mountain plan), then information hierarchy, Carbon patterns, component contracts and rendered responsive behavior. References include the current `@carbon/react` 1.115.0 install and Carbon MCP documentation/code audit. The UI should remain a compact task workspace; the two embedded tools keep their workflow-specific forms and PDF layout.

## Official Carbon guidance and local decisions

| Official guidance | Application in this site | Decision |
|---|---|---|
| Productive screens use body/supporting styles with the `01` suffix and fixed headings; pair compact body with compact heading for consistent line-height. [Typography](https://carbondesignsystem.com/building-blocks/foundations/typography/style-strategies/#styles-for-productive-moments) | Keep existing role assignments in `docs/design/react-typography-spacing.md`; don't normalize every screen to one size or bold weight. | Adopt role-based consistency, retain larger figures only where they aid payment scanning. |
| Spacing tokens establish grouping and hierarchy. [Spacing](https://carbondesignsystem.com/building-blocks/foundations/spacing/overview/#creating-hierarchy) | Keep the existing 4px-based spacing scale and shared shell in `apps/react/src/styles.scss`; integrations are scoped under their workspace roots. | Adopt shared spacing roles. Preserve denser allocation rows and longer editor flows where task content differs. |
| A tablist has one tab stop; arrow keys move between tabs. Scrollable tablists keep this behavior. Automatic selection can be inappropriate if activation is expensive. [Tabs accessibility](https://carbondesignsystem.com/building-blocks/core/components/tabs/accessibility/#keyboard-interactions) | Preserve Carbon Tabs and horizontal scroll. Inline tools are lazy-loaded; visited panels remain mounted to retain edits. | Adopt. Validate actual selected panel in count-only settlement where available tabs are restricted. |
| Toasts are non-modal, time-based messages intended to convey short status. [Notification](https://carbondesignsystem.com/building-blocks/core/components/notification/guidelines/#toast) | Use short action/result messages; persistent validation and recovery details remain inline in the relevant tool. | Adopt. Do not put worker/package/debug implementation details in user copy. |

## Carbon MCP code-audit review

Batch reviewed `ProjectToolsWorkspace.jsx` and `settlement/SettlementPaymentRow.jsx`.

- Three Button-size warnings in `ProjectToolsWorkspace.jsx`: the audit calls `size` “recommended.” These are secondary navigation and task controls using Carbon's installed default size intentionally. No uniform size prop was added because that would create unnecessary differences from equivalent app controls.
- One Button kind/size warning on the settlement accordion's `<button>` and one nesting warning that `AccordionItem` must be nested under `Accordion`: regex mode did not follow the custom `renderToggle` callback. In the rendered tree the button is Carbon's required custom toggle for `AccordionItem`, and the item is rendered as a child of `Accordion` from `Settlement.jsx`. Changing it to a standalone Carbon Button would break the Accordion interaction contract.
- The installed Carbon React package is authoritative for runtime props and composition; MCP audit findings are recommendations to investigate, not automatic edits.

## Shared decisions applied

- Project shell keeps one Carbon header, one project identity region, and one tablist. Embedded makers do not render a second site header.
- The `Tools` tab is always available. Unpinned tools open within it; changing or removing a tab does not erase the tool's saved data.
- Form creation remains an explicit submit action. Loading the tab does not enqueue a job. The existing form-maker account/session contract remains isolated from Circle Firebase authentication.
- Mountain Plan uses a project-scoped local draft. It does not claim cloud sync. It is not mounted while unused; hiding it flushes pending draft work.
- The all-tools debug sample is synthetic and isolated in a debug-only local namespace. It does not call form creation, form submission, OCR, Firebase, or the external academic-document application.
- Settlement categories and amounts, allocation capacities and fixed roles retain their existing semantics. Layout changes do not change calculations.
- Long Japanese labels wrap within their own row and do not force horizontal page overflow. PDF print typography remains separate from app UI roles.

## Visual verification policy

See [ui-screen-matrix.md](./ui-screen-matrix.md) for tested and untested states. A test assertion or Carbon MCP result is not treated as a substitute for inspecting the current production build in a browser. Production publication is not implied by this local audit.

## 2026-10-31 full-site audit decisions

The official rules above are guidance, not a requirement to make every component look identical. Current-screen comparisons and the Carbon MCP batch review are recorded in `ui-screen-matrix.md`; the following adoption decisions direct Tasks 2–5.

| Priority | Observed concern | Official guidance | Site decision and owner |
|---|---|---|---|
| P1 | Shared page headings, action links, and input groups are spaced differently between shell pages, participant/settlement views, and embedded makers. | Use named type roles and spacing scale to signal hierarchy; type role and spacing role should follow content purpose. | Adopt shared heading/action/input-group primitives in Circle. Do not refactor every existing selector or force the same density onto allocation rows. Task 2–3. |
| P1 | Modal header/body/footer patterns and long-content behavior are implemented across a broad component set. | Modal focus order and keyboard handling must match the decision and destructive-action context; keep focus in the modal and return it on close. | Retain Carbon modal contracts. Align only app-owned spacing and scroll ownership; test each modal family at narrow and desktop widths. Task 3/6. |
| P2 | Vehicle payment summary, expense editor, and disclosure have a specific, already tested hierarchy. | Productive screens favor role-based type hierarchy and consistent spacing. | Keep settlement monetary hierarchy, split/club meaning, and disclosure behavior. Normalize repeated vehicle row rhythm only. Task 3. |
| P2 | Dense allocation rows have local exceptions (role chips, grade, fixed status, overflow menu). | Align related metadata and leave space for controls; responsive content may wrap when necessary. | Preserve density and pin/driver roles. Adjust only verified collisions/wrapping. Do not increase all rows or replace the overflow menu. Task 3. |
| P2 | Embedded package styles are maintained in separate repos and can leak if styling is global. | Component styles should remain scoped to their component contract. | Add embedded-root-only presentation in each package; preserve standalone headers, job lifecycle, auto-draft and document output. Tasks 4–5. |
| P3 | Small spacing differences across independent sections and secondary actions are not consistently tokenized. | Carbon spacing uses a defined scale. | Introduce fallback-capable CSS custom properties for shared gaps, but do not rewrite purposeful values or normalize editor/document-specific layout. Task 2. |

### MCP audit interpretation

Carbon MCP searched the current documentation for productive typography, spacing scale, modal focus handling, and tab keyboard interaction, then audited the installed React source files `ProjectToolsWorkspace.jsx`, `SettlementPaymentRow.jsx`, `Participants.jsx`, `Allocation.jsx`, and `styles.scss`. Its batch reported 120 findings. This is a screening count, not 120 confirmed defects. Several categories are known false positives or require code/DOM review: custom settlement `renderToggle` accordion composition, dynamic modal sizes, inherited/default Carbon Button sizes, grid structures that represent data columns, and the `:focus:not(:focus-visible)` outline rule. Other findings are candidates only when a concrete visual or keyboard issue is reproduced. No automatic bulk token replacement is authorized by the audit.
