# Carbon migration roadmap

Status: normative phase sequence and gates v1.0 (effective 2026-09-29)
Source: [CURRENT_UI_AUDIT.md](./CURRENT_UI_AUDIT.md)
Target contract: [SANPOKAI_PRODUCT_UI.md](./SANPOKAI_PRODUCT_UI.md)

Contract role: Phaseの順序、依存関係、各Phaseのentry / exit gateだけを所有する。画面・interactionのtarget仕様はProduct UI仕様、横断原則は [CARBON_PRODUCT_PRINCIPLES.md](./CARBON_PRODUCT_PRINCIPLES.md)、pattern選択は [CARBON_PATTERNS.md](./CARBON_PATTERNS.md) を参照する。本書の順序はtarget UIを上書きせず、Auditの推奨は本書のPhase gateを上書きしない。

## 1. Sequencing principles

This roadmap is ordered by structural dependency and regression containment, not by visual impact.

1. Freeze user goals, terms, state taxonomy, and protected domain behavior.
2. Establish shell/page anatomy before feature surfaces depend on it.
3. Establish navigation and long-task routing before removing Modals.
4. Migrate the shared allocation/list patterns before feature-specific polish.
5. Migrate settlement only after page/workspace and form/save patterns exist.
6. Treat responsive and accessibility as acceptance criteria in every phase, then run a final cross-product hardening pass.
7. Keep production release/cutover as a separate authorization and gate; documentation completion never triggers deployment.

## 2. Protected invariants across all phases

- Existing data/schema compatibility
- React / legacy compatibility
- Synchronization and outbox behavior
- Firebase behavior and rules
- Settlement calculation results
- Participant identity and confirmation effects
- Vehicle/team/route state
- Existing persistence and shared-link behavior

Each implementation PR must identify whether it is:

- presentation only;
- interaction orchestration using existing store APIs; or
- a separately approved domain/data change.

Do not hide a domain/data migration inside a UI phase.

### Cumulative design invariants by phase

各Phaseのinvariantは、そのPhase以降も累積して適用する。

| Phase | Design invariants that become binding |
| --- | --- |
| A — Foundation | 5文書のrole / precedence、Product UI仕様の規則語、Official guidance / Project interpretationの区別、UI PR checklistを変更理由なしに迂回しない。Phase Aは文書・test contractのみでProduct UIを変更しない。 |
| B — Shell / navigation | 既存room URL、shared link、refresh / backとlegacy destination mappingを維持する。room-only既定着地と主要・補助navigationはProduct UI仕様§2が所有し、概要・履歴を必須stageにしない。すべてのdestinationに1つの`h1`、programmatic current state、navigation後のfocus strategyを持たせ、global / project / page action ownerを混在させない。 |
| C — Shared patterns | 新規Modalはapproved brief-task allow-listに限定する。既存の未移行Modalは担当Phaseと理由を分類し、拡張せず移行対象として残す。Save / Apply / Confirm / Cancel / Close / Back、typed state severity、focus-to-error / focus returnを共通contractにし、日本語message解析でbehaviorを決めない。 |
| D — Overview / participants | Participant identityとconfirm / unconfirmのdownstream effectを変えない。Importはpreview / correction前にcommitせず、productive list densityとsearch / filter / zero-data stateを維持する。 |
| E — Allocation | 全参加者をdragなしで割り当て可能にする。Unassigned、capacity、pin / lock、driver / leaderを失わず、同じ操作は既存と同じserialized assignment stateを作る。 |
| F — Route / costs | Route / movementをnested Modal state machineへ戻さない。Nested navigationでdraftを保持し、同じinputから同じdistance / cost resultを得る。Mapを唯一の情報源や唯一の操作手段にしない。 |
| G — Settlement rules | Calculationはprotected black boxとしてUIで再実装しない。同じinputは同じresultを作り、表示額のrule / sourceとblocking issueから修正fieldへの経路を示す。 |
| H — Settlement operations | Calculated obligation、collection state、recipient payment stateを統合しない。Sync / persistence failureを成功表示せず、history / restore / delete / resetはriskに応じた確認と既存recoverabilityを維持する。 |
| I — Hardening | 重要flowをdesktop Chromium、~390px Chromium、~390px WebKit、light / dark、keyboard、screen reader smoke、reduced motion、200% zoomで閉じる。残るcustom CSSはapp固有理由とtoken / owner / regression testを持つ。 |

## Phase A — Design foundation and enforceable contracts

