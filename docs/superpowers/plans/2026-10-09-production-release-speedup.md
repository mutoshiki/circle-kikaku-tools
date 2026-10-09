# 本番反映短縮 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Readinessの成功後に始める通常UI更新の公開処理を、実ブラウザ・データ削除・rollbackの保証を保って3〜5分へ短縮する。

**Architecture:** 既存のReact Production Releaseを段階的に改善する。まずsmokeとcleanupを同じjobで動かし、その後ブラウザ準備環境を実測改善する。継続運用用の検証済みReact rollback artifactを整備してから、通常更新と移行確認の二つの経路を同じworkflow内で選択する。

**Tech Stack:** GitHub Actions / Pages、Node 22、Playwright 1.61.0、Firebase browser-origin認証。

**Spec:** `docs/superpowers/specs/2026-10-09-production-release-speedup.md`

## Global Constraints

- 対象main SHAのReadiness成功、production設定・Rules検証、同じproduction build/digestを必須にする。
- 両ブラウザのroot smoke、予約room `P9A93LMQ`、marker確認、null確認、release直列実行を維持する。
- 通常企画データ、UI、精算ロジック、Firebase Rulesを変更しない。
- local CI build、別SHA、保持期限切れ成果物を公開・rollback用に流用しない。
- root smoke/cleanup失敗時のrollbackを維持し、失敗を成功扱いしない。
- 速度改善のためにUI・精算処理・Firebase Rules・production設定を変更しない。公開workflow、smoke action helper、テスト、release手順文書の変更は対象。

## Review Focus

- テストtimeout/runner終了でfinallyが実行されない場合も専用roomの回収経路があること。
- 古いFirebaseクライアントが削除後に書き戻すことを防ぐこと。
- 現在の公開SHAと保存されたrollback SHAが異なる場合に公開を止めること。
- 数commit前のshared変更を通常UI更新と誤判定しないこと。
- container起動・artifact転送を含めた実測で改善があること。

---

### Task 1: smokeとcleanupの環境準備を共通化

**Files:** `.github/workflows/react-production-release.yml`、`apps/react/tools/cleanup-production-smoke.mjs`、`apps/react/tests/react-production-release-contract.test.mjs`、`apps/react/tests/production-smoke-room.test.mjs`

**Interfaces:** 既存の`cleanupProductionSmokeRoom(page, options)`と予約room markerを使用する。通常成功時はcompatibility/rootそれぞれのsmoke job内でcleanupが完了した状態を次段階への条件とする。

- [x] production smokeテストはすでに`finally`でcleanupとnull確認を行うため、この挙動を維持する。成功時に再実行されている独立cleanup jobはsmoke job失敗時だけ起動するfallbackにする。
- [x] fallback jobはrunner終了後にも動く回収経路として残す。fallbackがcleanupに成功しても失敗したsmokeを成功扱いせず、root deployを止める。
- [x] runner終了で後続stepが走らない場合のfallbackと、concurrency制約下でのmarker所有権を明記する。fallbackが実行不能なら明示的に未完了とする。
- [x] root-deployはcompatibilityのsmoke/cleanupの両方の成功後のみ、rollbackはroot smokeまたはcleanup失敗時に動くようneeds/ifを更新する。
- [x] contract testをjob名・正規表現への追従だけにせず、成功/テスト失敗/cleanup失敗/fallbackの依存関係を検証する。room helperの未markedデータ拒否とnull確認も検証する。
- [x] focused checks: `node --test tests/react-production-release-contract.test.mjs tests/production-smoke-room.test.mjs` をapps/reactで実行する。失敗経路は模擬環境で検証し、本番の不具合注入をしない。
- [ ] 標準CI→Readiness→releaseで通常成功を計測する。現行約9分から約7分を初期目標とし、setupを116秒分消した効果を確認する。
- [x] cleanup簡素化とpromotion runner共通化は個別commitにまとめ済み。

### Task 2: 段階公開のブラウザ実行環境を共通化

**Files:** `.github/workflows/react-production-release.yml`、`apps/react/tests/react-production-release-contract.test.mjs`

**Interfaces:** 一つのpromotion runner内でcompatibilityとrootのdeploy/smoke/cleanupを順番に行う。root deployment、root smoke、root cleanupのstep outcomesをjob outputsに公開し、別runnerのrollback/recoveryに渡す。

- [x] Playwright公式containerを実測する。v1.61.0-nobleはローカルpull 101秒、3.45GBで、image内Nodeはv24.16.0だった。現状のGitHub runner browser installはcompat/root各約60秒、Nodeは22なので、このimage案を採用しない。
- [x] compatibility deploy→smoke→room cleanup→root deploy→smoke→room cleanupを同じpromotion jobにまとめる。Node 22、npm ci、Chromium/WebKitのinstallは一度だけにする。root deployはcompatibility smokeとcleanupの両成功後のみ実行する。
- [x] runner終了やroom cleanup失敗に備え、別runnerのcleanup-recoveryをpromotion失敗時のみ起動する。失敗を成功へ変換しない。
- [x] root deployが失敗した可能性もrollback対象にする。root deployがskipされたcompatibility段階の失敗でrollbackを実行しない。
- [x] focused checksとReact単体suiteを実行し、ジョブ順・成功条件・失敗時のrecovery/rollback条件を契約テストで確認する。
- [ ] 次の標準releaseで段階CIからroot smoke完了までの時間を記録し、約5〜6分を初期目標とする。テストを減らして目標を合わせない。

