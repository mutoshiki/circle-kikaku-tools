# Phase H: Settlement operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 集金・車への支払いを反復しやすい専用pageへ移し、記録の保存結果と訂正を明確にし、履歴の端末保存・共有復元を安全に操作できるようにする。

**Architecture:** App/navigation owns destinations, one main/h1 and focus. A read-only projection consumes existing settlement results; one room-scoped UI operation controller serializes H writes through existing commands and exact receipts, without changing the one-record outbox. Separate memo and history controllers own their drafts/confirmation; broad history receipts retain payload only in memory or existing protected storage, never a second durable room snapshot.

**Tech Stack:** React 19.2.8, `@carbon/react` 1.115.0, Carbon Grid/Sass tokens, Node test runner, Playwright 1.61.0, demo Firebase Auth/RTDB Emulator. No dependency/lockfile change.

**Spec:** [Approved Phase H design](../specs/2026-10-05-phase-h-settlement-operations-design.md). [SANPOKAI_PRODUCT_UI.md](../../design/SANPOKAI_PRODUCT_UI.md) is the sole normative Product UI specification; this plan is execution guidance, not another UI contract.

Status: plan approved for Native execution by 「実装へ」 (2026-10-05). Execution is in progress; completed steps and verification are recorded in the execution ledger and final phase evidence.

## Global Constraints

- Worktree `C:/Users/toshi/.codex/worktrees/phase-b-shell/circle-kikaku-tools`; branch `codex/phase-h-settlement-operations`; integration base `carbon-redesign` at `c33962ed9c28fd3cd94e4a63d52e111a026c7b0f`; design commit `d81e782`.
- 「第二のnormative specificationではない。」 Task 1 publishes approved design §12 clarifications into the sole normative owner before UI implementation. Plan/spec/evidence retain rationale, not competing rules.
- 「global navigationは増やさない。」 Tasks are `section=settlement&task=collection`, `task=payments`, existing `task=rules`; history remains `section=history-settings`; local/demo sample is `section=history-settings&task=sample`.
- 「schema、Firebase、domain/store/sync/services、計算、legacyを変更しない。」 Protected executable owners, generated files, Rules, runtime, dependencies, guards and workflows remain reference-only. Corrections crossing this boundary require separate scope, not silent expansion.
- 「計算額と実際の金銭移動は別状態。」 Preserve paid/paidBy/driverPaid, car-level combined payouts, standalone fallback and all existing financial capabilities. No授受台帳, auto-check reset, bulk write, mandatory completion flag or archive.
- 「connectedや空outboxは個別操作の成功証拠ではない。」 No re-command on retry; pending/unknown cannot be discarded or declared canceled. Preserve existing transaction/fallback semantics and exact acceptance evidence.
- 「新UIの通常訂正に採用しない。」 Do not call whole-map `undoCollectionChange` for new row correction; leave its owner and existing tests unchanged. Correct only the selected row through the existing helper.
- 「履歴一覧はこの端末の保存。復元は共有企画への変更。」 Existing history limit 20, manual save/read-back, conditional same-runtime Undo. No new durable full patch/backup, auth token or room copy in UI recovery/logs.
- 「document scrollがowner」。 Use tokens, g10/g100, compact rows, one main/h1, meaningful focus, labels/announcements, no horizontal overflow, no unconditional fixed footer/independent scroll cage/global Carbon selector override.
- 「本番操作は禁止」。 No main merge, Production Release/Readiness dispatch, compatibility deploy, root cutover, production smoke/Firebase writes. Integrate this phase only into `carbon-redesign` after tests/browser/review/automatic CI.

## Review Focus

1. Paid records survive cost/mode changes, but do not prove the amount historically received. Test no automatic clearing, no invented historical amount, and mode/slot recovery safety in Tasks 2/4/10.
2. A foreign write replaces the one-record outbox while a checkbox appears checked. Test retained unresolved status, blocked reversal/replay, and exact-operation evidence after reload in Tasks 3/10.
3. Whitespace/case-equivalent names, prototype-like names and unsafe name paths resolve to the wrong recipient. Test canonical-target ambiguity/safe stop without changing schema or persistence in Tasks 2/3/4.
4. A different client's participant/cost change arrives while restore or Undo is being confirmed/saved. Test stale confirmation and whole-business comparison, not own-patch-only success, in Tasks 7/10.
5. Corrupt/blocked history storage returns an empty array, or a broad receipt contains edit-lock secrets. Test error≠empty, no repair, read-back failure and sanitized durable receipts in Tasks 2/6/7/10.

---

## Execution setup and file map

All source/test paths below are relative to `apps/react`; document paths are repository-root relative. Run executable checks from `apps/react` unless marked root. Use installed `F:/nodejsss/node.exe`, `F:/nodejsss/npm.cmd`, `F:/nodejsss/npx.cmd`; `node/npm/npx` below mean those executables. No dependency installation unless independently proven missing and in scope.

Before offline checks:

```powershell
$env:SANPO_TEST_FIREBASE_TARGET = 'offline'
$env:SANPO_TEST_FIREBASE_PROJECT_ID = 'demo-circle-kikaku-tools'
$env:SANPO_TEST_FIREBASE_DATABASE_URL = 'http://127.0.0.1:9000'
node tools/assert-test-target.mjs offline
```

