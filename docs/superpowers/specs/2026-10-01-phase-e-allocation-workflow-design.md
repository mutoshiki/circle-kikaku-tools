# Phase E implementation design: car and team allocation

Status: written design approved for continuation by user on 2026-10-01; local implementation, cumulative acceptance and independent review fix pass complete on 2026-10-02. Remote CI/integration is separately tracked in [Phase E validation](../../design/PHASE_E_VALIDATION.md).

Integration base: `carbon-redesign` at `3fcdf5ead75fd984098f019ddacf290e5fb0b6d7` (Phase D integrated). Working branch: `codex/phase-e-allocation-workflow`.

### レビュー要点

- Desktopは車／班と未割り当てを同時に比較。Mobileは一覧→詳細→割当。手動移動は1人・1移動先・1操作で行い、ドラッグを必須にしない。
- 人数・上限は全員を含めて表示する。保存値が除外するのは名前の基準になる1人であり、運転手／班長の役割とは別。保存値とUI値の換算以外は変更しない。
- 固定は車割・班割共通のランダム制約。手動移動まで禁止しない。役割の複数人／未設定も既存仕様として保持する。
- ランダムは既存の対象・処理を維持。実行前に変更範囲、実行後に実際の結果を示す。保存再試行で抽選をやり直さない。
- 当日朝用に読み取り専用の結果とコピーを用意。未割り当て等を隠さず、公開状態・送信サービス・架空の完了flagは追加しない。
- URL・focus・同時編集・失敗・回帰testを契約化する。正式仕様の追記は本書承認後の実装PRで行い、本番には反映しない。

## 0. Authority and review boundary