Status: complete for the documentation contract on 2026-09-29; no Product UI change.

### Goal

Turn the five design documents into an implementation contract; inventory current tokens, CSS ownership, actions, state wording, and installed Carbon API.

### Why this phase comes here

Without a shared vocabulary and measurable rules, later work will repeat component substitution and create new arbitrary CSS.

### Prerequisites

- Target IA and task-surface decisions approved from the audit.
- Project list/creation ownership bounded: Phase B preserves current room/shared-link entry and does not add a new data owner.
- Current user-facing behavior and protected domain tests baselined.

### Screens / flows affected

No intended visual rewrite. Documentation, test helpers, design review checklist, optional story/fixture catalog.

### Shared patterns affected

Page anatomy, action hierarchy, form/save verbs, status taxonomy, empty/loading/error, token usage, accessibility checklist.

### Expected UX impact

No direct production change; subsequent decisions become consistent and reviewable.

### Regression risk

Low for product behavior; medium process risk if rules are not reviewed by maintainers.

### Validation strategy

- Verify the five documents have one authority model and no unresolved default that blocks Phase B.
- Verify Official guidance is distinguished from Project interpretation and every official claim has a Carbon source owner.
- Map removed source-text assertions to user-observable behavior/contract coverage; do not replace them with new source-text assertions.
- Run the documentation-relevant static/contract suite, focused behavior owners, React unit/contract tests, and diff checks. Production release tests are outside this phase.

### Exit criteria

- Terms, save-state definitions, document roles, precedence, invariants, and the UI PR checklist are approved.
- Every future UI issue can cite a user task, normative Product UI section, pattern rationale, and current Phase gate.
- The three removed source-text assertions have stronger or equivalent behavior/contract owners in the normal guard.
- No product UI behavior has changed.

## Phase B — App shell, project context, navigation, and page anatomy

### Goal

Replace whole-app contained Tabs with task destinations and stable page headers. Publish main versus supporting work areas according to the Product UI contract, not a generic project dashboard.

### Why this phase comes here

All long-task migrations need destinations, Back behavior, titles, focus strategy, and state restoration. Building feature pages first would recreate ad-hoc navigation.

### Prerequisites

- Phase A vocabulary and target IA approved.
- Decide routing/history strategy without changing room/share compatibility.
- Define navigation behavior for desktop and mobile.

### Screens / flows affected

Header, project title/context, Overview, Participants, Organization (Car/Team), Settlement, History/Settings entry points.

### Shared patterns affected

Global shell, local navigation, page header, breadcrumb/back, route focus, URL/state restoration, project-level actions.

### Expected UX impact

Users can identify current work area and move through lifecycle tasks; mobile no longer depends on four compressed Tabs.

### Regression risk

High: current tests target tab roles; navigation state and deep-link/share behavior are cross-cutting.

### Validation strategy

- Preserve current room URL and initial selected work area compatibility.
- Browser test direct opening, back/forward, refresh, current-page indication, focus after navigation.
- Desktop + 390px Chromium/WebKit, light/dark, keyboard-only.
- Verify no data mutation merely from navigation.

### Exit criteria

- Every feature has one stable page destination and `h1`.
- Global/project/page actions have separate owners.
- Current user can complete all old flows through the new shell.
- 公開するnavigation labelは実在するtaskだけを約束する。Phase Bでは「履歴」を公開し、設定・danger zoneの公開はPhase Hまで延期する。完成時IAと移行時の公開範囲はProduct UI仕様§2を参照する。

## Phase C — Shared task surfaces, forms, state feedback, and content

### Goal

Create reusable contracts for page forms, short Modals, list/detail workspaces, selection bars, confirmation, notices, and async states.

### Why this phase comes here

Registration, history, route, costs, and settlement all need the same surface/save/focus conventions. Implementing them independently would duplicate behavior.

### Prerequisites

- Phase B page/navigation destinations.
- Typed notice severity and existing runtime error sources mapped.
- Confirm Carbon 1.115.0 stable components; avoid unverified preview APIs.

### Screens / flows affected

Cross-product foundations; one low-risk pilot such as Project Overview edit or participant edit.

### Shared patterns affected

Form layout, draft/unsaved status, Save/Cancel/Apply, focus-to-error, Modal focus return, empty/loading/error, Toast policy, destructive risk tiers.

### Expected UX impact

Actions and feedback become predictable; redundant Toasts and stacked notifications decrease; long tasks have a clear migration target.

### Regression risk

Medium-high: feedback timing and save boundaries touch many flows.