Use existing rebuilt offline preview 4176, not stale dist/production preview. A guard/runtime/port failure is not valid feature RED. Record failing behavior and unchanged base failures separately; no source-string contract, new skip or expectation/timeout weakening. Steps below use RED→minimal implementation→GREEN→explicit-path commit; characterization already passing is recorded as PASS, not invented RED.

| File / unit | Responsibility |
| --- | --- |
| `tests/helpers/settlement-operations-fixture.mjs` (new) | Shared unit fixture built from existing reference/store/sync/history public factories |
| `src/ui/settlement-operations-model.js` (new) | Current domain projection, target safety, signed money presentation, business-state comparison |
| `src/ui/settlement-operations-draft.js` (new) | Narrow session recovery, broad receipt identifiers, ownership/version validation |
| `src/ui/settlement-operation-controller.js` (new) | Single H write barrier, exact intent capture, existing receipt delegation, lifetime/recovery |
| `src/ui/settlement-memo-controller.js` (new) | Memo-only raw draft/conflict/save/cancel |
| `src/ui/project-history-model.js` (new) | Read-only local-history validation and detached existing-owner restore impact preview |
| `src/ui/project-history-controller.js` (new) | Manual snapshot, confirmation, existing restore/Undo and safety conditions |
| `src/components/settlement-operations/{SettlementOverview,CollectionWorkspace,PaymentWorkspace,SettlementMemo}.jsx` (new) | Separate parent/list/memo views; subscribe to UI controllers, never calculate or write independently |
| `src/components/history/{ProjectHistory,RestoreConfirmation,SampleWorkspace}.jsx` (new) | Durable local list, brief danger confirmation, local/demo sample form |
| `src/App.jsx`, `src/navigation/project-navigation.js` | Stable room-scoped controller lifetime, page models/subroutes, current location/focus |
| `src/components/Settlement.jsx`, `ProjectTools.jsx`, `ProjectHistorySettings.jsx`, `AppHeader.jsx`, `src/styles.scss` | Delegate new views; remove obsolete H Modals/placeholders and sample menu only when successors are connected; scoped tokens |
| `tests/settlement-operations-*.test.mjs`, `tests/settlement-memo.test.mjs`, `tests/project-history-*.test.mjs` (new) | Characterization, models, caches, operations, navigation, memo, history controllers |
| `tests/browser/settlement-operations-{workspace,responsive}.spec.js`, `project-history-workspace.spec.js` (new) | Rendered flows, semantics/focus/geometry and danger |
| `tests/browser-emulator/settlement-operations-workflow.spec.js` (new) | Real multi-client money/history/memo acceptance and failure recovery |
| `docs/design/SANPOKAI_PRODUCT_UI.md`, `CARBON_MIGRATION_ROADMAP.md`, `evidence/PHASE_H_VALIDATION.md` | Normative clarification, phase checkpoint, actual evidence and assertion-replacement ledger |

Reference-only: `src/domain/**`, `src/store/**`, `src/sync/**`, `src/services/**`, `src/runtime.js`, `src/ui/allocation-save.js`, `src/components/settlement/edit.js`, existing vehicle-cost/route/rules controllers, `firebase/**`, `assets/**`, guards/config/workflows/lockfiles. Removing unused H-specific view code is not permission to remove capability or change these owners.

### Shared interfaces

- `Runtime`, `CanonicalRoom`, `Domain`, `StoreIntent`, `SaveReceipt` and `{receipt, disposition}` below refer to actual existing owner outputs, not new domain types. `StoreIntent` is the existing `{base,local,patch,sequence,kind}` emitted by store.subscribeIntents; `record` below is UI-only.
- `MoneyTarget = {kind:'collection'|'payment', key:string, name:string, participantId:string|null, context:string, editable:boolean, reason:string}`. Registered people use `participant:<id>`, standalone uses `name:<exact projected name>`; payments reuse existing `vehicleCostTargets(...).key`. Context captures mode/slot set/reset; key never becomes a new persisted identity.
- `OperationsView = {input,result,readiness,collections:CollectionRow[],payments:PaymentRow[],summary}`. Rows contain `target`, visible names, amount, excluded reason and current recorded state. `summary` contains domain collection counters, payment remaining count/signed sum and `checksComplete`; no independent financial formula.
- `OperationRecord = {kind:'collection'|'payment'|'memo'|'restore'|'undo'|'sample', targetKey:string, resetGeneration:number, receipt:SaveReceipt|null}` in memory. Narrow durable records retain only allowed changed paths/before; broad durable records retain only kind/targetKey/operationId/resetGeneration/historyTime/disposition/acknowledged. Never persist a broad receipt's patch/before.
- `createOperationsCache({roomId,storage}) -> {read,write,clear,getWarning}` uses `sanpo-ui:settlement-operations:v1:<encoded roomId>`. `storage` is a getter `()=>Storage` so access failures are caught; fixture injection is `()=>r.rawStorage`. Record: `{version:1, revision:number, filters:{collection:'outstanding'|'all',payment:'outstanding'|'all'}, collectorDraft:null|{targetKey,context,raw}, memoDraft:null|{raw,openingMemo,resetGeneration}, operation:null|narrowOrBroadRecord}`. `read()` returns the validated record or an empty record at revision 0; `write(next,{expectedRevision})` and `clear(field,{expectedRevision})` return a boolean and increment revision only on success. Clear accepts only `collectorDraft|memoDraft|operation`, retaining filters and other records. Compare-and-set against the latest in-memory revision prevents stale completion from clearing newer input; callers update from a fresh read, never an old whole-cache copy. Memory fallback; reject malformed version/fields, no auto-write of recovered canonical data. A memory-applied write with failed backing storage remains applied, with `getWarning()` explaining refresh is not assured.
- `createSettlementOperationController({runtime,cache}) -> {getSnapshot,subscribe,toggle,publishMemo,publishHistory,retry,observe,confirmCurrent,dispose}`. Snapshot `{operation,blocked,reason,cacheWarning}` stable until change. `toggle({target,checked,collector?})`, `publishMemo({openingMemo,raw,resetGeneration})`, `publishHistory({kind:'restore'|'undo'|'sample',historyTime?,perform:()=>boolean|StoreIntent|null})` return `Promise<{receipt,disposition}>`. The `perform` return is not acceptance evidence; only its captured existing intent builds a receipt. `retry/observe` act on the one existing operation, never a new command. `confirmCurrent` clears only proven terminal adjusted/reset controls. `dispose` detaches subscribers without deleting recovery data.
- App creates that controller once per runtime/room above page lifetime, and passes it to all H views/controllers. It must not add a global registry or second live runtime/store. Tasks 3/7 may use detached, transport-free stores for side-effect-free preflight/preview of existing command owners, never as a competing live state. History's broad operation blocks narrow H writes and vice versa; foreign outbox blocks all new H commands, not browsing.

