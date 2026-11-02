# 企画管理統合の残件完了 Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to execute this plan task-by-task. 完了した項目だけチェックする。既存計画の残件と今回得られた実機証拠を照合して進める。

**Goal:** 本番フォーム連携、未確認のデータ保持・画面操作、検証データのcleanupを終え、実績に基づいて既存計画を閉じる。

**Architecture:** 公開中のCircle、既存フォームキュー・Apps Script worker、既存release workflowを使う。最初に公開SHAと成功済み検証を照合し、未確認部分だけ実行する。不具合が見つかった場合に限って、そのownerを最小修正する。

**Tech Stack:** React、Carbon、Firebase RTDB、Apps Script、既存Playwright検証、Chrome／サイドブラウザ。

**Spec:** `2026-10-30-project-management-integration.md`、`2026-11-01-tabs-and-ui-behavior-consistency.md`、`docs/design/ui-screen-matrix.md`、リポジトリ`AGENTS.md`、本会話の残件と承認。

## Global Constraints

- 本番で書き込む企画は `P9A93LMQ` のみ。通常企画、他のフォーム・回答・jobを変更しない。
- workerのアカウントは `sanpokai.formmaker@gmail.com`、対象プロジェクトは `1Z_fpG_nd4UazqRZKbZHhzlcTsD0jBEaUXIqCXmqNTmgg5edgLNljgx50`。過去の確認を現時点の稼働証拠に置き換えない。
- UI操作はChrome／サイドブラウザのブラウザーAPIを使う。`cua_repl`という共通入口でもブラウザーAPIに限定し、`getApp`やデスクトップ・ファイルダイアログ操作に切り替えない。アップロードが必要ならブラウザーのfile chooser APIを使う。
- 成功済み検証は同じSHA・同じ対象で再利用する。全matrix、非deploy診断、workerデプロイ、トリガーの削除復元を理由なく繰り返さない。
- 認証・Rules・必須check・cleanup guardを迂回しない。過去の具体的承認は引き継ぎ、対象や権限が変わるときだけ追加判断を求める。
- 同じ問題で20分以上実質的な進捗がなければ停止し、原因、未完了項目、本番に残した検証データを報告する。停止時も安全に実行できるcleanupは先に行う。
- 新機能、文言の追加、大規模整理、アカウント連携・非公開機能は追加しない。無関係な未コミット変更・生成物を巻き込まない。

## Review Focus

1. 古い計画の「未デプロイ」と現在の公開状態が混在している → Task 1でSHA・run・workerを照合する。
2. 本番smokeとworkerが同じroomを同時に更新する → Task 2〜4を直列に行い、job完了を確認してからcleanupする。
3. フォーム作成の待機中に再送して重複する → Task 2では一件のjob IDを追い、結果不明なら既存復旧経路を使う。
4. タブ非表示でデータが消える、別ブラウザーへ古い設定が戻る → Task 3で二つのブラウザーと非表示前後を比較する。
5. roomだけ消してsidecarや外部フォームが残る → Task 4で今回作成したデータの一覧と照合する。

## Task 1: 現在地を一度だけ確定する

**参照:** `release-build.json`（本番）、GitHub Actions、`.github/workflows/react-production-release.yml`、workerの`deployment/form-maker-targets.json`、既存計画2件。

- [x] 公開状態を更新照合：公開React root SHAは`e1c43ff3693d8d6a992e276b71c117b878b13e54`、同SHAの`React Production Release` run `41303105246` が成功。compatibility/root smoke、両cleanup、rollback artifact保存まで成功。旧runは現状証拠に使わない。
- [x] workerは対象アカウント`sanpokai.formmaker@gmail.com`、対象プロジェクト`1Z_fpG_nd4UazqRZKbZHhzlcTsD0jBEaUXIqCXmqNTmgg5edgLNljgx50`。修正commit `debb3ea8783fbf2ced9a11d2f3c4246c89e49a34`、公式workflow run `41298877220` 成功。`Code.gs`/`appsscript.json` の本番読み戻しSHA-256一致を確認し、queue 5分・回答同期1時間の各トリガーを復元。現在の実行は今回P9作成を処理したrunで再照合する。
- [x] Chromeの本番P9アプリではroom marker`react-diagnostic-1793524753984-731`、タブは未表示、画面に保存失敗が残っていた。Firebase本番Rulesには`projectWorkspacesV1`が存在することを確認。実企画データは変更していない。
- [x] 未チェック項目を同版証拠あり・未確認・不具合ありに分類。タブ初回保存失敗の原因はRulesとクライアントのrevision不一致として修正対象に特定。

