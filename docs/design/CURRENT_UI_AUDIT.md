# Current React UI audit

Status: approved descriptive audit snapshot (2026-09-29)
Audit date: 2026-09-29
Audited tree: current working tree on `codex/react-migration-rc` at `633733c` plus pre-existing local changes. No user changes were reset or stashed.

Contract role: 現行実装と実ブラウザで観測した事実、問題、推奨方向を記録する **non-normative evidence**。本書の`Carbon interpretation`と`Recommended zero-based structure`は監査時点のProject interpretationであり、Carbon公式の直接規則ではない。将来実装の必須仕様は [SANPOKAI_PRODUCT_UI.md](./SANPOKAI_PRODUCT_UI.md)、共通原則とpattern選択は [CARBON_PRODUCT_PRINCIPLES.md](./CARBON_PRODUCT_PRINCIPLES.md) / [CARBON_PATTERNS.md](./CARBON_PATTERNS.md)、順序は [CARBON_MIGRATION_ROADMAP.md](./CARBON_MIGRATION_ROADMAP.md) が所有する。本書はそれらを上書きしない。

## 1. Audit scope and method

### Sources inspected

- React owners: `apps/react/src/App.jsx` and `apps/react/src/components/*.jsx`
- Styling: `apps/react/src/styles.scss`
- Domain/persistence boundaries used by the UI
- Browser tests and fixture-backed local preview
- Installed contract: `@carbon/react` 1.115.0 / `@carbon/icons-react` 11.87.0
- Carbon official guidance current on 2026-09-29

### Real-browser audit

The audit ran against a local test-mode build and synthetic localStorage fixtures; no production Firebase data was read or written.

| Environment | Viewport / engine | Result | Evidence |
| --- | --- | --- | --- |
| Chromium desktop | Playwright `chromium-desktop` | 44/44 states captured | `artifacts/ui-audit/desktop/` |
| Chromium mobile | Playwright `chromium-mobile`, ~390px | 44/44 states reached | run result; shared mobile filenames were later replaced by WebKit capture |
| WebKit mobile | Playwright `webkit-mobile`, ~390px | 44/44 states captured | `artifacts/ui-audit/mobile/` |

The three-project audit passed: 132 state captures, no horizontal document overflow assertion failure. A first attempt against a production-mode build failed only because production intentionally excludes `window.__REACT_ROUTE_ADAPTER__`; rebuilding with Vite `--mode test` restored the approved local route adapter and all three projects passed. This is a test-harness boundary, not a production UI defect.

### Explicit limitations

- A real screen reader session was not performed; semantic/accessibility findings combine DOM/code inspection and keyboard-focused automated checks.
- A physical mobile software keyboard and notch device were not used; short viewport, footer, scroll, and safe-area risks remain implementation-phase gates.
- Multi-client Firebase Emulator synchronization was outside this design audit. Existing sync behavior was not changed.
- Project list/create is not present as a full React screen in the audited shell; it was audited as a missing IA capability rather than simulated.
- Production deploy, compatibility deploy, root cutover, production smoke, and production Firebase writes were not performed.

## 2. Severity model

- **structural**: page/IA/task surface is wrong or missing; component-level repair is insufficient.
- **workflow**: sequence, save model, prerequisites, or completion path impedes the goal.
- **interaction**: controls, feedback, disclosure, focus, or action behavior is mismatched.
- **responsive**: layout/pattern does not transform appropriately for viewport/input.
- **accessibility**: semantics, keyboard, focus, contrast, announcement, or touch risk.
- **content**: wording, terminology, labels, or recovery instruction is unclear.
- **visual**: token, hierarchy, spacing, type, color, or surface inconsistency.
- **minor**: localized issue with low task impact.

Severity labels below can contain multiple categories; the first is the dominant category.

## 3. Executive findings

### Highest-impact problems

1. **Application IA is encoded as four contained Tabs.** Participants, car allocation, team allocation, and settlement are independent work areas in a lifecycle, not alternate views of one context. There is no Overview, project list, or stable nested-task navigation.
2. **Modal is the default task surface.** Registration, project information, history, settlement settings, vehicle cost editing, movement setup, and route planning are forced into dialogs. Several are long, repeated, context-dependent, or multi-step and should be pages/workspaces.
3. **Settlement is a card stack, not a task model.** Five Tile-like sections mix readiness, settings, collection, recipient payments, and notes in one long page. On mobile the operative tasks appear after large summary/settings surfaces.
4. **Feedback is globally over-centralized.** A single ToastNotification is used for many notices and severity is inferred from message text. On mobile it can cover project context/navigation; many successful state changes need no toast.
5. **Page anatomy is incomplete.** Recent local changes removed redundant section `h1`s, but the shell now lacks a stable page title on several work areas. Summary text, actions, and nav carry too many hierarchy roles.
6. **Custom CSS owns too much component behavior.** Global `.cds--modal` overrides, bottom-aligned mobile dialog behavior, fixed dimensions, and custom surfaces increase upgrade and accessibility risk even where tokens are used.