### Task 3: 継続運用用のrollbackを準備

**Files:** `.github/workflows/react-production-release.yml`、`apps/react/tests/react-production-release-contract.test.mjs`、新規`tools/production-release-artifact.mjs`、新規`apps/react/tests/production-release-artifact.test.mjs`

**Interfaces:** `production-release-artifact.mjs`は`digest <pages-directory>`、`publish <run-id> <sha> <asset-digest> <pages-payload>`、`fetch-current <production-manifest-url> <destination>`のCLI。publishはrelease smoke/cleanup成功後のみ。fetchは公開manifestと記録のSHA/digestの一致、payloadのchecksum、成功release runの出所を検証する。

- [x] 成功releaseの正確なPages payloadを期限に依存しないGitHub Release assetとして保存する。SHA・run・attempt別に書き込み専用の記録を作り、失敗releaseをrollback候補に含めない。Actionsでの保持期限に依存しない。
- [x] 最初の保存済み成功React成果物を作るまでは現在のlegacy rollbackを維持する。保存データの不足・digest違い・公開manifestとの違いを模擬fixtureで検証し、明示的に拒否する。
- [x] 必要なcontents書込権限をtrusted mainのpublish jobのみに限定する。通常のartifact取得は最小権限とする。
- [x] 取得済み成功payloadを今回runのrollback Pages artifactとして用意し、失敗後に再buildせず復旧できるようにする。
- [x] workflow相当の模擬Pages deployで復旧先のSHA/digestとファイル内容を検証する。
- [ ] 標準releaseで成功後のlast-good記録保存と、その成果物を使うrollbackを確認する。

### Task 4: 通常UI更新をroot一回公開へ整理

**Files:** `.github/workflows/react-production-release.yml`、`AGENTS.md`、`apps/react/playwright.production.config.js`、`apps/react/tests/production/production-smoke.spec.js`、`apps/react/tests/react-production-release-contract.test.mjs`、新規`tools/classify-production-release.mjs`、新規`apps/react/tests/classify-production-release.test.mjs`

**Interfaces:** `classify-production-release.mjs <previous-success-sha> <target-sha>`は`mode=standard|migration`と根拠の変更path一覧を返す。unknownもmigration。CLI出力とGITHUB_OUTPUTの値を一致させる。Task 3の検証済みrollback payloadを必須にする。

- [x] 通常経路を許可するpathをReact UI components/styles/静的UI copyとそのfocused testsに限定する。domain/sync/store/services/schema/Firebase/config/dependencies/release基盤・legacy source変更、履歴不足は移行経路にする。
- [x] 直前の公開成功SHAから全変更を比較し、UI-only・数commit前のshared・unknown・missing ancestor・依存変更の分類fixtureを検証する。
- [x] standard経路をReadiness→rollback確保/config確認→production build→root一回deploy→両ブラウザsmoke/cleanup→成功artifact保存とする。
- [x] migration経路はcompatibility→rootを維持するが、compatibility artifactのrootはTask 3の公開中成功React payloadを保持する。旧legacyを専用互換パスで検証し、通常ユーザーのrootをlegacyへ置換しない。legacy read checkのURLを対応させる。
- [ ] root promotion後も `/react/` と `/legacy/` を公開成果物に保持し、成功release archiveとrollback payloadに含める。root smokeは両パスからのReact起動・同期とlegacy読み出しを検証する。
- [x] `AGENTS.md`とcontract testsに通常/移行経路の条件を合わせて記述する。Required checksを迂回せず、同じworkflowを標準経路とする。
- [ ] standardとmigrationそれぞれで実ブラウザ確認する。version manifest、root HTTP 200、両ブラウザ・API・保存再読込・null・復旧経路を確認する。
- [ ] standard成功releaseを3回以上計測する。Readiness後3〜5分、公開中の旧版切替なしを目標とし、未達時はjob timingから再評価する。

### Task 5: 依頼から公開完了までの待ち・手戻りを減らす

**Files:** `.github/workflows/quality-guard.yml`（必要がある場合のみ）、`apps/react/tests/browser/production-smoke.spec.js`、`apps/react/tests/production/production-smoke.spec.js`、新規`apps/react/tests/browser/settlement-smoke-actions.mjs`、release workflowのjob summary

- [x] 旧selectorにより公開後で失敗した事例を使い、公開smokeとofflineの該当操作を共通action helperで実行する。データ対象guardやAPI検証はproduction test側に保持する。
- [x] 既に成功した同じSHAのCIを手作業で重複再実行しない。失敗時は原因修正と必要な再検証を行い、PRとmerge後mainの異なるSHAを混同しない。
- [x] Readiness待ち・artifact準備・deploy・smoke・cleanupをjob summaryで一目で確認できるようにする。アプリ操作で使うdataやsecretをログへ出さない。
- [x] CIの追加短縮は別計測で判断する。今回のmain CIは3分45秒だったため、初期段階ではrelease jobの準備重複を優先する。

実装状況（2026-10-09）: 最初のmigration releaseは成功したが、公開後に `/react/` と `/legacy/` がroot promotionで失われることを追加確認した。root artifactの経路保持、rollback archive、root production smokeを専用worktreeで修正中。Task 1〜2の計測とTask 3〜4の本番経路確認は、修正merge後の標準releaseで実測する。時間見積もりは保証ではない。無関係な変更・生成済みtest artifactは保全する。
