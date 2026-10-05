# Phase G: Settlement rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 精算する人が一つのpageでルールを修正し、既存計算への影響を確認し、変更設定だけを安全に保存できるようにする。

**Architecture:** URL owns the rules task. One UI-only controller owns raw settings, recovery and operation-specific receipts; a read-only adapter overlays the existing settings patch onto the latest room and calls the existing domain. App owns page anatomy and navigation focus. Collection, payouts, vehicle costs and protected domain/store/sync remain their existing owners.

**Tech Stack:** React 19.2.8, `@carbon/react` 1.115.0, Carbon Grid/Sass tokens, Node test runner, Playwright 1.61.0, demo Firebase Auth/RTDB Emulator. Dependencies and lockfiles are unchanged.

**Spec:** [Approved Phase G design](../specs/2026-10-05-phase-g-settlement-rules-design.md). [SANPOKAI_PRODUCT_UI.md](../../design/SANPOKAI_PRODUCT_UI.md) is the sole normative Product UI specification; this plan is execution guidance, not a second specification.

Status: written design approved by 「実装計画へ」 and implementation authorized by 「実装へ進んで」 on 2026-10-05. Native Tasks 1–8 are implemented and verified; Task 9 cumulative validation, whole-branch review and integration are in progress. Actual results belong to [Phase G evidence](../../design/evidence/PHASE_G_VALIDATION.md), not this execution plan. No production action is authorized.

## Global Constraints

- Worktree: `C:/Users/toshi/.codex/worktrees/phase-b-shell/circle-kikaku-tools`. Branch: `codex/phase-g-settlement-rules`. Integration base: `carbon-redesign` at `dbd4d76c3456e344d13f2f36004303616b99b385`; approved design commit: `7e2cafa`.
- 「normative ruleを上書きしない。」 Approved clarifications enter the normative owner in Task 1 before Product UI implementation; source descriptions, plan and evidence do not become competing contracts.
- 「wizard、別の確認step、項目ごとのautosaveは導入しない。」 One grouped form and one Save; no new global collector setting, generic personal exemption/percentage editor or completion flag.
- 「previewは既存domainを使う。」 Preserve calculation, identity, participant/allocation/route/cost/payment state, schema, Firebase Rules/config, persistence, sync and legacy owners. Generated files are not regenerated.
- 「settings Saveの許可範囲は既存の9 prefixだけ」。 Publish only changed settings paths, never the opening room, costs, collection, payment or memo.
- 「URLがtask選択の唯一のowner」。 Canonical task is `section=settlement&task=rules`; no local `settingsOpen`, duplicated route state or rule values in URLs.
- 「戻る・refreshで未保存入力を保持」。 UI cache key: `sanpo-ui:settlement-rules:v1:<encoded roomId>`, version 1, sessionStorage with memory fallback. Keep raw changes, original changed-path values, reset generation and exact receipt only.
- 「全outboxが空という理由だけで成功にしない。」 Post-publication inputs are frozen; retries use the receipt's exact changes and existing acceptance/retry helper.
- 「fieldへのtypingごとにpreviewを計算しても、結果全体を毎回live announcementせずfocusを動かさない。」 Form validity, write safety, settlement readiness and global sync status are separate.
- `lg` is installed Carbon 1056px: input groups 10/16 + preview 6/16; below `lg`, one column. One DOM/form, document scroll, inputs → detailed preview → end actions. No unconditional fixed/sticky footer.
- Keep Carbon public controls/tokens/focus, g10/g100, one shell main/h1, Arrow-key radio behavior, logical focus return, 44px-equivalent icon/menu hit areas and reduced motion.
- Phase H collection/payment/memo/history/danger internals stay unchanged. Parent changes are limited to rules entrances, brief rules status and corrective links.
- 「mainへのmerge、Release dispatch、compatibility deploy、root cutover、production smoke、production Firebase writeは禁止。」 Only implementation PR → CI → `carbon-redesign` integration; final program release remains Phase I's separate gate.

## Review Focus

1. Organizer removed/renamed or canonical-equivalent duplicate names: never exempt another person or repoint an unchanged ID. Pin identity safety in Tasks 2/5/8.
2. New driver costs arrive during editing: preview uses them, while settings Save leaves those costs and all paid/collector maps intact. Pin latest-source projection in Tasks 2/4/8.
3. Standalone names/counts shrink or modes alternate: raw hidden inputs recover; existing name-backed financial/payment data are not reset. Pin accepted normalization and recovery in Tasks 1/2/5/7.
4. Rejected/unknown Save reloads while another edit/reset occurs: no fabricated success, replay of acknowledged intent, stale overwrite or newer-draft deletion. Pin receipt/lifetime in Tasks 4/5/8.
5. All-exempt, multiple-driver, organizer-as-driver and nonstandard rounding/dual flags: counts, offset and per-person/per-car rounding remain actual domain results, not an independently plausible total. Pin full results/presentation in Tasks 1/2/6/7.

---

## Execution setup, checks, and ownership