### Strong foundations worth preserving

- Carbon Header, theme tokens, Grid/Column usage, standard form controls, labels, menus, and destructive confirmations.
- Participant and allocation Contained-list structures are compact and scan-friendly.
- Car/team allocation’s direct view of assigned and unassigned people maps well to the user goal.
- Explicit domain drafts/commit boundaries in complex edits; existing persistence, synchronization, and calculations.
- Local empty/search states, payment status shown in-row, and ContentSwitcher for all/unpaid are directionally sound.
- Current Chromium/WebKit mobile layouts avoid document-level horizontal overflow in the audited states.

## 4. Cross-product architecture

### Current structure

`App.jsx` renders a Carbon Header, editable project-name input, four contained Tabs, the selected feature component, global utility/menu modals, and one global Toast region. A room is addressed by URL/runtime state; no project index is rendered.

### User goal

Know which project is open, understand the project’s readiness, move through planning stages, and return to unfinished work without losing context.

### User task

Open a project, identify the next incomplete stage, enter a work area, complete or save it, and move to the next stage.

### Carbon interpretation

This is application shell + project navigation + page anatomy. Tabs should be reserved for related views within one broader context, not the entire project lifecycle.

### Problems

- Tabs flatten four unequal work areas and imply peer views rather than lifecycle tasks.
- No Overview or progress/next-action entry point.
- Project title edit, navigation, and current page hierarchy compete in the first viewport.
- URL/current-work restoration is weaker than a page/navigation model.
- Global utilities mix user help, demo reset, theme, and bug reporting.

### Recommended zero-based structure

Carbon Header for global identity/utilities; project context below it; project navigation for Overview, Participants, Organization, Settlement, History/Settings; each destination gets an `h1`, state summary, one primary action, and nested task navigation where needed.

### Severity

**structural**, workflow, responsive, accessibility.

### Dependencies

App shell, routing/state restoration, all page headers, focus after navigation, browser test selectors. Keep runtime/store and room URL compatibility unchanged.

## 5. Project list and project opening

### Current structure

The audited React shell opens one room/project via runtime/URL. There is no complete React project list, create-project entry, recency list, or empty project-index state.

### User goal

Find the intended project or start a new one without handling internal room identifiers.

### User task

Scan recent/owned projects, identify name/date/status, open one, or create one.

### Carbon interpretation

This is a top-level list/navigation task, not a modal inside an already-open project. A Data table or Contained list depends on scale and metadata; new-project is a distinct primary action.

### Problems

- Missing product-level IA creates reliance on links/external entry flows.
- Internal room addressing can leak into navigation and recovery.
- No designed loading/empty/error model for project discovery.

### Recommended zero-based structure

A project index with recent projects, meaningful status/date, search only when scale justifies it, primary `企画を作成`, and explicit empty/error states. Preserve legacy shared-link opening as an alternate entry path.

### Severity

**structural**, workflow.

### Dependencies

Authentication/room discovery contract, legacy links, project metadata. This requires separate product/data discovery before implementation and is not authorized as a data-model change by this audit.

## 6. Project creation, detail, and edit

### Current structure

Project name is an inline TextInput near the shell and saves on blur. `OverviewModal` holds memo and timetable in a local draft with explicit `共有保存`; other project context is dispersed.

### User goal

Create and maintain a trustworthy shared description of the event.

### User task

Enter/edit project name, date/context, memo, and timetable; review before sharing; know whether changes are local or shared.

### Carbon interpretation

This is a full-page grouped form/read view. Inline edit is suitable only for a single safe value with clear save status. A multi-row timetable and shared draft exceed a focused Modal.

### Problems

- Two save models exist in adjacent project information: name-on-blur and explicit shared save.
- Long project information is hidden behind a Modal rather than forming the project Overview.
- `この端末の下書き` uses an InlineNotification as explanatory chrome instead of a concise draft status.
- Blur-only save is difficult to predict and recover on keyboard/mobile.

### Recommended zero-based structure

Dedicated Overview read page with an Edit mode; grouped form; local draft/unsaved state in the page header; one shared Save and Cancel; repeating timetable rows; project-level danger zone separated from normal editing.

### Severity

**workflow**, structural, content, accessibility.

### Dependencies

Project name persistence, overview draft API, sync state, timetable schema. Do not merge save models without a domain compatibility plan.

## 7. Applicants and participant registration

### Current structure

`RegistrationModal` is a large scrolling Modal containing spreadsheet paste, Accordion instructions, manual participant/driver/grade fallback areas, validation, and one Register action.

### User goal

Import applicant data accurately and correct ambiguity before it affects assignments.

### User task

Choose a source, paste data, understand parsing, correct errors, review recognized records, then register.

### Carbon interpretation

This is a multi-stage, potentially long form/import workflow. Carbon dialog guidance excludes long, repeated, context-heavy tasks; form guidance favors logical grouping and visible order over hiding required sections.

### Problems

