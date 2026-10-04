# Phase F: Vehicle-cost workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 各ドライバーが対象車の距離・費用を入力し、ルート計算から距離を適用して、その車だけを安全に保存できるdedicated workspaceを実装する。

**Architecture:** URL owns section/task selection; a UI-only per-car controller owns unfinished input and exact save receipts. Existing settlement projection, canonical conversion, scoped store intents, sync, and route services remain the domain owners. Desktop exposes list/editor together; below Carbon `lg`, the same single editor becomes a durable drill-in page.

**Tech Stack:** React 19.2.8, `@carbon/react` 1.115.0, existing Carbon Sass/layout tokens, Node test runner, Playwright 1.61.0, demo Firebase Auth/RTDB Emulator.

**Spec:** [Approved Phase F design](../specs/2026-10-02-phase-f-vehicle-cost-workspace-design.md). [SANPOKAI_PRODUCT_UI.md](../../design/SANPOKAI_PRODUCT_UI.md) is the sole normative Product UI specification; this plan is execution guidance, not another specification.

Status at the pre-PR checkpoint: Native execution approved. Tasks 1–8 are committed and verified; Task 9 independent review, its single correction pass and final local cumulative gates are verified. PR CI and `carbon-redesign` integration remain in progress and are recorded separately in the integration PR. Checkboxes below preserve the approved execution instructions; actual local outcomes are recorded in [Phase F validation](../../design/evidence/PHASE_F_VALIDATION.md).

## Global Constraints

- Working branch: `codex/phase-f-vehicle-cost-workspace`; integration base: `carbon-redesign` at `f232d8d7de2c2077255c47e7f6e02f0085cfda77`.
- No merge to `main`, React Production Release dispatch, compatibility deploy, root cutover, production smoke or production Firebase write in this phase.
- Preserve generated domain, route service/adapter semantics, store, sync, Rules, room storage and legacy owners byte-for-byte.
- `lg` and above: fee list and selected editor share one Grid with no nested vertical-scrolling cages. Below `lg`: one task surface at a time. Installed `lg` width: 1056px.
- Render one active expense form. No duplicated hidden desktop/mobile editors, duplicate input IDs or two save owners.
- Save/Cancel follows active form/result. No unconditional fixed/sticky action tray in Phase F.
- Route Apply changes only the selected car's draft; car Save is the shared-write boundary.
- Keep the existing `sanpo.routePlannerState.v2:<roomId>` local itinerary key/format readable; do not migrate it to Firebase.
- Keep `@carbon/react` 1.115.0 and existing dependency/lockfile versions; inspect actual public exports/props/keyboard behavior before composition.
- Save during IME composition is ignored. Do not tighten accepted numeric/domain semantics or substitute financial formulas.
- One `main`, active task `h1`, current navigation semantics, 44px-equivalent icon/menu hit areas, Carbon focus and reduced-motion handling.
- Real Chromium and WebKit, Desktop and approximately 390px, light and dark; no production data/configuration or live production Maps smoke.

## Review Focus

1. Duplicate display names and standalone name-only cars: never infer a unique financial identity from a visual suffix; characterize target/write scope before enabling Save (Task 1).
2. Reload after an unacknowledged Save: retry the original operation/payload/extra IDs, not a newly normalized car or a new command (Task 3).
3. A resolved place arrives after stop reorder/removal or another car opens: it must not replace a different stop or clear the new request's busy state (Task 5).
4. A hidden fee is invalid while saving from another mobile fee: reveal/focus that fee rather than discarding input or silently disabling the action (Tasks 1, 4).
5. Route entered from allocation: Apply must open that car's unsaved movement editor, keeping a separate safe return link to the same allocation group (Tasks 2, 6).

---

## Execution setup and file ownership

Run commands from `apps/react` unless explicitly marked repository root. Use `F:/nodejsss/npm.cmd` / `F:/nodejsss/npx.cmd` on this host. Preserve the primary checkout's unrelated changes and this worktree's historical untracked artifacts.

Before any offline test command, set the test target in the same PowerShell process:

```powershell
$env:SANPO_TEST_FIREBASE_TARGET = 'offline'
$env:SANPO_TEST_FIREBASE_PROJECT_ID = 'demo-circle-kikaku-tools'
$env:SANPO_TEST_FIREBASE_DATABASE_URL = 'http://127.0.0.1:9000'
node tools/assert-test-target.mjs offline
```