## Task 1: Characterize protected behavior and publish the approved contract

**Files:** Create fixture helper and `tests/settlement-operations-characterization.test.mjs`; modify root normative specification only. **Spec:** §0–2/12.

**Interfaces:** Helper `createOperationsFixture({shared=false,standalone=false}) -> Promise<{runtime,server,transport,rawStorage,keys:{collection,payment},dispose}>` uses `tests/reference.mjs`, `tests/helpers/fixture-transport.mjs`, `createRoomStore`, `createRoomSync`, `createHistoryService`. `runtime.roomId` identifies the synthetic fixture; `rawStorage` has native Storage getItem/setItem/removeItem semantics. `resultOf(runtime)` calls existing `settlementInput/calculateSettlement`. The key objects are actual projected targets; do not import another `.test.mjs` to obtain helpers.

- [ ] **Write characterization:** record/解除 paid+paidBy vs driverPaid, standalone fallback, full normal/standalone financial result, restore metadata/reset/tombstone behavior, history limit/dedup and memory backup. Compare financial amounts from `resultOf(r.runtime)` before/after money flags; the existing collection counters/record metadata may change as intended. Unrelated canonical participants/allocations/cost/settings remain equal. Keep `tests/settlement-edit.test.mjs` whole-map Undo assertions intact.
  Named contract `paid flags change collection counters, not calculated amounts`: after checking one eligible initially unpaid fixture person, `assert.equal(after.perPerson, before.perPerson)` and `assert.equal(after.paidCount, before.paidCount + 1)`; compare the remaining financial fields to the same fixture's existing result.
- [ ] **Run:** `node --test tests/settlement-operations-characterization.test.mjs tests/settlement-edit.test.mjs`; expect PASS on existing owners. Resolve harness issues, do not change protected owners to make new assumptions true.
- [ ] **Publish approved spec §12:** normative v1.6: separate task URLs, money/actual-record distinction, row reversal, exact receipt, local history/shared restore/conditional Undo, result-specific danger wording and responsive/focus contracts. Preserve max-one Primary, protected-owner priority and incremental scope. Official/project/technical distinctions remain explicit.
- [ ] **Verify:** `git diff --check`; cross-reference each normative change to approved H spec and verify no executable owner changes. Commit explicit fixture/test/normative paths: `test(react): characterize settlement operations and fix H design contract`.

## Task 2: Read-only money projection and safe UI recovery

**Files:** Create model/draft modules and `tests/settlement-operations-model.test.mjs`, `settlement-operations-draft.test.mjs`. **Spec:** §3–6/7/10.

**Interfaces:** `projectSettlementOperations({room,domain,operation=null}) -> OperationsView`; `resolveMoneyTarget({room,domain,kind,key}) -> MoneyTarget|null`; `sameBusinessState({before,after,domain}) -> boolean` compares existing domain patch semantics plus relevant application metadata, ignoring root revision/lastUpdatedAt/lastUpdatedBy and sync journal/version bookkeeping, not participant identities/tombstones/locks. Cache contract is above.