### Validation strategy

- Unit tests for typed notice/status mapping.
- Browser tests for initial focus, tab order, Escape, focus return, invalid submit, retry, draft preservation.
- Screen reader smoke with at least NVDA + Chromium in implementation phase.
- No global `.cds--modal` behavior change until all dependent dialogs are classified.

### Exit criteria

- New Modals are reserved for brief tasks by a reviewable allow-list. Existing long dialogs have an explicit migration classification and owning Phase; their retention is not evidence of design compliance.
- Form/save and notification contracts are used by the pilot.
- No notice severity depends on parsing Japanese message strings.

## Phase D — Project overview, participant import, and participant confirmation

### Goal

Make participant confirmation the operational starting task and move applicant import out of the large Modal while preserving the strong participant list. Overview editing is a supporting task, not a mandatory entry point.

### Why this phase comes here

Participants are the canonical upstream data for allocation and settlement. Their page and identity/state behavior must stabilize before downstream UI migration.

### Prerequisites

- Phases B–C shell, page form, state, and save contracts.
- Registration parser and participant identity behavior protected by tests.

### Screens / flows affected

Overview edit/read, participant registration/import, parse preview/correction, participant list/selection/confirmation, edit/delete, post-confirm actions.

### Shared patterns affected

Long form page, staged import, parse errors, Contained list, search/filter empty states, contextual selection bar, short edit/danger Modal.

### Expected UX impact

Import becomes understandable and recoverable; confirmation remains efficient; the main list retains productive density.

### Regression risk

High: participant confirmation drives car/team/settlement state and form-linked compatibility.

### Validation strategy

- Existing unit/domain tests for registration and confirmation.
- Fixtures: empty, manual, pasted TSV, missing fields, duplicate names, form-linked unconfirmed/confirmed.
- Verify downstream assignment/recalculation results without changing them.
- 390px software-keyboard check, focus to parse error, selection bar safe area.

### Exit criteria

- Import has review/correction before commit.
- Participant list remains at least as scanable as current.
- Confirm/unconfirm effects match current domain behavior exactly.

## Phase E — Allocation workspace: vehicles and teams

Implementation evidence: [Phase E validation](./PHASE_E_VALIDATION.md) records the current candidate, independent review fixes, acceptance gates and integration status. It is not a second normative Product UI specification.

### Goal

Apply the shared allocation pattern to desktop and mobile without losing assigned/unassigned context.

### Why this phase comes here

Allocation depends on stable participant identity and page anatomy, and feeds route/cost/settlement work.

### Prerequisites

- Phase D participant flow complete.
- Pin/lock, capacity, driver/leader, randomization, and delete semantics documented.

### Screens / flows affected

Car allocation, car-out/driver status, team allocation, add/edit/delete groups, randomization, unassigned/empty seats.

### Shared patterns affected

Desktop 2-pane allocation, mobile list/detail/assign, Contained list, contextual selection/move, Overflow actions, randomization review.

### Expected UX impact

Faster recognition of gaps and capacity issues; mobile has an explicit task sequence instead of a long stacked workspace.

### Regression risk

High: assignment persistence, pin behavior, recalculation, and touch/drag behavior.

### Validation strategy

- No-drag keyboard and touch alternative for every move.
- Empty, full, over-capacity, pinned, multiple unassigned, delete, randomize/cancel/review.
- Desktop Chromium, 390px Chromium/WebKit, keyboard, focus return, no overflow.
- Compare serialized assignment state before/after equivalent old/new actions.
- Verify manual and random assignment remain complementary, and the completed allocation can be read and communicated to participants on the event morning. The existing participant-announcement generator is not evidence of car/team announcement coverage.

### Exit criteria

- All people can be assigned without drag.
- Capacity/unassigned issues are visible before completion.
- Car and team share structure without leaking vehicle-only rules.
- Completed car/team membership is readable for the morning handoff; no new publication state or messaging service is implied.
- Named deferred handoff consistency item for final Phase I: include explicit driver/leader role in copied unassigned-person entries, matching the read view; validate both allocation types. This known minor does not authorize removing the role or weakening the normative output contract.

## Phase F — Route, movement, and vehicle-cost workspace

Candidate evidence: [Phase F validation](./evidence/PHASE_F_VALIDATION.md) records task contracts, the independent review and one correction pass, final local browser/Emulator results and protected-owner comparison. At its pre-PR checkpoint, CI/integration remain separate gates recorded in the integration PR. It is descriptive, not a second normative specification; completion requires successful CI and safe integration into `carbon-redesign`.