**完了条件:** 追加デプロイの要否、再利用できる成功結果、実際に残る確認項目が特定できている。

## Task 2: 本番フォーム連携を一件だけ通す

**対象:** `apps/react/src/services/form-maker-workspace.js`の`createFormMakerWorkspaceProps`、`application-form-link.js`の`prepareApplicationFormContext`、専用workerの`worker/application-link.gs`・`worker/sync.gs`。通常は参照のみ。

- [ ] P9の既存検証データと現在の状態を照合し、参加者・配置・費用・集金の比較用スナップショットを確保する。2026-11-02に取得したroomにはrelease smoke由来marker`react-release-41303105246-1-updated`、仮参加者6人、互換用`applicationSync` fixture 2件があった。フォーム処理前データのスナップショットは未確保。
- [x] P9の本番「応募フォーム」タブから、明確な検証名で一件だけ作成する。job `5fc2ae1d34614fe8a8011ca48ebbf4fe` を追跡し、フォームID `1F4qvpwkqr7ip6ytJpwrsyc8nWAgx8R-Ls4oFJnV1ygY`、回答シートID `1vNZawckU2e0MOfEuXYr1UrFNoSCASAYJi7_3pa5ZnmA` を確認した。再送していない。
- [x] 阻害原因を修正：未使用のroom reservation IDを`project.jobId`としてForm Makerへ渡していたため、送信前から既存job扱いとなり作成ボタンが無効化されていた。reservationは送信時の`createProjectLink`で取得・再利用し、送信済みjobの復旧状態は既存のproject pending stateに任せる。`form-maker-workspace.test.mjs`で回帰テストを追加し、失敗→修正後成功を確認。
- [x] 作成済みフォームが同じP9に関連付き、そのタブ内に結果が表示されることを確認する。他企画の履歴を結果扱いしない。
- [ ] 架空の応募回答を計3件送信。最初の2件はP9限定full-refreshで`ok:true`, `responseCount:2`, `synced:true`まで確認。追加の1件もGoogleフォーム上では送信完了したが、最新のApps Script実行一覧に対応するフォーム送信トリガー実行はなく、参加者画面も「応募者 2人」のまま。通常の自動同期は未確認。全キューの手動再実行はしていない。
- [ ] P9の応募者一覧は「応募者 2人・参加者 6人」と表示された。参加者・配置・費用・集金の完全な同期前スナップショットはなく、後者3項目の比較は未完了なのでデータ保持確認を完了扱いしない。

**前回の停止理由（未確定）:** 匿名Playwrightセッションで`projectWorkspacesV1/P9A93LMQ`と`projectFormLinksV1/P9A93LMQ`がHTTP 401となった。認証状態とRulesのどちらが原因かは切り分けておらず、企画オーナー用ブラウザーが必須とは断定しない。

**2026-11-02の再確認:** PC再起動後、Chrome拡張ブラウザーとサイドブラウザーの両方で一覧・画面読み取りが成功した。P9の応募フォームタブはフォーム連携済み表示で、作成操作は「この企画には応募フォームが連携済みです」と止まった。Firebase Consoleで`rooms/P9A93LMQ/meta/applicationSync`を読み、タイトル「互換性確認用の企画」、回答キー`fixture-response-a`と`fixture-response-g`、`responseCount: 2`の検証fixtureを確認。これは実フォーム作成jobではない。フォーム名・説明は画面内で入力したが、フォーム作成要求・回答送信・worker jobは発生していない。期限切れの`projectFormLinksV1/P9A93LMQ`予約も確認した。フォーム作成を再試行するには、まずfixtureの削除が必要であり、ブラウザーの削除確認を待つ。