- [ ] **Write RED:** projection calls domain without commands, exposes one row per current car, signed zero/negative amount, separate exclusion/offset reasons; missing/mode-changed/normalized-equivalent/unsafe/prototype-like names are not silently aliased. Recovery round-trips raw text/filter and valid receipt; malformed lifecycle, wrong version, broad patch/before and token fields are rejected, quota/access error retains memory. Assertions include `assert.deepEqual(r.runtime.store.getSnapshot(), before)` and `assert.equal(view.summary.checksComplete, false)` for empty/indeterminate state.
  Named cache contract `stale completion cannot clear a newer draft`: after two writes using the current revision each time, `assert.equal(cache.clear('collectorDraft', {expectedRevision:oldRevision}), false)` and `assert.equal(cache.read().collectorDraft.raw, newestRaw)`. Model contract `payment rows preserve signed domain amounts` compares each row's amount to the corresponding `result.cars` adjustedTotalPay, including 0 and negative fixtures.
- [ ] **Run RED:** `node --test tests/settlement-operations-model.test.mjs tests/settlement-operations-draft.test.mjs`; expected missing new interfaces/behavior.
- [ ] **Implement signatures:** use current domain result and existing `vehicleCostTargets`/canonical name rules; no new normalized identity. Aggregate result.cars amounts only. Pending/failed/unresolved rows remain visible in outstanding views. Cache validates narrow monetary path scope and sanitized broad identifiers, keeps session filters/raw drafts and owner revision to prevent old completion clearing newer input.
- [ ] **Run GREEN:** same command plus Task 1 tests. Record current-result parity, no writes, storage failure/privacy cases. Commit explicit new files: `feat(react): add settlement operation projection and recovery cache`.

## Task 3: Exact-operation recording, reversal and broad-write barrier

**Files:** Create operation controller and `tests/settlement-operations-controller.test.mjs`. **Spec:** §7/8 receipt rules.

**Interfaces:** Consume Task 2 target/cache/comparison, `collectionChange(store,{name,checked,payment=false,collector})` and existing `allocationSaveReceipt/settleAllocationSave`. Produce shared controller contract above. Task 3 execution ruling (normative §14): execute the unchanged helper once against detached `createRoomStore({initial:latestRoom})`; project only resolved target paths into one existing live beginEdit/commitEdit. No transport, persistence or history is attached to the preview. This excludes incidental legacy normalization instead of rejecting compatible rooms. `publishHistory` captures broad receipt in memory, durable cache stores compact identifiers; receipt reconstructed only from matching existing outbox, otherwise conservatively unresolved/accepted-needs-review.

- [ ] **Write RED cases:** latest-room toggle once; intended paid+collector or driverPaid paths only (ignore the existing three root bookkeeping paths), inverse action leaves other rows intact; same target removed/renamed/reset/ambiguous; noop; foreign outbox; double submit; denied→exact retry; unknown empty/replaced outbox; acceptance followed by remote opposite value; stale controller completion; blocked cache. Named test `one local row record emits one intent without changing the calculated amount`:

```js
const r = await createOperationsFixture();
const cache = createOperationsCache({roomId:r.runtime.roomId,storage:()=>r.rawStorage});
const controller = createSettlementOperationController({runtime:r.runtime,cache});
const amountBefore = resultOf(r.runtime).perPerson;
let commands = 0; r.runtime.store.subscribeIntents(() => commands++);
await controller.toggle({ target: r.keys.collection, checked: true });
assert.equal(commands, 1);
assert.equal(controller.getSnapshot().operation.receipt.disposition, 'local');
assert.equal(resultOf(r.runtime).perPerson, amountBefore);
controller.dispose(); r.dispose();
```

Also assert no broad patch/token appears in durable JSON, broad unresolved record blocks monetary writes after refresh, and accepted records never replay when another value is current.
- [ ] **Run RED:** `node --test tests/settlement-operations-controller.test.mjs`.
- [ ] **Implement:** resolve target immediately before execution, preflight normalized candidate using existing owner to reject unexpected non-target domain changes before command, capture exactly the synchronous matching intent with `finally` unsubscribe. Store helper return is not a receipt. Gate all H writers on existing outbox/own nonterminal record; do not modify sync or add queue. Delegate acceptance/retry, additionally compare current requested paths before presenting recorded success. Historical broad command is called only once. Retry must not overwrite history backup or invoke sample factory again.
- [ ] **Run GREEN:** `node --test tests/settlement-operations-controller.test.mjs tests/settlement-operations-model.test.mjs tests/settlement-operations-draft.test.mjs tests/settlement-operations-characterization.test.mjs tests/allocation-save.test.mjs tests/settlement-rules-save.test.mjs tests/vehicle-cost-save.test.mjs`. Confirm no `settlement/edit.js`/receipt owner changes. Commit: `feat(react): track exact settlement records without whole-map undo`.

## Task 4: Connect durable navigation and money workspaces

**Files:** Create the three overview/collection/payment views; modify `App.jsx`, `Settlement.jsx`, navigation/styles; create `tests/settlement-operations-navigation.test.mjs`, `tests/browser/settlement-operations-workspace.spec.js`. **Spec:** §3–6/10.

**Interfaces:** Extend existing settlement URL helpers to `''|'rules'|'collection'|'payments'`; existing snapshots shape `{task,invalid}` retained. Views `{runtime,room,controller,cache}` consume Tasks 2/3; App retains one main/h1 and logical return IDs `settlement-collection-entry`, `settlement-payments-entry`, existing rules ID. No `collectionOpen` route mirror.