- Too many input modes and fields in one Modal.
- Parse/review/correction are not expressed as explicit stages.
- The mobile dialog scroll/footer geometry works in tested states, but the task remains structurally unsuitable for a dialog.
- Help Accordion is appropriate for optional instructions, but the overall import contract relies on explanatory copy.
- Error recovery is too global; row-level parse issues need association.

### Recommended zero-based structure

Dedicated import flow: source → paste/manual input → parsed preview with row issues → correction → commit. Preserve paste parser and registration store contract. On mobile, each stage remains a page section/step rather than a full-screen-like Modal.

### Severity

**structural**, workflow, responsive, accessibility.

### Dependencies

Registration parser, form-linked data, participant/driver/grade identity, legacy compatibility, test fixtures.

## 8. Participant list and confirmation

### Current structure

Search, optional Select filters, large Contained list rows with checkbox and Overflow menu, contextual sticky selection action, participant edit Modal, danger confirmations, and post-confirm tools.

### User goal

Determine exactly who participates and establish the canonical set for all later tasks.

### User task

Scan applicants, search/filter, select participants, review count, confirm, later correct individual details or selection.

### Carbon interpretation

Contained list + contextual selection mode is a strong fit. The page still needs stable title/status/action hierarchy and distinct data-empty/search-empty/filter-empty states.

### Problems

- Current work area lacks a stable page `h1`; `参加者 N人` summary acts as heading.
- Header `追加` is low-emphasis even in the zero-participant state, while search/filter remain visible without useful data.
- Checkbox accessible names are names only; duplicate names need disambiguation.
- Post-confirm actions are presented as repeated blocks rather than next workflow actions.
- Toast feedback can duplicate the visible result.

### Recommended zero-based structure

Keep the compact Contained list. Add page header with confirmation status/count and context-dependent primary action; distinct empty states; explicit selection toolbar; post-confirm next-task group; use participant edit Modal only while the form remains short.

### Severity

**interaction**, structural, accessibility, content.

### Dependencies

Participant canonical identity, confirmation side effects, car/team/settlement recalculation, handoff permissions.

## 9. Participant edit and delete

### Current structure

Short participant form in a scrolling Modal. Edit/delete live in row Overflow. Separate danger confirmations exist for deletion and removing from confirmed participants.

### User goal

Correct a person without accidentally losing or corrupting downstream assignments.

### User task

Open person actions, edit a few attributes, save; or remove/delete after understanding impact.

### Carbon interpretation

Short focused edit fits a Modal. Low-frequency destructive actions fit Overflow + danger confirmation. The distinction between delete and remove must be explicit.

### Problems

- Duplicate person names can make action/dialog identity ambiguous.
- Error title currently may be raw error text and does not always provide recovery.
- Downstream effects are described, but whether applicant source data remains should be explicit.

### Recommended zero-based structure

Maintain Modal for the current small form; show identifying metadata; field-linked errors; restore focus to the exact row action. Keep separate verbs and consequences for `削除` and `参加者から外す`.

### Severity

**content**, accessibility, minor interaction.

### Dependencies

Participant identity and downstream assignment cleanup.

## 10. Car-out availability and car allocation

### Current structure

Vehicle groups and people are rendered as compact lists; driver/capacity metadata, pin action, Overflow actions, empty-seat candidate disclosure, add/edit Modal, random-allocation confirmation, and unassigned section.

### User goal

Assign all confirmed participants to viable vehicles while respecting drivers and capacity.

### User task

Create/rename vehicles, identify drivers, set capacity, inspect vacancies/unassigned people, move people, optionally randomize while preserving fixed assignments.

### Carbon interpretation

This is a direct-manipulation allocation workspace. Simultaneous group/unassigned visibility is more important than card decoration. Contained list is appropriate; randomization is a tool, not the primary goal.

### Problems

- Desktop structure is useful, but mobile serializes a complex workspace without a clear current subtask.
- Pin, Overflow, vacant-seat disclosure, and randomize compete for attention.
- Random confirmation explains risk but needs a review/undo model.
- Group creation Modal is acceptable only while short; capacity/driver logic must remain explicit.
- A mobile drag/touch path alone would be insufficient; keyboard alternative must remain.

### Recommended zero-based structure

Preserve compact group/member lists and assigned/unassigned model. Desktop 2-pane workspace; mobile group list → group detail → select unassigned participants. Summarize capacity issues at page level. Keep randomize tertiary, show preserved locks and reviewable result.

### Severity

**workflow**, responsive, interaction, accessibility.

### Dependencies

Shared `Allocation` pattern, pin/lock semantics, driver state, participant confirmation, assignment store.

## 11. Team allocation

### Current structure

The same `Allocation` component is reused with team-specific labels, add Modal, randomization, group/member lists, and unassigned people.

### User goal

Create balanced, complete activity teams with visible unassigned participants.

### User task

Create teams, place people, inspect balance, randomize if useful, and correct the result.

### Carbon interpretation

Reuse of one allocation pattern is correct if vehicle-only concepts do not leak. Team and car are sibling task pages, not Tabs merely because code is shared.

### Problems

