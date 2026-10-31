# 企画タブ内ツール統合・UI統一 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 応募フォームと登山計画書を企画タブ内で利用でき、入力途中の内容を保持し、既存ツールを含めたUIに統一感を持たせる。

**Architecture:** 元ツールから共通ヘッダーを除いた再利用可能な画面とサービスを切り出し、バージョン固定のパッケージとして企画サイトが読み込む。フォームは既存キュー／workerを維持する。登山は企画別の下書き保存APIを先に作り、global runtimeをroot単位のruntimeに変えてから組み込む。

**Tech Stack:** 既存React/Vite、Carbon React、Firebase Auth/RTDB、Apps Script worker、IndexedDB、既存html2canvas/jsPDF/OCR処理。新しいUIライブラリ・ルーター・状態管理基盤は追加しない。

**Spec:** `docs/superpowers/specs/2026-10-31-inline-project-tools-design.md`。既存の `2026-10-30-project-management-integration.md` の外部入口方式を、本計画の対象ツールについて段階的に置き換える。完了済みの同一企画接続を再実装しない。

## Global Constraints

- 実装順は **フォームのタブ内統合 → 登山下書き → 登山タブ内統合 → 全体UI統一**。前段の完了条件を満たしてから次段へ進む。
- 本計画は実装を許可された作業計画である。実装・テスト・配布は各Phaseの完了条件と既存リリース経路に従う。DB／worker／公開設定は、必要性と互換範囲が確認できた場合だけ変更する。
- 将来の実装時は各リポジトリのAGENTSと既存リリース経路を使う。企画サイトの完了条件は対象main SHAのReadiness、既存React Production Release、両ブラウザのroot smoke、専用room `P9A93LMQ` のcleanup。通常企画で試験しない。
- 既存の未コミット変更・生成物・他worktreeを保持する。作業開始時に各リポジトリの最新mainと公開SHAを再確認する。本書の調査SHAを無条件に最新と扱わない。
- テンプレート、タブの共有設定・順序・固定解除・ツール取り外しの意味を維持する。非固定ツールも「ツール」から開ける。
- フォーム作成用アカウントは `sanpokai.formmaker@gmail.com` を維持。Circle側のFirebase認証キャッシュと、フォームセッションの認証・capabilityを混在させない。
- capability、refresh token、編集者メールなどをURL query、ログ、共有URL、通常roomデータへ追加しない。
- 登山下書きは初期に端末内保存。画像をroom RTDBへ送らず、クラウド同期できる表示もしない。
- MCPが示す最新APIとインストール済みCarbonのAPIは実装時に照合する。未確認props、icon名、MCPだけを根拠にしたパッケージ更新を行わない。
- 必須の意味・操作・復旧に必要な説明を残し、内部構造や将来予定の説明をユーザー画面へ増やさない。
- 全ツールを一連で確認できる、実用的な合成サンプル企画を用意する。現実の企画と誤認される氏名・連絡先・場所を使わず、フォーム作成・送信・OCR外部呼出し・本番API書込をサンプル投入時に起こさない。既存企画へ一括上書きする方式は避け、専用のデバッグ企画／ローカルfixtureとして隔離し、再投入と初期化の対象を限定する。
- 同じ問題で20分以上、原因特定・修正・検証の進捗がなければ止め、原因と未完了範囲を報告する。

## 実行状況（2026-10-31）

この欄はチェックボックスとは別に、実装とリリースの現在地を記録する。サブタスクのチェックは個別の完了条件と証拠を確認してから付ける。

| Phase | 実装状況 | 残っている完了条件 |
|---|---|---|
| 1. フォームをタブ内へ統合 | Circle側の統合実装と回帰修正あり。元Portalのpending job復旧修正はPR #25でmainへ反映済み。 | Circle全検証、preview照合、PR・main Readiness・本番smoke。 |
| 2. 登山下書き保存・復元 | 登山側の自動保存・復元、退避導線を実装。PR #21 は2026-10-31にmainへmerge、copy guardとValidateは成功。Circleからの利用を含む回帰テストあり。 | Cloudflare Workers BuildsはPRで失敗、GitHub deploy jobはskip。単体サイトの本番反映は未確認。Circle統合のリリースと下書き異常系の残り確認。 |
| 3. 登山をタブ内へ統合 | Circle側にworkspace組込と企画切替時の保持処理あり。2026-10-31に現行previewをサイドブラウザで確認し、応募フォーム／登山計画書のタブ内表示、登山計画書の実施日初期値、自動同期説明文がないことを確認。対象Chromium/WebKit browser spec 44件通過。 | 全画面遷移・PDFを含む統合確認とリリースゲート。 |
| 4. 合成サンプル | 専用デバッグ企画、外部書込ガード、登山サンプル保護の実装と対象回帰テストあり。 | 最新buildで全ツール横断、隔離、390px/desktop・light/darkを確認する。 |
| 5. UI統一 | 共通ルール・画面matrixと一部の実画面観察を記録済み。 | 画面・overlay全体の監査、最新previewでの残り状態確認、修正、テストを完了する。 |
| 公開 | まだCircle側のcommit/PR前。 | Circle PR、required checks、main SHAのReadiness、既存React Production Release、両browser smoke、`P9A93LMQ` cleanup。 |