**完了条件:** 作成→同じ企画へ接続→回答同期が実サービスで成功し、既存業務データの保持を確認できている。確認できない段階を成功扱いしない。

## Task 3: 未確認の操作だけを埋める

**記録先:** `docs/design/ui-screen-matrix.md`、既存modal inventoryの`docs/design/react-typography-spacing.md`。

- [ ] ローカルの全ツールサンプルで、未確認の旧enabled/pinned組合せ、全off、非表示deep link、表示中タブの非表示、先頭・末尾の並び替えを確認する。単体テストで証明済みの分岐はその実績を使う。
- [ ] 参加者・配置・精算・フォーム入力・登山下書きを持つ状態で非表示→再表示し、入力保持を比較する。共有設定は二つのブラウザーで同じになることを確認する。正常なフォーム作成はTask 2の一件を再利用する。
- [x] 2026-11-02: P9のタブ順をChromeで一つ移動し、別ブラウザーで再読込後に同じ順序が反映されることを確認。別ブラウザーから元の順序へ戻し、Chrome側でも反映を確認した。検証用の順序変更は復元済み。
- [ ] matrixとmodal inventoryで今回の手動確認がない行だけを開き、主操作、閉じる／取消、フォーカス復帰、スクロール、入力エラーを確認する。狭幅とデスクトップ、light/darkの不足分を埋める。同じ描画機構の反復検証はまとめるが、未確認をpassにしない。
- [x] タブ初回保存で、クライアントが新規sidecarへ`revision: 1`を書き、本番Rulesは新規sidecarの`revision: 0`だけを許可していた不一致を特定。初回の保存値を0に合わせ、次回編集から1へ進める回帰テストを追加。unit 188/188、Firebase Auth/RTDB emulator 6/6、preview build/manifest照合を確認。
- [ ] 修正版を公開し、ブラウザーでP9のタブ編集保存を確認する。サイドブラウザーでは編集画面の表示を確認したが、共有保存と別ブラウザーへの反映はまだ確認していない。前回の匿名セッションHTTP 401は認証要件の根拠にしない。

**完了条件:** 既存計画が要求する到達可能状態の未確認が解消し、維持する差には理由がある。実機・screen readerは別途未検証と明記する。

## Task 4: 本番検証データを片付ける

**既存経路:** `apps/react/tools/cleanup-production-smoke.mjs`、`apps/react/tests/production/firebase-smoke-room.mjs`。marker・room guardを維持する。

- [x] Task 2のjobが処理を終え、cleanup後に再書込みする対象フォーム実行がないことを確認する。jobパスには値がなく、今回フォームのsubmit triggerを除去した。共有トリガー全体は停止していない。
- [x] 今回作成した専用フォームと回答シートをファイルID・タイトルで照合し、完全削除した。他のフォームは触っていない。
- [ ] release workflowのcleanup成功ログと実データに不一致があり、後続確認では同じrelease markerを持つP9 roomが再び読み取れた。前回の`null`確認は現在のcleanup完了を証明しない。再読込後もmarker `react-release-41303105246-1-updated`、参加者6人、応募者2人を本番UIで確認。
- [ ] `meta/applicationSync`は現在も存在し、`responseCount: 2`。`projectFormLinksV1/P9A93LMQ`にはjob `5fc2ae1d34614fe8a8011ca48ebbf4fe` の`linked`レコードが残る。Firebase Consoleで現在値を再確認した。Rulesは迂回しない。
- [ ] worker Script Propertiesには削除済み検証フォームIDを指す`FORM_IMPORT_V2_{formId}`が`active`で残り、`FORM_IMPORT_INDEX_V2`にも同IDが含まれる。`lastSyncedAtMs`が後続時刻に更新されているため、これが`applicationSync`再生成の原因である可能性が高い。登録削除後の再同期を見て因果を確認する。作成journalは監査用として残す。
- [x] P9フォームID専用のsubmit triggerは除去済みで、queue／定期同期triggerは維持。共有trigger全体は停止していない。
- [x] `projectWorkspacesV1/P9A93LMQ`に`revision: 4`、`tabOrder`、`tools`が存在。P9で設定変更を保存し、別ブラウザーの再読込で同一順序・可視状態を確認した。順序変更を元に戻し、逆方向の反映も確認。