Run executable checks from `apps/react` unless marked root. Use `F:/nodejsss/node.exe`, `F:/nodejsss/npm.cmd`, `F:/nodejsss/npx.cmd`; `node` below means that verified Node runtime. A failed test-target guard, missing runtime or occupied port is a harness failure, not a valid feature RED.

Before each offline test process set and verify:

```powershell
$env:SANPO_TEST_FIREBASE_TARGET = 'offline'
$env:SANPO_TEST_FIREBASE_PROJECT_ID = 'demo-circle-kikaku-tools'
$env:SANPO_TEST_FIREBASE_DATABASE_URL = 'http://127.0.0.1:9000'
node tools/assert-test-target.mjs offline
```

Reject ambient production configuration through this existing guard; do not dump secrets or silently bypass it. `playwright.config.js` rebuilds an isolated offline preview at 4176; do not test stale dist on 4174. Use deterministic promises/expected focus, not arbitrary waits.

| File, relative to apps/react unless marked | Responsibility / permitted change |
| --- | --- |
| `tests/settlement-rules-characterization.test.mjs` (new) | Existing full calculation, normalization and settings-patch characterization |
| `src/ui/settlement-rules-model.js` (new) | Existing canonical settings patch over latest room; form/safety/readiness associations; domain-backed preview |
| `src/navigation/project-navigation.js` | Settlement task URL parse/href/push/replace/snapshot, preserving existing launch identities |
| `src/ui/settlement-rules-draft.js` (new) | Narrow sessionStorage recovery and memory fallback |
| `src/ui/settlement-rules-save.js` (new) | Settings-only publish bridge and existing receipt delegation |
| `src/ui/settlement-rules-controller.js` (new) | Raw form, current-room dependencies, cache ownership, frozen Save/retry lifecycle |
| `src/components/settlement-rules/SettlementRules.jsx` (new) | Controller subscription, grouped form, validation focus, App page model |
| `src/components/settlement-rules/RulesPreview.jsx` (new) | Domain result/readiness presentation, actual car detail and corrective links |
| `src/App.jsx`, `src/components/Settlement.jsx`, `src/styles.scss` | Task connection, page model/focus, existing parent entrances, removal of obsolete settings Modal, owner-local Grid/token layout |
| `tests/settlement-rules-{model,navigation,draft,save,controller}.test.mjs` (new) | Each UI boundary's focused behavior contracts |
| `tests/browser/settlement-rules-{workspace,responsive}.spec.js` (new) | Rendered task, recovery, semantic/focus/geometry and presentation contracts |
| `tests/browser-emulator/settlement-rules-workflow.spec.js` (new) | Real acknowledgement, parallel input, denial/reset/recovery/cleanup |
| Root `docs/design/SANPOKAI_PRODUCT_UI.md` | Approved normative clarification, Task 1; sole owner |
| Root `docs/design/evidence/PHASE_G_VALIDATION.md` (new), `CARBON_MIGRATION_ROADMAP.md` | Actual provenance, assertion replacements, outcomes and remaining gates; not rule owners |

Protected reference-only: `src/domain/**`, `src/store/**`, `src/sync/**`, `src/services/**`, existing `src/ui/allocation-save.js`, `src/components/settlement/edit.js`, vehicle-cost/route owners, root `firebase/**`, `assets/**`, `types/**`, dependencies, test-target guards and workflow files. If a required correction crosses this boundary, stop that change and report the constraint; do not widen Phase G silently.

### Shared interface vocabulary

`Domain`, `CanonicalRoom`, `SettlementEdit` are existing objects from `createRoomStore` and `beginSettlementEdit`. `SaveReceipt` and `SaveResult = {receipt, disposition}` are the existing `allocation-save.js` contract, not a new sync protocol.

`RuleFields` is a partial object of existing UI-state fields: `rounding`, `driverReward`, `driverRewardType`, `driverCollectionOffset`, `driverCollectionFree`, `organizerName`, `organizerFree`, `standalone`. `standalone` retains raw `enabled/driverCount/memberCount/driverNames`; UI choice methods write the existing boolean pair, not a new `driverRule` schema. New organizer selections also retain their selected existing participant ID as UI-only `organizerId`; null means untouched, empty string means cleared.

`RulesRecord = {fields: RuleFields, before: Record<canonicalSettingsPath, value>, resetGeneration: number, organizerId: string|null, receipt: SaveReceipt|null}`. `before` uses the actual patch granularity from the existing settings owner, including standalone's object/subpaths as returned, not a new conflict granularity. No whole room/edit session is cached.

## Task 1: Establish parity and publish the approved design contract

**Files:** Create `tests/settlement-rules-characterization.test.mjs`; modify root `docs/design/SANPOKAI_PRODUCT_UI.md`, approved spec status and root `docs/design/CARBON_MIGRATION_ROADMAP.md` only where its scope text still implies a new collector rule.