Reject ambient production configuration through that guard; do not print secrets or reinterpret a staging-named production config as safe. Every RED/GREEN command below includes this preflight. A RED caused by environment/port failure is not a valid behavior RED.

| File owner | Responsibility |
| --- | --- |
| `src/ui/vehicle-cost-target.js` (new) | Exact existing car target, safe allocation entrance, fee locators, typed validation associations |
| `src/navigation/project-navigation.js` | Durable cost task URLs, compatible inbound navigation, validated return context |
| `src/ui/vehicle-cost-draft.js` (new) | Narrow UI-only cache; in-memory fallback on storage failure |
| `src/ui/vehicle-cost-save.js` (new) | Cost-only bridge to existing edit/conversion/intent and receipt helpers |
| `src/ui/vehicle-cost-controller.js` (new) | Per-car raw input, recovery, frozen submission, preview and draft lifecycle |
| `src/components/vehicle-costs/VehicleCosts.jsx`, `ExpenseEditor.jsx` (new) | List/workspace, active movement/extra form; no domain math |
| `src/ui/vehicle-route-controller.js` (new) | Per-car working itinerary; query/input revision fences; ephemeral predictions |
| `src/components/vehicle-costs/VehicleRoute.jsx`, `PlaceSearch.jsx` (new) | Route/search/map page composition and keyboard/text alternative |
| `src/App.jsx`, `components/ProjectShell.jsx`, `components/Settlement.jsx`, `components/Allocation.jsx`, `components/allocation/AllocationWorkspace.jsx`, `styles.scss` | Common entrances, page model, focus/return, removal of obsolete cost dialog owner; owner-local layout |
| `tests/vehicle-cost-*.test.mjs`, `tests/vehicle-route-controller.test.mjs` (new) | Target/draft/save/async contracts |
| `tests/browser/vehicle-cost-workspace.spec.js`, `tests/browser/vehicle-route.spec.js`, `tests/browser/vehicle-cost-fixture.js` (new) | Offline observed behavior, delayed route adapter, geometry and semantics |
| `tests/browser-emulator/vehicle-cost-workflow.spec.js` (new) | Exact write/receipt, concurrency, reset and reload behavior |
| Existing navigation/settlement/negative/route/browser suites | Retain meaningful behavior and replace only obsolete dialog/source/geometry assumptions |

No generic repository/service rewrite, global cache refactor, new dependency, side panel abstraction or separate fee-save endpoint. A narrow new UI adapter can reuse existing public helpers without changing their semantics.

## Task 1: Characterize protected targets and validation; implement the UI target adapter

**Files:** Create `apps/react/src/ui/vehicle-cost-target.js`, `apps/react/tests/vehicle-cost-target.test.mjs`; retain `apps/react/tests/settlement-edit.test.mjs` unchanged unless adding characterization.

**Interfaces:**

- Consumes `store.domain.settlementInput(room) -> {data,state}`, `domain.settlement.calculateSettlement(data,state)`, existing readiness `fields`/`rows` and existing negative-input predicates.
- Produces `vehicleCostTargets(room, domain) -> Target[]`; `Target = {key, car, editable, reason}` with `car` the existing projection object, keys `participant:<participantId>` or `name:<exactName>`.
- Produces `resolveVehicleCostTarget(targets, key) -> Target|null`; `vehicleCostTargetForGroup(room, domain, groupId) -> Target|null` using existing group/anchor identity, never explicit driver-role guessing.
- Produces `vehicleCostFees(carState, domain) -> Fee[]`, `Fee = {key,row,kind,editable,removable}`; movement key `movement`, existing extra ID opaque, idless original row assigned UI-only session locator.
- Produces `validateVehicleCost({data,state,target,domain,fees}) -> {fields:[{feeKey,field,message}],valid}`. Read readiness field associations on a target-only car projection; human messages are content only. Match existing negative validation without message-prefix parsing. Do not block on other cars/global rules.

- [ ] **Write characterization and adapter tests.** Use `createRoomStore`, fixture, and `createReference` from existing `tests/reference.mjs`. Pin these assertions with explicit named cases:
  - `ID targets preserve cost anchors rather than driver-role accounts`: keys match `data.cars` participant IDs, including multiple/missing driver roles.
  - `name-only standalone target retains exact fallback key`: `resolveVehicleCostTarget(targets, target.key).car.name === originalName`, including Japanese/colon/slash names.
  - `duplicate-name projection never enables guessed financial Save`: compare ID-scoped conversion with pre-edit canonical entries; if isolation cannot be proven, `editable === false` and a reason exists, without changing the projection owner.
  - `hidden invalid fee produces a field destination`: missing named-extra amount yields that fee's `amount`; another car's missing distance does not enter the target's field set.
  - `zero blank large signed and dormant values retain baseline acceptance`: negative magnitude invalid, signed category with positive magnitude valid, amount `1000000000` / distance `1000000` accepted as before; blank/pending normalization characterized, not newly prohibited.