- [ ] **Write RED navigation/browser behavior:** direct/shared/legacy and refresh/no entry-write, Back/Forward, current section+subtask, invalid task replacement after resolution, registered direct checkbox vs standalone inline input/Cancel/fallback/IME, filter/copy/excluded labels, car-level driverPaid, signed breakdown/correct cost link, no success Toast. Named test `direct collection entry and explicit return have meaningful focus`:

```js
await page.goto('/?room=H-LOCAL&section=settlement&task=collection');
await expect(page.getByRole('heading', {level:1,name:'集金',exact:true})).toBeVisible();
await expect(page.getByRole('dialog')).toHaveCount(0);
await page.getByRole('link', {name:'精算へ戻る',exact:true}).click();
await expect(page.getByRole('link', {name:'集金を確認',exact:true})).toBeFocused();
```

Seed synthetic data once per room, not on every refresh. Pin focus after a checked outstanding row disappears, pending/error row retained, long-name safety, and no fabricated historical amount/check clearing after cost/mode updates.
- [ ] **Run RED:** navigation unit file; `npx playwright test tests/browser/settlement-operations-workspace.spec.js --project chromium-mobile`.
- [ ] **Implement composition:** fresh outstanding views, room/session filters, copy all actual outstanding targets and selectable text fallback. App-owned operation controller outlives subpage unmount. Parent is compact readiness/amounts/work links/memo supporting slot; existing rules model/readiness links consume current inputs. Use public Carbon controls with installed API/keyboard checks. Inline one standalone row draft; preserve React fallback and disallow context-changed publish. Eliminate CollectionPrompt/review Modal only after successor passes. Keep costs/rules controllers untouched.
- [ ] **Run GREEN:** navigation plus new browser file on Chromium desktop/mobile, then WebKit mobile; build. Commit named source/tests: `feat(react): provide focused collection and payment pages`.

## Task 5: Memo-only inline edit and recovery

**Files:** Create memo controller/view and `tests/settlement-memo.test.mjs`; extend operations workspace tests; modify parent wiring. **Spec:** §7 memo.

**Interfaces:** `createSettlementMemoController({runtime,operations,cache}) -> {getSnapshot,subscribe,edit,setRaw,save,cancel,rebase,dispose}`. Snapshot `{editing,raw,dirty,error,frozen}`; `save` delegates operations.publishMemo, never direct stale state. Rebase is explicit prepublish only and preserves raw as a visible input control until user chooses current editing base.

- [ ] **Write RED:** raw navigation/refresh/quota recovery, unchanged Save/no intent, Cancel/no write, remote same-memo conflict, latest other paid/cost preserved, double/IME/pending controls, publish-after-leave no navigation/focus. Assert emitted domain path list equals `['settlement/memo']` and receipt retry never invokes command twice.
  Named unit test `memo save preserves concurrent payment and cost edits`: capture its emitted intent, remove only root revision/lastUpdatedAt/lastUpdatedBy from `Object.keys(intent.patch)`, then `assert.deepEqual(domainPaths, ['settlement/memo'])`; `assert.deepEqual(after.settlement.driverPaid, latestBeforeSave.settlement.driverPaid)` with analogous current-cost assertions. Named browser test `memo raw draft survives refresh without publish` asserts the refreshed TextArea value equals the exact untrimmed input and that no command occurred.
- [ ] **Run RED:** `node --test tests/settlement-memo.test.mjs`; focused browser `--grep 'memo'` (new tests use English titles with `memo`).
- [ ] **Implement:** short labeled TextArea, Primary「メモを保存」/Cancel, recovery owner revision, frozen postpublish input, inline errors. No global/other-feature Save, success Toast or publish cancel pretending rollback.
- [ ] **Run GREEN:** unit plus memo browser cases on Chromium mobile/WebKit mobile. Commit: `feat(react): preserve memo-only edits and save recovery`.

## Task 6: Honest local history listing and snapshot persistence

**Files:** Create history model, history controller's list/snapshot portion and ProjectHistory; create `tests/project-history-model.test.mjs`, `project-history-controller.test.mjs`, `tests/browser/project-history-workspace.spec.js`; modify App/history placeholder connection. **Spec:** §8 local snapshots.

**Interfaces:** `inspectLocalHistory({history,storage}) -> {kind:'ready'|'unavailable'|'corrupt',items,message}` reads existing history.key without mutation; `storage` is a getter `()=>Storage`. `createProjectHistoryController({runtime,operations,rawStorage}) -> {getSnapshot,subscribe,saveSnapshot,selectRestore,confirmRestore,selectUndo,confirmUndo,cancelConfirmation,dispose}`; snapshot `{items,loadIssue,confirmation,operation,canUndo}`. Later restore methods are implemented in Task 7; `rawStorage` is the UI-injected getter for native localStorage, tests use `()=>r.rawStorage`, not changed runtime/service.

- [ ] **Write RED:** no auto-save on entry; valid empty vs invalid JSON/access denied, quota/read-back failure, duplicate snapshot/20-limit, current marker after actual data equality not selected row, pending shared write blocks new snapshot. Browser title「履歴」appears without scrolling Modal; Tertiary保存 updates list visibly, no success Toast. Tokens are absent from rendered row/metadata.
  Named model test `corrupt history is not an empty history`: seed invalid JSON at `runtime.history.key`, then `assert.equal(inspectLocalHistory({history:runtime.history,storage:()=>rawStorage}).kind, 'corrupt')`, and verify the raw value is unchanged. Named controller test `history save requires readback` forces setItem to fail and asserts `assert.ok(controller.getSnapshot().loadIssue)` instead of adding a success row.