**Interfaces:** Consumes existing `createRoomStore`, `beginSettlementEdit`, `writeSettlementDraft`, `tests/reference.mjs::{fixture,createReference,plain}`. Produces named baseline cases consumed by Tasks 2/4, without a new runtime interface or production data.

- [ ] **Write characterization tests before UI code.** Cases: registered/standalone; organizer also driver, non-driver owner, multiple explicit drivers per car; offset/free/both flags; split/club reward; private/Times; signed/blank/pending extras; rounding 1/10/100 and stored 50. Assert complete `plain(calculateSettlement(...))` equality with `createReference()`, participant/projection and canonical paid/collector/car maps unchanged on unrelated rules edits.
- [ ] **Pin raw acceptance observations.** Table rows `''`, `'0'`, `'1,000'`, `'0.5'`, `'100'`, negative ASCII/full-width minus and duplicate/blank names. Assert existing normalize results, raw-count transition guard and reward interpretation separately; do not invent an integer-only/financial validation rule. Characterization may pass immediately and is not called feature RED.
- [ ] **Run baseline:** `node --test tests/settlement-rules-characterization.test.mjs tests/settlement-edit.test.mjs tests/vehicle-cost-calculation.test.mjs tests/phase7-compatibility.test.mjs`. Expected PASS on unchanged executable base; record each failure against the base before proceeding.
- [ ] **Apply the approved normative clarification.** Update §6/11/13/14/20/22 per design §11: collector belongs to collection; exemptions are existing role-based choices, deductions are existing expense types; shareCount ≠ payerCount; rounding scopes, draft/receipt/no-op/conflict, empty standalone entrance, URL, one-form layout and feedback boundaries are explicit. Remove generic personal amount/percentage repository implications. Adjust stale “精算設定を完了”/“精算設定を編集” examples to the canonical rules task wording where necessary; do not redesign Phase H. Bump the normative revision with reason/date and link that actual revision from the approved spec.
- [ ] **Verify document scope/links and `git diff --check`.** No runtime/source assertion is added to enforce prose. Preserve official-vs-project distinctions; ROADMAP only owns scope/order/gates.
- [ ] **Commit explicit files:** `git commit -m "docs(design): fix approved Phase G rules contract and parity baseline"`.

## Task 2: Domain-backed candidate, validation and correction targets

**Files:** Create `src/ui/settlement-rules-model.js`, `tests/settlement-rules-model.test.mjs`.

**Interfaces:**

- `projectSettlementRules({room,edit,domain}) -> {patch,candidateRoom,currentInput,candidateInput,current,candidate,readiness}`. Copy the in-memory settings edit, invoke unchanged `writeSettlementDraft({domain}, copyOfEdit)`, derive `domain.sync.buildSettlementSettingsIntentPatch(edit.session.base, copyOfEdit.session.draft)`, apply only that patch to current `room` using `applyEntityPatchToObject`. Then call `settlementInput`/`calculateSettlement` for both rooms. Never mutate the real edit/store or publish. `readiness` contains existing domain issues plus UI-owned links, not a second calculator.
- `validateSettlementRules(state) -> {valid,fields:[{key,message}]}`. Field keys are `standalone.driverCount`, `standalone.memberCount`, `driverReward`; raw negative guards and standalone raw sum ≤ 0 match Task 1. Nonselected-mode counts do not become required; organizer missing advisory is not a mandatory field.
- `settlementRulesSafety({room,edit,organizerId,patch,domain}) -> [{key,reason,fieldKey}]`. Keys: `reset`, `stale-settings`, `organizer-missing`, `organizer-ambiguous`. Compare actual dirty paths against opening values. Resolve selected organizer with existing ID and canonical name equality; unchanged canonical ID/fallback is preserved.
- `settlementRulesReadiness({room,input,result,domain}) -> [{key,message,destination}]`. Destinations are `{kind:'rule',fieldKey}`, `{kind:'vehicle-cost',destination}`, `{kind:'participants'}`, or null. Rule keys derive from source predicates/result; car fields/rows derive from the unchanged issues owner and Phase F's `vehicleCostTargets`/`vehicleCostFees`. Never parse Japanese messages to decide severity/behavior. Missing/ambiguous cost targets have a reason, not guessed first-car navigation.

- [ ] **Write RED tests:** `preview overlays changed rounding only onto latest expenses and paid maps`; `preview creates no intent and mutates no room/edit`; `unrelated remote rule survives`; `same dirty path is stale`; `organizer ID deletion and canonical duplicate selection block unsafe write`; `readiness lacks costs but does not invalidate rules`. Pin assertions, e.g. `patch === {'settlement/rounding':'10'}`, latest car distance `'222'`, unchanged store identity, intent count 0, full candidate result equals reference.

  In the first case, use the existing fixture's first projected car and edit rounding to `'10'`, then deliver remote distance `'222'`; the test's core assertions are:

  ```js
  const projection = projectSettlementRules({ room: store.getSnapshot(), edit, domain: store.domain });
  assert.deepEqual(projection.patch, { 'settlement/rounding': '10' });
  assert.equal(projection.candidateInput.state.cars[car.name].dist, '222');
  assert.deepEqual(plain(projection.candidate), plain(createReference().calculateSettlement(projection.candidateInput.data, projection.candidateInput.state)));
  assert.equal(store.getSnapshot(), beforePreview);
  assert.equal(intents.length, 0);
  ```