This document is an implementation design, not another normative Product UI specification. [SANPOKAI_PRODUCT_UI.md](../../design/SANPOKAI_PRODUCT_UI.md) remains the sole product authority; its v1.3 incorporates Phase E clarifications without changing protected data meaning. This design implements §1–6, §9, §16–23 and [Roadmap Phase E](../../design/CARBON_MIGRATION_ROADMAP.md#phase-e--allocation-workspace-vehicles-and-teams). [Product Principles](../../design/CARBON_PRODUCT_PRINCIPLES.md) provides official evidence; [Carbon Patterns](../../design/CARBON_PATTERNS.md) provides task-to-pattern selection. [Current Audit](../../design/CURRENT_UI_AUDIT.md) is descriptive, not a competing target specification.

The user approved Desktop group/unassigned comparison, Mobile list/detail/assignment, no-drag manual moves, explainable random allocation, and morning result presentation/copy, and instructed continuation after reviewing this design. Incorporate the clarifications in §12 into the normative owner in the implementation PR; do not silently create a competing contract here.

## 1. Intended outcome and phase scope

By the event morning, an organizer can place the confirmed participants in cars and teams, inspect gaps and roles, make manual corrections to a random result, and communicate the current composition. The tool supports this short operational task; it is not a project dashboard or mandatory lifecycle wizard.

Phase E owns allocation workspace, group creation/capacity/delete, participant moves, fixed/role controls within allocation, random allocation review, and read-only result presentation/copy. Car and team remain independent sibling destinations with a shared interaction anatomy, not new Tabs.

Preserve every current allocation capability, including participant name/grade/memo/mark editing and participant deletion. Those capabilities may move to correctly scoped controls, but do not disappear. Preserve form-linked driver/group creation and updates, manual creation, multiple role holders, role removal, waiting participants, locked waiting participants, and capacity normalization.

Out of scope: route/cost editors, Maps/Places/Routes implementation, settlement rules/calculations/payments, history workflow, project repository, messaging service, authentication roles, publication state, new schema, assignment algorithm, store commands, sync protocol or legacy UI. Existing entrances elsewhere continue working. Phase F owns the shared car-context route/cost deep link; Phase E does not add a duplicate cost editor or a nonfunctional route link.

## 2. Evidence and protected meaning

### Current source and observed UI

- [Allocation.jsx](../../../apps/react/src/components/Allocation.jsx) renders all groups, duplicates the unassigned candidate list beneath each expanded vacancy, and folds the unassigned pool at the page end. Manual group-to-group correction currently requires returning a person to waiting first. Fixed controls are prominent on every row. Random confirmation says only that people will be assigned randomly.
- [room-store.js](../../../apps/react/src/store/room-store.js) owns `createGroup`, `capacity`, `deleteGroup`, `move`, `role`, `editParticipant`, `deleteParticipant`, and `randomize`. They remain the command boundary.
- [canonical.js](../../../apps/react/src/domain/generated/canonical.js) owns group anchoring, deterministic overflow normalization and projection. [roles.js](../../../apps/react/src/domain/generated/roles.js) explicitly separates structural anchor from role. [allocation.js](../../../apps/react/src/domain/generated/allocation.js) owns random eligibility and slots. These generated/domain sources are protected, not UI-edit targets.
- Chromium at 1440×1000 and 390×844, local synthetic room `PHASE-E-DESIGN-LOCAL-2`: registration created two cars; one person was manually assigned and fixed; randomization left that person in the same car and placed the remaining people. The 390px view stacked full group lists; horizontal document overflow was absent in that state.
- Chromium at 1280×900, local synthetic room `PHASE-E-DESIGN-LOCAL-3`: created a team, randomized two members into it and refreshed; the team and members remained visible. Initial `/favicon.ico` returned an existing 404; after refresh the captured console contained no errors. This discovery is not a full browser acceptance result. WebKit, dark, actual touch/software keyboard, concurrent clients and post-change UI have not yet been validated for Phase E.

### Capacity is not role identity

Persisted `group.capacity` counts placements other than `group.ownerId`. `ownerId` is the structural anchor used to name the group, not an asserted driver/leader. A group may have several role holders, or its anchor may no longer have that role. Canonical normalization can replace the anchor when someone moves; retain that behavior.

The initial conversational explanation “capacity excludes the driver/leader” described the usual state, not the general contract. The accurate UI contract is:

- Count all displayed people in the group, including the anchor: `1 + projected members.length`.
- Present the all-person limit: `stored capacity + 1`. For example, stored capacity 3 becomes `4人 / 上限4人`, not an ambiguous `3/3人`.
- Capacity editing uses `割り当て人数の上限（全員を含む）`; convert UI limit to stored capacity by subtracting 1, without changing schema or commands. Preserve current UI's stored 1–99 acceptance as displayed 2–100. Existing larger compatible values are displayed without truncation; changing them still follows the current edit acceptance policy.
- Defaults remain stored car 3 / team 5, presented as all-person limits 4 / 6. This is a count/label adapter, not a different allocation constraint.
- Empty slots are `max(0, stored capacity - projected members.length)`, exactly the current model. Extra drivers/leaders are not subtracted again.
- Display `運転手` / `班長` from each placement's explicit role only. Do not infer the role from group name, anchor or applicant availability.
- The all-person limit describes this tool's allocation setting, not verified legal vehicle seating capacity. Do not claim the UI has verified vehicle safety.

### Fixed and random meaning

`participant.locked` is shared across car/team allocations. It excludes that person from randomization in either type, even while waiting. It is not a ban on an explicit manual move and does not protect a person from all normalization, capacity changes or participant removal.

Randomization uses the unchanged domain eligibility helper: unlocked waiting/member placements with role=false may move; locked people and explicit role holders do not move. Both already-assigned and waiting eligible people are in scope. A group anchor whose role was removed is not automatically protected. Insufficient slots may leave people waiting. No UI-specific balancing criteria, “waiting only” mode, seed, fairness claim or guarantee that everyone is assigned is added.

## 3. Chosen structure and alternatives

**Chosen:** Desktop comparison workspace with group/member lists and a visible unassigned pool; Mobile summary list → group detail → assignment task. Both use the same stable IDs, projections, command boundary and URL task model.

**Rejected:** list/detail on all widths reduces Desktop simultaneous comparison; drag-first board makes variable-length groups and Mobile/keyboard operation harder without a demonstrated benefit. No drag is introduced in Phase E. A future drag enhancement must supplement, not replace, the selection/move path.

### Root page anatomy

Keep the Phase B shell, project context and one `h1` (`車割` or `班割`). Header summary owns all-person assigned/unassigned counts and group count; do not repeat the same toolbar summary inside the feature. Capacity/role issues belong near the affected group with a compact page-level summary when needed. Unassigned people, insufficient available slots and missing roles are different facts; multiple role holders are valid data, not automatically an error. Canonical state normally resolves over-capacity by returning overflow members to waiting, so inspect that actual outcome instead of expecting a persistent over-capacity card. Do not derive a new readiness/completion flag from these counts.

- Desktop at Carbon `lg` and above: group/member workspace and unassigned pool are simultaneous columns in Carbon Grid. Groups form compact stacked lists, not decorative cards. Keep document scrolling as the primary scroll owner; do not add competing fixed-height list scrollboxes. The pool is not collapsed by default.
- Below `lg`: use the drill-in anatomy rather than forcing a narrow two-pane workspace. At ~390px the root has compact group summaries, visible unassigned count with a task link, and the next useful action. It does not stack every group's full member list and candidate list.
- Each summary has group name, total people/limit, actual driver/leader names (or missing-role status), and empty-slot/issue information. Long and duplicate names wrap and are disambiguated using available grade/mark/group order metadata, never raw participant IDs.
- Normal root is a read/adjust workspace with no permanent Primary. `車を追加` / `班を追加` and `ランダム割り当て` are Tertiary; `結果を確認・コピー` is a task link. If participants exist but no groups exist, group creation is the single empty-state Primary. With no participants, the task link goes to Participants; do not create a second registration owner.

## 4. URL, responsive and focus model

Extend UI navigation narrowly; preserve the current participant task API and every existing room/shared/legacy URL mapping. The allocation type still comes from `section`, not a second stored active-type flag.

| Destination | Canonical query addition | Surface / return |
| --- | --- | --- |
| Root allocation | no allocation task or group parameter | Current car/team work area |
| Group detail | `task=group&group=<stable group ID>` | Mobile dedicated detail; Desktop focused group plus pool; return to root |
| Assign into group | `task=assign&group=<stable group ID>` | Mobile candidate selection; Desktop targeted group plus candidate context; return to that group |
| All unassigned | `task=unassigned` | Mobile people with destination selection; Desktop pool-focused workspace; return to root |
| Result presentation | `task=presentation` | Read-only car/team composition; return to root |

Group creation, small capacity edit, participant edit and destructive confirmation remain short registered dialogs, not new task routes. Random confirmation is defined in §7.

- URL owns durable destination. Local state owns only temporary selection/editor state; it must not duplicate the active route. Primary work-area navigation clears allocation task/group parameters without breaking participant tasks or unrelated launch parameters.
- Direct task URL, refresh and browser Back/Forward stay in the correct room, type and group. Unknown tasks, mismatched type or missing/deleted groups render the parent with a concise contextual explanation; do not recreate deleted data or crash. Do not declare a group missing while initial room loading is unresolved. Invalid allocation parameters are canonically removed with replace, not a new history entry or a rewrite of room/launch identity. A concurrent deletion abandons only that group's local selection.
- Resizing retains the same task, selected person and semantic destination. It changes layout, not domain state or history entries. Do not auto-navigate on a breakpoint.
- Changed section/task/group focuses `h1`; direct initial entry does not steal focus. Explicit parent return restores the logical group/task link (including list position) when present, otherwise the parent heading. Browser history uses heading focus. Modal dismissal returns to its logical trigger or surviving parent control.
- Assignment does not lose focus when the candidate row disappears: focus the next remaining candidate, or the group heading if none remains. Announce the updated count/status without duplicating full list readout.
- UI-local selection is not committed until the labeled move action. Cancel clears selection only; browser navigation may clear ephemeral selection and retains committed assignments. Do not promise refresh restoration of a not-yet-applied selection or introduce a Firebase draft.

## 5. Manual placement and correction

The repeating interaction is one person → one destination → one `車へ割り当て` / `班へ割り当て` action. Direct group-to-group moves call the existing `move` once; no intermediate waiting command is required. Bulk assignment is not introduced because existing commands do not provide an atomic bulk transaction.

- In the Desktop pool, a person is selectable and a labeled destination control lists groups with current empty-slot information. Exactly one contextual Primary completes the selected move. A group entry can preselect the destination without committing.
- Mobile group detail shows members first, current roles/limit, then `参加者を割り当て`. Its assignment task lists unassigned candidates and has the same single selection/apply model. Each completed move updates the group and candidates, allowing repeat placement without a new Modal per person.
- In any group, the frequently needed `移動` action is discoverable outside Overflow. Its inline labeled destination form has one move action and Cancel. It can choose another group or waiting. Do not hide group-to-group correction solely inside rare-action menus.
- Full destinations show their limit and cannot accept an ordinary additional member. If no target can accept the person, explain the current constraints and offer group creation/capacity editing or waiting as appropriate. Recheck the latest room and use the existing command to validate; stale UI availability is not an authorization to overwrite a concurrent placement.
- Do not disable manual moves merely because the person is fixed or has a role. Explain that manual moves retain those attributes; render the actual normalized outcome, including changed group anchor/name or remaining role issues.
- A move failure retains the selected person/destination if they still exist. If a participant is deleted or a group disappears, clear only the invalid selection and explain the changed context.
- Use existing insertion/order semantics; do not add member-reordering, group sorting or a new assignment algorithm in this phase.

## 6. Group and participant controls

| Operation | Placement and behavior |
| --- | --- |
| Group creation | Short dialog: choose the existing eligible waiting person and total limit, explicit Add. Existing command sets the initial role; choosing a person does not redefine applicant car-out availability. |
| Capacity edit | Group Overflow/detail; explicit Save. Show a reduction warning if the new limit is below the current people count. Explain that overflow members return to waiting; do not predict their identities with a second algorithm or promise fixed people are immune. |
| Group delete | Overflow last, divider, Danger confirmation naming the exact group. Explain members return to waiting, not that participants are deleted. Retain current domain/downstream effects. |
| Random-fixed toggle | Visible fixed state on the row; action in participant Overflow/detail by default. Label `ランダム割り当てで固定` / `固定を解除`, with the car/team shared effect explained. No new per-type lock. |
| Driver/leader role | Participant Overflow/detail, actual role status visible. Allow current multiple/no-role states. Role removal does not delete the group or rename it by UI inference. |
| Name/grade/memo/mark | Existing short participant editor. Group naming follows the unchanged anchor/name projection; no independent vehicle/team nickname schema is added. |
| Participant removal | Participant Overflow last, Danger confirmation with identifying context. Preserve current participant tombstone and downstream cleanup; do not confuse it with returning to waiting. |

Existing group creation eligibility and participant edit/source-authority constraints remain unchanged. A participant's current role is not the same as applicant car-out availability. Do not grant a new manual override of form-linked source fields.

Dialog field errors associate with the correct input and focus it on invalid submit. Initial focus, focus trap, Escape, accessible close label and logical return are verified at composition level. A rejected operation does not close the editor or erase its field values.

## 7. Random allocation: explain, execute once, inspect

`ランダム割り当て` is a visible Tertiary tool, not the page goal or an automatic step after group creation.

1. Open a brief confirmation showing type, number of eligible people, fixed/role-preserved counts and the fact that existing unlocked non-role assignments can change. Insufficient space or fixed waiting participants remain visible as relevant constraints. Label the action `ランダムに割り当て`, not `実行`.
2. Compute eligibility with the existing domain helper, not a parallel UI policy. Revalidate scope on submit. If the current type's membership/group limits, affected identities/roles/fixed attributes or reset generation have changed since the presented summary, that submit issues no command: show the updated summary with `割り当てが変更されました。内容を確認してもう一度選んでください。` and let the next explicit submit use it. Unrelated cost/memo updates do not require this extra review. Cancel/Escape changes nothing.
3. Execute the unchanged `randomize` command exactly once. No speculative mutation, second random run to generate a preview, new persisted undo snapshot or hidden seed. No attempt to turn current random assignment into a balancing solver.
4. Show the actual resulting composition and unassigned/role/capacity issues in the normal workspace. After local application, distinguish `共有保存中` from acknowledged result and failure. Focus the result summary after dialog dismissal; manual corrections stay available when the operation is settled.

Disable with a nearby reason when no groups or no eligible people exist. A lack of spare space is explained as possible redistribution/remaining waiting, not falsely treated as proof that randomization can do nothing. Locked waiting people remain waiting unless explicitly moved by the user.

## 8. Morning result presentation and copy

`結果を確認・コピー` opens a durable read-only task for the current type. This is not the existing participant announcement generator and not a new “publish” workflow stage.

- Show project context, `車割の結果` / `班割の結果`, current issues, each identifiable group, actual driver/leader labels, members, all-person count/limit, and unassigned people. A missing/multiple role state is faithfully represented; the group-name anchor is not silently presented as driver/leader.
- Provide a read-only plain-text preview and one `車割をコピー` / `班割をコピー` Primary. Copy is optional; users can read the result aloud or inspect it directly. No mandatory finishing screen or completion flag.
- Text order is project name (when set), allocation type, groups in existing projected order with member/role labels, then `未割り当て` and any relevant role/capacity problems. Ordinary no-issue output does not gain an artificial “完了” assertion. Participant private notes/marks/grades, costs, application tokens and internal IDs are not included in the copied text.
- Generate display and text from the same current canonical projection and stable identities. No editable second assignment list; changes made elsewhere update the preview. Preserve every duplicate-name person rather than merging equal labels. Group order/name context can distinguish groups; if names still cannot be distinguished in copied text without the omitted metadata, show a same-name warning in the presentation and direct the organizer to check the on-screen participant attributes. Do not fabricate unique names or IDs in output.
- Pending/failed relevant shared allocation saves are clearly shown; copying is disabled until their disposition is known. Unassigned or missing-role issues alone do not hide the result or force a wizard: output retains those issues and is never labeled complete. Preserve UI-local inspection while connection recovery is pending.
- Clipboard success may use typed transient feedback. Failure stays near the preview with retry and selectable text as a fallback. No posting integration, share permission, export schema, PDF/print implementation or publication timestamp is introduced.
- User decision (2026-10-01): do not display or copy a random-allocation provenance statement in Phase E. Neither automatic provenance nor an organizer-declared creation-method control is in scope. A future enhancement requires its own design and, for reliable cross-device provenance, separately approved persistence/sync scope; historical `lastAutoAssignLabel` is not evidence of the current result's creation method.

## 9. Save, failure and concurrency

Allocation remains a series of existing immediate commands, not a new page-wide draft/Save. Small attribute forms have local draft → explicit Save; move/random/delete/role/fixed actions commit their existing logical unit. Cancel does not reverse a command already applied locally.

- Capture the operation-specific identity/changed paths from the existing intent flow. Disable duplicate invocation in the active action context, show local-applied/shared-pending/failed/acknowledged disposition, and keep other unrelated feature state intact.
- Retry an applied operation through existing sync facilities using its original operation/payload, not by invoking randomize again, making a new group/ID, or replaying an already-acknowledged role toggle. A conflict/reset is not success. Never use “any outbox drained” as proof that this operation was accepted.
- Retain only bounded UI-owned receipt/input necessary for the unresolved action, namespaced by room/type/operation so navigation/refresh cannot authorize a fresh shuffle or group creation. Clear resolved receipts; invalidate stale reset generations without replaying them. Storage failure retains in-memory context and warns that refresh recovery is unavailable. No whole-room copy, token or alternate sync protocol. If endpoint acknowledgement or adjustment cannot be identified safely through existing APIs, keep the state unresolved and contextual rather than weakening the success contract; record the constraint before implementation proceeds.
- Domain normalization wins over optimistic intent. Report adjusted outcome and show the actual current room; do not silently move the person back, compensate by overwriting another client, or replay old patches over later acknowledged edits.
- After navigation/unmount, an asynchronous completion must not steal the new page's focus, reopen a dialog or manufacture a fresh success. Shared status uses Phase C's typed feedback/state contracts; visible row/count changes need no success Toast.
- UI editing/assignment does not overwrite participant, other allocation, cost, route, settlement or payment data. Compare all protected fields after equivalent actions, including legitimate existing downstream effects rather than requiring them to be frozen incorrectly.

## 10. Carbon evidence, composition and accessibility

**Official guidance:** [Contained list usage](https://carbondesignsystem.com/components/contained-list/usage/) groups related items and supports interactive/inline actions; deeply nested complex lists and multiple column headers need another pattern. [Modal usage](https://carbondesignsystem.com/components/modal/usage/) limits interruption to short, infrequent tasks and advises doing repeated tasks on the main page. Larger scrolling tasks may need a full page. [2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/) supplies responsive columns/breakpoints. [Accessibility](https://carbondesignsystem.com/guidelines/accessibility/developers/) includes product composition and focus responsibilities.

**Project interpretation:** simultaneous Desktop pool, Mobile drill-in, one-person move selection, all-person count adapter, random scope explanation and read-only morning presentation are Sanpokai workflow decisions. Carbon does not prescribe allocation capacity meaning, eligibility, algorithm, role cardinality, URL names or text output.

Installed `@carbon/react` is 1.115.0. Verify actual public props/DOM/keyboard before implementation. ContainedListItem's interactive controls belong in its `action` slot, not inside ordinary `children`. Do not hide its header through internal CSS: render the useful list heading once with public `label`/`action` composition. If the desired selectable anatomy cannot fit that contract, use a semantic list with public Carbon form controls and document the owner-local reason, rather than claiming a bespoke interaction is provided by Carbon.

- Use Grid/Column and public breakpoint, spacing, productive type, color/layer/theme tokens. Remove allocation-owned arbitrary grid widths and internal header overrides when replacing their owners; do not refactor unrelated feature CSS.
- One `h1`, named group/selection regions, semantic list and visible labels. Current work area remains marked by the shell. Role/fixed/issues use words as well as icons/color.
- Every action works by keyboard and touch; no hover/drag/long-press dependency. Selection state and destination association are programmatic. Single-primary contexts remain identifiable.
- Preserve Carbon focus styling and logical visual/DOM order. Touch triggers meet product 44px-equivalent hit target; no new sticky footer. Respect reduced motion, long names, dark theme, safe-area padding and short viewport without horizontal document overflow.
- Loading/error announcements are local and concise. Real software keyboard, native screen reader and device safe-area limitations are reported, not claimed proven by viewport emulation.

## 11. Acceptance and regression evidence

Before product code, freeze observed behavior with focused contract tests. Tests protect outcomes, not the obsolete ghost variant, toolbar margins, internal CSS classes or requirement to show every full group on Mobile.

| Area | Required evidence |
| --- | --- |
| Domain parity | Same IDs/commands/clock/random produce equivalent normalized placements, roles, fixed attributes, capacities and downstream state before/after UI adapters. Domain/store/generated/Firebase/shared source remain unchanged. |
| Capacity | All-person display/edit round-trip; stored car/team defaults; full destination; minimum/maximum/legacy larger value; shrink overflow and fixed overflow; concurrent last-slot normalization. No role/anchor conflation. |
| Roles/identity | Anchor with role removed, non-anchor and multiple role holders, no-role group, anchor moved/replaced, locked assigned/waiting person, manual move of fixed person, duplicate names, linked-source updates. |
| Manual flow | Waiting→group, group→group, group→waiting; Cancel no command; command failure retained selection; participant/group deleted during selection; command-specific busy and focus after disappearing row. |
| Random flow | Cancel unchanged; assigned and waiting eligibility; fixed and explicit roles preserved; no groups/no eligible reason; insufficient slots; changed scope before submit; applied failed save retries same result, not a second shuffle. |
| Read/copy | Same projection/text, correct actual roles and all-person counts, unassigned/issues included, private metadata omitted, refresh/deep link, clipboard error/fallback, relevant pending save not falsely completed. |
| URL/focus | Room/shared/legacy entry, task/group direct entry, refresh, Back/Forward, participant tasks unchanged, invalid/deleted group fallback, resize no route mutation, parent return/keyboard heading/Modal return. |
| Browser | Chromium/WebKit Desktop and ~390px, light/dark, keyboard and emulated touch, long/duplicate names, empty/populated/full/short viewport, overflow, focus, pending/error/danger states; before/after evidence. |
| Emulator/shared | Two clients moving into last slot, moved/fixed/role/group persistence after reload, independent car/team changes, conflict/reset/retry, unrelated participant/cost/route/settlement/payment values preserved per existing rules. No production endpoint. |

Relevant existing owners include `apps/react/tests/domain.test.mjs`, `store.test.mjs`, `project-navigation.test.mjs`, `tests/browser/allocation.spec.js`, `app-shell-navigation.spec.js`, `tests/emulator/room-sync.test.mjs` and `tests/browser-emulator/sync.spec.js`. Add focused UI contracts where these do not cover new composition. Keep protected calculation/compatibility tests; do not delete them because the interface changed.

Run relevant tests first, then the Phase E acceptance browser matrix and required PR CI. Compare failures to the integration base by test identity; do not recapture a protected legacy manifest or weaken assertions to hide baseline issues. Verification here defines future acceptance, not a claim that those checks have run.

## 12. Normative clarifications and implementation handoff

Following written approval, update Product UI §9 in the same implementation PR to explicitly own:

1. Capacity display/edit counts everyone; storage excludes the structural anchor. Role status remains separate, including multiple/no-role cases. This corrects ambiguous role-based wording without changing protected data meaning.
2. Manual correction has a discoverable one-person selection/destination action and uses existing single commands; fixed is a random constraint, not a manual move prohibition.
3. Random review uses actual existing eligibility and explains reassignment of already-assigned people, insufficient slots and fixed waiting people. No fake preview/undo or algorithm change.
4. Morning result presentation/copy is read-only, uses the same canonical projection, retains issues, and adds no publication/messaging/persistence state.
5. Task/group URLs extend the Phase B navigation model, with invalid/deleted destination fallback and logical focus return. Group/participant dialogs stay brief.

Implement only after written-spec approval and the reviewed implementation plan. Keep units separated: allocation presentation adapter, route/task orchestration, group/member/pool views, short editors/confirmation, morning read/copy, and operation-specific UI feedback. Reuse Phase C/D patterns only where the contracts fit; do not rename participant APIs into an incompatible global task API or entangle allocation with settlement.

Commit/push/PR/CI/merge only to `carbon-redesign`. No merge to main, Production Release dispatch, compatibility deploy, cutover, production smoke or production Firebase write. Phase E completes only after implementation, tests, real-browser acceptance, required CI and safe integration; this document alone is not completion.