現時点で「機能実装済み」と「公開済み」は分けて扱う。上表の局所確認はPhase完了や公開合格を意味しない。

## Review Focus

1. 企画Aで入力／作成を始めた後に企画Bへ移動しても、下書き・job・capabilityが混ざらない（Task 1–3, 5, 7）。
2. 作成受付後の通信断・タブ切替・reloadで重複フォームを生成せず、結果不明を成功と扱わない（Task 1–3）。
3. IndexedDB拒否・容量不足・破損・将来版・他タブ更新でも直前の保存済み下書きを壊さない（Task 4–5）。
4. 画像解析中の切替・破棄後に遅延応答が別企画へ適用されない。復元後のPDFが手入力・画像・行程編集を反映する（Task 4–7）。
5. 狭幅・日本語長文・拡大・ダークテーマ・モーダルで操作が欠けず、隠れたタブへフォーカスが入らない（Task 3, 7, 9–10）。

## 調査済みの現在地（2026-10-31）

| 対象 | 確認したmain | 実際の構成と再利用箇所 |
|---|---|---|
| Circle | `2c3ec771c4912a3a74ba375e93e81bc36c08a0b9` | `apps/react/src/App.jsx` の動的Tabs/TabPanels、`ProjectToolsWorkspace.jsx` の `ExternalToolWorkspace` が外部入口。`runtime.js` の `external.createApplicationForm` → `services/application-form-link.js` が予約・job ID・tokenを作り、fragmentでportalへ渡す |
| Portal | `de990f2` / Link new forms to existing projects (#22) | `src/features/form-maker/App.jsx`、`services/form-maker-session.js` の `createFormMakerSession` / `canonicalInput` / `session.enqueue`、`form-maker-project-link.js`。`targetRoomId/targetRoomJobId/targetRoomCapability` はすでに対応済み |
| 登山 | `dc2e704` / Accept project context handoff | `src/App.jsx`、`src/LegacyRuntime.jsx`、`app-core.js/app-flow.js/app-view.js/app-share.js`。runtimeは `new Function` と `window.__tozanApp`、document selector・イベントに依存。企画の実施日は登山計画書の同名項目へ初期値として内部同期する。企画名を山名へ流用しない |

原リポジトリの通常checkoutは古いbranch/mainだったため、上記はfetch後の `origin/main` を `git show` して確認した。単に通常checkoutのファイルをコピーしない。

- Circleのインストール済みCarbonは `@carbon/react 1.115.0`、React宣言は `19.2.8`。元2アプリの宣言はCarbon `^1.114.0` / React `^19.1.1`。これだけで互換性を断定せず、共通packageはReact/ReactDOM/Carbonをpeer dependencyにし、hostで一組に解決する。
- Carbonのインストール済みTabsは `TabList.activation` に `automatic/manual` を持ち、TabPanelは非選択panelをhiddenにする。アプリの条件render・toolsPanelId変更によるunmountは別途対策が必要。
- Portalのpending job keyは現在単一の `sanpokai-form-maker-pending-job-v1`。作成履歴も全企画を含む。タブ内統合でそのまま使うと企画間混在が起きる。
- 登山の永続化は連絡先用 `tozanContactsV2` が中心。`state` はstep/maxReachedStep/uploads/metrics/itinerary/routeImage/analyzing/sampleDataActive。入力値はDOMにもある。`pendingPdfFile` と準備済みPDFは保存対象ではない。
- 共有項目は同じ意味の入力欄がある場合だけ内部同期する。登山計画書では実施日を空欄時の初期値として同期し、復元下書き・入力済みの値を優先する。同期説明や確認操作は出さず、企画名を山名として扱うなど意味の異なる値は流用しない。

## パッケージと保存の契約

### 共通ソースの配布

元Portalに `packages/form-maker/`、元登山に `packages/mountain-plan/` を新設する。元の `src/App.jsx` はstandalone shellとなり、同じpackageの画面を利用する。Circleでは `apps/react/vendor/` の固定tgzと `integrated-tools.lock.json`（package version、source repository、full SHA、SHA256）を使う。

- packageはビルド済みESM・専用CSS・必要assetをexport。React/ReactDOM/Carbon/Carbon iconsをbundleに二重同梱しない。
- `apps/react/tools/import-tool-package.mjs` がarchiveとprovenanceを検証し、lockfileを更新する。配布元worktreeの絶対pathをアプリに残さない。
- CSSは `.form-maker-workspace` / `.mountain-plan-workspace` の配下に限定。body、共通button、全h1などへの上書きを持ち込まない。PDF専用styleは印刷対象に限定する。
- Circleは `React.lazy` でツールを初回選択時に読み込む。起動済みのpanelだけを保持し、未選択ツールを先読みして重い処理を開始しない。

### フォーム

`prepareApplicationFormContext({roomId, room, transport, cryptoApi, now}) -> Promise<{version:1,roomId,jobId,token,projectName,eventDate}>` をCircleの `application-form-link.js` に公開する。既存 `createApplicationFormHref` はその結果をfragment化する互換wrapperとする。

packageの公開componentは `FormMakerWorkspace({project:{roomId,projectName,eventDate}, session, createProjectLink, linkedForm, active, onNotice, onHandoffReady})`。URLの消費や共通Headerはstandalone wrapperの責務。`createProjectLink()` は明示的な作成submit時だけ呼び、既存の予約→enqueue契約と同一job IDを使う。予約後enqueue前に中断しても同じroom/jobで復旧する。

Circleの学務handoff権限は `services/url-compat.js` の `tokenStorageKey(roomId)` / `validHandoffToken` と `SANPO_HANDOFF_EXPORT_TOKEN_V1:` を再利用する。`runtime.handoffToken` は現在launch時の固定値なので、room別capability controllerのgetter＋subscribeへ変更する。`onHandoffReady({roomId,jobId,token})` は現在room・既知jobとの一致を確認して保存・通知し、CSV操作をreloadなしで利用可能にする。旧query付きURLの互換処理と共有URLからのtoken除去を維持する。

job参照・入力下書きは `roomId` で分離。権限tokenは既存handoff storage／必要最小のsessionStorageに保管し、共有roomに入れない。作成状態の正本は既存workerのjob。履歴の表示は現在企画に関連を確認できるjobだけ。旧global pendingはそのjobの対象roomを確認できた時だけ引き継ぎ、未知・不一致を成功や別企画の結果にしない。

### 登山下書き

`MountainPlanDraftV1 = {schemaVersion:1, scope:{kind:'project',roomId}|{kind:'standalone',draftId}, revision, savedAt, fields, metrics, itinerary, assets, routeAssetId, progress:{step,maxReachedStep}, sampleDataActive}`。

- `fields` は現在のフォームの永続対象input/select/textareaの明示allowlist。チェック値・行程の掲載有無・休憩・変更後時刻も保存。氏名・連絡先は保存対象だが、既存の全企画共通連絡先を勝手に更新しない。
- `assets` の実体はIndexedDBのバイナリデータとMIME型。WebKitの保存互換性のためBlobをArrayBufferに変換し、読み込み時にBlobへ戻す。旧形式のBlob記録も読める。既存data URLは保存境界で変換し、同じルート画像を重複保存しない。object URL、DOM、実行中request、`analyzing`、編集中行の開閉、準備済みPDFは保存しない。
- `draft-schema.js`: `normalizeDraft(value)`、`validateDraft(value)`。将来versionは読み込まず原本を保持する。
- `draft-storage.js`: `loadDraft(scope)`、`saveDraft(scope, snapshot, {expectedRevision})`、`deleteDraft(scope,{expectedRevision})`。保存とasset更新は同じtransaction。成功／競合／容量・アクセス失敗を区別して返す。
- `draft-runtime-adapter.js`: `captureDraft(runtime)` と `restoreDraft(runtime,draft)`。読み込み時に現在の妥当性から到達可能stepを再計算し、保存値だけで未入力チェックを迂回しない。
- 変更後800msで保存。画像追加／削除・解析完了・明示タブ切替時は保存をflush。pagehideの非同期処理だけに依存しない。保存完了前は「保存しました」にしない。
- standaloneで企画fragmentを受け取った場合は、同じタブのreload後もscopeを保つため、`tozan.activeDraftScope:v1` をsessionStorageへ保存する。fragment適用／消去でroomとの関連を失わない。新しいstandalone sessionは専用standalone scopeを使い、別企画の下書きを勝手に選ばない。組込時はhostのroom propが常に優先する。
- 下書きは自動保存・自動復元し、通常利用の画面に手動保存・ファイル読込・削除の操作を置かない。保存障害時のみ現在内容を書き出せる復旧操作を示す。
- 同じroomを複数タブで編集した場合はrevision競合で上書きを止め、最新の下書きを読み直せるようにする。読込ボタンは競合時だけ表示する。

## Phase 1 — フォームメーカーをタブ内へ統合

### Task 1: フォーム本体とstandalone shellを分離

**Files (Portal):** `src/features/form-maker/App.jsx`、`src/services/form-maker-session.js`、`form-maker-history.js`、`form-maker-project-link.js`。新設 `packages/form-maker/src/FormMakerWorkspace.jsx`、`useFormMakerWorkspace.js`、`project-job-storage.js`、`index.js`、package/build設定。既存サービスは共通packageから再exportし二重管理しない。

**Interfaces:** 上記 `FormMakerWorkspace`、sessionの既存 `prepare/listJobs/getJob/enqueue/getHandoffToken` を使用。`project-job-storage` はroom別の入力・pending job・予約情報を管理する。

- [ ] 既存テストに、standalone動作、room別pending、旧pendingの一致／不一致、受付後reload、token非露出のケースを追加する。画面を二重実装していないことは配布物と動作で確認する。
- [ ] Header・Theme切替・URL fragment読込をstandalone wrapperへ残し、作成・状態・結果の本体を切り出す。globalなscrollTo/focus先をworkspace rootへ変更する。
- [ ] queued/running/partial/failed/unknownの復旧、再試行idempotencyを維持。hidden時は不要なpollを止め、再表示で最新jobを取得する。
- [ ] `npm run test:history`、`npm run test:browser`、`npm run build` と新規packageテストを実行。新規スクリプトはpackage.jsonへ登録し、復元した状態で受付が二重実行されないことを確認する。
- [ ] Portal単体の動作確認後に独立commit/PR。元ソースSHAを固定したpackageを作成し、次Taskへ渡す。

**完了条件:** 元サイトと組込componentが同一ソースを使い、host Headerなしで入力→受付→結果まで動く。元worker／Rulesへの変更は不要であることをemulator契約で確認する。変更が必要と判明した場合は理由と互換範囲を追加してから進む。

### Task 2: Circleの連携開始をURL依存から分離

**Files (Circle):** `apps/react/src/services/application-form-link.js`、`runtime.js`、`services/url-compat.js`、`services/handoff-client.js`（既存tokenの扱いを確認）、新設 `services/form-maker-workspace.js`、`services/handoff-capability.js`。対象テスト `tests/application-form-link.test.mjs`、新設 `tests/form-maker-workspace.test.mjs`、`tests/handoff-capability.test.mjs`、既存emulator連携テスト。

**Interfaces:** `prepareApplicationFormContext`、package用session adapter、`runtime`内の企画別controller。`createHandoffCapability({roomId,storage,initialToken}) -> {getSnapshot,subscribe,accept({roomId,jobId,token},expectedJobId)}`。`runtime.handoffToken` getterの互換を保ち、参照画面へ更新を通知する。tokenを履歴URLや現在queryへ露出させない。

- [ ] タブopenだけではreserve/enqueueしない、予約成功後の通信断、同一job復旧、連携済みroomの重複作成拒否、room切替を検証する。
- [ ] 既存URL wrapperを維持しつつcontext factoryを抽出する。既存の6時間TTLを変更しない。結果不明のjobを捨てて新jobを作らない。
- [ ] `formMakerV1`の既存認証storageを再利用し、Circle Firebase SDKのログイン状態を上書きしない。作成結果のprivate linkは所有sessionで取得できる場合だけ表示する。
- [ ] `Participants.jsx`、`ProjectToolsWorkspace.jsx`、`ProjectTools.jsx` のCSV利用可否をcapability更新に追従させる。作成完了直後／reload後にCSVを使えることと、別room/jobのtokenを拒否することを検証する。
- [ ] 全Unit、影響するFirebase/Auth emulator・shared/legacy互換検査を実行。企画の参加者・精算情報が保持され、フォームjobが同じroomへ接続されることを確認する。
- [ ] 独立commit。backend契約が変わらない限り、worker deployをこのTaskへ追加しない。

### Task 3: 応募フォームタブへ本体を表示

**Files (Circle):** 新設 `components/ApplicationFormWorkspace.jsx`、`components/ProjectToolHost.jsx`、`tools/import-tool-package.mjs`、`vendor/integrated-tools.lock.json`。変更 `components/ProjectToolsWorkspace.jsx`、`App.jsx`、`styles.scss`、`package.json`/lockfile。新設 `tests/browser/inline-form-maker.spec.js`。

**Interfaces:** `ApplicationFormWorkspace({runtime,room,active})` はTask 2のcontrollerとTask 1のpackageを接続。`ProjectToolHost` はroomでkeyを分け、初回訪問済みtoolだけ保持し、active状態を渡す。

- [ ] 最新mainを使った固定packageを取り込み、peer依存が一組で解決することと、プロダクションbuildで読めるasset/CSSを確認する。
- [ ] 外部launcherを本体へ置換。「応募フォーム」タブを開くと直接入力できる。未作成／作成中／連携済み／受付停止／結果不明に必要な操作だけを表示する。
- [ ] この企画の連携済みフォームを優先し、「別のフォームを作成」は表示しない。権限がない端末に編集URL取得を保証しない。応募回答の取得・参加者確定は現行の参加者画面を使う。
- [ ] タブ切替・非固定ツールの開閉・直接URL・履歴移動・取り外し→再追加・reloadで入力/jobを保持し、別roomへ混ぜないことを両ブラウザで操作する。
- [ ] 初期の参加者/精算画面でフォームpackageを読み込まず、フォームを一度開いた後のhideでは不要な通信・フォーカス移動が止まることを確認する。
- [ ] 対象browser spec、既存project-workspace・応募者・handoff・collectionテスト、build/preview照合を通す。releaseと専用smokeまで進めてPhase 1を完了にする。

**Phase 1完了条件:** サイト内で同一企画へのフォーム作成と結果確認が完結する。Googleフォーム本体の編集・回答画面へのリンクは利用できる。元Portalの単体作成も動く。

## Phase 2 — 登山計画書の下書き保存・復元

### Task 4: 既存runtimeのデータcapture/restore境界

**Files (登山):** `app-core.js`、`app-flow.js`、`app-view.js`、`app-share.js`、`src/LegacyRuntime.jsx`。新設 `src/drafts/draft-schema.js`、`draft-runtime-adapter.js`、対応Vitest。

**Interfaces:** 上記schemaとadapter。standaloneで既存runtimeにadapterを付け、後段のroot単位runtimeへ移せるようDOM参照を外から渡す。

- [ ] 現在の全永続入力をApp.jsx・動的な行程editor・画像処理から棚卸しし、allowlistと変換表を作る。旧state、DOM入力、連絡先設定、PDF準備の所有関係を記録する。
- [ ] 手修正済み行程、掲載対象、休憩、ルート画像・複数画像、未完了step、サンプル、空値、数値0をcapture→restoreして比較するテストを先に用意する。
- [ ] capture/restoreを追加し、復元後にmetric入力・行程・upload・progress・PDF previewを再描画する。復元はOCR/API送信やグローバル連絡先保存を起こさない。
- [ ] 復元順は「既存既定値・連絡先 → 保存下書き → 妥当性再計算」。企画の新しい初期値は既存下書きを自動上書きしない。
- [ ] 解析中snapshotは実行中flagを戻さず、最後の確定データを復元する。PDFキャッシュをinvalidateし、保存前と同じ結果を再生成できることを既存PDF検査で確認する。
- [ ] `npm test`、`npm run test:e2e`、`npm run build` を実行し、独立commit。

### Task 5: IndexedDB保存と下書きUI

**Files (登山):** 新設 `src/drafts/draft-storage.js`、`draft-files.js`、`useMountainDraft.js`、`DraftControls.jsx`、対応Vitestと `e2e/draft-recovery.spec.js`。変更 `src/App.jsx`、`src/LegacyRuntime.jsx`、必要なstyle。

**Interfaces:** 上記storage APIとファイルAPI。保存namespaceは既存 `tozanContactsV2` と分離。project scopeは受け取ったroomId、未接続standaloneは専用draftIdを用いる。

- [ ] 最小のIndexedDB test helperを使い、Blob roundtrip、atomic更新、revision競合、quota／拒否／破損／将来schemaで旧データを保持するテストを用意する。
- [ ] 800ms debounce、画像操作・解析完了・step移動時flush、成功後だけ保存完了通知、stale非同期結果の破棄を実装する。継続エラーをトーストで連打せず、保存障害時だけ書き出し可能な状態を保つ。
- [x] 下書きは自動保存・自動復元する。通常画面の手動保存・ファイル読込・削除操作は省き、保存結果を短く通知する。standalone reload復元と組込のサンプル保存をChromium/WebKitで確認。
- [ ] 同じ企画の別タブ更新と競合した場合に黙って上書きしない。最後に保存したrevisionと現在revisionを比較し、最新読込の復旧操作を示す。
- [ ] 保存容量不足などで未保存内容がある場合に限って、JSON書き出しで退避できることを確認する。通常時のファイル持ち運びUIと読み込み処理は実装しない。
- [ ] Chromium/WebKitでreload、close/open、オフライン、保存拒否、複数企画、複数タブ、保存復旧を確認する。企画fragment適用→消去→reloadでも同じscopeを復元する。`npm test` / `npm run test:e2e` / buildと既存Pages workflowの公開smokeを通す。

**Phase 2完了条件:** 単体登山メーカーで画像込みの作業を再開でき、復元後にPDFを生成できる。端末内保存であることがUI上も分かる。まだCircleへの画面統合を完了扱いにしない。

## Phase 3 — 登山計画書をタブ内へ統合

### Task 6: runtimeを画面root単位にする

**Files (登山):** `app-core.js/app-flow.js/app-view.js/app-share.js`、`src/LegacyRuntime.jsx`、`src/App.jsx`、`src/ProjectHandoffNotice.jsx`。新設 `packages/mountain-plan/src/MountainPlanWorkspace.jsx`、`createMountainPlanRuntime.js`、`index.js`、配布設定。

**Interfaces:** `createMountainPlanRuntime({root,services,onDraftChange}) -> {captureDraft,restoreDraft,setActive,flushDraft,dispose}`。`MountainPlanWorkspace({project,draftStore,active,theme,onNotice})` はTask 4–5の保存APIを使用する。

- [ ] document selector、global変数、documentイベント、window export、body class、timer、OCR request、object URL、PDF targetを一覧化する。それぞれroot／instance／明示サービスへ所有権を移す。
- [ ] `$`/`$$`の既定rootをinstance rootへ変更する。`window.__tozanApp`と全ページ一度だけのRUNTIME_KEYをhostの起動条件から除く。standalone互換が必要な参照はそのwrapperだけで提供する。
- [ ] イベント・timer・解析requestをdisposeし、遅延応答にはinstance generationを照合する。タブhideは下書きflushと重いpreviewの抑制を行い、進行中解析を別企画へ適用しない。
- [ ] 既存の3stepと手入力編集を再利用し、React全書き換えをしない。既存Reactとimperative runtimeの両方が同じDOMの所有者にならない境界を維持する。
- [ ] PDF生成対象を明示rootに限定する。非表示タブ全体を一時表示する方式や共通bodyを書き換える方式で、参加者・精算画面をPDFへ混入させない。
- [ ] 元の連絡先・サンプル・警察署補完・画像/OCR fallback・PDF・share・project-handoffテストを実行し、2instance／mount-dispose-remount、StrictMode相当でlistener重複と状態混在がないことを検証する。
- [ ] 独立commit/PR、固定packageを作成。standaloneの既存URLと操作を維持する。

### Task 7: 登山タブへ本体を表示

**Files (Circle):** 新設 `components/MountainPlanWorkspace.jsx`、`services/mountain-plan-workspace.js`。変更 `ProjectToolHost.jsx`、`ProjectToolsWorkspace.jsx`、`App.jsx`、`styles.scss`、vendor manifestとpackage/lockfile。新設 `tests/browser/inline-mountain-plan.spec.js`。

**Interfaces:** Task 6 packageをlazy load。Task 5 storageに現在room scopeを渡し、既存 `services/mountain-plan-handoff.js` は外部URL互換用に残す。常用の作成操作は外部遷移しない。

- [ ] 企画別controllerを用意し、復元完了前に空snapshotを自動保存しない。room変更時は先のinstanceをflush/disposeしてから次を復元する。
- [ ] ヘッダーを除いた3step本体を直接表示し、Step・画像プレビューの高さを表示後に測定する。隠れたpanelで0pxを基準にPDFを生成しない。
- [x] 共有可能な企画情報は意味が一致する入力欄へ初期値として内部同期する。登山計画書の実施日は、企画に日付があり、下書き復元後の欄が空の場合だけ設定する。同期説明・確認操作は追加せず、保存済み下書き・入力済みの値を優先する。企画名を山名へ流用せず、名前／参加者を反映済みと表示しない。確認：`DraftControls` の空欄時のみの同期条件、Circle props、現行previewで日付と文言の有無を照合。回帰browser spec 44/44通過。
- [ ] タブ切替、非固定ツール開閉、reload、履歴移動、取り外し・再追加、企画A→B→Aで画像・行程・編集中段階を保持することを両ブラウザで確認する。
- [ ] 画像追加→解析→手修正→下書き復元→PDF生成を合成データで通し、精算・車割・モーダルのCSS/DOM/イベントへの影響がないことを確認する。
- [ ] Unit、対象browser、既存project-workspace・settlement・allocationとshared互換、build/preview照合を通す。依存追加・新asset・外部APIのためrelease分類に従いcompatibility→rootを検証する。

**Phase 3完了条件:** 企画の共通shellを残したまま登山計画書を作成・保存・復元・PDF化できる。PDFとGoogleフォーム本体以外のメーカー操作でサイト外へ移動しない。

## Phase 4 — 全ツールで使えるデバッグ用サンプル企画

### Task 8: 統合ツール一式の合成サンプル

**Files:** Circle `services/project-domain.js`（または既存sample-data module）、`App.jsx`、`ProjectToolsWorkspace.jsx`、new `services/debug-sample-project.js` / fixture tests; Portal `packages/form-maker` fixture entry; Tozan `packages/mountain-plan` sample adapter and bundled synthetic image assets. Update browser tests and developer instructions.

- [ ] 現在の「サンプルデータ」投入が選択中roomを共有上書きする点を含め、既存sample entry pointsを棚卸しする。サンプル投入で通常企画を上書きする既存挙動を新しい統合経路では再利用しない。
- [ ] 一つの合成企画fixtureに、応募回答・確定参加者・複数車と定員・複数班・支払区分別費用・集金状況・メモ・フォーム状態・登山計画の入力／行程／画像を関連づける。固定値のfixtureをschema normalize/migrate経由で検証し、年・文言などを更新しやすくする。
- [ ] サンプルは専用 `DEBUG-SAMPLE` namespace/roomまたはテストfixtureのみに読み込む。通常企画を開いた状態でサンプル投入を実行できないこと、サンプル操作がFirebase/Apps Script/Google Forms/OCRへ外部書込・生成・送信をしないことを確認する。
- [ ] サンプル投入後に全ツールタブを開き、利用可能な内容を見て編集・タブ移動・下書き復元・CSV previewまで試せる。実フォーム作成や学務アプリの起動が必要な操作は、合成モードで無効表示し目的を短く説明する。未実装の外部連携を成功状態に偽装しない。
- [ ] デバッグサンプルの初期化操作は一か所にまとめ、専用sample namespaceだけを初期状態へ戻す。フォームメーカーのsession、通常企画、端末の連絡先・他企画下書きを消さない。個別ツール側に重複したサンプル再投入ボタンは置かない。
- [ ] サンプル開始・切替・リセットの確認、room隔離、全ツール横断のbrowser testを追加する。390px/desktop、light/darkで実データのように操作できることを確認する。

**完了条件:** 一つの明示的なデバッグサンプルで、全タブの主要表示と編集状態を安全に確認できる。サンプル投入・初期化で通常企画や外部サービスへ書き込まれない。

## Phase 5 — Carbon MCP / Builderで全体UIを統一

### 公式指針とこのサイトの判断

| 公式資料で確認したこと | 本計画での採用判断 |
|---|---|
| [Typography / Productive](https://carbondesignsystem.com/building-blocks/foundations/typography/style-strategies/#styles-for-productive-moments): productiveなbody・fixed headingの組合せで行高を整える | 作業画面は既存のproductive tokenを役割別に統一。大きなマーケティング見出しや全面太字は使わない。具体的な役割割当は本サイトの設計判断 |
| [Spacing](https://carbondesignsystem.com/building-blocks/foundations/spacing/overview/#applying-spacing): spacing tokenをmargin/paddingに利用。[Hierarchy](https://carbondesignsystem.com/building-blocks/foundations/spacing/overview/#creating-hierarchy): 余白でまとまりと重要度を示す | 同じ役割の余白を共通化。全画面の行高を同じにする、カード枠を増やす案は採らない |
| [Tabs accessibility](https://carbondesignsystem.com/building-blocks/core/components/tabs/accessibility/#keyboard-interactions): tablistの単一tabstopと矢印移動。横scrollでも操作原則を維持 | 既存の横scroll・無制限固定を維持。重い画面読み込みのため、manual activationを候補とし実画面で採否を決める。選択とfocusを混同しない |
| MCPのTabs例とインストール済み1.115.0の `TabList.activation` / hidden panelを照合済み | mount保持とlazy loadはアプリ側の責務としてTask 3/7で実装する。Carbonが下書きを保存すると解釈しない |

### Task 9: 統合後の全画面監査と共通ルール確定

**Files (Circle docs):** 新設 `docs/design/ui-consistency.md`、`docs/design/ui-screen-matrix.md`。対象コードはまず監査のみ。対象はspecに記載した全画面・全overlay。元2サイトのstandalone wrapperも確認する。

- [ ] 新しい統合画面がそろった状態で、利用目的→操作手順→情報階層→pattern→componentの順に整理する。旧スクリーンショットだけで全体仕様を決めない。
- [ ] 各画面で通常／空／loading／error／処理中、modal内外、メニュー、トースト、長文を列挙し、調査済み／対象外の理由／未検証を記録する。
- [ ] Carbon Builderを読み、MCP `code_audit` に対象JSX/SCSSを渡す。結果を公式必須・推奨・本サイト固有判断に分け、必要なcomponentのdocs_search/code_searchとインストール済みDOM/props/exportを照合する。監査結果だけで一括自動修正しない。
- [ ] 文字階層、本文・label、太字の目的、余白、左右基準線、action配置、Buttonサイズ・kind、入力幅、区切り、保存状態、empty/error copyを決める。既存tokenを優先し、通常日本語本文のletter-spacingを装飾目的に広げない。
- [ ] 390pxとdesktopの比較を同じ合成企画で残す。必要な差は残し、同じ役割だけをそろえる。採用／不採用理由を記録する。

### Task 10: 共通ルールを全画面・overlayへ適用

**Files:** Circle `apps/react/src/styles.scss` と対象components、必要に応じて `styles/_workspace.scss` / `_tool-content.scss` に限定抽出。元2packageのscoped stylesとstandalone shell。テストは既存 `visual-consistency.spec.js`、`modal-layout.spec.js`、追加したinline-tool specsへ意味のあるcaseを追加する。

- [ ] 共通shell→参加者・割当・精算・ツール管理→フォーム・登山→modal/menu/toastの順に適用する。既存の支払区分・金額・人数・固定表示を変えない。
- [ ] 同じ操作のButton kindと並び、見出し・本文・補足・金額の役割をそろえる。情報量が異なる画面を同じカード・同じ高密度に押し込まない。PDF本文の提出用レイアウトをアプリ用type tokenで壊さない。
- [ ] 説明を必要な場所へ限定し、未対応機能・内部token/worker構成・実際に適用しない情報を文言へ持ち込まない。追加packageの元サイトにも同じ修正を反映する。
- [ ] サイドブラウザで最新build＋preview照合後に、light/dark、390px/desktop、200%拡大、長い日本語、エラー、入力中、内訳開閉、全modal/menuを実操作する。水平overflow・隠れたfocus・buttonの重なりを直す。
- [ ] 操作に関係する差だけをbrowserテストで固定する。CSS文字列の一致だけを検証するテストや同じ内容のsnapshotを乱造しない。MCPの再auditは変更箇所を対象に行い、指摘の採否を記録する。
- [ ] 全Unit、browser、Visual/Layout、emulator/shared互換とbuildを必要範囲で通す。UIごとの完了をmatrixへ記録し、未検証項目を合格にしない。

**Phase 5完了条件:** 共通shell、全タブ、全overlayが同じ役割・操作ルールを使う。スマホで作成→参加者→割当→精算→登山PDFまでの移動に二重ヘッダー、不要なlauncher、入力消失がない。

## 各Phaseの公開・rollbackと最終引き継ぎ

- [ ] Phaseごとに動作する単位でPRを分け、変更した元repoのstandalone検証も行う。package導入PRはsource SHAとarchive checksumを添付する。通常のnpm installで別版へ変わる配布はしない。
- [ ] Circleは前回成功production SHA以降の全pathを既存workflowが分類する。package/dependency/persistence/configはUI-onlyと手判定せず、既存compatibility経路を使う。
- [ ] 対象main SHAのRelease / Readiness成功を確認して既存React Production Releaseをdispatch。同一SHA・同一buildをcompatibility/rootで使用し、両browser root smokeと専用room cleanupを確認する。公開manifestのSHA/digestも照合する。
- [ ] フォームの実service検証は専用合成企画・専用検証フォームで実施する。既存smokeにフォーム作成が含まれない場合、root smokeだけでworker実連携を合格にしない。フォーム削除・job/予約cleanupの既存手順と対象を実行前に確認し、通常企画で代用しない。
- [ ] 登山/OCRのproduction smokeで実解析を常時実行しない。画像・PDFは合成fixture、API実接続は既存の許可済み検証手順を使い、mock検査と区別して記録する。
- [ ] production検証が失敗したら既存rollbackに従い、検証済み公開artifactを復元する。packageの旧版に戻しても読めない下書きは削除せず、将来schemaとして保持・書き出し可能にする。
- [ ] 最終報告は、各Phase完了、公開SHA、package元SHA、確認した画面・状態、未検証事項、preview/本番URLを簡潔に記す。サイドブラウザは最新buildの対象画面へ合わせる。

## 実装前に追加承認を要しない判断／追加仕様になる判断

**この計画の推奨として進められるもの:** 元アプリも共通ソース利用、固定package配布、lazy load、端末内の企画別下書き、800ms自動保存、保存障害時だけの復旧書き出し、専用sample namespaceの合成企画、既存UIの操作を保った共通token適用。

**別途仕様決定が必要になるもの:** 登山下書きの端末間共有、同時共同編集、クラウド画像保存、複数登山計画／複数応募フォーム、Googleフォーム本体の編集画面の自前再実装、Windowsアプリ本体のUI変更。いずれも本計画の完了条件へ追加しない。

## セルフレビュー

- [x] 利用者指定の4段階順序、サンプル企画の隔離要件、全体UI統一の対象範囲を記載した。
- [x] すでに完了した同一企画フォーム接続・登山handoffを再実装する計画になっていない。
- [x] 元アプリの通常checkoutとorigin/mainの差を調べ、最新mainの既存APIを根拠にした。
- [x] 企画別pending、capability、mount保持、下書きBlob、PDF、非同期disposeの所有範囲とテストを各Taskへ割り当てた。
- [x] 実装者が異なるファイル名・APIを仮定しないよう、Task間の公開契約を明記した。
- [x] 公式指針と本サイトの採用判断、端末内保存という推奨、未対象の追加仕様を分けた。
- [x] アプリ・DB・workerの変更とテスト実行・公開は、この計画策定では行っていない。
