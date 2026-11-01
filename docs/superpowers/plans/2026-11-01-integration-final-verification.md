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

- [x] 公開manifest/main SHAは`7a2c49486b415fb0a323881f4d9d7d05f98b12f6`。同SHAの`React Production Release` run `41288547282`は成功。`origin/main`をfetchして同SHAに揃え、既存成果物の再公開は不要と確認。
- [x] workerは対象アカウント`sanpokai.formmaker@gmail.com`、対象プロジェクト`1Z_fpG_nd4UazqRZKbZHhzlcTsD0jBEaUXIqCXmqNTmgg5edgLNljgx50`。2026-11-01のtrigger画面で`runFormMakerQueueV1`と`runFormMakerApplicationSyncV1`がHead・エラー率0%で存在することを確認。重複するフォーム送信triggerも見えたが今回の作成・同期を止めないため触らない。
- [x] Chromeの本番P9アプリではroom marker`react-diagnostic-1793524753984-731`、タブは未表示、画面に保存失敗が残っていた。Firebase本番Rulesには`projectWorkspacesV1`が存在することを確認。実企画データは変更していない。
- [x] 未チェック項目を同版証拠あり・未確認・不具合ありに分類。タブ初回保存失敗の原因はRulesとクライアントのrevision不一致として修正対象に特定。

**完了条件:** 追加デプロイの要否、再利用できる成功結果、実際に残る確認項目が特定できている。

## Task 2: 本番フォーム連携を一件だけ通す

**対象:** `apps/react/src/services/form-maker-workspace.js`の`createFormMakerWorkspaceProps`、`application-form-link.js`の`prepareApplicationFormContext`、専用workerの`worker/application-link.gs`・`worker/sync.gs`。通常は参照のみ。

- [ ] P9の既存検証データと現在の状態を照合し、参加者・配置・費用・集金の比較用スナップショットを確保する。古い検証データが妨げる場合だけ、markerと対象を確認して既存のguard付きcleanupを行う。
- [ ] P9の本番「応募フォーム」タブから、明確な検証名で一件だけ作成する。予約/job IDを控え、同じjobの処理完了を追う。新規送信で再試行しない。
- [ ] 作成済みフォームが同じP9に関連付き、そのタブ内に結果が表示されることを確認する。他企画の履歴を結果扱いしない。
- [ ] 作成した専用フォームへ架空の応募回答を一件送信し、その回答の同期を確認する。待機が必要なときはworkerの実行状況を確認し、既存の対象限定同期操作があれば使う。全キューの手動再実行を安易に行わない。
- [ ] P9の応募者一覧へ反映されたこと、確定参加者は既存の選択・更新フローに従うこと、元の参加者・配置・費用・集金が上書きされていないことを比較する。

**完了条件:** 作成→同じ企画へ接続→回答同期が実サービスで成功し、既存業務データの保持を確認できている。確認できない段階を成功扱いしない。

## Task 3: 未確認の操作だけを埋める

**記録先:** `docs/design/ui-screen-matrix.md`、既存modal inventoryの`docs/design/react-typography-spacing.md`。

- [ ] ローカルの全ツールサンプルで、未確認の旧enabled/pinned組合せ、全off、非表示deep link、表示中タブの非表示、先頭・末尾の並び替えを確認する。単体テストで証明済みの分岐はその実績を使う。
- [ ] 参加者・配置・精算・フォーム入力・登山下書きを持つ状態で非表示→再表示し、入力保持を比較する。共有設定は二つのブラウザーで同じになることを確認する。正常なフォーム作成はTask 2の一件を再利用する。
- [ ] matrixとmodal inventoryで今回の手動確認がない行だけを開き、主操作、閉じる／取消、フォーカス復帰、スクロール、入力エラーを確認する。狭幅とデスクトップ、light/darkの不足分を埋める。同じ描画機構の反復検証はまとめるが、未確認をpassにしない。
- [x] タブ初回保存で、クライアントが新規sidecarへ`revision: 1`を書き、本番Rulesは新規sidecarの`revision: 0`だけを許可していた不一致を特定。初回の保存値を0に合わせ、次回編集から1へ進める回帰テストを追加。unit 188/188、Firebase Auth/RTDB emulator 6/6、preview build/manifest照合を確認。
- [ ] 修正版を公開し、P9でタブ編集の実保存を確認して応募フォームタブを表示する。保存後に同じタブからフォーム作成へ進む。

**完了条件:** 既存計画が要求する到達可能状態の未確認が解消し、維持する差には理由がある。実機・screen readerは別途未検証と明記する。

## Task 4: 本番検証データを片付ける

**既存経路:** `apps/react/tools/cleanup-production-smoke.mjs`、`apps/react/tests/production/firebase-smoke-room.mjs`。marker・room guardを維持する。

- [ ] Task 2のjobが完了し、cleanup後に再書込みする実行がないことを確認する。共有トリガー全体は停止しない。
- [ ] Task 1・2で控えた今回の専用フォーム／回答保存先を照合し、不要な検証資産は復元可能なゴミ箱へ移す。他のフォームは触らない。
- [ ] P9の検証roomを既存cleanup経路で削除し、読み直して空を確認する。今回作成したworkspace sidecar・予約・関連jobは、現行Rulesと保存契約に従って片付ける。必要な監査履歴まで一律削除しない。
- [ ] workerが削除済み企画へ再送していないことと、残した履歴が有効な権限・処理中依頼を持たないことを確認する。

**完了条件:** P9のroomと今回の検証用sidecarに不要データがなく、残す監査履歴・ゴミ箱資産が明示されている。

## Task 5: 必要な場合だけ公開し、実績を閉じる

- [ ] Task 1で確認した公開SHAとTask 3の最終ソースを比較する。コード修正がなければ再公開しない。
- [ ] 修正がある場合は対象check、commit／push／PR／CI／merge、main対象SHAの`Release / Readiness`、既存`React Production Release`へ進む。公開path分類とcompatibility要否は既存workflowに従う。
- [ ] 最終公開SHAについてroot両ブラウザーsmoke・cleanup・成功artifactの証拠を確保する。既に同じSHAで成功していれば再利用し、失敗時は既存rollback経路を使う。Task 2のworker確認とrelease smokeは並行しない。
- [ ] 元の統合計画、タブ・UI統一計画、`.superpowers/sdd/2026-10-30-project-management-integration/progress.md`の古い状態を実績で更新する。古い「承認待ち」は現在の承認・実施結果へ置き換える。記録だけの変更でアプリ再公開を繰り返さない。
- [ ] 最終報告に公開SHA／run、フォーム作成・回答同期、データ保持、P9 cleanup、未検証事項を短く記す。

**終了条件:** Phase 3bの実サービス確認、既存計画の未確認操作、本番root smokeとcleanupが証拠付きで完了している。将来対応のPhase 6は今回の残件に含めない。