- Same shell-level Tab issue as vehicle allocation.
- Vehicle-specific density/action choices can leak into team needs.
- Balance criteria and completion state are not summarized as user outcomes.

### Recommended zero-based structure

Keep the shared allocation anatomy but provide team-specific summary (team sizes/unassigned), labels, and validation. Treat as a local destination under Organization.

### Severity

**structural**, workflow, minor content.

### Dependencies

Shared Allocation component, participant set, randomization rules.

## 12. Route and movement

### Current structure

Within `Settlement`, vehicle-cost Modal changes internal `view` from expense to movement to route. `RoutePlanner` includes stop search, results, selected route, map, options disclosure, loading/empty/error, and Apply/Back. Only one dialog remains in DOM, with manual focus selection.

### User goal

Calculate a defensible travel distance/route for a vehicle and use it in cost calculation.

### User task

Choose movement type, enter or search stops, calculate alternatives, inspect map/summary/options, select one, apply distance, return to the cost.

### Carbon interpretation

This is a nested workflow requiring substantial space and context. It is not a brief dialog. Back navigation and draft preservation are page/workspace responsibilities.

### Problems

- A Modal impersonates multiple pages by swapping heading, content, size, scroll ownership, footer, and initial focus.
- The user must remember which expense and draft they came from.
- `role="application"` on map increases keyboard contract risk.
- Mobile map/search/options inside the dialog is usable in the fixture but fragile with real keyboard and dynamic results.
- Route adapter failure is shown inline, but production/test adapter boundaries complicate test setup.

### Recommended zero-based structure

Vehicle cost detail → nested Route page. Preserve cost draft across navigation. Desktop may use list/map split; mobile prioritizes stops and route summary, with optional map disclosure. Apply distance returns to the same cost editor. Keep manual-distance fallback.

### Severity

**structural**, workflow, responsive, accessibility.

### Dependencies

Route adapter, map API, vehicle cost draft, movement formula, focus/routing state. No calculation rewrite.

## 13. Costs and vehicle-specific costs

### Current structure

Settlement shows each vehicle in an ExpandableTile. `費用を編集` opens one Modal containing a Contained list of expense rows, selected expense form, additional expense creation/deletion, movement preview, and candidate expenses. Standard and extra expenses share a dense editor.

### User goal

Ensure every vehicle cost and calculation input is correct before settlement distribution.

### User task

Pick a vehicle, review total, inspect/edit each expense, add/remove extras, configure movement calculation, and save consistently.

### Carbon interpretation

Repeated multi-item editing with cross-item drafts is a workspace. A list-detail pattern is more appropriate than ExpandableTile → Modal → internal views.

### Problems

- Surface nesting: page Tile → ExpandableTile → Modal → Contained list / Accordion / Tile preview.
- Frequent edit is hidden behind repeated open/close operations.
- Modal owns both list selection and detailed form, particularly constrained on mobile.
- A current local line uses `kind="danger--ghost"`, inconsistent with Carbon’s `danger-ghost` naming and worthy of implementation-phase contract verification.
- Candidate expenses in Accordion mix optional reuse with primary editing.

### Recommended zero-based structure

Vehicle cost list page and vehicle cost detail workspace. Desktop list/detail split; mobile list then edit page. Formula/readiness visible; route as nested page; one coherent save boundary. Use standard rows plus explicitly removable extra rows.

### Severity

**structural**, workflow, responsive, visual.

### Dependencies

Settlement calculation/store, draft preservation, route task, standard/extra expense identity, dirty local changes.

## 14. Settlement settings, split, club fee, exemption, deduction

### Current structure

`SettlementSettingsEditor` is a large 3-step Modal with ProgressIndicator. Steps cover method/organizer, driver reward/movement-related values, and collection rules. Settings/issues are summarized in a Tile with one or more InlineNotifications. Related exemption/deduction effects are presented through settlement results and settings structures.

### User goal

Define one internally consistent rule set that produces understandable charges and payouts.

### User task

Choose settlement mode, organizer/collector, split/rounding, driver compensation, club fee, exemptions/deductions; inspect calculation impact; save.

### Carbon interpretation

The task is complex and high-impact. It needs a dedicated form/workspace with visible validation and calculation preview. A wizard is valid only when steps are truly sequential and conditional; it still should not be a Modal at this length.

### Problems

- Step 1 shows a Back action that has no meaningful previous step.
- Modal obscures settlement result context needed to judge settings.
- Issues are repeated as separate InlineNotifications, increasing visual noise.
- Rule categories and their effect on payer/recipient totals are not visible together.
- Exempt, excluded, paid, and deducted states risk conceptual overlap.

### Recommended zero-based structure

Dedicated Settlement rules page, grouped by 대상/roles, split/rounding, compensation/club fee, exemptions/deductions, collection. Show a live read-only calculation preview and blocking issue summary. Use wizard only if dependency testing proves it reduces error; omit Back on first step.

### Severity

**structural**, workflow, content, accessibility.

### Dependencies

Settlement schema/calculation, participant roles, organizer/collector, validation, legacy compatibility. UI must consume existing results, not reimplement them.