### Goal

Replace the expense→movement→route Modal state machine with durable list/detail and nested page tasks.

### Why this phase comes here

It depends on shell routing, form drafts, allocation vehicles, and shared async/error patterns. Settlement rules should consume stable cost inputs after this phase.

### Prerequisites

- Phases B–E.
- Define cost draft persistence across nested navigation.
- Route adapter and manual-distance fallback contract protected.

### Screens / flows affected

Vehicle cost list, expense detail, standard/additional costs, movement type, route stops/search/results/map/options/apply.

### Shared patterns affected

List/detail workspace, nested task Back, async search, map/text fallback, formula preview, draft status.

### Expected UX impact

Repeated cost editing becomes faster; route context is understandable; mobile no longer depends on a full-screen-like nested Modal.

### Regression risk

Very high: cost draft, movement formula, route application, map API, and settlement totals interact.

### Validation strategy

- Golden settlement result comparison before/after UI migration.
- Route fixture tests for empty, loading, no result, error, alternatives, map unavailable, apply/back/cancel.
- Verify expense draft survives route round-trip and cancel discards only intended changes.
- Verify each driver can locate their car and input distance/costs independently, including meter-based manual distance. Use two Emulator clients to cover different-car concurrency and existing same-car conflict behavior; do not infer driver identity from anonymous auth.
- Real keyboard and 390px tests; map keyboard/text alternative and reduced motion.

### Exit criteria

- No nested internal Modal view remains for route/movement.
- Existing cost and distance results are byte/number equivalent for the same inputs.
- Route can be completed without relying on the map.
- The vehicle-cost workspace has a direct task entry and car context; equivalent distance tools and per-car domain behavior remain available.

## Phase G — Settlement rules and calculation explanation

### Goal

Move settlement settings out of the wizard Modal and make split, club fee, exemption, deduction, roles, and calculation impact understandable as one rule system.

### Why this phase comes here

Rules depend on final participant/allocation/cost structures. Moving them earlier would validate against unstable inputs.

### Prerequisites

- Phases D–F stable.
- Existing settlement calculation and compatibility tests green.
- Use the Product UI default of a single grouped form; permit a page wizard only when task evidence proves sequential dependency.

### Screens / flows affected

Settlement readiness, mode, organizer/collector, rounding/split, driver compensation, club fee, exemption, deduction, validation, preview.

### Shared patterns affected

Long high-impact form, issue summary, calculation preview, progress indicator if justified, confirmation/save.

### Expected UX impact

Users can see why amounts change and correct blocking setup without repeated Modal open/close cycles.

### Regression risk

Very high: settlement logic is critical and compatibility-sensitive.

### Validation strategy

- Treat domain calculation as a black-box protected owner; UI consumes results only.
- Golden fixtures for normal, standalone, club fee, exemptions, deductions, rounding, negative/extra/concurrent cases.
- Focus to first invalid; screen reader relationship between issue summary and fields.
- Cross-viewport and dark/light tests.

### Exit criteria

- Every displayed amount has an explainable source/rule.
- Blocking issues link to the corrective field/section.
- Same inputs produce identical existing settlement results.

## Phase H — Settlement operations: collection, payouts, history, and danger zone

### Goal

Replace the long settlement Tile stack with overview + focused collection/payment work, and migrate durable history/settings out of Modals.

### Why this phase comes here

Operational tracking needs stable rules/results. History and broad destructive actions also need the page/navigation and state patterns already established.

### Prerequisites

- Phase G rules/result presentation.
- Typed persistence failure/sync-conflict behavior.
- Restore/undo semantics confirmed.

### Screens / flows affected

Settlement overview, collection checks, recipient/driver payouts, paid/unpaid filters, breakdown, memo, history, snapshot/restore, project settings/danger zone.

### Shared patterns affected

Status list, ContentSwitcher/filter, disclosure, immediate state + undo/reversal, optimistic failure, history table/list, destructive confirmation.

### Expected UX impact

Outstanding money movement becomes the dominant task; completion is scanable; broad destructive actions are separated from routine work.

### Regression risk

High: persistent paid/collected state, synchronization, restore, and status wording.

### Validation strategy

- Multi-client Firebase Emulator tests for paid/collected state and conflicts.
- All/unpaid, excluded/exempt, paid reversal, save failure, offline/reconnect.
- History empty/create/restore/cancel/undo, with protected-state comparison.
- 390px sticky/keyboard/safe-area and screen reader state announcement.