- [ ] **Run RED:** `node --test tests/settlement-rules-model.test.mjs`; new missing exports/contracts fail for the intended reason.
- [ ] **Implement the four interfaces only.** Reuse existing changed-setting conversion rather than writing a parallel canonical normalizer. For missing global issues, predicate parity is tested against the existing owner; structured car field indices map to actual stable fee locators. Preserve signed values and legitimate nonzero `accounting`; never assert that all accounting must balance to zero.
- [ ] **Run GREEN:** prior command plus Task 1's four-file baseline command. Full-result parity and no mutation are required, not one matching total.
- [ ] **Commit model and tests:** `git commit -m "feat(react): derive settlement rules preview from protected domain"`.

## Task 3: URL-owned rules navigation

**Files:** Modify `src/navigation/project-navigation.js`; create `tests/settlement-rules-navigation.test.mjs`; retain `tests/project-navigation.test.mjs` and `tests/vehicle-cost-navigation.test.mjs`.

**Interfaces:** `readSettlementTask(href) -> {task:''|'rules',invalid:boolean}`; navigation adds `getSettlementTaskSnapshot() -> stable JSON string`, `settlementTaskHrefFor(task) -> relative href`, `navigateSettlementTask(task) -> boolean`, `replaceSettlementTask(task) -> boolean`. Only `''|'rules'` are valid outputs; all room/shared launch parameters survive, old presentation selectors are cleared by existing section URL construction.

- [ ] **Write RED using the existing fake history/EventTarget harness:** rules link retains `room=A&handoffToken=shared`; rules→costs→Back→Forward reproduces exact task; refresh parser matches; `view=seisan` opens parent; unknown settlement `task` is marked invalid; replace does not grow history; reselecting settlement clears child task without losing room. No settings, names or candidate amounts enter href.

  ```js
  navigation.navigateSettlementTask('rules');
  assert.deepEqual(readSettlementTask(location.href), { task: 'rules', invalid: false });
  assert.equal(new URL(location.href).searchParams.get('handoffToken'), 'shared');
  navigation.navigate('settlement');
  assert.deepEqual(readSettlementTask(location.href), { task: '', invalid: false });
  go(-1);
  assert.equal(readSettlementTask(location.href).task, 'rules');
  ```
- [ ] **Run RED:** `node --test tests/settlement-rules-navigation.test.mjs tests/project-navigation.test.mjs tests/vehicle-cost-navigation.test.mjs`.
- [ ] **Implement URL methods without local route state.** Off-section snapshot is empty/noninvalid; wrong child task is invalid only inside settlement. Actual room resolution/fallback explanation and heading focus remain Tasks 6/7, not URL parser side effects.
- [ ] **Run GREEN:** same three-file command; all existing allocation/vehicle/legacy navigation contracts pass unchanged.
- [ ] **Commit navigation and tests:** `git commit -m "feat(react): add durable settlement rules task navigation"`.

## Task 4: Narrow recovery cache and settings receipt bridge

**Files:** Create `src/ui/settlement-rules-draft.js`, `src/ui/settlement-rules-save.js`, `tests/settlement-rules-draft.test.mjs`, `tests/settlement-rules-save.test.mjs`.

**Interfaces:**

- `createSettlementRulesDraft({storage,roomId}) -> {read,write,clear,isRecoverable}`; storage is `() => sessionStorage`, record version 1, exact namespace above. Same API shape as Phase F cache; no unrelated cache refactor.
- `publishSettlementRulesEdit(runtime,edit,{organizerId=null}) -> SaveReceipt|null`. Revalidate Task 2 safety at submit, use unchanged `writeSettlementDraft`, commit the existing `settlement-settings` session once with `{close:false}`, then `allocationSaveReceipt(runtime,intent,{type:'settlement-rules',label:'精算ルール'})`. Derive no-op from the actual settings patch before commit; no-intent no-op returns null. Never use global-status-only `commitSettlementEdit` for this task.
- `settleSettlementRulesSave(runtime,receipt,options) -> Promise<SaveResult>` delegates unchanged `settleAllocationSave`; options remain `{retry,observe,onReceipt}`. No new ack/lock/merge protocol.

