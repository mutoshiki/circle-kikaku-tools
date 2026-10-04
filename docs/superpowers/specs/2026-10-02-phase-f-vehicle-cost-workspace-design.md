# Phase F implementation design: vehicle costs, movement, and route

Status: written specification approved by the user's 「進んで」「続行」 on 2026-10-02. Implementation plan prepared for review; Product UI implementation has not started.

Integration base: `carbon-redesign` at `f232d8d7de2c2077255c47e7f6e02f0085cfda77` (Phase E integrated). Working branch: `codex/phase-f-vehicle-cost-workspace`.

## レビュー要点

- 各ドライバーが「車両費用」から対象車を選び、距離・必要な費用を入力できる。車割・精算からも同じworkspaceへ入る。本人と車を認証情報から推測しない。
- Desktopは対象車の費目一覧と選択中の編集領域、mobileは車一覧→費目一覧→費目編集。任意順に編集でき、wizardや必須の確認stepにしない。
- 通常の費目入力は車のdraftへ保持。「この距離を適用」は計算結果をそのdraftへ移す。「車両費用を保存」だけが車単位の共有保存を行う。
- 戻る・費目切替・ルート往復ではdraftを保持。明示的キャンセルは未保存draftだけを破棄。端末反映後の保存失敗を「キャンセルで元に戻る」と説明しない。
- 地点検索、経由地編集、ルート候補、地図、道路設定、距離の直接入力を維持。地図が使えなくてもtaskを完了できる。
- 標準／追加費用、登録済み費用の再利用、自家用車／タイムズ、割勘／部費、差引、人数だけの精算、内訳を維持。計算・schema・sync・canonical persistenceは変更しない。
- 本書は実装設計。唯一のnormative Product UI仕様は引き続き `SANPOKAI_PRODUCT_UI.md`。承認後に必要なinteractionの具体化をそのownerへ反映してから実装する。

## 0. Authority, brief, and scope