### Exit criteria

- Calculated obligation and actual completion states remain distinct.
- State changes are visible without success Toast spam.
- Restore/delete/reset have risk-appropriate confirmation and recoverability.
- Settlement completion is based on existing calculation and collection/payment state, not a new mandatory archive/project-completion stage. History/settings remain secondary recovery utilities.

## Phase I — Cross-product responsive, accessibility, content, and visual hardening

### Goal

Close cross-flow gaps after structural migrations and remove obsolete custom Carbon overrides.

### Why this phase comes here

Responsive/accessibility are gates in every phase, but final cleanup can only remove legacy CSS and normalize wording after target surfaces exist.

### Prerequisites

- Phases B–H complete with per-phase gates.
- Real content lengths and representative datasets available in local fixtures.

### Screens / flows affected

All.

### Shared patterns affected

Grid/spacing/type/layer, touch targets, focus order/return, landmarks/headings, live announcements, reduced motion, Japanese terminology, icon/tooltips, loading/empty/error.

### Expected UX impact

Consistent productive density, robust mobile behavior, clearer Japanese labels, fewer custom surfaces, and lower Carbon upgrade risk.

### Regression risk

Medium-high: broad CSS cleanup can subtly change geometry; semantic fixes can affect selectors/tests.

### Validation strategy

- Full interaction matrix: desktop Chromium, 390px Chromium, 390px WebKit, short viewport, light/dark.
- Keyboard-only and NVDA smoke for all main workflows; axe or equivalent automated scan as supplement, not proof.
- `prefers-reduced-motion`, 200% zoom/reflow, contrast, touch target measurement, no horizontal overflow.
- Remove global `.cds--*` overrides one owner at a time with visual baselines.
- Japanese content glossary review.

### Exit criteria

- No unresolved structural/modal migration item from the audit.
- No critical keyboard/focus/contrast/reflow defect.
- Remaining custom CSS has an app-specific rationale and tokenized values.

## 3. Dependency flow

```text
A Foundation
    ↓
B Shell / navigation / page anatomy
    ↓
C Shared task surfaces / forms / feedback
    ↓
D Overview / participants
    ↓
E Vehicle and team allocation
    ↓
F Route / movement / vehicle costs
    ↓
G Settlement rules
    ↓
H Collection / payouts / history / danger
    ↓
I Cross-product hardening
```

Parallel work is intentionally limited: feature phases share navigation, state, and domain owners. Within a phase, documentation/test fixture preparation can proceed before UI implementation, but overlapping edits to shell, `Settlement.jsx`, or shared styles should remain serialized.

## 4. First implementation slice recommended

Phase Aの次は、one bounded **Phase B shell/page-anatomy slice**とする:

1. 現行room URL、shared link、initial destination、back / refreshをbehavior testでfreezeする。
2. Product UI仕様のApp shell / Page layout / Global invariantsを、既存`App.jsx` / `AppHeader.jsx` ownerへmappingする。
3. Navigation componentを現行`@carbon/react` 1.115.0で検証し、desktop / mobile / focus contractを先にtestする。
4. 主要task destinationとstable page titleを導入し、概要・履歴は補助導線に留める。旧flowを到達不能にしない。
5. 全work areaが到達可能で、navigationだけではdata mutationが起きないことを確認してから、旧whole-app Tabsを段階的に外す。

Do not start with settlement visual polish or arbitrary CSS cleanup: both depend on the target page/navigation structure.

## 5. Integration and production boundary

Phases B–I form one Carbon redesign integration program:

- Use the long-lived `carbon-redesign` branch as the only integration target for each phase.
- Each phase completes through implementation, relevant tests, browser validation, commit/push, PR, CI, and merge into `carbon-redesign`.
- During Phases B–I, do not merge to `main`, dispatch React Production Release, compatibility deploy, root cut over, run production smoke, or write production Firebase data.
- A production hotfix starts from `main` as a separate change and is incorporated into `carbon-redesign` only when applicable.

After Phase I, run the cumulative regression gate across Chromium/WebKit desktop/mobile, accessibility, responsive behavior, Firebase Emulator/shared behavior, Maps/Places/Routes, persistence/sync/calculation compatibility, and final design-contract alignment. Only after every gate passes may `carbon-redesign` open its final PR to `main` and enter the standard same-SHA/same-artifact readiness, release, compatibility, cutover, dedicated-smoke-room, rollback, and cleanup path.