- [ ] **Run RED:** history model/controller unit files and new browser file `--project chromium-mobile`.
- [ ] **Implement:** delegate existing `history.read/save`, verify time/data read-back; never repair/delete corrupt storage automatically. Current marker uses existing canonical business comparison. Keep snapshots only in existing history store; no second full room cache. Durable page replaces wrapper/「履歴を開く」Modal entrance, with explicit local-vs-shared copy and empty/error states.
- [ ] **Run GREEN:** same tests on desktop Chromium and mobile WebKit; characterize service protected bytes. Commit: `feat(react): show local history and verify snapshot saves`.

## Task 7: Broad restore confirmation and genuinely safe Undo

**Files:** Complete history model/controller; create RestoreConfirmation, extend history unit/browser tests. Remove obsolete HistoryModal only when new flow works. **Spec:** §8 restore/Undo.

**Interfaces:** `previewHistoryRestore({room,item}) -> {available,reason,candidate,impact}` calls existing restore command in a detached `createRoomStore` without transport/listeners to real runtime, deriving metadata/migration behavior from the owner rather than copying it. `selectRestore(item)` captures target+opening business fingerprint; `confirmRestore({understood:true})` revalidates and invokes operations.publishHistory with `perform:()=>runtime.history.restore(...)`. Undo parallels that interface; existing backup remains service-owned.

- [ ] **Write RED:** cancel/unchecked/stale target causes zero intents; missing/newer-schema/corrupt snapshot remains visible but not restorable; restore captures one intent/receipt, retry does not restore twice; restored metadata/reset/paid/tombstones match existing service, and unshared local drafts remain untouched. Assert safe Undo only when no other business change occurred: `assert.equal(history.getSnapshot().canUndo, false)` after foreign participant addition during save, even if own paths are accepted. Include postrestore edit/reset/newrestore/refresh, Undo command consuming backup then failed retry, and no secret/full patch in new caches/logs.
  Name the concurrency test `restore accepted after foreign participant addition does not enable undo`; `history` above is the UI controller. Browser test `restore cancel returns focus without writing` asserts the row's「この状態を復元」trigger regains focus after Escape and observed write count stays 0. Browser test `undo requires current whole-state equality` observes the disabled/absent Undo entry after a later business edit, not the service backup alone.
- [ ] **Run RED:** both history unit files and history browser `--grep 'restore|undo'` with explicit matching English titles.
- [ ] **Implement:** danger title/body/checkbox from approved spec, summaries without rawJSON/path/token. Revalidate opening/target with Task 2 comparison. Only no-adjustment acceptance plus entire business state equal to actual command's local result enables Undo; then continuously validate same-runtime fingerprint. No fabricated timer/atomic room lock. Broad receipt memory loss yields pending/unknown or accepted-needs-current-review, never replay. Accepted/adjusted are not synonym for exact-restoration success. Complete focus trap/dismiss/return and current review action.
- [ ] **Run GREEN:** model/controller/history browser on Chromium mobile and WebKit mobile; existing service characterization. Commit: `feat(react): confirm shared restore and guard whole-state undo`.

## Task 8: Move existing sample replacement into local-only danger utility

**Files:** Create SampleWorkspace; modify App/AppHeader/ProjectTools and history entry; extend navigation/history browser tests. **Spec:** §9.

**Interfaces:** History navigation produces `getHistoryTaskSnapshot`, `historyTaskHrefFor`, `navigateHistoryTask`, `replaceHistoryTask`, with `{task:''|'sample',invalid}`. Sample uses existing `createProjectDomain` factories and operations.publishHistory `{kind:'sample',perform}`; choices `{type:'normal'|'form'|'missing',carCount:'2'|'3'|'4'|'5'}` remain UI-local, form-linked type ignores count as currently.

- [ ] **Write RED:** sample removed from normal utility menu, local/demo history has separate開発用操作 entry; shared runtime/direct sample URL replaces history without write. Form choose/cancel no writes; confirmation unchecked/stale current/changed choice stops command; execution once keeps actual sample metadata semantics and no generic production reset. Assert no hidden project-delete/settings item appears.
  Named browser test `sample selection and confirmation cancel preserve the project`: cancel the danger dialog, `await expect(page.getByRole('heading', {level:1,name:'サンプルデータ',exact:true})).toBeVisible()`; compare protected fixture state to before and verify zero intents. Shared counterpart `shared sample deep link never writes` verifies replacement URL and 0 server writes.
- [ ] **Run RED:** navigation unit plus history browser `--grep 'sample'` with matching test titles; shared denial case joins Task 10 Emulator suite.
- [ ] **Implement:** dedicated form→Tertiary「置換内容を確認」→brief danger「サンプルで置き換える」、understanding checkbox and target/impact. Guard `runtime.sampleDataEnabled` at entry and submit. Remove obsolete global sample Modal and Header props only when unused; don't alter fixture/domain factory, help/theme/bug/app switcher.
- [ ] **Run GREEN:** same tests in Chromium mobile/WebKit mobile plus `shell.spec.js`/`phase6.spec.js` affected utilities. Commit: `feat(react): separate local sample replacement from routine utilities`.

