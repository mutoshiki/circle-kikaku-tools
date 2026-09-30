# Phase D implementation design: participants and handoff

Status: proposed for review, 2026-10-01. No Product UI implementation yet.

This is an implementation design, not another normative Product UI specification. `docs/design/SANPOKAI_PRODUCT_UI.md` v1.1 remains the sole authority. This proposal implements its sections 4–8, 16–20 and the Phase D gates in `CARBON_MIGRATION_ROADMAP.md`. Conflicts must be resolved in the normative owner before implementation, not silently overridden here.

## 1. Intent and phase boundary

The operational starting task is deciding who participates. An organizer reviews form-linked applicants, selects participants, and can add people manually. Confirmed participants then feed car/team allocation and settlement. Overview and history remain supporting destinations; no dashboard, mandatory Overview stage, lifecycle wizard or completion schema is introduced.

Phase D owns participant import/review/correction, participant scanning/selection/confirmation, short participant edit/delete, and participant announcement/handoff entry points. Overview already has Phase C's page editor: preserve it, fix only verified contract regressions. Allocation redesign, route/cost editing, settlement and history remain Phases E–H.

## 2. Evidence and technical constraint

### Current implementation

- `RegistrationModal.jsx` places spreadsheet paste plus six manual text areas in one scrolling dialog. Parsing updates a count/warning paragraph; submit directly calls `addParticipants` without an editable preview.
- `Participants.jsx` uses a Contained list, search/filter and staged choices, but hides the list after form-linked confirmation. Active filters disappear when their controls close. Selection lacks a clear Cancel action, and manual addition is hidden for form-linked projects.
- `GuidanceModal` in `ProjectTools.jsx` mixes date/time/supplement editing and a long announcement preview. Its domain generator and clipboard capability are reusable without changing their outputs.
- At 390 × 844, a fresh offline room exposes search/filter even with zero data, then opens a nearly viewport-sized registration dialog with paste and manual inputs together. The dialog's scroll/footer works; its task structure, not a claimed geometry defect, is the reason to migrate it.

Initial inspection used Chromium and `http://127.0.0.1:4176/?room=PHASE-D-DESIGN-OFFLINE`, synthetic local data only. Entry and Add → registration were operated. The only console error was the existing `/favicon.ico` 404, not a React/runtime exception. No WebKit, dark-theme, populated-state or post-change validation is claimed at this planning stage. Baseline React unit suite: 59 passed on integration base `c9fbf01`.

### Protected registration semantics

There are two different existing data paths:

1. **Automatic form-linked applicants:** existing `applicationSync` data, stable response identity, staged selection, then `applySelection`.
2. **Manual or pasted registration:** existing parser/manual normalization, then `addParticipants`, which creates canonical participants and existing downstream placement/driver effects immediately.

The UI must not turn the second path into a new persistent applicant repository. The input/review remains a local draft until registration. The user must see that registration adds participants, not merely candidates waiting for an unimplemented approval stage.

Normative §8.1 currently says `参加者候補として登録` for all input sources. Before implementation, clarify that section to distinguish automatic applicant confirmation from manual/paste registration and use the truthful final label `参加者を登録` for the existing `addParticipants` path. Keep the review/correction-before-commit invariant. This is a wording/ownership correction grounded in protected behavior and the user's manual-add use case, not permission to weaken review or alter schema.

The existing parser merges normalized duplicate names and emits advisory warning strings. Preserve that policy; show its warnings before registration. Do not invent row IDs, parse-warning severity from Japanese text, reverse the parser's duplicate resolution, or claim that warnings were repaired merely because they were hidden.

## 3. Chosen task structure

### Alternatives

- **Recommended: one durable nested task with input and editable review states.** A single task URL owns source choice, input, review and correction. Back to input retains the draft. This is enough to protect registration and keeps navigation/state ownership small.
- **Separate input and review routes:** enables linking to individual stages, but introduces more history entries and recovery coordination without a demonstrated need. Do not add stage URLs in this phase.
- Retaining the long Modal, or inventing an unverified desktop side panel with a different mobile editor, fails the already-approved task-surface criterion and is not an implementation alternative.

### A. Participant page

- Continue to land room-only links on Participants.
- Keep the compact Contained list available after confirmation; show participant status/count at the existing page-header owner, not a duplicate heading/card inside the feature.
- Read mode shows the current participants. Form-linked selection mode includes the applicants plus existing manual participants, preserving the exact eligibility and identity mappings.
- Search/filter operate in the current list context. Show the result count and applied filter values even with the filter controls collapsed. Distinguish data-empty, search-empty and filter-empty; provide a clear condition-reset action.
- Provide manual/paste registration from both ordinary and form-linked rooms. Zero-data entry has one clear primary registration action; populated read mode uses a lower-emphasis task link. Never publish placeholder navigation.
- Selection has selected count, one `参加者を確定` action and `キャンセル`. Cancel discards staged choices, not participants, filters or assignments. A destructive removal still explains downstream effects and preserves applicant source records.
- Keep short participant edit/danger dialogs, with identifying metadata and names/actions disambiguated only when duplicate display names require it. Do not regenerate participant IDs.
- After confirmation, group the next tasks: car allocation, team allocation, announcement and handoff export. They are links/actions, not equally weighted cards or another mandatory stage. Existing announcement/handoff availability and token checks remain intact.

### B. Registration task

Nested destination: `section=participants&task=import`. SideNav still identifies the Participants work area; the page `h1` is `参加者を登録`. A visible return link identifies the parent.