- [ ] **Run RED:** `node --test tests/vehicle-cost-target.test.mjs`. Expected missing adapter export or assertion failure, not a Firebase guard failure.
- [ ] **Implement the interfaces above** in the UI adapter. Reuse the existing structured `fields` set; map fee locations before normalization so idless locators never become mutable array-index contracts. Keep normalization acceptance separate from readiness display. Ambiguous identity retains input and refuses guessing; if safe narrow handling requires protected-owner changes, stop for separate approval.
- [ ] **Run GREEN:** `node --test tests/vehicle-cost-target.test.mjs tests/settlement-edit.test.mjs`. Expected all cases pass, no skips; scoped-write tests compare unchanged other-car/settings/collection values.
- [ ] **Commit at repository root:** `git add apps/react/src/ui/vehicle-cost-target.js apps/react/tests/vehicle-cost-target.test.mjs` then `git commit -m "feat(react): define safe vehicle cost targets"`.

## Task 2: Durable cost URLs and safe return context

**Files:** Modify `apps/react/src/navigation/project-navigation.js`, `apps/react/tests/project-navigation.test.mjs`; create `apps/react/tests/vehicle-cost-navigation.test.mjs`.

**Interfaces:**

- Produces `readVehicleCostTask(href) -> Destination = {carKey,task,expenseKey,stopKey,returnTo,invalid}`; `task` is `''|'expense'|'route'|'route-search'`.
- `returnTo` is `null | {section:'settlement'} | {section:'organization-car',groupId}`. Encode the validated destination as `return=settlement` or `return=organization-car&returnGroup=<existingGroupId>`; never accept arbitrary URLs. Group existence is resolved after load by the target adapter.
- Navigation adds `getVehicleCostTaskSnapshot() -> stable JSON string`, `vehicleCostTaskHrefFor(destination) -> href`, `navigateVehicleCostTask(destination) -> changed:boolean`, `replaceVehicleCostTask(destination) -> changed:boolean`.
- Cost URL uses `section=vehicle-costs&car=<encodedKey>`, plus `task=expense&expense=<key>`, `task=route`, or `task=route-search&stop=<locator>`; URL selection is the only active-page owner.

- [ ] **Write tests with fake history/event target using the existing navigation test harness.** Assert URL round trip for `participant:p1` and `name:田中/車`; no arbitrary `return=https://...`; room/shared parameters survive. `navigate('participants')` clears `car`, `expense`, `stop`, `return`, `returnGroup`, `task`, `group`, `view`, `allocation`; initial room-only remains participants. Popstate restores the precise task; refresh parsing is identical. Nested task return retains its validated caller; Apply destination is always expense/movement, never directly allocation.
- [ ] **Run RED:** `node --test tests/vehicle-cost-navigation.test.mjs tests/project-navigation.test.mjs`; new contracts fail, old inbound contracts remain passing.
- [ ] **Implement the navigation signatures.** Validate syntax at URL owner; resolve actual car/fee/stop/group only after room load at workspace owner. Compare canonical href for navigation changes, not just section strings. Removing an invalid target uses `replace`, never adds a history loop or selects the first car.
- [ ] **Run GREEN:** same command; all deep-link/legacy/back/refresh tests pass without assertion relaxation.
- [ ] **Commit:** `git add apps/react/src/navigation/project-navigation.js apps/react/tests/project-navigation.test.mjs apps/react/tests/vehicle-cost-navigation.test.mjs` then `git commit -m "feat(react): add durable vehicle cost navigation"`.

## Task 3: Per-car draft recovery and operation-specific Save

**Files:** Create `apps/react/src/ui/vehicle-cost-draft.js`, `vehicle-cost-save.js`, `vehicle-cost-controller.js`, `apps/react/tests/vehicle-cost-draft.test.mjs`, `vehicle-cost-save.test.mjs`.

**Interfaces:**