- [ ] **Write RED cache tests:** isolation by room; version/shape corruption handled without crash; throwing get/set/remove retains memory input and marks nonrecoverable; clearing rules leaves vehicle drafts untouched. Assert stored payload has only RulesRecord, no room/cars/credentials.
- [ ] **Write RED real fixture-sync tests** using `createRoomSync`, `memoryStorage`, `createFixtureServer` from existing helpers. Assert changed rounding is the sole patch; remote car distance `'222'`, paid/collector/memo/route/allocation remain intact; no-op/Cancel produce 0 intents. Exercise accepted own operation, denied, pending/unknown with empty outbox, exact retry, foreign outbox, accepted-then-changed settings and reset. Assert patch/op evidence, not global `kind` alone.

  For the local scoped-save fixture after remote distance update, pin the bridge directly:

  ```js
  const receipt = publishSettlementRulesEdit(runtime, edit);
  assert.deepEqual(receipt.patch, { 'settlement/rounding': '10' });
  assert.equal(runtime.store.domain.settlementInput(runtime.store.getSnapshot()).state.cars[car.name].dist, '222');
  assert.equal((await settleSettlementRulesSave(runtime, receipt)).disposition, 'local');
  ```
- [ ] **Run RED:** `node --test tests/settlement-rules-draft.test.mjs tests/settlement-rules-save.test.mjs`.
- [ ] **Implement cache and bridge.** Keep whole edit only in memory. Cache original dirty-path values and frozen receipt; retry cannot regenerate changes, normalize new input or re-run commit. If selected organizer changed/disappeared, refuse publication with retained input. Do not edit `allocation-save.js` to make a settings test pass.
- [ ] **Run GREEN:** same command plus `node --test tests/allocation-save.test.mjs tests/settlement-edit.test.mjs tests/vehicle-cost-save.test.mjs`.
- [ ] **Commit these four files:** `git commit -m "feat(react): isolate rules recovery and settings save receipts"`.

## Task 5: Single controller with source/conflict/lifetime ownership

**Files:** Create `src/ui/settlement-rules-controller.js`, `tests/settlement-rules-controller.test.mjs`.

**Interfaces:**

- `createSettlementRulesController({runtime,cache}) -> {getSnapshot,subscribe,updateField,setMode,setDriverRule,setOrganizer,save,retry,cancel,confirmCurrent,restartFromCurrent,dispose}`.
- `updateField(key,value)` accepts Task 2's existing RuleFields, boolean/string/standalone values; `setMode(enabled)` retains hidden raw fields, `setDriverRule('normal'|'offset'|'free')` writes the existing pair only after selection, `setOrganizer(participantId)` records the chosen existing ID and projected name after safety checks. Untouched dual flags stay dual; untouched organizer ID is not reassigned.
- Snapshot: `{state,projection,validation,writeIssues,dirty,recoverable,receipt,frozen,status,saving,completion}`. `state` is raw UI state, `projection` is Task 2's return object, validation is form-only, completion is null or terminal Save disposition. Stable snapshot identity changes only on actual controller updates for `useSyncExternalStore`.
- `save({composing=false})/retry() -> Promise<SaveResult>`; no-op disposition `unchanged`, composing `composing`, invalid `invalid`, unsafe `unavailable`. Existing receipt dispositions are unchanged. `cancel()/confirmCurrent()/restartFromCurrent() -> boolean`: Cancel only before publish; confirmCurrent only acknowledged-adjusted/reset; restart only unpublished stale draft with explicitly disclosed draft discard. Pending/unknown cannot discard. `dispose()` unsubscribes/cancels memory edit, never deletes recovery.
- `prepareStandaloneRulesDraft({runtime,cache}) -> boolean` is a local-only empty-state entrance action. If any recovery record exists, leave it intact; otherwise use existing `beginSettlementEdit(...,{standalone:true})` defaults to write the local changed fields and close that memory session. Normal direct URL never forces this seed; mode switching later changes enabled only.

- [ ] **Write RED:** recover raw names/counts/reward after mode alternation and dispose/reopen; two cache failures; all-group invalid submit; IME/no duplicate submit; no-op closes without intent; latest unrelated cost/rule refresh updates projection, not raw input; dirty-path remote edit is stale; identity/reset invalidates correct dependency only. Verify new empty-state draft sets only existing defaults, never overwrites recovered receipt, and creates no shared intent.
- [ ] **Write RED async lifetime tests** with deferred real sync completion: old disposed controller cannot navigate/focus (no component callback in controller) or erase a newer same-room `'1500'` draft; freeze all inputs after publish; received operation result updates its own cache only while owning that persisted record. In accepted-then-remote edit, retry adds no write. Recovered unknown is observed without a fresh publication.
- [ ] **Run RED:** `node --test tests/settlement-rules-controller.test.mjs`.
- [ ] **Implement controller using Tasks 2/4.** Changed fields overlay the original settings edit for its narrow patch; current room feeds preview. Compare cached original path values/reset at recovery and before publish. Explicit re-edit starts from current settings with a fresh session; never silently rebase stale input. Gate every late cache write/clear by persisted-record ownership; page callbacks remain Task 6.
- [ ] **Run GREEN:** prior command plus all five `settlement-rules-{model,draft,save,navigation,controller}.test.mjs` commands and Task 1 parity tests. Check edit-session/subscription cleanup as well as output.
- [ ] **Commit controller and tests:** `git commit -m "feat(react): manage rules draft and concurrent save lifecycle"`.