**完了条件:** P9のroomと今回の検証用sidecarに不要データがなく、残す監査履歴・ゴミ箱資産が明示されている。

## Task 5: 必要な場合だけ公開し、実績を閉じる

- [ ] Task 1で確認した公開SHAとTask 3の最終ソースを比較する。コード修正がなければ再公開しない。
- [ ] 修正がある場合は対象check、commit／push／PR／CI／merge、main対象SHAの`Release / Readiness`、既存`React Production Release`へ進む。公開path分類とcompatibility要否は既存workflowに従う。
- [ ] 最終公開SHAについてroot両ブラウザーsmoke・cleanup・成功artifactの証拠を確保する。既に同じSHAで成功していれば再利用し、失敗時は既存rollback経路を使う。Task 2のworker確認とrelease smokeは並行しない。
- [ ] 元の統合計画、タブ・UI統一計画、`.superpowers/sdd/2026-10-30-project-management-integration/progress.md`の古い状態を実績で更新する。古い「承認待ち」は現在の承認・実施結果へ置き換える。記録だけの変更でアプリ再公開を繰り返さない。
- [ ] 最終報告に公開SHA／run、フォーム作成・回答同期、データ保持、P9 cleanup、未検証事項を短く記す。

## Continuation record — 2026-11-02

- `React Production Release` run `41303105246` on `e1c43ff3693d8d6a992e276b71c117b878b13e54` succeeded, including compatibility/root browser smoke and workflow cleanup.
- Despite that cleanup log, a later production read of the P9-only room returned the same run's synthetic marker and fixture data. The exact marker was deleted with an authenticated browser REST request guarded by a marker equality check; an immediate read and a second read after navigating all test tabs to the project list both returned `null`.
- The project-list and P9 checks used Playwright browser sessions only. No native computer-use action, form creation, answer submission, worker job, reservation, or real project write occurred.
- The new browser session authenticated anonymously. RTDB allowed reading `rooms/P9A93LMQ` but returned 401 for `projectWorkspacesV1/P9A93LMQ` and `projectFormLinksV1/P9A93LMQ`. The form flow and saved tab settings therefore remain unverified; the browser is not authenticated as the project owner. Do not bypass Firebase Rules.
- No application source, Firebase Rules, worker deployment, or release was changed in this continuation. Existing unrelated/untracked files remain untouched.

### Browser retry — 2026-11-02

- The earlier `Local browser use is disabled in Work settings` result did not recur after initializing a fresh Browser runtime. Chrome user tabs, the P9 application form UI, Firebase Console under `610unko@gmail.com`, and the side-browser tab editor were readable through the supported browser APIs. The user noted that the PC had been restarted; the restart is a plausible explanation, not a proven root cause.
- The create attempt reached the app's guard and was blocked before enqueue because the P9 smoke room still contained a clearly synthetic `meta/applicationSync` fixture (`互換性確認用の企画`, `fixture-response-a`, `fixture-response-g`). The current failure was not evidence that Form Maker or Browser was unavailable.
- Historical note: no Google Form or response existed at this point. The user later authorized cleanup limited to assistant-created P9 data; the fixture was removed and the later P9 form smoke is recorded below. Do not apply this superseded wait instruction to the remaining work.