- `createVehicleCostDraft({storage,roomId,carKey}) -> {read,write,clear,isRecoverable}`; cache key `sanpo-ui:vehicle-cost:v1:<encodedRoomId>:<encodedCarKey>`, version 1. `storage()` returns sessionStorage. Cache only dirty target field values/original values, reset generation, UI fee locators, working itinerary and exact receipt; no whole room or all-car snapshot.
- `beginVehicleCostEdit(runtime,target) -> edit` consumes existing `beginSettlementEdit`; select existing `settlement-car` scope for both ID and exact-name targets, set existing session `participantId`/`name`, with no store changes.
- `publishVehicleCostEdit(runtime,edit) -> receipt` writes via existing `writeSettlementDraft`, calls `store.commitEdit(edit.session,{close:false})` exactly once, and passes returned intent to `allocationSaveReceipt(runtime,intent,{type:'cost',label})`.
- `settleVehicleCostSave(runtime,receipt,options) -> Promise<{receipt,disposition}>` delegates unchanged `settleAllocationSave` semantics. Technical reuse is UI-only; allocation wording must not leak into cost content.
- `createVehicleCostController({runtime,target,cache}) -> {getSnapshot,subscribe,updateField,setRentalType,setMovementType,addExtra,reuseExtra,removeExtra,save,retry,cancel,dispose}`. `updateField(feeKey,field,rawString)`, `setRentalType(type)`, `setMovementType(type)`, `reuseExtra({name,amount,type})`; `addExtra()` / `reuseExtra()` return the selected fee key; `removeExtra(feeKey)` returns the next logical fee key. `save({composing=false})` / `retry()` return `{receipt,disposition}`. Snapshot contains current `edit`, `fees`, `issues`, `dirty`, `recoverable`, `receipt`, `frozen`, `status`. `cancel()` refuses to imply rollback after publish; `dispose()` unsubscribes without deleting draft.

- [ ] **Write tests** with injected throwing storage, deterministic extra ID factory through existing domain helper seam, and delayed sync/receipt fixtures from allocation-save tests. Assertions: two-car caches survive separately; recover only unfinished fields over current canonical data; clear one leaves the other; removed/reset target retains unavailable input separately. IME/double submit emits at most one intent; failed Save freezes inputs; reload/retry retains exact extras IDs/payload and never reruns commit; global outbox empty is not receipt proof; accepted then remote-changed data is not replayed. Local disposition says `この端末に保存`. ID-backed and standalone name-backed intent paths touch only that target, and remote other-car/rule/payment changes survive.
- [ ] **Run RED:** `node --test tests/vehicle-cost-draft.test.mjs tests/vehicle-cost-save.test.mjs`.
- [ ] **Implement the signatures.** Keep full existing edit session only in memory; reconstruct it from current canonical room plus narrow unfinished input on recovery. Persist exact operation receipt immediately after publish; disable new input through pending/unknown/rejected frozen submission. Retry original receipt only. Preserve candidate-name deduplication and normalization of pending rows from current CarEditor; never generate another extra ID on retry. Do not call the old global-status-only `commitSettlementEdit` for this workspace.
- [ ] **Run GREEN:** previous command plus `node --test tests/settlement-edit.test.mjs tests/allocation-save.test.mjs`. All scoped/retry contracts must pass.
- [ ] **Commit:** add the three UI files and two tests explicitly; `git commit -m "feat(react): isolate vehicle drafts and save receipts"`.

## Task 4: Working vehicle list/expense workspace and common entrances

**Files:** Create `apps/react/src/components/vehicle-costs/VehicleCosts.jsx`, `ExpenseEditor.jsx`, `apps/react/tests/browser/vehicle-cost-workspace.spec.js`, `vehicle-cost-fixture.js`; modify `App.jsx`, `components/ProjectShell.jsx`, `components/Settlement.jsx`, `components/Allocation.jsx`, `components/allocation/AllocationWorkspace.jsx`, `styles.scss`, `docs/design/SANPOKAI_PRODUCT_UI.md`.

**Interfaces:**

- `VehicleCosts({runtime,room,resolved,destination,onNotice,onPageChange,onReturn}) -> ReactNode` consumes Tasks 1–3. `onPageChange({title,description,metadata,back})` supplies the shell page model; workspace must not create another main/h1. `onReturn({destination,focusId})` requests App-owned logical return focus.
- `ExpenseEditor({snapshot,onFieldChange,onRentalType,onMovementType,onAdd,onReuse,onRemove,onRoute,onSave,onCancel}) -> ReactNode`; changes delegate controller methods, no separate editor state/store. Rental/standard-extra transformations reuse domain helpers.
- New fixture `seedVehicleCostRoom(page,{roomId,room=fixture,routeAdapter})` writes only synthetic local room data through `addInitScript` and installs `window.__REACT_ROUTE_ADAPTER__` when requested; no production Firebase.