[SANPOKAI_PRODUCT_UI.md](../../design/SANPOKAI_PRODUCT_UI.md) v1.3 is the sole normative Product UI specification. This implementation design derives from §1–6, §10, §12, §16–23 and [Roadmap Phase F](../../design/CARBON_MIGRATION_ROADMAP.md#phase-f--route-movement-and-vehicle-cost-workspace). [Product Principles](../../design/CARBON_PRODUCT_PRINCIPLES.md) owns official evidence and cross-product principles; [Carbon Patterns](../../design/CARBON_PATTERNS.md) owns selection criteria; [Current Audit §12–13](../../design/CURRENT_UI_AUDIT.md#12-route-and-movement) supplies descriptive evidence.

All product choices below are **Project interpretation**, not statements that Carbon prescribes this application's navigation or save model. If a proposed clarification conflicts with protected behavior or the normative owner, stop at that boundary; do not weaken the owner or quietly change a domain protocol.

### Agreed user goal

前日まで・当日・登山後のいずれでも、距離や必要な費用が分かった人が対象車へ入力し、複数ドライバーの情報を精算へ渡せる。精算担当者は同じ値と内訳を確認できる。全員が企画の概要や精算設定を巡回する必要はない。

The user approved a separate vehicle-cost destination, Desktop list/editor, Mobile drill-in, dedicated route page, explicit route Apply versus per-car shared Save, and preservation of current capabilities. No new role, driver account, publication/completion flag, mandatory stage, random-allocation provenance, or messaging service is implied.

### In scope

Vehicle-cost navigation and entrances; car selection; standard/additional expense presentation and editing; existing movement inputs; per-car UI draft recovery; route/search/result/map/options task orchestration; draft/Apply/Save/Cancel/Back feedback; accessibility, responsive behavior and relevant contract coverage.

### Out of scope

Settlement-rule redesign (Phase G), collection/payment/history/settings redesign (Phase H), allocation/participant workflow changes, allocation algorithm, settlement calculation, route calculation/SDK request semantics, Firebase Rules/configuration, schema, domain/store/sync protocol, canonical persistence, legacy UI, and production operations.

Existing rule, collection, payout, memo and history surfaces remain reachable. Phase F may replace their car-cost entrance with a link to the common workspace, not redesign those workflows.

## 1. Evidence and protected owners

The following are source observations on the integration base, not acceptance results for the new UI:

| Owner | Current responsibility / constraint | Phase F treatment |
| --- | --- | --- |
| [Settlement.jsx](../../../apps/react/src/components/Settlement.jsx) | Vehicle rows open `CarEditor`; a single dialog swaps expense / extra / movement / route views, scroll ownership and focus selectors | Extract the car-cost UI into a durable workspace; remove this cost/route dialog state machine only |
| [settlement/edit.js](../../../apps/react/src/components/settlement/edit.js) | Existing UI draft, canonical conversion, store commit, flush; ID-backed cars use `settlement-car`, name-only cars currently use the generic edit scope | Preserve canonical conversion/commit owner; narrowly adapt cost-only UI orchestration and test the target write set for both representations |
| [room-store.js](../../../apps/react/src/store/room-store.js) | Edit sessions, canonical publish, reset/participant checks, `commitEdit` returns an intent | Use public edit/intent boundary; do not change store semantics |
| [domain/index.js](../../../apps/react/src/domain/index.js) | `settlementInput` supplies current allocation or standalone cars, and the legacy-compatible UI state | This is the source of which cost cars exist; do not infer one cost account for every explicit driver role |
| [generated/canonical.js](../../../apps/react/src/domain/generated/canonical.js) / [generated/sync.js](../../../apps/react/src/domain/generated/sync.js) | ID/name storage compatibility, name projection, expense identity/normalization, narrow `buildSettlementCarIntentPatch`, concurrent merge | Protected. UI target labels and URLs do not redefine identity or merge policy |
| [generated/settlement.js](../../../apps/react/src/domain/generated/settlement.js) | Movement, Times fees, signed extras, driver reward, standalone inputs, totals, readiness | Consume unchanged results/helpers; no replacement calculation |
| [RoutePlanner.jsx](../../../apps/react/src/components/RoutePlanner.jsx) | Stops/search, candidates, optional map/options, Apply callbacks and internal search view; route requests can finish after later input | Replace task orchestration and composition; fence stale async results at the UI owner |
| [runtime.js](../../../apps/react/src/runtime.js) | `routeDraft` uses `sanpo.routePlannerState.v2:<roomId>` in local browser storage | Keep the existing key/format readable; it is a last-used local itinerary, not shared per-vehicle route storage |
| [route/service.js](../../../apps/react/src/route/service.js), [legacy-domain.js](../../../apps/react/src/route/legacy-domain.js), [google-maps-adapter.js](../../../apps/react/src/route/google-maps-adapter.js) | Places resolution, Routes requests/fallback, serialization/ranking, selected-distance conversion and map rendering | Keep request and calculation behavior unchanged; fixtures exercise the same interface |
| [project-navigation.js](../../../apps/react/src/navigation/project-navigation.js) / [App.jsx](../../../apps/react/src/App.jsx) | Canonical section URL, inbound compatibility, shell and focus destinations | Extend navigation with the real vehicle-cost surface; do not duplicate URL state into an independent active-page state |

The current route warning says places are shared in the room; React `routeDraft` itself writes only local storage. New wording distinguishes external Google search/calculation requests, local route recovery, and the shared expense distance. Do not claim that detailed stops are shared merely because a distance can later be saved.

Name projection can collapse same-name entries even though canonical storage is ID-based. Name-only standalone/legacy edits also require write-set characterization. These are technical constraints, not a reason to remove standalone mode, rename people, or replace schema. Identity and write isolation must be proven before switching those entrances.

## 2. Chosen IA and rejected alternatives

### Chosen structure

`参加者 → 車割 / 班割 → 車両費用 → 精算` describes common task order, not a required sequence. Overview/history remain secondary. Insert the functioning `車両費用` link after `班割` and before `精算`, including current-section semantics and mobile navigation.

```text
車両費用（対象車を選ぶ、確定値を見る）
  └─ 対象車の費用（費目一覧、draft状態、計算preview）
       ├─ 費目編集（移動条件 / 標準費目 / 追加費目）
       └─ 移動距離を計算
            └─ 出発地 / 目的地 / 経由地を検索
```

車割の対象車と、精算の「費用を入力」はこのworkspaceへ接続する。ルート入口も同じtarget/draftを使い、呼出元ごとの別editorを作らない。

### Alternatives

- **精算内だけの編集**: one entry is simpler, but drivers must find a personal input task inside the organizer's aggregate task. Reject as the only entrance; retain settlement links for review/correction.
- **全車・全費目を1枚のformへ展開**: permits comparison but confuses save ownership and parallel entry, and overloads mobile. Reject; car selection is read/scan, editing is per car.
- **段階固定wizard / nested Modal**: makes a short sequence explicit but forces unnecessary Apply/Next repetitions during frequent corrections. Reject; expense order is arbitrary and route is a nested optional task, not a required stage.

## 3. Target identity, URL, and return context

### Identity

- Use the cost vehicles actually returned by `settlementInput`, not anonymous auth, applicant vehicle availability, a guessed driver, group label, or display row index.
- ID-backed targets use the existing `participantId` cost identity. Name-backed targets use the exact existing fallback key with an explicit namespace; do not mint a canonical car ID for standalone data.
- A group link resolves the current group's projected cost target at click time. `groupId` and cost `participantId` are not interchangeable. Multiple explicit drivers do not create extra fee accounts unless the protected domain already supplies them.
- Same display names are visually disambiguated using projected order/context where possible, but labels never choose storage ownership. Legacy name projection ambiguity must be exposed by a focused characterization test, not hidden with a visual suffix.
- If no unambiguous target/write set can be produced through existing boundaries, do not redirect Save to a guessed target. Preserve data and the recoverable draft, explain the unresolved target, and request separately scoped approval if a protected-owner change is necessary. Do not claim that visual disambiguation fixes calculation identity.

### URL contract

Add `section=vehicle-costs`. This design selects the following UI route shape; it is not a database schema:

| Task | Query state |
| --- | --- |
| Vehicle list | `section=vehicle-costs` |
| Vehicle workspace | `section=vehicle-costs&car=<target>` |
| Expense editor | Above + `task=expense&expense=<expense target>` |
| Route planner | Above car context + `task=route` |
| Place search | Above car context + `task=route-search&stop=<origin/destination/waypoint target>` |

`<target>` is URL-encoded `participant:<existing ID>` or `name:<existing fallback key>`. Movement is a reserved expense target; existing extras use their domain IDs. An ID-less compatible extra uses a UI-only session locator tied to its original row, never a new shared identity or a persisted mutable array-index contract. After refresh, resolve only if the original row is still identifiable; otherwise return to its fee list without committing or dropping the draft.

Keep return context as allowlisted internal destinations (`vehicle-costs`, the same car-allocation group, or `settlement`) plus the necessary stable target. It survives refresh/deep link via validated UI query state, not an arbitrary URL redirect. Store no draft, addresses, amounts, credentials, or whole snapshot in query parameters. Invalid targets wait for initial room resolution, then replace to the valid parent with a concise reason. Never briefly show a different car as a fallback.

Task URL builders retain only parameters relevant to the chosen task. Route/search does not retain an active expense query; the selected parent fee lives in the car's UI draft/return context. Leaving vehicle costs removes its car/expense/stop/return parameters while preserving existing project/shared-link parameters. A waypoint search locator is checked against the current itinerary revision and original stop; reordered/removed/repeated stops must not cause a result to update a different waypoint.

### Navigation behavior

- Direct/shared URLs open the specified project/car/task. Room-only landing remains participants; legacy `view=...` links continue resolving through the existing owner.
- Browser Back/Forward follows visited tasks and preserves UI drafts. Reload restores task context and recoverable drafts; a new device sees canonical saved costs, not another device's unfinished draft.
- Parent Back is a Link, not Cancel or a secondary form action. Fee edit → fee list; search → route; route → original cost editor or car-allocation group. Missing return context defaults to the same vehicle workspace.
- Successful route Apply always exposes the target vehicle's movement editor with the applied draft distance and unsaved status. If opened from car allocation, retain a separate `車割へ戻る` link to that group. Returning to allocation does not save the distance.
- Resize changes presentation, not URL, selected expense, draft, query or route target. Navigation owns page location; component state owns only ephemeral disclosure/async state.
- Successful shared Save closes the editing task: return to the vehicle list, or to the recorded settlement/car-allocation entrance when present. Restore its logical trigger if it exists; otherwise focus the destination heading. Browser history must not resurrect an already accepted dirty draft.

## 4. Page anatomy and action placement

Use the existing shell/page header and normative §4 type roles. Context/title/description → metadata → navigation/sub-task links → main content; place feedback near its owner. No repeated wrapper Tile or independent fixed footer.

| Surface | Header / metadata | Main content / supporting content | Main action |
| --- | --- | --- | --- |
| Vehicle list | `車両費用`; project context; real car count and problem summary only | Comparable car rows: vehicle/driver context, saved distance, saved total, issue/draft status, explicit link | None; selecting a car is navigation |
| Vehicle workspace | `<対象車>の費用`; draft/sync state; preview marked `保存前の合計` when dirty | Fee list, selected editor on desktop; domain formula/amount preview adjacent to relevant inputs | `車両費用を保存` at the end of the active form; Secondary `キャンセル` |
| Mobile expense editor | Fee/task `h1`; target car as context; car-wide unsaved state | Selected fee form, its formula/preview, car-wide issue summary when Save finds other invalid fees | Same car-wide Save, explicitly described as saving this car's draft, not only the visible row |
| Route | `移動距離を計算`; target car/current draft distance; explicit parent link | Stops → text route candidates/selected summary; optional map beside on desktop / disclosed below on mobile; options disclosure | `この距離を適用`, after results; not a shared Save |
| Place search | `<地点の役割>を検索`; car/route context; Back link | Search, query-owned result count, candidates/recent places, local feedback | Selecting a result completes this local selection; no generic Confirm button |

Form commit actions sit after their inputs/results rather than being duplicated in the page header. Keep one Primary per current page/task. A fee switch/editor is not a second transaction context; do not show both route Apply and car Save while route is active.

`費用を追加`, `登録済みから追加`, and `ルートから距離を計算` are discoverable sub-task starts, not competing Primary actions. Real navigation uses Links with optional supported Carbon button styling. Copy/delete/map/disclosure are not page-level Primary actions. Additional-fee Delete lives in its Overflow, not icon-only danger.

Vehicle-list totals stay canonical; they do not incorporate another car's local draft. If a target has a draft, show `未保存の入力あり` and an entry to resume it. Do not invent a last-saved timestamp, author, paid/completed status or a completion percentage. Show existing last-update data only with its true scope; project activity is not proof that this car's cost was updated.

## 5. Expense structure and capability preservation

### Common fee-row anatomy

Fee name → domain amount with sign/unit → burden category / relevant formula or state → explicit edit entrance → optional low-frequency actions. Standard and additional rows share alignment and hierarchy, without pretending they have identical permissions.

### Movement and standard fees

- Movement editor keeps vehicle type, manual distance, private-car fuel economy and gas price, Times handling, and existing movement burden category. Group dependent values together with visible unit labels.
- Manual distance is always available independently of route API setup or result. It is not a degraded hidden recovery path.
- Formula/amount comes from unchanged domain results; formula wording explains inputs rather than calculating a replacement payable amount. Route-display precision and applied-distance rounding remain the existing helper's behavior; show the exact value that will be applied with its `km` unit.
- Preserve private/Times switching normalization, dormant fee behavior, Times time/distance rules and driver compensation. Do not zero or delete data merely because another vehicle type hides its input.
- Read-only driver compensation explains that its rule is managed in settlement; keep the existing rule entrance. Do not add its editor to Phase F.
- Standard fees have no Delete action. Keep the existing accepted zero-value treatment; do not introduce a new shared enable/disable flag.

### Additional fees and reuse

- Preserve name, numeric amount, split/club category, and separate `費用から差し引く` boolean/type semantics. Non-negative amount input plus the existing signed category is not a raw negative-number editor.
- Create each extra's existing domain ID once per intended addition. Back/retry/reload does not generate a second fee.
- Adding opens a draft expense editor. Ordinary typing goes directly into the per-car draft; no mandatory `入力→確認→登録` or per-field Apply loop.
- Preserve current `pending`/normalization acceptance for incomplete new expenses. On final Save, explicitly explain any incomplete draft row that will not become a saved fee; do not silently claim it was saved. Do not invent stricter financial/domain validity rules.
- Preserve `登録済みから追加` and the existing candidate inclusion/deduplication semantics. Show copied name/amount/category before final car Save; later edits to the source fee do not silently alter this copied draft fee.
- Delete removes only the target additional fee from this unsaved car draft. Explain that shared removal occurs on car Save. Cancelling the car restores the saved fee. A new unsaved row can be removed without a destructive shared-data confirmation.
- Neither expense-row removal nor car draft Cancel removes participants, cars, routes, payments or global rules. Do not advertise a persistent Undo that the owner does not provide.

## 6. Draft, Apply, Save, Cancel, and receipts

### One editing owner per car

Entrances from vehicle costs, settlement and allocation resolve to the same `(project, cost target)` UI draft. Fee list/detail and nested route tasks share that owner. Do not persist the entire room as a UI cache, duplicate other feature drafts, or create independent car drafts per entrance.

Use the existing UI-local recovery pattern in [participant-task-draft.js](../../../apps/react/src/ui/participant-task-draft.js), with a **separate vehicle-cost namespace** and narrow per-car data. A versioned session-storage cache may contain this car's raw inputs, the original relevant field values needed for stale-draft checks, reset generation, target identity, selected fee, and a narrow save receipt. It is not authoritative room persistence and does not change Firebase schema/protocol. Storage exceptions keep live input and report that reload recovery is unavailable.

Rehydrate from current canonical data; overlay only this task's unfinished inputs, never a cached room or all-car state. After reset, target removal, identity change, incompatible cache or conflicting base, retain recoverable input separately and require a valid target/current context before committing. Do not remap an old name/ID to a replacement by visual similarity.

### State transitions

| State / action | Local effect | Shared effect / next surface |
| --- | --- | --- |
| Open car | Start/recover this car's draft with current baseline | None |
| Type / fee switch / parent Back | Preserve raw values, selected fee and relevant position | None |
| Route Apply | Put the helper-produced distance into this car's draft; return to its movement editor | None; show `距離を適用しました。車両費用は未保存です` as contextual status, not a success Toast |
| Cancel before commit | Discard only this car's unsaved cost draft and receipt-free task; close editor | No write; retained local itinerary is not a shared expense change |
| Save | Validate all this car's draft fields; publish one scoped existing intent; freeze submitted content | Local intent may apply before network acknowledgement; show saving/unconfirmed, not confirmed shared success |
| Save succeeds | Clear only accepted task draft/receipt; close editing task | Show canonical accepted/current cost at destination; no generic success Toast |
| Save fails / acknowledgement uncertain | Retain frozen payload and narrow receipt; expose retry/current-value action | Do not show `共有保存済み`; no automatic replay into newer unrelated data |
| Retry | Continue original operation/precise reconciliation via existing sync boundary | Never regenerate extra IDs or use a new whole-car overwrite to force success |
| Leave after local commit | Preserve receipt; explicitly state that already applied changes are not undone by leaving | Do not issue an inverse write or label navigation as Cancel |

Normal fee editing has no compulsory intermediate Apply. Route Apply is necessary because it transfers a separately calculated result. Final Save is necessary because several car fields/extras form one user-intended change. An IME Enter must not submit while composing.

In an actual local-only runtime, successful Save means `この端末に保存`, not shared acknowledgement. Emulator/shared runtime evidence must prove the additional shared acceptance. Offline UI acceptance does not justify displaying `共有保存済み` for a runtime without transport.

### Write set and concurrency

- Preserve existing canonical conversion, store command/edit semantics, IDs and sync reconciliation. Use the existing `buildSettlementCarIntentPatch`/scoped edit boundary; no changes to generated domain, store or sync.
- Both ID-backed and name-backed car saves must be verified to write only the selected car's existing paths. The name-only UI adapter may select the existing `settlement-car` scope with its name argument; it must not add a new domain scope/command.
- Do not save all `edit.state.cars`, rules, standalone counts/names, paid maps or other car drafts as a page-wide transaction. Test full actual intent paths, not just a convenient prefix.
- Same-car concurrent edits preserve existing field-version/extra-ID merge outcomes. Do not promise a lock or invent a conflict winner. Different car inputs remain isolated; unrelated changed rules are consumed as current preview inputs without being written by the car draft.
- Use Phase C–E operation-specific UI receipt conventions. Persist only the original change paths/base values/reset generation and needed operation identity, not a full snapshot or auth token. Freeze input after local application so visible new input cannot be mistaken for that operation's success.
- Outbox emptiness or a global sync `success` alone is not proof this operation was accepted. Use existing observable intent/outcome/current-path evidence. If acceptance/reconciliation cannot be established, preserve `保存結果を確認できません` rather than asserting success or retrying destructively.
- Background completion after navigation never steals focus. Reset/participant removal prevents stale target resurrection; accepted changes are not replayed over later edits.

## 7. Route task, itinerary recovery, and application

### Data boundary

The existing room-keyed `runtime.routeDraft` remains compatible as the last-used local itinerary. It is not vehicle ownership or synchronized detailed stops. A per-car **UI-local** working route context isolates concurrent unfinished car tasks within the tab; seed it from the compatible itinerary only when no task-specific draft exists, labelled as a previous local route to review, not that vehicle's verified route.

The route UI may continue updating the existing last-used cache through its owner; do not change its key/format or migrate it into Firebase. Nested task recovery stores only plain resolved stops, serialized results/options/selection/query needed for this task. Raw Places SDK prediction objects and methods remain ephemeral; re-query after reload rather than serializing SDK internals. Cancel cost edits does not erase the user's existing itinerary cache; applying distance does not claim that stops were published.

### Route anatomy and interaction

1. Target car/current draft distance and explicit parent link.
2. Origin, ordered waypoints and destination with role/name/address; add/search/edit/remove and Up/Down keyboard/touch alternatives. Keep the current waypoint limit and stop ordering.
3. Candidates and selected text summary: route label, distance, duration, available toll estimate and leg summaries. Label toll values as estimates, not automatically registered expense charges.
4. Optional map, consuming the selected candidate; no task depends on map clicks.
5. Disclosed route settings retaining current toll/highway controls and compatible option state. Do not introduce a round-trip mode or multiply distance in UI; the current route task submits single-trip behavior. Preserve dormant compatible values such as ferry settings through the existing service.
6. Single `この距離を適用` action after a usable current result. Show the helper's applied km value next to it. Disable with a visible reason for no selected route/current calculation, rather than applying an old candidate to new stops.

Do not add a separate confirmation for each stop or route. Resolving a place returns to the route task and updates only that selected stop. Reordering/removing/changing settings invalidates obsolete results and runs the existing calculation flow when prerequisites permit. No new route ranking, fuel optimization, fare formula, or external request policy is introduced.

### Async ownership

Bind every search/resolve/calculate/map completion to the active project/car/task plus input revision. Apply a result only if those still match. An old query, removed waypoint, newer options, another car, cancelled task or unmounted page cannot overwrite current state or clear its loading/error. UI revision tokens are not shared domain versions.

Keep the latest query and resolved stops on error. Differentiate no results, search/resolve failure, route failure, and map failure by typed UI operation state; do not parse localized provider messages into routing/severity rules. Display actionable user wording, with underlying diagnostic details confined to appropriate logs, not API keys or internal adapter names in UI.

## 8. Empty, loading, error, and validation

| State | User-facing treatment / recovery |
| --- | --- |
| Room loading | Existing page skeleton/status; do not resolve a car as missing before load completes |
| No cost cars | Explain the relevant prerequisite and link to car allocation, or the existing standalone setup when that mode is in use; do not demand participants in valid standalone mode |
| Vehicle/fee no longer available | Retain draft safely; show target loss and current list entrance; no silently selected replacement |
| Clean / dirty / recovered draft | Local concise status; recovered draft is not shared saved data |
| Incomplete/invalid cost input | Existing accepted domain semantics; field label/error association, car-wide issue summary and corrective fee link |
| Save attempted with invalid hidden fee | Navigate/select that fee, expose error, focus its first invalid input; no silent disabled button with no explanation |
| Other car / global-rule issues | Keep them visible as appropriate but do not block a valid target-car save or classify by a `${name}車の` message prefix |
| Search idle / no matches | Recent places or query guidance; zero matches retains query and suggests correcting it |
| Search/resolve pending | Busy only in candidate/search region; prevent duplicate selection; retain surrounding context |
| Search/resolve failed | Keep query and retry action; stop role remains identifiable |
| Route missing origin/destination | Explain missing stop and link/act on it; route Apply unavailable |
| Route pending / no returned routes / failed | Separate loading, no-route and error text; retry current stops/options; old candidate cannot remain applicable |
| Map unavailable or failed | Local map message; text candidates, distance application and manual distance continue working |
| API not configured/offline | Explain that route calculation is unavailable; return to manual distance without discarding costs |
| Shared save failed or unknown | Persistent car-specific status plus operation-safe retry/current-value route; never Toast-only |
| Local draft cache unavailable | Keep input in memory; disclose lack of reload recovery, not a false shared-save failure |

Retain raw numeric strings and IME input until the established normalization/commit boundary. Do not turn blank/invalid input into fabricated `0円` saved evidence. Do not add stricter domain acceptance, globally disable standalone, or require route-derived distance instead of meter input.

The existing readiness owner yields human messages. Use messages as content, not behavior keys. Target-car validation must characterize and reuse equivalent existing prerequisites with structured UI field/task associations, keeping accepted inputs/results unchanged. If new structured metadata requires altering a protected owner, separate that change for approval instead of parsing strings or weakening validation.

## 9. Responsive, scroll, and Carbon implementation

### Official guidance checked on 2026-10-02

- [Forms](https://carbondesignsystem.com/patterns/forms-pattern/): related inputs should be logically grouped and labelled; dedicated pages accommodate complex input. In-page commit actions follow the form; a Back link is not the secondary Cancel action.
- [Contained list](https://carbondesignsystem.com/components/contained-list/usage/): related rows may include inline actions. The on-page variant suits persistent contexts; the disclosed variant is for temporary contexts. Multiple column headers require a different data-presentation choice.
- [2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/): consistent key lines and standard breakpoints structure responsive layouts.

The Modal page could not be fetched through the research tool in this pass. No new official claim is based on that failed fetch; the existing foundation/pattern references and the fetched Forms guidance support the approved dedicated-task choice. These summaries do not make car-specific draft, route ownership or this navigation Carbon rules.

### Project interpretation

- `lg` and above: fee list and selected editor share one Grid with no nested vertical-scrolling cages. Below `lg`: one task surface at a time; a car workspace shows the fee list, selecting a fee opens its durable editor. Medium is not forced into a cramped split view.
- Document/main owns normal scrolling. Store list position and logical trigger for parent Back in UI state; do not re-query `.cds--modal-content` or control Carbon internal wrappers. Map may own only intentional map pan interaction, never the primary task scroll.
- Render one active expense form. No duplicated hidden desktop/mobile editors, duplicate input IDs or two save owners. Resize keeps selection/input, and only changes which surrounding list is visible.
- At 390px and short viewport, car/task/draft state comes before lower-priority metadata. Long names, Japanese text and amounts wrap without document overflow; scan layout remains compact.
- Save/Cancel follows active form/result. No unconditional fixed/sticky action tray in Phase F. Preserve access by document scroll with software keyboard; future sticky treatment requires measured necessity and a documented content/safe-area contract.
- Prefer installed Carbon Grid/Column, FormGroup, TextInput with appropriate decimal keyboard, RadioButtonGroup, Checkbox, Search, Link, ContainedList `on-page`, OverflowMenu, InlineLoading, and scoped notifications. Component choice is conditional on public exports/props and keyboard tests in `@carbon/react` 1.115.0, not an unverified SidePanel API.
- Verify the installed list/action markup does not nest interactive controls. Choose explicit row links/controls rather than making an entire row a button containing buttons.
- Preserve token-based g10/g100 layers, productive type and Carbon focus. Own layout CSS may arrange product content but does not globally override Carbon internal selectors, invent radius/shadow/colors, or infer geometry from fragile DOM ancestry.

## 10. Accessibility and focus contract

- One `main`, active task `h1`, logical heading outline, and current `車両費用` navigation semantics. The selected fee is identified without misusing Tabs for page navigation.
- Forward task navigation/browser Back/Forward focuses task heading per shell contract; initial direct load does not steal focus. Explicit parent Back restores its logical link/control and list position when available, else heading. Save closes to its caller/list trigger; asynchronous success after leaving does not focus it.
- Place-search task entry announces stop role. Search field has a visible label; result count/status is polite and query-owned. Result selection resolves before returning to the corresponding stop trigger. Failed resolution keeps a usable error/retry and search context.
- Candidate routes use an installed Carbon radio contract or equivalent native group with actual Arrow-key behavior, labelled options, one selected state and standard focus. Do not preserve the current custom `button role=radio` without its keyboard contract.
- Stop reorder has named Up/Down actions, announced new order, and keeps the moved item's focus. Removing a focused stop/fee moves to the next available logical item/add action, not the document body.
- Labels, units, required conditions, helper text, invalid association and first-invalid focus are verified at composition level. Save during IME composition is ignored. Keep keyboard/visual order aligned across breakpoints.
- Visible focus, light/dark contrast, 44px-equivalent icon/menu hit areas and `prefers-reduced-motion` are mandatory targets. Do not add `role=application` to the map without a separately implemented/tested keyboard contract; text data and controls remain outside it.
- Ordinary draft updates do not flood live regions. Announce search/result/save state transitions once; report persistent failures in context. Semantic automated checks are not a claim of native screen-reader validation.

## 11. UI boundaries and data flow

Keep feature orchestration small enough to test without reading all of Settlement:

| UI unit (responsibility, not mandated filename) | Inputs / outputs | Must not own |
| --- | --- | --- |
| Vehicle list/presentation | Current `settlementInput`/calculated cars and UI draft status → links/read rows | Cost calculation or shared Save |
| Vehicle target adapter | Validated URL/group context → exact existing cost target/allowed return destination | New vehicle identity, inferred auth ownership |
| Car draft controller | Existing edit session + narrow UI recovery + selected target → inputs, scoped Save and receipt states | New merge protocol, whole-room persistence, other cars' writes |
| Expense editor | Active row/movement draft + domain preview → raw input changes | Separate fee repository or replacement financial formula |
| Route task controller | Target car + working itinerary + existing route service → current candidates, selected helper value | Google SDK requests/ranking or shared expense commit |
| Route/search/map presentation | Typed UI async state and text route data → selection/disclosure actions | Retrying wrong target/revision or guessing provider error categories |

Data flow: current canonical room → existing settlement projection/domain result → target car's UI draft/preview → existing canonical conversion and scoped intent → existing sync outcome/current canonical view. Route service → verified current selected-distance helper → that car's draft distance, not directly to store/Firebase.

Only UI/navigation/components/tests and narrow cost-edit adapters should change. Preserve generated domain, route service/adapter semantics, store, sync, Rules, room storage and legacy owners byte-for-byte. A file boundary alone is not proof: review actual patch paths and calculation outputs.

## 12. Verification and evidence matrix

This is required future coverage, not a claim that Phase F implementation already passes.

### Contracts before replacement

- Characterize `settlementInput` cost targets, scoped ID/name edits, duplicate names, anchor replacement/removal, extra IDs, standalone and private/Times switching. Freeze observable behavior and calculations, not dialog classes/source text.
- Keep existing [settlement-edit.test.mjs](../../../apps/react/tests/settlement-edit.test.mjs), [route.test.mjs](../../../apps/react/tests/route.test.mjs), browser route/settlement/negative-value and shared compatibility assertions. Translate old dialog locators to observable task contracts only as implementation changes those surfaces; do not delete coverage to make the new layout pass.
- Golden same-input calculation comparisons include private movement, Times distance/time, standard reward, split/club, signed extras, zero/blank accepted states, standalone, rule/exemption/deduction/rounding inputs. Full protected output remains equivalent; fields not redesigned still affect the golden result.

### Behavior matrix

| Area | Required scenarios / observable assertions |
| --- | --- |
| Entrances / navigation | Vehicle nav, settlement link, car-group link, direct/shared task URL; inbound legacy URL; refresh/back/forward; invalid/deleted target after loading; current location and focus |
| Draft scope | Two cars with unfinished inputs; fee switches and route round-trip; source entrance switch; reload recovery; local cache failure; Cancel one car leaves other car/cache/canonical state intact |
| Apply versus Save | Route Apply changes draft only; Back without Apply does not change expense distance; final Save commits only selected car; save closes editor and clears accepted draft only |
| Cost capabilities | Standard/read-only/remove distinctions; extra create/reuse/edit/delete; non-negative input plus signed category; IME; Times/private dormant values; standalone target and empty-state behavior |
| Async route | Empty, delayed search, delayed resolve, zero results/routes, retry, alternatives and applied rounding; changed stops/options/car while old request completes; map failure with usable text/apply; no SDK adapter with usable manual distance |
| Save safety | Double submit; failed/uncertain acknowledgement; operation-specific receipt; reload/retry without duplicate extras; accepted then later changed values; reset/participant removal while draft/receipt is open |
| Parallel input | Two Emulator clients edit different ID/name-backed cars; same car different fields/extras and same-field conflict follow existing owner; rules/payment changes untouched; no whole-car/page overwrite |
| Accessibility | Landmarks/headings/current item, keyboard-only task completion, actual radio keys, focus return/reorder/remove/error, field associations, loading announcements, reduced motion |
| Geometry / responsive | No document horizontal overflow at ~390px, long project/car/fee/place names and amounts; one active form; hit areas; short viewport/keyboard reachability; no content obscured by shell/actions |

### Browser and runtime evidence

- Real Chromium and WebKit, Desktop and approximately 390px, light and dark. Capture before/after representative vehicle list, selected movement/extra form, route/search/result/map-unavailable and save-failure states.
- Combine automated semantic/geometry/behavior assertions with rendered browser operation. The unified in-app browser is available and was exercised on the existing local React app during discovery; do not infer uninstalled Browser from a missing legacy skill listing. It is an interaction channel, not a replacement for the WebKit matrix.
- Record exact browser/viewport/theme/input method and which states were actually operated. A synthetic short viewport/tap is not a real software keyboard or physical-device safe-area test. If native screen-reader/real-device evidence is unavailable, record that limit and retain the final Phase I manual acceptance gate; do not call it PASS.
- Offline fixtures for interaction and route failures; demo Firebase Emulator for write paths/concurrency. No production data/configuration or real production Maps referrer smoke. Fixtures verify UI integration, not live Maps availability; retain the final Phase I authorized Maps/Places/Routes gate.
- Required React/Shared checks follow actual changed owners and repo classifier. Do not bypass required checks, skip trace errors, relax assertions or update screenshots without behavior review.

## 13. Normative traceability and proposed clarifications

| Decision | Existing Product UI owner |
| --- | --- |
| Independent cost task / driver use / no identity guessing | §1–2, §12 |
| Nested route, text fallback, manual distance, no expense→movement→route Modal | §10, §12, §22.3 |
| One Primary / distinct Save, Apply, Cancel, Back | §4–6, §22.2 |
| Per-car draft and write isolation / unchanged domain | §6, §12, §14 invariants, §22.4 |
| Productive list/editor and mobile drill-in | §12, §20–21 |
| Contextual state/error, no message-parsing behavior | §17–18, §22.6/9 |
| Focus/keyboard/touch/map alternative | §10, §19–20, §22.7/8 |
| Review/evidence and no production operations | §22.10, §23 and React AGENTS integration program |

After written-spec approval, incorporate these concrete refinements into **§10/§12 of the normative owner in the implementation PR**, not as competing rules in this document:

1. Shared car target/draft between entrances; compatible local itinerary is not synchronized vehicle route ownership.
2. Normal fee input does not need intermediate confirmation/Apply; route Apply returns to the movement editor and clearly remains unsaved, including when entered from car allocation.
3. Back/refresh recovery, car-local Cancel, and scope after locally applied but unacknowledged Save; exact retry receipts and immutable submitted content.
4. Standard/read-only/candidate/standalone capabilities and current-ID versus name-fallback safeguards; no guessed target when name projection is ambiguous.
5. Per-car whole-draft Save on mobile selected-fee surface, with car-wide validation/error links and post-save return behavior.

These are proposed implementation refinements of the approved structure. The existing normative contract and protected owners remain unchanged until that review; passing a design-file check is not user approval or implementation acceptance.

## 14. Implementation order, exit, and release boundary

After written-spec review, create a separate implementation plan using writing-plans. Order the work by dependency: target/write-set characterization → navigation/draft owner → vehicle list/editor with standard/extra capability parity → route task/async ownership → scoped saving/receipt integration → cumulative browser/shared regression and independent review. This order is an outline, not the unreviewed detailed execution plan.

Phase F exits only when the working cost/route surfaces satisfy the normative owner, all protected capabilities and equivalent results are demonstrated, nested cost/movement/route dialog views are gone, targeted/cumulative tests and browser evidence pass, required CI/review passes, and the Phase F PR is safely merged **only to `carbon-redesign`**.

No merge to `main`, React Production Release dispatch, compatibility deploy, root cutover, production smoke or production Firebase write in this phase. Final Phase I integration/release gates and same-SHA/artifact/rollback/dedicated-room safeguards remain unchanged. Written design completion alone does not complete Phase F.

## 15. Written-spec self-review

- Authority: all target decisions trace to the sole normative owner; approval-dependent refinements are identified, not silently enacted.
- Scope: cost/route UI only; settlement rules/operations and protected data owners remain outside scope.
- Consistency: route Apply is local; car Save is shared; Back keeps draft; pre-commit Cancel discards only that draft; post-commit navigation cannot undo an applied write.
- Feasibility: ID/name scoped writes, projection ambiguity, cache recovery, and receipt evidence have explicit characterization/stop conditions rather than invented domain guarantees.
- Coverage: observable task, semantic, geometry, concurrency, calculation and real-browser gates are listed; no new implementation/test result is claimed.
- Review boundary: written specification approved on 2026-10-02; the [implementation plan](../plans/2026-10-02-phase-f-vehicle-cost-workspace.md) is the next review artifact. Plan preparation is not implementation acceptance.

Written-spec validation on 2026-10-02: all 22 local file links resolve; no unfinished placeholder remains; staged whitespace check passes. Existing offline `settlement-edit.test.mjs` + `route.test.mjs` passed 10/10 with no skips or changes to assertions. This is baseline/spec evidence only: no Phase F UI code or new tests were added, and the new UI browser/Emulator/CI acceptance matrix remains unexecuted.