### Form worker smoke and cleanup — 2026-11-02

- The user explicitly authorized deletion of assistant-created synthetic P9 data. Used only P9 (`P9A93LMQ`); no actual project room was changed.
- Created one P9 form request and submitted three clearly synthetic responses. The ordinary `syncManagedFormOnSubmitV1` executions at 8:15 and 8:38 completed, but did not write the room snapshot. Only a P9-specific temporary full-refresh function succeeded with `synced:true`, `responseCount:2`; the third response did not produce a form-trigger execution and the participant count stayed at 2. Automatic trigger success is not verified. The P9 participants screen showed 2 applicants and retained 6 confirmed participants.
- Restored the worker to the reviewed candidate source after the temporary diagnostic/cleanup functions. Production readback hashes match `Code.gs` `2D449CF3D2CAE675D9E968E4BBFC090FD519375187D734C3CBDC644E6EBD56D7` and `appsscript.json` `D73BCF1BF07F358E8B64E2C6BFF0CC2AE8E035BB943A1BCFB4B227507333734F`.
- Restored and verified the reviewed worker source by production pull: `Code.gs` SHA-256 `2D449CF3D2CAE675D9E968E4BBFC090FD519375187D734C3CBDC644E6EBD56D7`; `appsscript.json` SHA-256 `D73BCF1BF07F358E8B64E2C6BFF0CC2AE8E035BB943A1BCFB4B227507333734F`. Trigger list shows 9 total: one 5-minute queue trigger, one hourly sync trigger, and 7 form-submit triggers; the P9 form-specific trigger is absent.
- Permanently deleted the P9-only form and response spreadsheet after verifying their titles and IDs. Removed the P9 `meta/applicationSync` snapshot and verified it is `null`. The P9 `projectFormLinksV1` record remains `linked`; a worker-authenticated write returned HTTP 401 and Console still showed it, so it was not force-cleared. The associated job path has no displayed value. A Script Properties entry for the deleted form also remains. No global sync was manually run.
- Remaining gaps: clean up the P9 Script Properties entry without bypassing authorization; ordinary submit-trigger recovery; before/after snapshots for allocation/settlement/collection; and shared tab-sidecar persistence. The shared sidecar had no value when checked. Hourly reconciliation could not be verified after the form was removed. No app release was needed for this worker-only operation.
- Follow-up access check: the current Chrome browser bridge returned an empty tab list, and `clasp run getFormMakerReleaseDiagnosticsV1` returned Apps Script API `NOT_FOUND` without running a function. No additional production state changed. The remaining Script Properties and Firebase link cleanup therefore need a working authenticated browser/API session; the plan does not need to be regenerated.

### Browser reinspection — 2026-11-02

- Chrome and side-browser APIs are available again. No native-app or desktop file operation was used.
- Fresh Firebase Console and production app reads contradict the earlier cleanup observation: the P9 release-marker room, `applicationSync` (`responseCount: 2`), linked `projectFormLinksV1` record, and workspace sidecar are present. The worker's Script Properties show the deleted P9 form's import entry still `active` and its `lastSyncedAtMs` advanced after cleanup. The earlier `null` read was temporary; recurring worker activity is a likely cause of the reappearing snapshot, not yet proven.
- P9 cross-browser tab persistence was verified with a reversible reorder, second-browser reload, and restore from that browser. The sidecar currently has `tabOrder` and `tools`; keep it until the P9 synthetic room disposition is completed.
- The next cleanup must remove only the P9 form ID from `FORM_IMPORT_V2_{formId}` and `FORM_IMPORT_INDEX_V2`, leave unrelated registrations and the creation journal intact, then verify a later worker sync no longer recreates P9 `applicationSync`. Do not stop shared triggers. This production deletion is awaiting action-time confirmation.

**終了条件:** Phase 3bの実サービス確認、既存計画の未確認操作、本番root smokeとcleanupが証拠付きで完了している。将来対応のPhase 6は今回の残件に含めない。