- [ ] **Capture before evidence** from the Phase E build before replacing it: existing cost dialog, movement/route/search/error and settlement caller, same synthetic inputs/viewports/themes as after. Record base SHA, build and capture date. Use a separate safe preview without resetting this branch; reuse prior captures only with verified build/state provenance.
- [ ] **Write browser RED** using roles/labels: `vehicle list and both callers open one car draft`; `mobile whole-car Save reveals a hidden invalid fee`; `private Times and signed-extra capabilities persist`; `reload Back resize and Cancel preserve correct scope`. Assert current `車両費用` nav, one main/h1/form, car-level Save commits canonical target only, amount field rejects negative but accepts large/zero values, draft remains raw while IME active, target lost after initial load has a reason and parent entrance. Accepted input values and readiness to save are distinct (e.g. zero movement distance remains editable but not ready under existing prerequisites). Reuse old cost candidate behavior tests, including standard rows cannot be deleted.
- [ ] **Run RED:** `F:/nodejsss/npx.cmd playwright test tests/browser/vehicle-cost-workspace.spec.js --project chromium-mobile`. Expect missing cost destination, not changed legacy tests failing from unbuilt/stale preview.
- [ ] **Implement the components and App connection.** Expose nav after 班割 before 精算. Publish approved §10/§12 clarifications (design §13), explicitly distinguishing local itinerary, car-wide Save, route Apply and return behavior. Clarify §6's logical-unit Apply as route-result transfer, not compulsory intermediate fee confirmation. Replace §12's unconditional last-update wording with display only when actual metadata exists; do not manufacture it. Vehicle list uses current saved domain totals plus concise local-draft status. At `lg` split list/editor, below one surface; same form and draft survive resize. Form Save/Cancel follows fields; no duplicate header/sticky Primary. Typed validation targets the hidden fee then focuses first invalid field. ID-derived control IDs are stable UI locators, not exposed labels. Connect settlement and car group to the same target adapter/controller; missing mapping is explained, never guessed.
- [ ] **Run GREEN:** previous command, then `F:/nodejsss/npx.cmd playwright test tests/browser/vehicle-cost-workspace.spec.js --project chromium-desktop`; `F:/nodejsss/npm.cmd run build`. New workspace works without route redesign yet; manual distance stays functional. Keep old route entrance until Task 6 replaces it; do not duplicate its owner into the new page.
- [ ] **Commit:** explicit changed paths above; `git commit -m "feat(react): add shared vehicle cost workspace"`.

## Task 5: Route controller with per-car and async ownership

**Files:** Create `apps/react/src/ui/vehicle-route-controller.js`, `apps/react/tests/vehicle-route-controller.test.mjs`; extend Task 4 fixture with deferred search/resolve/calculate/map failures.

**Interfaces:**

- `createVehicleRouteController({roomId,carKey,service,routeDraft,working,rememberWorking}) -> {getSnapshot,subscribe,setContext,setQuery,resolveStop,setStops,setOptions,selectRoute,calculate,renderMap,applyValue,dispose}`.
- `setContext({task,stopKey})`, `setQuery(query)`, `resolveStop(stopKey,prediction) -> Promise<void>`, `setStops(stops)`, `setOptions(options)`, `selectRoute(index)`, `calculate() -> Promise<void>`, `renderMap(element) -> Promise<void>`.
- `working` is plain serialized itinerary or null; `rememberWorking(serialized)` writes target-only UI cache. `routeDraft.read/write` retain existing local-room cache format. Initial legacy cache seed is labelled previous local itinerary, not vehicle-owned data.
- Snapshot: `{state,search:{query,predictions,status,error},calculation:{status,error},map:{status,error},revision}`; status `idle|pending|ready|empty|error`. `applyValue() -> string|null` uses unchanged `distanceKilometers(state)` only for current selectable result.
- Calls existing service `search(query)`, `resolve(prediction)`, `calculate(state)`, `renderMap(element,state)` unchanged. Predictions/provider objects never enter serialized cache.