## Task 9: Replace obsolete UI assertions and validate all browser layouts

**Files:** Create `tests/browser/settlement-operations-responsive.spec.js`; inspect/update only affected assertions in `tests/browser/settlement.spec.js`, `phase6.spec.js`, `shared-task-contracts.spec.js`, `settlement-rules-workspace.spec.js`, `ui-audit.spec.js`, `ui-audit-form.spec.js`, `visual-consistency.spec.js` (all under `tests/browser/`) and scoped `src/styles.scss`. **Spec:** §10/11.

**Interfaces:** Existing four-project offline config; semantic locators and geometry from rendered bounds. Existing `settlement-rules-workspace.spec.js` standalone prompt test becomes inline-record test, preserving paidBy/state assertion. Collect replaced assertion→protected behavior→new test in future evidence ledger.

- [ ] **Write RED responsive cases:** Chromium/WebKit desktop and 390px, light/dark, long room/person/car names, signed large amounts, 390×500, 1055/1056, reduced motion. Checkbox Space/filter Arrow keys, inline input/Cancel/IME, current page/landmark, row removal focus, restore focus trap/return, touch/short viewport, back/refresh retaining draft/operation. Assert document horizontal overflow ≤1px; required actions reachable and not covered; one main/h1; no fixed bottom action obscures rows.
  Named test `H pages retain one main and no document horizontal overflow` uses `await expect(page.getByRole('main')).toHaveCount(1)`, `await expect(page.getByRole('heading', {level:1})).toHaveCount(1)`, and asserts `document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1` on each destination/theme/viewport. Test `keyboard checked row leaves focus on the next outstanding record` identifies the next fixture person's checkbox by accessible name and asserts it is focused.
- [ ] **Run RED:** responsive file `--project webkit-mobile`. Already passing geometry is characterization; only genuinely missing behavior is RED.
- [ ] **Fix only UI owner-local composition/token issues.** Replace old collection/history/sample Modal assertions with page/row/confirmation successor, no change to protected paid/fallback/Undo/calculation behavior. Update cost-entry navigation tests to actual new payment destination instead of keeping obsolete parent card. Retain existing actual numeric/golden assertions and error outcomes; no new skips, snapshot-only proof or timeout waiver.
- [ ] **Run GREEN:** `npx playwright test tests/browser/settlement-operations-workspace.spec.js tests/browser/settlement-operations-responsive.spec.js tests/browser/project-history-workspace.spec.js` across all four projects, then each changed existing browser file. Commit: `test(react): validate H semantics focus and responsive behavior`.

## Task 10: Real multi-client Emulator money and restore recovery

**Files:** Create `tests/browser-emulator/settlement-operations-workflow.spec.js`, UI fixes only to their owning modules if genuine defects found. **Spec:** §11 real transport.

**Interfaces:** Existing Emulator conventions: demo-circle-react, Auth9098/RTDB9008, preview4175, isolated contexts, unique synthetic rooms, authenticated REST readback and cleanup. Reuse reference/domain and existing transport test patterns, no production/staging config or persistent Rules changes.

- [ ] **Write RED:** A/B separate-row collection, same-row correction, paid vs other-car costs/rules/memo, standalone mode/count change, driverPaid/rename/delete/reset; held acknowledgement→reload, foreign outbox/rejection/expired/reconnect/exact retry; memo same-path conflict; restore/Undo while foreign participant/cost changes, backup lost on refresh, compact broad receipt verification. Assert full protected unaffected data/calculation and accepted operation evidence from server, not global sync UI alone. Shared sample URL must emit zero writes.
  Named test `concurrent collection and other-car costs survive reload on both clients` uses authenticated server readback: `expect(after.participants).toEqual(before.participants)` and `expect(after.allocations).toEqual(before.allocations)`; verify both intended edits, exact sync operation ID and domain-calculated amounts, then reload A/B and compare each projection to server state. Named test `unknown replaced outbox does not permit reverse write` confirms unavailable reversal and unchanged write count until exact acceptance evidence appears.
- [ ] **Run focused RED:** guarded demo Emulator command below with new suite only. Missing behavior must fail at the intended assertion, not server/guard initialization.
- [ ] **Correct owning UI defects only.** Temporary scoped denial Rules are restored in `finally`; close clients/held sockets, await quiescence, delete only generated test rooms and authenticated null-readback. Test cache contents for secret/full room duplication without printing private payloads. No domain/sync fallback changes.
- [ ] **Run focused GREEN then cumulative SDK and browser Emulator suites** using existing quality-guard configuration. Resolve `$phaseHEmulatorConfig` to a unique absolute temporary file under task artifacts, write via apply_patch, exact existing Rules absolute path, UI disabled, auth9098/database9008; validate Java/runtime/port availability. Remove/recover only that verified temporary file later, never repository Firebase config.