## Task 6: Dedicated rules page and parent entrances

**Files:** Create `src/components/settlement-rules/SettlementRules.jsx`, `RulesPreview.jsx`, `tests/browser/settlement-rules-workspace.spec.js`; modify `src/App.jsx`, `src/components/Settlement.jsx`, `src/styles.scss`.

**Interfaces:** `SettlementRules({runtime,room,resolved,destination,onPageChange,onReturn}) -> ReactNode`, consumes Task 3 destination and Task 5 controller. `onPageChange({title,description,metadata,back})` is App's derived page model, not another route state. `onReturn({focusId:'settlement-rules-entry',reason:'back'|'saved'|'cancel'|'current'})` requests navigation to settlement parent and logical trigger focus. `RulesPreview({projection,onCorrect}) -> ReactNode`; `onCorrect(destination)` uses Task 2 typed destinations. No new main/h1, editor state or calculation owner.

- [ ] **Capture before provenance before replacing UI.** Offline Phase F executable base, synthetic fixture, old rules steps/standalone/invalid settings, same viewport/theme as after; record commit, build, date and inputs. Use verified prior captures or a separate base preview; do not checkout/reset this branch or call later builds “before”.
- [ ] **Write browser RED using existing `seedVehicleCostRoom` and semantic navigation helpers.** Names: `rules groups compare effects before one Save`; `empty participant parent enters standalone rules`; `invalid submit focuses first field while missing costs permit valid rules Save`; `current flag and rounding values do not migrate on entry`; `rules Save preserves collection payout memo and car costs after reload`. Assert one named form, one h1/main, five group headings, no shared mutation on typing, actual displayed shareCount/payerCount/perPerson/car rounding/offset.

  For invalid reward after blur, assert correction behavior rather than disabled-next-step structure:

  ```js
  await expect(page.getByRole('heading', { level: 1, name: '精算ルール', exact: true })).toBeVisible();
  await expect(page.getByRole('form', { name: '精算ルール', exact: true })).toHaveCount(1);
  const reward = page.getByRole('textbox', { name: '1台あたりの協力代（円）', exact: true });
  await reward.fill('-300');
  await reward.press('Tab');
  await expect(reward).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: '精算ルールを保存', exact: true }).click();
  await expect(reward).toBeFocused();
  ```
- [ ] **Run RED:** `npx playwright test tests/browser/settlement-rules-workspace.spec.js --project chromium-mobile`; expect missing page/behavior, not stale preview or environment failure.
- [ ] **Implement form and preview composition.** Header title `精算ルール`, description `負担と集金の扱いを設定し、計算への影響を確認します。`; groups A–E in design §4 order; Save `精算ルールを保存` at the end with Secondary Cancel, no header duplicate. Registered/standalone modes, names, organizer, rounding/current stored alternative, reward funding, dual/current driver flags and exemption explanations map to existing controls/state. Readiness is separate; no success Toast or total-preview live chatter.
- [ ] **Connect App and parent.** Extend App's destination focus key with settlement task JSON. Client/task/history transitions focus h1, direct first load does not; explicit Back/Cancel/Save use real entry ID. Invalid task fallback waits for room resolution then replaces parent once with reason. Empty parent exposes participant registration and local standalone seed action; rules link is outside each-car payment heading. Use ordinary link semantics for opening task; seed is the explicit same-tab empty action, never a shared write or mode encoded in URL. On completion after departure do not navigate/focus. Delete only `SettingsModal` and its unused imports/styles; preserve CollectionModal and payment/memo logic.
- [ ] **Run GREEN:** same mobile file, then `--project chromium-desktop`; `npm run build`. Inspect installed Carbon RadioButtonGroup/NumberInput/Select/Grid public props and rendered keyboard behavior; do not force hidden input clicks or override Carbon internals.
- [ ] **Commit explicit page/parent/test/style files:** `git commit -m "feat(react): replace rules wizard with dedicated grouped page"`.

## Task 7: Replace obsolete UI assertions and validate responsive interaction

**Files:** Create `tests/browser/settlement-rules-responsive.spec.js`; modify affected existing files identified by `rg -n '精算設定|settlement-settings|精算方法|車出し協力代|次へ' tests/browser`. Known owners: `settlement.spec.js`, `settlement-negative-validation.e2e.spec.js`, `modal-layout.spec.js`, `ui-audit.spec.js`, `ui-audit-form.spec.js`, `carbon-remediation.spec.js`, `visual-consistency.spec.js`; only affected rules assertions change. Extend Task 6 browser tests as needed.

**Interfaces:** Uses the existing four-project offline config and Tasks 2/5/6 contracts. Geometric checks derive from rendered bounds and viewport, not Carbon class names/old modal masks/step count. Existing collection/payment and vehicle/route tests keep their contracts.