- [ ] **Write async RED** using manually resolved promises (not timing-only sleeps). Assert search A completing after B cannot replace B/count/status; resolve to a removed/reordered repeated stop is ignored; old car result cannot update new context; changed options invalidate old alternatives/Apply; map failure does not disable text result. `12345` meters yields `12.3` km with `roundTrip:false`. Cache seed, max 25 waypoints, recent-place handling and dormant options match existing owner. Disposal blocks state publication; render into a disconnected map cannot mutate the active page.
- [ ] **Run RED:** `node --test tests/vehicle-route-controller.test.mjs tests/route.test.mjs` (existing route service tests stay green).
- [ ] **Implement the controller** with monotonic per-operation ownership tokens including room/car/task/input revision and stop identity. Reorder/delete invalidates pending resolution, including repeated place IDs; apply never targets by stale index. Keep debounced search behavior, current query on error, and invalidate obsolete candidates. Fence completion and cleanup separately so old finally blocks cannot clear new loading. Keep API request/ranking/conversion code byte-identical.
- [ ] **Run GREEN:** same command; all asynchronous and service contracts pass without suppressing errors.
- [ ] **Commit:** new UI controller, test and fixture changes; `git commit -m "feat(react): fence vehicle route task completions"`.

## Task 6: Dedicated route/search pages and removal of nested cost dialog

**Files:** Create `apps/react/src/components/vehicle-costs/VehicleRoute.jsx`, `PlaceSearch.jsx`, `apps/react/tests/browser/vehicle-route.spec.js`; modify workspace/App composition, `styles.scss`, `components/Settlement.jsx`; retire `components/RoutePlanner.jsx` only after confirming no remaining callers with `rg`.

**Interfaces:**

- `VehicleRoute({controller,destination,onSearch,onBack,onApply}) -> ReactNode`, `PlaceSearch({controller,stopKey,onResolved,onBack}) -> ReactNode` consume Task 5. `onApply(distanceString)` calls Task 3 `updateField('movement','dist',distanceString)` then navigates to `task:'expense',expenseKey:'movement'`, preserving returnTo. Neither component saves shared data.
- App destination focus key includes Task 2 snapshot. Explicit parent Back restores logical trigger/list position through Task 4 onReturn; browser history focuses heading. Initial direct load does not steal focus; background completion after leaving never focuses.

- [ ] **Write browser RED:** route from allocation → search origin/destination → actual Arrow-key candidate selection → Apply opens movement editor as unsaved; canonical distance unchanged until car Save. Route Back without Apply leaves distance unchanged. Keyboard stop Up/Down/remove retains logical focus and announces order. Zero matches/resolve/route failures retain input and offer retry; map error and missing SDK still permit text/manual task completion. Assert revised location privacy text, not old claim that places are room-shared. Use delayed fixture ownership tests for route/expense navigation.
- [ ] **Run RED:** `F:/nodejsss/npx.cmd playwright test tests/browser/vehicle-route.spec.js --project chromium-mobile`.
- [ ] **Implement Carbon/native semantic route and search surfaces.** Text candidates use Carbon RadioButtonGroup verified against installed Arrow-key contract; if unsuitable use native radio group with tested keys, not custom button-role radio. Map optional below lg and never role=application by default. Keep stop actions named/touch-sized, query-owned polite feedback, advanced options disclosure. Parent Back is Link; only Apply is Primary; no additional confirmation per stop. Remove CarEditor/old nested view/hidden stay-mounted RoutePlanner and associated cost-only CSS after shared entrances all resolve. Retain SettingsModal, memo/collection/payment/rules unchanged. Delete obsolete route file only with zero callers and retained behavior coverage.
- [ ] **Run GREEN:** previous command, then `F:/nodejsss/npx.cmd playwright test tests/browser/vehicle-route.spec.js --project webkit-mobile`; Task 5 unit suite; React build.
- [ ] **Commit:** explicit touched/new/retired paths; `git commit -m "feat(react): replace nested cost routes with task pages"`.

## Task 7: Preserve golden calculations and convert old browser guards

**Files:** Create `apps/react/tests/vehicle-cost-calculation.test.mjs`; modify `tests/browser/settlement.spec.js`, `settlement-negative-validation.e2e.spec.js`, `route-planner-carbon.spec.js`, and any other cost-dialog callers found by `rg -n '費用を入力|settlement-cost|RoutePlanner' tests/browser`. Do not rewrite unrelated feature guards.