## 15. Settlement overview and data presentation

### Current structure

One long Settlement page contains five Tiles: status, settings, collection checks, driver payments, and memo. ContentSwitcher filters all/unpaid. Vehicle payments use ExpandableTile with breakdown and paid checkbox.

### User goal

Know whether settlement is ready, understand the remaining money movement, and finish outstanding collection/payment work.

### User task

Resolve setup problems, review amounts, mark participant collection, pay recipients/drivers, inspect breakdowns, record notes.

### Carbon interpretation

This requires an overview with prioritized blocking/next actions plus focused work areas. Tile is not a default section container. Related data should use lists/structured data and disclosure.

### Problems

- Equal Tile treatment hides the difference between readiness, configuration, operational checks, and notes.
- On mobile, long serial stacking delays the main operational task.
- Large type/spacing lowers productive density without improving hierarchy.
- Settings precede collection even after settings are complete.
- Nested expandable cards add surface and interaction complexity.

### Recommended zero-based structure

Settlement Overview: readiness + essential totals + next task links. Separate Costs, Rules, Collection/Payment work areas. Use compact lists/Structured list for money data; disclosure only for breakdown. Keep `すべて / 未回収のみ` as a valid similar-view switch or replace with a filter if future requirements expand.

### Severity

**structural**, workflow, responsive, visual.

### Dependencies

App navigation, settlement subroutes/state, calculation result presentation, shared status patterns.

## 16. Collection and paid-status management

### Current structure

Participant collection rows and vehicle/recipient payment cards show current status. A small Modal records collection/collector. Payment checkbox updates row status immediately. Breakdown can expand.

### User goal

Track actual money receipt and payout without confusing calculated obligation with completion state.

### User task

Filter outstanding items, record collection, inspect amounts, mark payout, and correct mistakes.

### Carbon interpretation

High-frequency state tracking belongs directly in a list with immediate visible result. Short additional input may use a Modal. Extra success Toast is usually unnecessary.

### Problems

- Collection and payout are separated by large card surfaces rather than a consistent status-list pattern.
- Checkbox wording `支払い済みにする` changes meaning after checked and needs state/undo clarity.
- Optimistic update failure and sync conflict presentation need explicit design.
- Exempt/excluded/paid tags must remain semantically distinct, not color-only.

### Recommended zero-based structure

Compact collection/payment lists with summary and outstanding filter; direct row state change; short collector Modal only when data is required; status text + icon/tag; undo or explicit reversal; persistent inline error on save failure.

### Severity

**interaction**, workflow, accessibility, content.

### Dependencies

Paid/collected persistence, sync conflicts, settlement calculation, role/status semantics.

## 17. History and restore

### Current structure

`HistoryModal` is a scrolling Modal with `現在の状態を保存`, rows of timestamp/project name, row restore buttons, optional undo, and empty text.

### User goal

Return to a known prior state safely and understand what will change.

### User task

Create a snapshot, identify one by time/context, restore it, and undo if needed.

### Carbon interpretation

History is a durable list and a high-impact restore workflow; it deserves a page or nested destination, not a long Modal. Restore requires impact confirmation.

### Problems

- Modal scale limits scan and future metadata.
- Restore is a Ghost row action without visible impact preview in the list.
- Empty copy does not explain how history is created.
- Current/restore target distinction is weak.

### Recommended zero-based structure

History page with a compact list or Data table, current marker, meaningful metadata, tertiary snapshot action, restore confirmation, and time-limited undo if supported.

### Severity

**structural**, workflow, content.

### Dependencies

Snapshot format, restore/undo semantics, compatibility boundaries, app navigation.

## 18. Destructive actions and settings

### Current structure

Participant/group deletion uses Overflow + danger Modal. Sample data reset is a normal utility-menu task with a radio form Modal. Project-level delete/reset/settings are not consolidated into a dedicated destination.

### User goal

Remove incorrect objects or reset data without accidental broad loss.

### User task

Select a target, understand downstream effects, confirm or cancel, recover where possible.

### Carbon interpretation

Risk determines visibility and confirmation. Row delete can live in Overflow; broad reset belongs in a separated danger zone. Demo/sample operations should not resemble ordinary product tasks.

### Problems

- Sample reset is too close to routine help/theme utilities.
- Undo strategy is inconsistent across delete/restore/reset.
- Danger wording sometimes states deletion but not whether source/legacy data remains.

### Recommended zero-based structure

Keep row delete Overflow + concise danger Modal. Move broad reset/delete to Settings danger zone; isolate sample data to development/demo context. Define recoverability tier and wording per action.

### Severity

**workflow**, content, interaction.

### Dependencies

Data cleanup behavior, snapshots/undo, environment/demo flag, legacy state.

## 19. Empty, loading, error, and synchronization states

### Current structure

There are participant/search empty messages, route empty/loading/error, settings issues via InlineNotification, root load error via InlineNotification, disabled handoff with reason, and global Toast notices. No unified state taxonomy is visible.

### User goal

Know whether there is no data, data is loading, an operation failed, or shared state is still synchronizing—and know what to do next.