- [ ] **Write RED responsive/history/focus cases** for g10/g100, 390×844/390×500, 1055/1056, desktop 1280, long project/person names, large amounts, 99 driver-name inputs and reduced motion. Assert overflow ≤ 1px, one active form across resize, raw input retained, actions reachable/noncovered, radio Arrow keys, touch selection, error summary link, logical Back focus, direct/shared/legacy/refresh/popstate and current navigation. Readiness corrective links must open the exact car/fee and return to the same rules draft (using existing URL navigation back), not create a second vehicle draft.
- [ ] **Run RED:** `npx playwright test tests/browser/settlement-rules-responsive.spec.js --project webkit-mobile`. If geometry already passes, retain it as characterization and record only genuinely missing behaviors as RED.
- [ ] **Implement only owner-local missing layout/focus fixes**, Carbon Grid form 10/preview 6 at `lg`, single column below, one form containing input groups then detailed preview then end actions. Preview money/rules are read-only; its disclosure and corrective links remain keyboard-operable in the same DOM sequence before end actions. They do not create a second editor/Save owner. Mobile metadata only essential counts/amount; no fixed tray/independent scroll cage.
- [ ] **Replace each obsolete rules assertion with its observable successor.** Negative counts/reward now assert `aria-invalid`, correction text and invalid-submit focus, not disabled “次へ”; Cancel/raw recovery/rounding/save/paid parity are retained. Log old assertion, protected behavior and new test name. Do not rewrite unrelated legacy UI requirements, add skips or weaken monetary/keyboard assertions.
- [ ] **Run GREEN:** `npx playwright test tests/browser/settlement-rules-workspace.spec.js tests/browser/settlement-rules-responsive.spec.js tests/browser/settlement.spec.js tests/browser/settlement-negative-validation.e2e.spec.js tests/browser/modal-layout.spec.js tests/browser/carbon-remediation.spec.js tests/browser/visual-consistency.spec.js` across all four projects. Newly changed audit files also run focused; old applicability skips are listed separately, never introduced to hide a failure.
- [ ] **Commit tests and narrow fixes:** `git commit -m "test(react): validate rules page behavior across Carbon breakpoints"`.

## Task 8: Real Emulator parallel settings and receipt recovery

**Files:** Create `tests/browser-emulator/settlement-rules-workflow.spec.js`. Reuse existing vehicle/allocation Emulator conventions without modifying the protected helpers/Rules/config; local test scaffolding stays in this suite.

**Interfaces:** Two isolated browser contexts, demo RTDB server read through existing migration owner, held websocket acknowledgement and narrowly scoped temporary Emulator denial. RulesRecord survives refresh in the same session; distinct clients have distinct local drafts.

- [ ] **Write failing real-transport cases:** rules rounding vs other client driver distance; different settings paths; same dirty path changed before submit; post-submit adjusted result; rejection→reload→exact retry; held/unknown ack with foreign operation; own accepted then remote settings changed; reset/organizer removal/canonical duplicate selection; leave before delayed completion. Assert all unaffected canonical car/paid/collector/participant/allocation/route/memo data and full calculation parity. No request goes to production.
- [ ] **Run focused RED after test-target preflight**, via the commands below with `-- tests/browser-emulator/settlement-rules-workflow.spec.js`. Missing contracts must fail at intended behavior, not missing Emulator/permission/config.
- [ ] **Fix only verified UI adapter/controller defects.** Keep existing same-path merge/retry semantics, settings prefix scope and current canonical identity. Each test restores temporary denial Rules and deletes its dedicated room in `finally`, closes held sockets/clients, checks acknowledgement/outbox quiescence where applicable, verifies restored Rules and authenticated null room readback.
- [ ] **Run GREEN focused then cumulative Emulator suites.** Use `.github/workflows/quality-guard.yml`'s existing emulator configuration: Auth 9098, RTDB 9008, UI disabled, existing `firebase/database.rules.json`; demo project `demo-circle-react`. Create a uniquely named temporary config via `apply_patch`, never modify `firebase.json`, and remove only that verified temporary file afterward.

```powershell
# Repository root, config path is the validated task-specific temporary file.
$env:SANPO_TEST_FIREBASE_TARGET = 'emulator'
$env:SANPO_TEST_FIREBASE_PROJECT_ID = 'demo-circle-react'
$env:SANPO_TEST_FIREBASE_DATABASE_URL = 'http://127.0.0.1:9008'
node apps/react/tools/assert-test-target.mjs emulator
npx firebase-tools emulators:exec --config "$phaseGEmulatorConfig" --only auth,database --project demo-circle-react "npm --prefix apps/react run test:browser:emulator -- tests/browser-emulator/settlement-rules-workflow.spec.js"
npx firebase-tools emulators:exec --config "$phaseGEmulatorConfig" --only auth,database --project demo-circle-react "npm --prefix apps/react run test:emulator"
npx firebase-tools emulators:exec --config "$phaseGEmulatorConfig" --only auth,database --project demo-circle-react "npm --prefix apps/react run test:browser:emulator"
```