**Interfaces:** Consume Tasks 1–6 plus existing legacy reference `createReference`, `plain`, domain result and canonical storage. Golden comparisons use the identical inputs through unchanged domain vs protected legacy reference; no new expected formulas.

- [ ] **Write golden cases** for private movement, Times distance/time, reward, split/club positive and negative extras, standalone, organizer/exemption/deduction/rounding/collection/payment values and accepted zero/blank. Assert full result equality before Save and after reload, not just one total. Run them once against baseline data first to establish characterization.
- [ ] **Write/update failing observable guards** before changing their owners: retain expense name/amount/type/reuse/delete, numerical validity, route stop/search/error/candidate/Apply, Japanese IME, accessible names, keyboard/focus and overflow coverage. Remove only assumptions about dialog existence, internal `.cds--modal-*` scroll/mask/72px row size and false shared-location copy; document each replacement assertion in evidence. Don't preserve source-text contract or make content conform to obsolete snapshots.
- [ ] **Run RED on new cases** missing behavior, using `node --test tests/vehicle-cost-calculation.test.mjs` and targeted affected browser files. Already-passing characterization is not claimed as a feature RED.
- [ ] **Implement only missing UI fixes in owning Tasks 1–6**, not domain math. Ensure old table/payment/memo/rules still work as unchanged protected workflows. Update test descriptions to task behavior, and attach visual evidence separately from assertions.
- [ ] **Run GREEN:** `F:/nodejsss/npm.cmd test`; `F:/nodejsss/npx.cmd playwright test tests/browser/vehicle-cost-workspace.spec.js tests/browser/vehicle-route.spec.js tests/browser/settlement.spec.js tests/browser/settlement-negative-validation.e2e.spec.js tests/browser/route-planner-carbon.spec.js` (all four projects). Expected no skips or assertion weakening; run `F:/nodejsss/npm.cmd run verify:legacy` to confirm protected files.
- [ ] **Commit:** explicit tests and owner-local fixes only; `git commit -m "test(react): protect vehicle cost and route behavior"`.

## Task 8: Emulator write isolation, unknown saves and parallel driver entry

**Files:** Create `apps/react/tests/browser-emulator/vehicle-cost-workflow.spec.js`; use existing browser-emulator allocation/participant socket-hold/rules-denial conventions, existing `tests/reference.mjs` and fixture transport. Do not modify production Firebase Rules.

**Interfaces:** Two isolated browser contexts to one synthetic demo room, shared canonical read through existing migration boundary. Unit receipt tests are not a substitute for actual RTDB acknowledgement/reload checks.

- [ ] **Write failing integration tests**: different ID-backed cars and name-backed standalone cars edited concurrently preserve both plus remote rules/payment; same car different existing extras/fields preserve owner merge semantics; same-field conflict matches existing owner. Denied/held acknowledgement preserves frozen payload across reload/retry and extra IDs appear once. Accepted then remotely modified save is never replayed; reset/removal prevents stale-success display. Route Apply emits no shared write. Include one double-submit and a client leaving before acknowledgement without focus theft. Dedicated room cleanup in `finally`; restore temporary Emulator rules even on failure.
- [ ] **Prepare the isolated runner** at repository root: verify `artifacts/phase-f-emulators.json` does not already contain user work, then create it with `apply_patch`, using the existing CI configuration shape and the absolute path to this checkout's `firebase/database.rules.json`. Values are database port 9008, Auth port 9098, UI disabled; project `demo-circle-react`. This temporary local config is not committed and does not change Rules. Set target environment to `emulator`, project `demo-circle-react`, database `http://127.0.0.1:9008`; run `node apps/react/tools/assert-test-target.mjs emulator`.
- [ ] **Run RED** at repository root: `F:/nodejsss/npx.cmd firebase-tools emulators:exec --config artifacts/phase-f-emulators.json --only auth,database --project demo-circle-react "F:/nodejsss/npm.cmd --prefix apps/react run test:browser:emulator -- tests/browser-emulator/vehicle-cost-workflow.spec.js"`. Expected a missing UI behavior assertion, not missing Java/Rules/configuration. No production-config override.
- [ ] **Fix only UI adapter/controller receipt issues**, preserving operation semantics. Run through existing `.github/workflows/quality-guard.yml` Emulator config conventions (temporary host config, same ports/project); do not invent an alternate persistence protocol. If an owner-level incompatibility is exposed, report it and require separate protected-scope approval.
- [ ] **Run GREEN:** targeted command above in both existing Emulator browser projects, then `F:/nodejsss/npm.cmd run test:emulator` plus existing participant/allocation/sync browser Emulator regressions. Verify synthetic rooms absent after cleanup and rules restored; no failed page/console errors silently ignored.
- [ ] **Commit:** integration tests and UI-only fixes; `git commit -m "test(react): verify parallel vehicle cost saves"`.