```powershell
# Repository root; temporary config already created and validated.
$env:SANPO_TEST_FIREBASE_TARGET = 'emulator'
$env:SANPO_TEST_FIREBASE_PROJECT_ID = 'demo-circle-react'
$env:SANPO_TEST_FIREBASE_DATABASE_URL = 'http://127.0.0.1:9008'
node apps/react/tools/assert-test-target.mjs emulator
npx firebase-tools emulators:exec --config "$phaseHEmulatorConfig" --only auth,database --project demo-circle-react "npm --prefix apps/react run test:browser:emulator -- tests/browser-emulator/settlement-operations-workflow.spec.js"
npx firebase-tools emulators:exec --config "$phaseHEmulatorConfig" --only auth,database --project demo-circle-react "npm --prefix apps/react run test:emulator"
npx firebase-tools emulators:exec --config "$phaseHEmulatorConfig" --only auth,database --project demo-circle-react "npm --prefix apps/react run test:browser:emulator"
```

- [ ] **Commit suite and verified UI corrections:** `test(react): verify H concurrent records and restore recovery in Emulator`.

## Task 11: Cumulative evidence, Native review and integration-only finish

**Files:** Create root `docs/design/evidence/PHASE_H_VALIDATION.md`; update Roadmap H outcomes after actual checks. **Spec:** §11 exit.

**Interfaces:** No new product API. Consume all earlier task contracts and prior-phase regression gates; actual merge/CI/browser provenance determines completion.

- [ ] **Run cumulative guarded checks:** `npm test`, `npm run build`, `npm run test:browser` across four projects, H responsive/workspace/history WebKit mobile `--repeat-each=2`, `git diff --check`; root `node tools/classify-release-changes.mjs c33962ed9c28fd3cd94e4a63d52e111a026c7b0f HEAD`. Compare protected executable byte diff separately from existing legacy manifest discrepancies; do not recapture hashes or remove failures. Required shared compatibility selected by existing workflow must pass.
- [ ] **Operate real rendered screens and capture before/after** (base/current build SHA, viewport, theme, scenario): initial/direct/refresh/back, outstanding/check reversal, standalone inline record, memo, restore/cancel/conditionalUndo, sample danger, loading/empty/error/offline, long names/touch/keyboard/focus/overflow. Use available unified browser tools plus Playwright, not screenshots alone. Base fixture and current fixture must represent equal domain state; retain console/trace failures and exact counts.
- [ ] **Record remaining Phase I device/provider work accurately:** actual software keyboard/browser chrome/safe-area/native NVDA/VoiceOver and live Maps/Places/Routes are not proved by viewport emulation/semantic assertions. Retain G's known deferred findings; don't mark them fixed by this phase.
- [ ] **One independent whole-branch review under Native**, using requesting-code-review skill before integration. No per-task implementation agents. Review financial parity, target identity, narrow/broad receipt privacy, one-outbox barrier, latest-room writes, restore/Undo concurrency, memory lifetime, URL/focus, normative traceability and assertion replacement. Reproduce substantive findings, fix owning UI, rerun affected and cumulative gates. Required failures block merge.
- [ ] **Commit evidence, push, PR:** `git push -u origin codex/phase-h-settlement-operations`; `gh pr create --base carbon-redesign --head codex/phase-h-settlement-operations`. Attach created PR in Codex. PR records normative sections, scope/protected bytes, actual tests/browser/Emulator cleanup, assertion ledger, limitations and no-production boundary. Watch existing automatically selected CI; do not dispatch release/readiness workflows.
- [ ] **Merge only into carbon-redesign after required CI/review green.** Fetch remote, verify merged tree corresponds to reviewed/checked head and main unchanged. If base moved, assess/retest cumulative gate first. Record merge SHA/CI links; preserve needed ignored evidence and unrelated files. No production/main action, and no phase completion claim before integration.

## Self-review and execution handoff

| Spec section / acceptance | Tasks |
| --- | --- |
| Authority/official guidance/protected owners and proposed normative update (§0–2/12) | 1, all constraints, 11 |
| IA, URL, current location, entry/return/removal focus (§3) | 4, 8, 9 |
| Parent amounts/readiness/real-check completion (§4) | 2, 4, 9, 10 |
| Collection normal/standalone, context/fallback/copy (§5) | 1–4, 9, 10 |
| Car-level payment, signed values, identity/details (§6) | 1–4, 9, 10 |
| Exact write/barrier/reversal/cache/memo (§7) | 2, 3, 5, 10 |
| Local history/read-back/current/restore/Undo/privacy (§8) | 1–3, 6, 7, 10 |
| Existing local/demo sample danger, no phantom settings (§9) | 8–10 |
| Responsive/accessibility/content/empty/loading/error (§10) | 4–9, 11 |
| Real transport/compatibility/review/CI/integration gates (§11/13) | 10, 11 |

Self-review: fixture/cache/model/controller methods are introduced before dependent tasks; narrow vs broad cache shapes stay distinct; each Review Focus item has named assertion coverage. History preview uses a detached existing owner, not a second restore algorithm. Documentation creation is not UI/test/browser success. Plan is reviewed against the approved spec, with no placeholder implementation choices or delegation before approval.

Handoff: Native is preserved. Ask the user whether this plan captures the approved design, and wait. On approval invoke `superpowers:executing-plans`, establish the execution ledger and implement Tasks 1–11 with one final fresh whole-branch reviewer. Task 1 normative clarification is still pending, not silently published by plan creation.