1. Choose `表データを貼り付け` or `手動入力` using a labeled source control. Only the chosen source fields are shown. Preserve each source draft when switching.
2. Paste keeps the existing parser, heading requirements, column-order handling, inferred grades and warnings. Manual input preserves names entered only in driver/grade areas as well as the main names field; none of the six existing input capabilities is removed.
3. `入力内容を確認` builds a local preview, with no room command. Parsing errors are associated with the input, with focus to the relevant field. Parser warnings and source column information remain visible and distinguishable from blocking errors.
4. Review lists each recognized person with editable name, grade and driver eligibility. Use labeled row controls and identity/context text, not a horizontally scrolling spreadsheet at 390px. Correcting the source is always possible via `入力に戻る`.
5. `参加者を登録` is the only committing action. It passes the reviewed people to the unchanged `addParticipants` command. A blank corrected name blocks submission and focuses its field.
6. Registration stays busy until the existing sync acknowledges completion. Failure retains the draft, reviewed values and retry; navigation does not manufacture success. Successful registration returns to the participant list without a redundant success Toast.

Drafts are UI-local and room-scoped, never Firebase/schema data. Navigation/back/refresh retain unsaved input and reviewed corrections. Explicit Cancel discards only this task's draft; successful registration clears it. Local-storage failure must not discard in-memory input or falsely promise recovery. No new persistence or conflict protocol is introduced.

### C. Announcement task

Nested destination: `section=participants&task=announcement`, with `h1` `参加者発表文を作成` and a parent return link. Preserve the existing date, time, supplement, generated preview and clipboard output. The read-only preview follows the input fields; mobile uses normal page scrolling, not a fixed dialog footer. Clipboard success may use typed transient feedback; failure is contextual with retry and retained fields. This is participant announcement, not car/team announcement or a messaging integration.

Handoff export stays a short registered dialog, with current authorization/ambiguity checks and output unchanged.

## 4. URL, state and focus contracts

- The canonical `section` remains the existing project work area. A narrowly supported `task` query belongs to Participants; unknown tasks and tasks on other sections resolve safely to the parent page without changing room identity.
- Primary navigation clears the child task. Selecting Participants while already in its child returns to the list; it is not rejected merely because the parent section is unchanged.
- Task state is derived from the URL. Do not maintain a competing `registering` boolean that can disagree with refresh/back/forward.
- Direct child URL, refresh and browser back/forward preserve the same room and task. Existing legacy inbound mappings and room-only/shared links remain unchanged.
- A changed section/task moves focus to the existing page `h1`. Initial direct entry does not steal focus. Input → review and invalid submit move focus to the review heading or first invalid field respectively.
- Explicit parent Back/Cancel restores the logical task launcher when it exists; otherwise the participant heading is the fallback. Browser history navigation keeps the route-level heading strategy.
- Preserve parent list search/filter/selection during child-task round trips without persisting new domain state. Never hide a still-editable child in a Modal or leave multiple active task surfaces.

## 5. Carbon evidence versus product interpretation

**Official guidance:** [Modal usage](https://carbondesignsystem.com/components/modal/usage/) says a full page may be needed when large Modal content does not fit the task. [Forms](https://preview.carbondesignsystem.com/building-blocks/core/patterns/forms) covers visible labels, logical form ordering, validation and not hiding required information in Tabs/Accordions. [Form specifications](https://www.carbondesignsystem.com/building-blocks/core/components/form/specifications) support content-dependent column widths and one-column mobile forms.

**Project interpretation:** durable registration/announcement pages, input → editable review → existing commit, and compact participant list/selection are choices for this actual workflow. Carbon does not prescribe the room schema, applicant identity, duplicate-name policy or task URL.

Use installed `@carbon/react` 1.115.0 public components and API, Grid/Column, productive type, spacing/layer/theme/breakpoint tokens. Verify actual exports/props/keyboard behavior before implementation. Retain appropriate Contained list/short Modal patterns; no wrapper Tiles, global Carbon internal selectors, custom focus rings or unverified SidePanel.

## 6. Protected behavior and acceptance

No changes to domain/generated parser/store, Firebase schema/Rules, synchronization protocol, calculations, participant identity/tombstones, driver/group side effects, allocations, routes, costs, club fees/exemptions/deductions, paid state, handoff authorization or legacy source.

Before completion:

- Freeze equivalent registration/confirmation serialized outcomes, including driver-only/grade-only manual names, duplicate normalization, unconfirm downstream cleanup and no identity revival.
- Test no commit before review; corrected preview values reach the existing command; cancel/back/refresh retain or discard exactly the documented draft; failed/shared save does not close or lose input.
- Test linked applicants, zero participants, zero selection, manual additions to linked projects, duplicate display names, active collapsed filters and concurrent source changes.
- Test direct/shared/legacy URLs, child-task history, current-location semantics, keyboard entry/return/invalid focus and protected state after navigation.
- Validate Chromium/WebKit desktop and approximately 390px, light/dark, touch, long content, short viewport, overflow, selection action safe area and announcement copy. Record actual device keyboard/NVDA limitations rather than claiming emulation proves them.
- Run relevant unit/browser/Emulator suites, full PR CI and independent code review. Do not adapt tests to preserve the removed long dialog or fixed source strings.
- Commit/push/PR/CI/merge only to `carbon-redesign`. No main merge, production release/deploy/cutover/smoke/Firebase writes. Feature phases E–H remain deferred.

## 7. Review checkpoint

The requested Phase D is an architectural workflow change, not a one-component replacement. Review this concrete implementation design before writing the task-by-task implementation plan and Product UI code. The sole normative document will receive the registration-semantics clarification alongside the implementation, with this technical constraint recorded in its review evidence.