### User task

Wait, retry, correct input, remove filters, complete prerequisites, or continue offline/local work as permitted.

### Carbon interpretation

These states have different patterns: contextual empty, initial Skeleton, local loading, field/section/global error, transient feedback, persistent sync status.

### Problems

- `参加者を追加してください` plus `参加者がいません` duplicates one empty state.
- Search/filter controls remain prominent when the underlying list is empty.
- Notice severity is inferred from Japanese message text, coupling content to behavior.
- Multiple issue notifications can stack instead of one actionable summary.
- Screen-reader announcements and sync-conflict recovery are not demonstrated end-to-end.

### Recommended zero-based structure

Shared state taxonomy/component contracts, typed notice severity, contextual action, one issue summary with links, initial Skeleton only where real asynchronous structure loads, and explicit sync status/error handling.

### Severity

**interaction**, accessibility, content, structural.

### Dependencies

Runtime loading, sync/outbox events, route adapter, shared notification API, all feature pages.

## 20. Mobile and responsive behavior

### Current structure

At ~390px, global header, editable project title, four equal tabs, and feature content stack vertically. CSS globally changes Carbon Modals into bottom-aligned/full-width surfaces. Selection actions are sticky. Allocation becomes one column. Settlement becomes a long Tile/card stack.

### User goal

Complete the same planning tasks with touch and a software keyboard without losing context or actions.

### User task

Navigate, scan lists, select people, edit forms, inspect/modify costs/routes, and complete confirmations.

### Carbon interpretation

Responsive design changes information priority and task surface, not just column count. Long tasks should become pages; data should transform to lists/detail; sticky actions are contextual and safe-area-aware.

### Problems

- Four Tabs consume a large fixed band and compress application IA.
- Toast can cover project context/navigation.
- Global Modal overrides hide which tasks are structurally too long.
- Settlement and settings require excessive vertical scanning.
- Actual software-keyboard and safe-area behavior is not yet proven.
- Some icon actions rely on CSS sizing rather than a declared 44px touch contract.

### Recommended zero-based structure

Collapsible project navigation, explicit page header, page-based long forms/routes/costs, task-specific list/detail transformation, contextual sticky selection bar with safe-area, and dedicated physical-device keyboard validation.

### Severity

**responsive**, structural, accessibility.

### Dependencies

App navigation, every task surface, modal removal phases, CSS/token foundation.

## 21. Accessibility and content audit

### Current structure

Carbon components provide a strong baseline: labels, menus, tabs, dialogs, controls, focus trapping. The app adds custom composition, dynamic views, map role, sticky actions, and global notices.

### User goal

Understand and complete all tasks with keyboard, assistive technology, high contrast, touch, or reduced motion.

### User task

Navigate headings/landmarks, operate lists/forms/dialogs, recover from errors, and retain focus/context after state changes.

### Carbon interpretation

Accessibility is a product composition responsibility. Carbon component use does not validate heading structure, focus return, names for duplicate records, dynamic announcements, or custom map behavior.

### Problems

- Missing/unstable page headings after local UI simplification.
- Dynamic internal Modal views manually query focus targets; page navigation is safer.
- Duplicate name controls can have indistinguishable accessible names.
- Error association/focus-to-first-invalid is not consistent.
- `role="application"` on map needs a documented complete keyboard model.
- Toast timing and placement may not provide reliable nonvisual feedback.
- Terms such as 保存/反映/確定/閉じる are not consistently tied to state transitions.

### Recommended zero-based structure

Semantic page landmarks/headings, task-surface-specific focus policy, typed state announcements, unique object labels, field-linked errors, map text fallback, reduced-motion checks, and a Japanese terminology/action-label glossary.

### Severity

**accessibility**, content, structural.

### Dependencies

Page shell, routing, forms, notification API, map, all feature tests.

## 22. Visual system and custom CSS

### Current structure

The stylesheet uses many Carbon tokens and responsive rules, but also owns modal geometry, fixed/min dimensions, custom card/list surfaces, and selectors into Carbon internals.

### User goal

Scan a dense planning tool with predictable hierarchy in light/dark themes.

### User task

Distinguish page, section, row, state, and action without decoding arbitrary surfaces.

### Carbon interpretation

Grid, spacing/type/color/layer tokens should establish hierarchy. Custom CSS should express application-specific layout only, not replace Carbon interaction/focus/surface contracts.

### Problems

- Tile/card density and custom surface nesting weaken hierarchy.
- Global `.cds--modal*` overrides create upgrade risk.
- Fixed dimensions/magic numbers require semantic token/grid review.
- Productive density varies widely between participant/allocation and settlement.

### Recommended zero-based structure

Token inventory and CSS ownership gate; normalize page/section/list anatomy; remove custom Carbon-internal overrides as long tasks migrate to pages; retain only app-specific workspace geometry with documented breakpoint rationale.

### Severity

**visual**, structural, responsive.

### Dependencies

Foundation phase, app shell, modal migration, visual regression baselines, installed Carbon version.

## 23. Browser audit step register