`$phaseGEmulatorConfig` must be resolved to a unique absolute temporary file before execution; the config is the exact existing workflow format with an absolute Rules path. Assert Java/runtime availability and ports first. Unit fixture transport does not substitute for the real Emulator acceptance tests.

- [ ] **Commit suite and owning UI fixes only:** `git commit -m "test(react): verify concurrent rules saves and recovery in Emulator"`.

## Task 9: Cumulative gate, rendered evidence, review and integration

**Files:** Create root `docs/design/evidence/PHASE_G_VALIDATION.md`; update Roadmap Phase G outcome/remaining gates only after observed results. Preserve local screenshot/trace artifacts; link selected before/after evidence with provenance.

**Interfaces:** Consumes G-01–G-12 and prior-phase behavior contracts. No new runtime interface; actual CI and integration are required before marking Phase G complete.

- [ ] **Run full offline cumulative checks:** guarded `npm test`, `npm run build`, `npm run test:browser` (four projects), focused rules `--repeat-each=2` on WebKit mobile, `git diff --check`, root `node tools/classify-release-changes.mjs dbd4d76c3456e344d13f2f36004303616b99b385 HEAD`. Assert protected executable diff empty separately from historical `npm run verify:legacy` manifest mismatches. Do not refresh hashes/skip failures; classify the same base failing IDs and run required Shared Compatibility checks selected by the classifier/workflow.
- [ ] **Operate rendered screens**, Chromium/WebKit desktop/~390px, light/dark: parent entry, standalone, raw edit/preview, disabled/failure/recovery/stale, keyboard/radio/invalid focus, corrective vehicle link, long form/overflow/Back/Forward/refresh. Capture equivalent before/after states, viewport/theme/input/build SHA, console errors and exact test counts. Use available unified browser control plus configured Playwright, not screenshots alone.
- [ ] **Record Phase I-only gaps candidly:** physical software keyboard/browser chrome/safe area, native NVDA/VoiceOver, actual safe Maps/Places/Routes provider validation. Emulated taps/semantics/mock SDK do not prove these. They are deferred device/provider gates, not waived requirements.
- [ ] **Request one independent whole-branch review under the selected Native method**, using requesting-code-review skill before integration; no task implementer delegation. Review normative/plan/spec traceability, monetary/identity parity, settings-only writes, current-source preview, receipt/no-op/reset, controller lifetime, URL/focus and test replacements. Reproduce and effect-grade findings, fix verified defects, rerun affected and cumulative checks; record unresolved issues and block merge for required failures.
- [ ] **Commit evidence and push feature branch:** explicit paths, `git push -u origin codex/phase-g-settlement-rules`. Create `gh pr create --base carbon-redesign --head codex/phase-g-settlement-rules`; PR includes normative sections, protected diff, actual browser/Emulator results, assertion replacement map, limitations and no-production boundary. Attach PR using Codex artifact tool. Watch the existing automatically selected CI; do not manually dispatch release/readiness/deploy workflows.
- [ ] **Merge only after required CI/review passes**, using repository-supported merge into `carbon-redesign`. Fetch and verify remote merge SHA/tree against reviewed head and main unchanged. Evidence-before-success: document merge/CI links and any base movement/retest requirement. Preserve necessary ignored artifacts before recoverable worktree cleanup; don't remove unrelated files. No main merge/release/smoke/Firebase production action.

## Plan self-review and handoff

| Approved acceptance | Owning tasks |
| --- | --- |
| G-01 URL/current navigation/focus | 3, 6, 7 |
| G-02 mode/empty/recovery/no shared preview write | 2, 4, 5, 6, 7 |
| G-03 raw/normalization/stored alternatives | 1, 2, 5, 6, 7 |
| G-04 full protected financial parity | 1, 2, 4, 8, 9 |
| G-05 counts/rounding/offset/result presentation | 2, 6, 7 |
| G-06 form/readiness/precise correction focus | 2, 6, 7 |
| G-07 changed settings scope/Cancel | 4, 5, 8 |
| G-08 receipt/unknown/exact retry/foreign outbox | 4, 5, 8 |
| G-09 real concurrent costs/settings/identity/reset | 8 |
| G-10 lifetime/cache failure/record ownership | 4, 5, 8 |
| G-11 browser/theme/touch/keyboard/responsive | 6, 7, 9 |
| G-12 prior workflows/protected bytes/old assertions | 1, 7, 8, 9 |

Self-review: every new interface is produced before consumption; RuleFields/RulesRecord, projection and receipt vocabulary remain consistent. Each Review Focus item has explicit tests in its owning tasks. Characterization PASS is not invented RED; new feature RED is isolated from harness/baseline failures. The plan fixes contracts and assertions, not generated calculation bodies or new schema. No implementation/CI/browser outcome is asserted at this planning checkpoint.

Execution handoff: **Native is preserved from the user's prior selection**. Ask the user to review whether this plan captures the approved design. On approval, invoke `superpowers:executing-plans` and execute Tasks 1–9 in order; end with the independent whole-branch review and integration-only gates. Do not start implementation while plan review is pending.