## Task 9: Browser evidence, cumulative gate, review and integration

**Files:** Create `docs/design/evidence/PHASE_F_VALIDATION.md`; update `docs/design/CARBON_MIGRATION_ROADMAP.md` only with actual Phase F outcome and retained Phase I gates; retain screenshots/traces as local artifacts with selected review evidence links. No claimed completion before merge.

- [ ] **Validate before-evidence provenance** recorded in Task 4, then compare equivalent after states. Do not label a later build as the Phase E before state.
- [ ] **Run automated after matrix:** `F:/nodejsss/npm.cmd run test:browser` (all four configured projects), plus focused cost/route suite with light/dark scenarios and reduced motion. Assert 390px horizontal overflow absent, one active form across 1055/1056 boundary, long project/car/place/expense names and amounts, short viewport, 44px hit areas and no obscured actions. Browser Back/Forward/refresh/direct/shared/legacy URLs, current item, heading focus and logical parent returns must remain observed contracts. Preserve participant/allocation/payment state through these navigation tests.
- [ ] **Operate rendered after screens** through unified browser control and Playwright Chromium/WebKit Desktop/~390px: car list, private/Times/extra editor, route/search/results, unavailable map/SDK, validation, unconfirmed save and recovery. Record exact browser/viewport/theme/input method, before/after images and console failures. Synthetic taps/short viewport are not physical keyboard, native screen-reader or safe-area PASS; explicitly retain unavailable device/SR/live Maps checks for final Phase I.
- [ ] **Run cumulative local checks:** React unit/build/protected verification, targeted and cumulative browser/Emulator suites, `git diff --check`, then repo change classifier and actual required Shared Compatibility checks selected by changed owners. Compare any failures to the same base test IDs; do not hide failures with skips, weakened assertions or screenshot refresh. Record exact counts, commands/build SHA and limitations in evidence; code-reviewed protected diff must be empty.
- [ ] **Request independent whole-branch review** after the execution-method choice, using requesting-code-review skill. Review normative traceability, target/write safety, receipt/retry, async ownership, URL/focus/resize, capability parity, protected owners and test adequacy. Fix verified findings and rerun affected checks. No proactive task delegation before that choice.
- [ ] **Commit evidence, push and create PR** with `gh pr create --base carbon-redesign --head codex/phase-f-vehicle-cost-workspace`; include normative §10/§12 links, actual evidence/results and explicit no-production boundary. Attach created PR with Codex artifact tool. Watch required CI and review; correct failures safely. Docs-only planning commit is not this implementation PR's acceptance.
- [ ] **Merge only to carbon-redesign** when checks/review pass, via repository-approved merge method. Verify merged SHA/remote state; leave main/release workflows untouched. Do not run Release/Readiness or production smoke to satisfy the normal production policy. Preserve any ignored artifacts needed for review before worktree cleanup.

## Self-review / execution handoff

Spec coverage: identity and domain parity → Tasks 1/7/8; navigation and invalid targets → Tasks 2/4; draft/Save/retry/cancel → Task 3/8; fees and responsive form → Task 4; route/cache/async → Tasks 5/6; all error/a11y/geometry/browser gates → Tasks 4/6/9; normative clarifications → Task 4; CI/integration → Task 9. All five Review Focus conditions have owned tests. Interfaces use the same Destination, Target, Fee and controller methods throughout; no task creates a second shared-write owner.

The implementation plan is intentionally shorter than a source-code transcript. Bodies belong to implementation; this document fixes ownership, values, assertions, order and stop conditions. Runtime path/guard checks and old cost-browser assertions are reviewed, not discarded. Product UI code and new acceptance tests remain unexecuted at this planning checkpoint.

Recommended execution: **Native**. The nine tasks share target/draft/navigation interfaces tightly; implementing them in this session keeps those interfaces coherent, with independent whole-branch review before integration. Subagent-driven execution is also available if the user wants independent implementer/reviewer gates per task. Begin implementation only after plan review and execution-method selection, per writing-plans handoff.