Health legend: **Pass** means the state was reached in all three configured projects without the audit assertion failing. **Concern** means it rendered and was operable, but the design audit found a structural/UX issue. **Partial** means automation did not prove a requested real-device or assistive-technology property.

| # | State | Health | Audit note |
| ---: | --- | --- | --- |
| 1 | Empty participant shell | Concern | Duplicate empty messaging; search/filter shown before data |
| 2 | Header utility/app menu | Pass | Menu operable; sample reset placement is questionable |
| 3 | Guide Modal | Pass | Short passive dialog is appropriate |
| 4 | Sample-data Modal | Concern | Broad reset appears as routine utility task |
| 5 | Missing-data success Toast | Concern | Toast overlaps mobile context and is often redundant |
| 6 | Participants with missing-data sample | Pass | List remains scanable; issue hierarchy needs work |
| 7 | Participant search no-result | Pass | Needs action to clear condition |
| 8 | Participant filters open | Pass | Filter controls fit; active filters need persistent summary |
| 9 | Participant default list | Pass | Strong Contained-list foundation |
| 10 | Participant selection sticky action | Partial | Works in viewport; physical keyboard/safe-area not proven |
| 11 | Participant row Overflow open | Pass | Correct low-frequency action placement |
| 12 | Participant edit Modal | Pass | Short focused edit remains a suitable dialog |
| 13 | Participant delete confirmation | Pass | Danger pattern present; consequence wording can improve |
| 14 | Car allocation default | Pass | Useful productive list/workspace foundation |
| 15 | Car candidates expanded | Pass | Direct context useful; mobile task sequence needs redesign |
| 16 | Car add Modal | Pass | Appropriate while form remains short |
| 17 | Car randomization confirmation | Concern | Needs result review/undo strategy |
| 18 | Car row Overflow open | Pass | Low-frequency actions grouped correctly |
| 19 | Team allocation default | Pass | Shared allocation pattern is worth preserving |
| 20 | Team add Modal | Pass | Appropriate while short |
| 21 | Settlement default | Concern | Long equal-weight Tile stack, weak next-action hierarchy |
| 22 | Settlement wizard step 1 | Concern | Long settings task in Modal; unnecessary Back action |
| 23 | Settlement wizard step 2 | Concern | Context needed to judge values is hidden |
| 24 | Settlement wizard step 3 | Concern | Step completion works; full task surface is wrong |
| 25 | Vehicle expense editor | Concern | Repeated list/detail editing constrained to Modal |
| 26 | Extra vehicle expense row | Concern | Dense but usable; draft and delete rules need page workspace |
| 27 | Private-vehicle movement settings | Concern | Nested internal dialog view |
| 28 | Rental movement settings | Concern | Same structural issue; conditional fields remain readable |
| 29 | Route planner empty | Concern | Full workflow begins inside existing expense Modal |
| 30 | Route search results | Concern | Search works in fixture; mobile keyboard not proven |
| 31 | Route candidate selected | Concern | Context-heavy choice needs persistent page state |
| 32 | Route map open | Partial | Visual state reached; map keyboard/screen reader not fully proven |
| 33 | Route options open | Pass | Optional advanced disclosure is appropriate |
| 34 | Expense after route apply | Pass | Draft survived return in test; navigation model remains fragile |
| 35 | Payment breakdown open | Pass | Disclosure is appropriate; Tile nesting is not |
| 36 | Payment marked paid | Pass | In-row state change is clear; failure/undo path still needed |
| 37 | Participant registration Modal | Concern | Long import form should be a page flow |
| 38 | Registration help expanded | Pass | Optional help fits Accordion |
| 39 | Form-linked participants unconfirmed | Pass | State is visible; page hierarchy remains weak |
| 40 | Form-linked participants confirmed | Pass | Confirmation path reached; next tasks need better structure |
| 41 | Guidance generation Modal | Concern | Large form/preview may merit nested page if frequently used |
| 42 | Handoff disabled state | Pass | Reason is visible, not disabled-only |
| 43 | Dark-theme shell | Pass | Token-based theme works in inspected state |
| 44 | Mobile navigation/shell state | Concern | Four contained Tabs remain the practical navigation |

## 24. Traceability to source owners

| Concern | Current owner |
| --- | --- |
| Shell, project title, whole-app Tabs, global Toast | `apps/react/src/App.jsx` |
| Header utilities/app switcher | `apps/react/src/components/AppHeader.jsx` |
| Participant workflow | `apps/react/src/components/Participants.jsx` |
| Participant edit | `apps/react/src/components/ParticipantEditor.jsx` |
| Registration/import | `apps/react/src/components/RegistrationModal.jsx` |
| Car/team allocation | `apps/react/src/components/Allocation.jsx` |
| Settlement/costs/settings/payment | `apps/react/src/components/Settlement.jsx` |
| Route task | `apps/react/src/components/RoutePlanner.jsx` |
| Overview/history/guidance/handoff/bug report | `apps/react/src/components/ProjectTools.jsx` |
| Grid/surfaces/modal/mobile behavior | `apps/react/src/styles.scss` |

## 25. Audit conclusion

The current React UI is not a failed Carbon implementation: it has useful Carbon components, strong compact lists, and working responsive mechanics. Its largest gap is that component adoption came before a stable task/IA model. The target migration should preserve the participant/allocation list foundations and domain contracts while replacing shell-level Tabs, long/nested Modal workflows, settlement card stacking, and notification/CSS over-ownership in dependency order.

## 26. Validation status for this documentation change

- React production build: pass.
- React unit/contract suite: 46/46 pass after restoring the production-mode bundle.
- Legacy protected-file check: 1,296 files unchanged.
- Focused rendered-browser regression: 12/12 pass across Chromium desktop, ~390px Chromium, and ~390px WebKit (modal viewport/footer, focusable controls, menus/disclosure, theme, and horizontal overflow).
- Full UI audit: 44 states × 3 projects = 132 captures/reaches; pass.
- Root CSS lint: pass.
- Generated Carbon/Plex assets: unchanged after regeneration.
- Root static/domain suite: pass after removing three stale source-text assertions that had not followed later committed behavior. No product source or production artifact was changed by these test-only corrections.
- Firebase Rules Emulator: pass against `demo-circle-kikaku-tools`; no production Firebase access.
- Repository-wide browser guard: 57/61 pass. Four pre-existing legacy UI regressions remain outside this audit-only scope:
  1. An empty-seat disclosure remains `aria-expanded="true"` after the test expects it to close.
  2. One allocation row measures 65px against a 64px maximum.
  3. The expected passphrase Modal close button is absent.
  4. Settlement settings validation does not expose step 1 when the test expects it.
- Collaboration job: static and five-device chaos pass, but the deep suite reports existing owner-placement and capacity invariant failures.
- The WebKit legacy suite was not reached by `test:guard` because the Chromium job failed first. React WebKit mobile audit and focused regressions did pass.

Therefore the five documents and the React audit are reviewable, and the test-only contract drift is corrected, but repository-wide `Quality Guard` cannot be honestly reported green. Making it green now would require legacy UI and collaboration/domain repairs expressly outside this documentation-only task.

### Removed source-text assertions and replacement coverage

| Removed assertion | Why deletion is correct | Behavior / contract owner retained in normal guard |
| --- | --- | --- |
| Static `#tab-list[selected]` in `tests/run-static-tests.mjs` | Carbon Web Componentsのselected stateはruntime navigation sync後に反映される。初期HTML文字列へ`selected`があることは、実際のcurrent view、selected styling、keyboard stateを保証しない。 | `tests/carbon-complete.visual.spec.js`はview切替後の`highlighted` property、selected style、全viewportのoverflowを実ブラウザで確認する。`tests/assignment-workspace-refresh.spec.js`は車割/班割click後のactive templateと`aria-current`を確認する。両方とも`test:carbon:complete`に含まれる。 |
| Exact `rendered-qa-v28` cache-buster in `tests/dark-accent-contract.mjs` | Cache-busterはreleaseごとに変わるimplementation valueで、特定の過去文字列を固定してもfresh CSSやtheme behaviorを証明しない。現在値は別変更で意図的に更新済み。 | 同contract testがdark theme token、layer alias、hard-coded accent排除を直接検査する。`tests/carbon-complete.visual.spec.js`がlight/darkのcomputed appearanceとoverflowを実ブラウザで検査する。Exact query文字列の代替assertionは追加しない。 |
| Exact desktop grid `minmax(104px, 132px) minmax(112px, 124px) 48px` in `tests/design-refinement-contract.mjs` | 1つのCSS宣言値はrowの可読性、重なり、touch target、responsive reflowを保証せず、正常なlayout変更も妨げる。 | `tests/settlement-cost-editor-list-v75.spec.js`がmobile light/darkとdesktop light/darkでrow geometry、cell containment / non-overlap、vertical alignment、44px action、modal fit、page overflow、console errorを測定する。`test:carbon:complete`に含まれる。 |

判断基準: exact source textを削除したこと自体を新しいsource-text testで固定しない。壊れた時にユーザーが受ける結果を再現できる既存behavior testが通常guardに含まれるため、3件ともguard strengthを維持している。

`apps/react/migration/protected-files.json`は、この3 test fileのreview済みhashだけを更新する。他のlegacy file hashは再captureせず、React migrationのprotected-file guardを維持する。

### Phase A contract verification

- Five-document structure check: exactly five Markdown documents, explicit role/status, valid local cross-links, one normative Product UI specification, one minimum UI PR checklist.
- Root static/domain contract suite: pass.
- React unit/contract suite: 46/46 pass.
- Focused replacement behavior coverage: 9/9 pass for current navigation selection, Carbon light/dark shell across 320/390/768/1280px, and cost-row geometry across mobile/desktop light/dark.
- React protected legacy check: pass after updating only the three reviewed test hashes.
- Diff / Markdown whitespace checks: pass.
- No production, compatibility, cutover, production smoke, or production Firebase operation is part of this verification.
