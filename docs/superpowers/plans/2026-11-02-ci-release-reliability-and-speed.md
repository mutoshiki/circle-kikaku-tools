# CI・検証・本番公開の高速化と安定化 Implementation Plan

> **実装状況:** Task 1・2・4を実装済み。Task 3はworker/P9の本番書き込みが絡むため今回の対象外。Task 5の実測はPR CI完了後に追記する。

**Goal:** 必須チェックと本番の両ブラウザーsmokeを維持し、変更に見合った検証・検証環境の分離・作業手順の固定により待ち時間と手戻りを減らす。

**Architecture:** 既存の `quality-guard.yml` → main対象SHAの `Release / Readiness` → `react-production-release.yml` を維持する。既存分類器を拡張し、offline検証の重複と直列部分を削る。本番P9の処理は引き続き直列とし、release smokeとフォームworker検証の用途を分ける。

**Tech Stack:** Node 22 / npm ci / GitHub Actions / Playwright 1.61.0 / Vite / Firebase Auth・RTDB Emulator / Apps Script worker。

**Spec:** 2026-11-02の依頼に基づき、既存CIの安全性・必須チェック・公開の信頼性を維持したまま、重複と不要な待ち時間を減らす。今回の実装では本番公開を行わない。

## 0. 調査範囲・制約

- 調査対象checkoutは `codex/project-workspace-first-save-rules` / `a6366d7d106bd84e0fb995429f514fa7cab62f0c`。PR #134のheadで、merge後mainは `e1c43ff3693d8d6a992e276b71c117b878b13e54`。GitHub compareで両者の差はform workspaceサービス・単体テスト・既存計画書の3ファイルだけと確認し、今回参照するworkflow/configが当該mainと同じことを確認した。
- 2026-11-01のCI 3本、release成功/失敗各1本、非deploy診断2本のjob・step時刻をGitHub APIで取得。CI 1本のChromium/WebKit JSON artifactも読んだ。小さい標本であり、長期の中央値・p95ではない。
- Apps Scriptは別作業先 `C:/Users/toshi/.codex/worktrees/project-management-worker-integration/worker/` のsourceも読んだ。本番workerの現在のsource hash・権限・実行状態は今回は再検証していない。
- 古い進捗文書には、後続の会話上の実施結果と異なる残件記述がある。過去のチェック欄だけで現在の不具合・未完了を確定しない。
- 既存の未コミット文書4件・生成物は保全。この新規計画書以外の変更、テスト実行、CI再実行、merge、公開、Firebase書き込みは行わない。

## Global Constraints

- `Release / Readiness` をrequired checkとして維持する。ruleset `24113226` はmain対象、strict有効、bypass actorなし。従来branch protection APIの404は「保護なし」を意味しない。
- PRの成功をmerge後main SHAのReadinessに流用しない。同じSHAで既に成功した工程は新しい失敗根拠がなければ再実行しない。
- domain / store / sync / persistence / calculation / Firebase / schemaの変更には関連shared・legacy検証を残す。未分類・履歴不足は広い検証へ倒す。
- 本番はP9A93LMQのみ、両ブラウザーroot smoke・cleanup・Rules/API制約・検証済みrollbackを維持する。
- compatibility/rootは同一production build・SHA・digestを使う。公開中rootと一致する成功artifactのrollback方式を維持する。
- flakyな結果をretry成功で隠さない。テストの削除・skip追加・assertion緩和によって高速化しない。

## Review Focus

1. 削除・rename・複数機能同時変更・未知のpath・判定不能が狭い検証へ漏れること → Task 2。
2. offline並列化で共有ファイル・port・room・ブラウザー状態が衝突すること → Task 1。
3. 選択テストが0件、report欠損、shard欠落なのにReadinessが成功すること → Task 1・2。
4. worker、開いたアプリ、遅延ジョブがcleanup後にP9を再生成すること → Task 3。
5. ブラウザーの接続不良をアプリ障害と誤判定し、再公開や全CIへ戻ること → Task 4。

## 1. 現状と実測

### 1.1 フローと、既に改善済みの点

`quality-guard.yml` はPR/main pushで発火し、最初の変更分類後に各jobを並列実行する。CI concurrencyはPR番号またはref単位で古い実行をcancelする。releaseはdispatch、`react-production-release` concurrencyでcancelせず直列化される。非deploy diagnoseも同じ枠を使う。

releaseはReadiness確認 → Rules/config・rollback確保 → production build一度 → standardならrootのみ、migrationならcompatibility→root → 両ブラウザーsmokeとcleanup → 成功payload保存。この骨格を作り直す必要はない。2026-10-09の高速化計画で既に、promotion runner共通化、build一度、成功artifact保存、standard/migration分類を実装している。古い計画の目標時間を現在の実測として扱わない。

### 1.2 実行時間

job時間はstarted_at〜completed_at。workflow時間はcreatedAt〜updatedAtで、job間の待ちも含む。秒未満を丸めた値。

| 工程 | 実測 | 読み取れること |
|---|---:|---|
| CI #41300963284 / PR | 10分35秒 | job合計35.85 runner分 |
| CI #41301764724 / main | 9分55秒 | job合計36.68 runner分 |
| CI #41295190058 / main | 10分23秒 | job合計38.10 runner分 |
| Chromium job / 上記3本 | 8分28秒〜9分45秒 | テスト本体462〜533秒、install26秒前後 |
| WebKit job / 上記3本 | 5分31秒〜7分58秒 | テスト本体282〜409秒、install31〜48秒 |
| Legacy Browser / 上記3本 | 7分49秒〜10分17秒 | head186〜252秒、base196〜258秒を常に両方実行 |
| Visual job / 上記3本 | 56〜83秒 | 同じspecをChromium全suiteにも含めている |
| Firebase / 上記3本 | 70〜110秒 | build10秒前後、npm ciをroot/Reactそれぞれ実施 |
| Shared Collaboration / 上記3本 | 131〜147秒 | ブラウザーinstall46〜53秒、検証64〜70秒 |
| Release成功 #41303105246 / migration | 4分18秒 | prepare63秒、promotion163秒、archive12秒 |
| 同releaseのsmoke本体 | compatibility38秒＋root33秒 | ブラウザーinstall47秒、smoke用npm ci15秒 |
| Release失敗 #41302547257 | 4分44秒 | compatibility失敗、recovery60秒。rootは公開されていない |
| 非deploy診断 #41282141038 / #41282647632 | 1分38秒 / 2分14秒 | install45/55秒、WebKit smoke20/47秒。接続確認だけの用途には重い |

PR #134のPR CI開始→main CI完了→成功release完了を、失敗releaseなしの各工程で足すと約24分48秒。実際の経過時間にはmerge待ち・再実行・人の作業が別途加わる。Readiness job自体の2〜4秒はCI全体の所要時間ではなく、現行release summaryの `readiness_seconds` も集約checkの時間である。

### 1.3 テストartifactから分かったこと

main CI #41301764724はChromium 270 passed / 521.9秒、WebKit 134 passed・1 skipped / 407.6秒。skipは既存 `modal-layout.spec.js:100` のWebKit resize制限で、全項目をWebKit検証済みとは呼べない。

| spec | Chromium desktop＋mobileの結果時間合計 | WebKit mobile |
|---|---:|---:|
| settlement.spec.js | 139.9秒 | 108.1秒 |
| allocation.spec.js | 80.5秒 | 61.4秒 |
| project-workspace.spec.js | 44.9秒 | 33.3秒 |
| ui-audit.spec.js | 16.7秒 | 15.2秒 |

これらはテスト結果のduration合計で、job時間とは異なる。遅延の主因を「全画面スクリーンショット」だけに帰す根拠はない。settlement/allocationの操作量が大きい。timeout値を短くするだけでは正常時を速くできない。

### 1.4 具体的な問題と根拠

- **直列テスト:** `apps/react/playwright.config.js` は4project定義、`workers: 1`。CIはChromium desktop/mobile、WebKit mobileを別jobにしているが、それぞれのjob内は直列。WebKit desktopは定義だけで標準CIの実行対象ではない。
- **明白な二重実行:** `quality-guard.yml:159` のVisual jobと、同`:85` のChromium全suiteの両方で `visual-consistency.spec.js` を実行。Build/Unit/Firebase各jobのbuild、各browserのpreview buildにも重複はあるが、単体buildは約10〜13秒で主因ではない。
- **分類が粗い:** `tools/classify-release-changes.mjs:11` はservices全体をsharedに分類し、React変更ならFirebase/Shared Collaborationも必ず実行。PR #134のサービス2行削除も全系列を動かした。ただし同サービスは企画連携の境界なので、これを単純に「legacy不要」とは判定できない。
- **空のreportを成功扱いし得る:** `tools/assert-browser-clean.mjs` は失敗列挙が0なら成功し、選択したテストの存在や必要件数を検証していない。選択実行・shard導入前に補強する。
- **環境分離は既に存在:** `tools/test-firebase-target.mjs` はoffline/emulator/stagingを明示し、本番project/URLを拒否。`serve-test-preview.mjs` はoffline4176/emulator4175で再build、既存server流用なし。これを温存する。
- **P9 cleanupの対象不足:** `tests/production/firebase-smoke-room.mjs` は `rooms/P9A93LMQ` だけを扱う。`projectWorkspacesV1`、`projectFormLinksV1`、worker登録・submit trigger・queued/partial jobは扱わない。`allowPriorReleaseMarker` は他runのmarkerも許すので、既存workflowの直列枠と対で使う必要がある。
- **失敗の実証:** release #41302547257は `Reserved smoke room marker does not belong to this release` で失敗。writer競合を示すが、どのwriterかはこのログ単独では確定しない。前の会話にある「ブラウザータブだけが原因」は断定しない。
- **worker成功と同期成功は別:** 別作業先の `events.gs: syncManagedFormOnSubmitV1` は例外をcatchして `{status:'error'}` を返す。Apps Script実行画面の「完了」だけでは同期成功の証拠にならず、特定回答が企画へ反映されたことが必要。
- **ブラウザー接続調査はCI外:** Chrome/side-browserの接続可否に対してrelease diagnoseを実行しても接続の問題は解決しない。アプリの検証と接続の疎通確認を取り違えていた。

## 2. 推奨する検証範囲

最初は全件数を保った重複排除・並列化を実施し、変更範囲による選択はその後に入れる。

| 変更 | ローカル開発中 | PR・main CIで求める検証 | 公開経路 |
|---|---|---|---|
| 計画書・開発文書のみ | diff確認・リンク等の必要な確認 | Change scope＋Readiness。テスト対象なしの理由を記録 | アプリ再公開しない |
| 明示allowlist内の局所UI/copy | 対象spec＋影響画面、390pxとdesktop。関連するWebKit操作も確認 | Build/Unit、常設critical journey、対象UI specsをChromium desktop/mobile＋WebKit mobile、必要なvisual | 既存分類でstandardならroot一度 |
| 共通styles・App shell・共通UI | 関連テスト | React browser全件・visual。shared依存があればその系列も追加 | 公開分類は現行どおり |
| 割り当て/精算の計算・保存、domain/sync/store、Firebase/schema、フォーム連携service、組込package | 対象unit/emulator＋操作 | 現在の関連React/shared/legacy系列を維持 | migration |
| CI/config/dependency/未知path/判定不能 | 影響確認 | 保守的な全系列 | migration |

「変更行数」「jsxという拡張子」「UIという依頼文」だけでは狭めない。component中に保存・計算処理があるため、初期allowlistは依存を確認した葉の表示変更に限定する。`form-maker-workspace.js` を一律UI扱いする変更はしない。既存分類器に選択対象specと理由を追加し、CIとローカルで同じ判断を読む。

PRとmainは異なるSHAなので両方を検証する。初期案ではPR結果のtree同一性による流用やmerge queueを導入しない。各実行を短くして総時間を縮める。

## 3. 改善案の比較・採否

| 案 | 効果・コスト | 判断 |
|---|---|---|
| offline browserを2 workersへ | テスト本体が数百秒あり効果大。出力衝突/CPU競合の検証が必要 | 最優先。まずfile単位、fullyParallelは初期導入しない |
| Legacy baseをhead失敗時だけ実行 | 正常時にbaseブラウザー196〜258秒、base協調55〜104秒とbase npmを省ける | 採用。head失敗時はbaseとテストID比較を必ず実施。shared/source変更の新規失敗はブロック |
| Visual重複除去 | 数十秒程度と準備/runner負荷を削減。coverageは同一 | 採用。専用jobへ所有権を寄せ、広いChromium jobからだけ除外 |
| 変更範囲によるspec選択 | 小修正の全件実行を削減。取りこぼしリスクあり | Task 1後に限定導入。unknownは全件、選択根拠と件数を保存 |
| 2 shards | CPU競合が強い場合にも短縮できるがrunner/setup/reportが増える | 2 workersで安定しない/十分縮まらない場合だけ比較。初期から両方入れない |
| npm cache | 既にsetup-nodeでnpm cacheあり。node_modulesの使い回しはしない | 維持。Firebase jobのcache keyにroot/React両lockfileを含める小修正のみ |
| Browser binary cache | downloadとrestoreが同程度になり得る。Linux依存導入は別途必要 | 初期不採用。install20〜50秒に対しテスト本体が数百秒 |
| Chromium `--only-shell` | headlessの不要なfull browser downloadを省ける | 使用channelを確認後、小さな追加最適化として計測。削減秒数は未測定 |
| 共通build artifact配布 | build約10秒を減らせるがupload/download・job依存待ちが増える | 初期不採用。local/emulator/production buildを混同しない |
| 専用Docker image/self-hosted runner | 継続保守、更新、秘密情報、環境差のコストが増える | 不採用。旧計画にも3.45GB imageの準備負担の記録あり。今回は再測定しない |
| 本番smokeのブラウザー並列化 | 本体合計約33〜38秒の一部を削れるだけでP9競合が増える | 不採用。production/emulatorは当初workers1維持 |
| WebKit削除・成功までretry | 見かけの短縮/成功を作る | 不採用。両ブラウザーの確認と失敗の可視性を維持 |
| 別Firebase staging＋別worker | 実フォームの反復テストを本番P9から分離できるが認証/Rules/運用が増える | 保留。通常は既存Emulator。フォーム基盤を頻繁に変更する実績が出てから導入 |

公式資料も、browser binary cacheを一般には推奨せず、CI worker数は安定性との比較を求めている。shardはfile単位でも可能で、fullyParallelを使う場合にtest単位へ変わる。本計画の2 workers採用は、このリポジトリの実測に基づく判断である。

## 4. 段階的な実装

### Task 1: テスト件数を減らさず、重複と直列ボトルネックを解消

**変更対象:** `.github/workflows/quality-guard.yml`、`apps/react/playwright.config.js`、`tools/assert-browser-clean.mjs`、`apps/react/tests/browser/ui-audit.spec.js`、`ui-audit-form.spec.js`、`shell.spec.js`、`modal-layout.spec.js`。必要なconfig/report契約テストは `apps/react/tests/ci-browser-report.test.mjs` に追加。

**作業:**

- [ ] JSON artifactを使う小さなreport fixtureで、欠損・0件・unexpected/flaky・必要project欠落を失敗とし、既存の明示skipを別集計することを固定する。expected selectionなしで全skipを合格にしない。
- [ ] screenshot出力を `testInfo.outputPath()` 等のproject/test固有pathへ移す。特に `ui-audit.spec.js` の `artifacts/ui-audit/mobile` はChromium/WebKitで同名になる。実fixtureの共有状態・file出力を先に点検する。
- [ ] offlineのみ環境変数でworkers1/2を切替可能にする。初期値を2へ変える判断は、同じcommit・同じproject/spec集合で比較してから行う。file内の既存テスト順序を維持する。
- [ ] Visual jobの所有specを全Chromium jobから除外する。両jobの和集合が変更前のtest ID集合と同じで、重複だけが消えたことをreportで確認する。WebKit側の当該specは維持する。
- [ ] legacy各jobのhead reportがcleanならbase checkout/install/testを省く。headに失敗がある場合のみ既存compare経路へ進む。失敗を `continue-on-error` だけで成功化しない。
- [ ] `test-firebase-target` guard、固定preview originの不一致も修正する。`tests/browser/production-smoke.spec.js:56` の4174固定監視は実際の4176のassetエラーを捕捉しないので、baseURL由来で判定する。

**検証・完了条件:**

- 実装時のfocused commandは `node --test apps/react/tests/ci-browser-report.test.mjs`。offline比較は既存CIと同じ `SANPO_TEST_FIREBASE_TARGET=offline` / demo project / loopback URLを設定し、`npm --prefix apps/react run test:browser -- --project chromium-desktop --project chromium-mobile --workers=1` と `--workers=2`、WebKit mobileも同様に比較する。独立実行を同じportへ同時起動しない。
- offlineの全test ID集合・結果（既存WebKit skip1件を含む）を変更前後で比較。並列化後の独立実行3回で新規flaky/失敗0。これは導入時だけの比較で、毎回の3周テストにはしない。
- legacyは「head成功/base未実行」「head新規失敗/base比較」「既知baselineのみ」「shared/source変更のhead失敗」をreport fixtureで確認。後者は必ずブロック。
- 初期目標はfull CI約10分→5〜7分。未達ならjob別に判断し、2 workersでCPU競合が増える場合は該当projectを1へ戻し、2 shard案を比較する。
- rollbackはworkflow/configを前の設定へ戻すだけ。production smokeやRulesは変更しない。

### Task 2: 変更範囲に応じた検証を、既存Readinessへ接続

**変更対象:** `tools/classify-release-changes.mjs`、新規 `tools/verification-scope.json`（path→spec/系列の小さな明示表）、`.github/workflows/quality-guard.yml`、`apps/react/package.json`、新規 `apps/react/tests/ci-change-scope.test.mjs`、既存 `apps/react/tests/react-production-release-contract.test.mjs`。

**インターフェース:** 分類器に純粋関数 `classifyCiChanges(paths)` をexportし、既存出力を保持しつつ `profile`、`browserSpecs`、`needsFirebase`、`needsLegacy`、`reasons` を追加。既存のbase/head引数CLIを残す。release側 `classify-production-release.mjs` とは役割が異なるので、CI分類でstandard公開を直接許可しない。

- [ ] docsのみ、allowlist UI、global UI、shared、infrastructure/unknownを分類するfixtureを用意する。削除/renameは旧新pathの両方で判定し、複数変更は検証範囲の和集合にする。diff取得不能は全系列または明示失敗。
- [ ] `production-smoke.spec.js`、企画遷移/空状態などの短い常設journeyと、影響するspecを選ぶ。leafの初期対象は実際のimport関係を読んでから確定し、それ以外は従来のfullを使う。
- [ ] `styles.scss`・共通UI・App構成・組込tgz・依存/設定・shared処理は狭めない。局所変更に見えるserviceのshared除外は別途依存根拠がある場合だけ行う。
- [ ] required check名 `Release / Readiness` を保ち、選択planに従う必要jobがすべて成功したときだけ成功させる。未実行/取消/空reportを成功の代わりにしない。docs-onlyは明示的な無テストplanとして記録する。
- [ ] CI job summaryにprofile・比較base/head・選択spec/project・結果件数・full fallback理由を表示する。ローカル開発でも同じ分類CLIを読む。常設の新しいテスト管理サービスは作らない。

**検証・完了条件:** `node --test apps/react/tests/ci-change-scope.test.mjs apps/react/tests/react-production-release-contract.test.mjs` を実行。実際の変更path fixtureで選択結果を比較し、fullとselectedの結果を一度照合。main exact SHAのReadinessを維持。局所UI CIの暫定目標2〜4分は未測定値であり、実装後の次の3回の自然な実行で採否を確認する。

### Task 3: P9の汚染と後片付けの再試行を止める

**変更対象:** `apps/react/tests/production/firebase-smoke-room.mjs`、`apps/react/tools/cleanup-production-smoke.mjs`、`apps/react/tests/production/production-smoke.spec.js`、`apps/react/tests/production-smoke-room.test.mjs`、`.github/workflows/react-production-release.yml`。worker側が必要なら別作業先 `worker/events.gs`、`worker/managed-sync.gs`、その既存テスト・運用文書へ限定する。

**既存の分離を維持:** ローカル/PR/mainはofflineまたはEmulator。本番release smokeは現在のP9だけ。フォーム作成・回答送信は通常の全UI修正では行わず、worker・受付・フォーム連携境界を変更したときの追加確認とする。現在のフォーム待ち時間はqueue5分周期、reconciliationは1時間周期であり、UI修正ごとに待つ理由はない。

- [ ] P9開始時のread-only preflightでroom marker、workspace、form link、検証対象job/worker登録の有無を短く分類する。値・secret・回答全文はログへ出さない。通常の企画、owner不明、unknown markerを自動削除しない。
- [ ] release smokeが作るworkspace sidecarを、そのrunが作成したと証明できる場合にcleanup対象へ含める。link/job/Google資産はrelease smokeが作らないので、そのcleanupから無条件に削除しない。
- [ ] フォーム実サービス確認では一時manifestにP9・session marker・uid/jobId・formId/sheetId・submit trigger source ID・作成時刻を記録する。作成依頼は1回だけ。既存jobを追跡し、返答が遅いだけで再送しない。
- [ ] フォーム検証後は、今回formだけの同期登録を停止/解除し、今回submit triggerだけをsource IDで除き、jobが終端でin-flight同期がないことを確認する。その後P9アプリページを企画一覧へ移し、該当link/slot/workspace/roomを所有範囲だけ削除し、Google資産はゴミ箱へ移す。creation journalは監査用に保持する。
- [ ] 管理操作が必要なら、workerの既存metadata lockを使うP9/form ID限定cleanup関数を一度だけ標準化する。guardは専用script ID＋P9＋今回資産の一致。既存のclosed-form trigger cleanupだけではactive登録/indexを除去できないため、それを流用しただけで完了としない。
- [ ] shared queue/定期同期trigger全体を停止・削除しない。`formMakerRecoverUnknownJob_` はqueue停止を要求する既存仕様なので、今回の掃除のために無理に呼ばず、running/unknownならその状態を明示して標準経路で終了を待つ。
- [ ] releaseとworkerのP9実操作は同時に実行しない。既存release concurrencyを利用し、手動worker検証前にはin-progress release/diagnoseなしを確認、作業中はdispatchしない。初期段階で新DB leaseや専用schedulerは追加しない。
- [ ] Emulator/worker mockで「遅い書き込みがcleanupへ追いつく」「既存登録は残る」「今回資産だけ削除」「一部cleanup失敗→同じmanifestで再開」を検証する。終了時nullを確認し、常駐writerがいない根拠も保存する。毎回1時間後まで待つ方式は採らない。

**完了条件:** releaseによるworkspace残りと、worker由来の再生成を混同しない。消せない対象を「cleanup成功」と報告しない。実装時の本番確認はP9の1回の作成・1回答・反映・後片付けで終了し、別の成功済みCIへ戻らない。worker権限や別repo公開が必要な場合は、その範囲を当該変更として扱う。

**focused command:** `node --test apps/react/tests/production-smoke-room.test.mjs apps/react/tests/production-smoke-diagnostics.test.mjs apps/react/tests/react-production-release-contract.test.mjs`。worker側はその作業先の既存runnerで上記cleanup/race caseを実行する。本番smokeをローカルfixtureテストの代わりに反復しない。

### Task 4: Codexの作業手順を固定し、再調査・再公開を抑える

**変更対象:** `AGENTS.md`（短い参照と停止条件）、新規 `docs/development/verification-and-release.md`。既存plan/progressへ重複した運用手順を大量に追記しない。memory変更はこの計画に含めない。

- [ ] 開始時はscope/変更path・現在SHA・成功check/run・公開SHAを一度確認。記録は「工程／SHAまたはworker版／run ID／結果／次の一手」の短い表にする。
- [ ] 開発中は対象テスト。PR/mainはCI plan。成功済み同SHAのcheckは再利用する。新しいcommit・新しい失敗・新たな未確認影響がある場合だけ範囲を拡大する。
- [ ] 公開合格はReadiness→release smoke/cleanup/archiveの結果で判断。フォーム実サービス確認は対象変更の場合だけ追加し、「公開完了、フォーム検証残り」のように完了済み工程を巻き戻さない。
- [ ] ブラウザーはそのセッションの利用可能tool一覧からBrowser/Chrome能力を発見し、既知URL/tabを選んでAX/DOMを1回読む。`cua_repl` がある場合はbrowser APIだけを使い、`getApp`・ネイティブメモ帳・デスクトップ操作を使わない。
- [ ] 新しい接続/runtime初期化時は返されたAPI説明に従う。再起動やstale handleの根拠がある場合だけ再初期化する。「一覧に見えない」という理由で同じ探索を繰り返さない。標準手順→一度の再接続で進まなければ、接続障害を明示し別の独立作業へ進む。
- [ ] 接続確認のためにproduction diagnose・フォーム作成・本番再公開を行わない。WebKit診断は失敗した本番経路を再現する必要がある場合のみ。調査ログは一箇所へ保存し、承認を繰り返し求めない。
- [ ] ローカルpreviewは既存 `build:preview` / `check:preview` と明示originを使用。古いworker/cacheや4174/4176の取り違えを検証対象のバグと呼ばない。
- [ ] plan/progress更新は工程終了時または引き継ぎ時に1回。古い文書を全部読み直すより、最新のrunとsourceを根拠にする。

**完了条件:** 次の通常修正1件で、同SHAの成功CI再実行0、不要なdiagnose0、ブラウザー接続の反復調査0、文書更新は終了時1回。人の待ち時間とCI runner時間を別々に記録する。

### Task 5: 最終的な採否を少ない計測で決める

**変更対象:** 既存workflowのsummaryと上記運用文書。計測専用のdashboard、定期workflow、外部サービスは追加しない。

- [ ] summaryのReadiness durationを「集約checkの時間」と明示し、CI run全体と主要jobの経過時間も既存Actions APIから記録する。
- [ ] Task 1の導入検証後は、次の自然なPR/main/release 3件から測定する。計測だけのために本番releaseを3回作らない。
- [ ] full CI5〜7分、局所UI2〜4分、Readiness後公開3〜5分を暫定目標にする。後者は既にmigration成功4分18秒で範囲内。新しい機構を足すよりその安定運用を優先する。
- [ ] PR＋main＋公開の目安はfull変更13〜19分、局所UI7〜13分。queue待ち・外部フォーム作成待ち・人のmerge待ちは別枠。並列化の短縮率は未実測で保証しない。
- [ ] runner合計時間・flaky・再実行・cleanup失敗が増える案は採用しない。workers2で十分ならshard/cache追加は終了する。

## 5. 実装順序と判断事項

**推奨順:** Task 1（件数を保つ短縮）→Task 2（局所変更の選択）→Task 3（P9の所有範囲とwriter停止）→Task 4（作業手順）→Task 5（自然な実行で評価）。Task 4の「成功工程へ戻らない」「接続確認にreleaseを使わない」はコード変更なしでも次回から採用できる。

Task 1と2を同時に大量変更しない。件数を変えない高速化の結果を基準にしてから選択方式を導入する。各taskは独立したPRにし、実装時は既存AGENTSのCI・公開条件に従う。

初期実装にユーザーの追加決定は不要。2 workersの安定性・leaf allowlistの具体的範囲は実測/依存調査で決める。別Firebase staging/別worker、merge queue、self-hosted runner、ブラウザーcacheは初期対象外。これらが必要になった場合だけ、費用・権限・運用負担を示して別途判断する。

## 6. 証拠・参照先

- CI/main job・step時間とbrowser JSON: https://github.com/mutoshiki/circle-kikaku-tools/actions/runs/41301764724
- CI/PR: https://github.com/mutoshiki/circle-kikaku-tools/actions/runs/41300963284
- 別main CI: https://github.com/mutoshiki/circle-kikaku-tools/actions/runs/41295190058
- 成功release: https://github.com/mutoshiki/circle-kikaku-tools/actions/runs/41303105246
- marker不一致の失敗release: https://github.com/mutoshiki/circle-kikaku-tools/actions/runs/41302547257
- 非deploy診断: https://github.com/mutoshiki/circle-kikaku-tools/actions/runs/41282141038 、https://github.com/mutoshiki/circle-kikaku-tools/actions/runs/41282647632
- required check ruleset: https://github.com/mutoshiki/circle-kikaku-tools/rules/24113226
- Playwright公式CI（worker/キャッシュ）: https://playwright.dev/docs/ci
- Playwright公式並列実行/shard: https://playwright.dev/docs/test-parallel 、https://playwright.dev/docs/test-sharding
- Playwright公式headless shell: https://playwright.dev/docs/browsers
- 調査でダウンロードしたJSONはOS一時フォルダー `C:/Users/toshi/AppData/Local/Temp/circle-ci-audit-20261102/{chromium,webkit}/react-browser.json`。リポジトリへテスト結果全文・token・回答データを追加しない。

## 7. 実装・検証結果

### 実装済み

- **Task 1:** Chromium/WebKit offline suiteを2 workersで実行可能にし、Chromiumからvisual specの重複実行を除外。既存のfull coverageはChromium 262 + Visual 8、WebKit 134 passed + 1既存skipを維持する。browser report validatorで空・不足・欠損・flakyを不合格にし、screenshotをtest固有ディレクトリへ分離。production smokeのasset監視originを固定portからbaseURL由来に変更。
- **Task 2:** docs-only / 承認済みleaf UI / full のfail-closed classifierを導入。未知・shared・広域UI・設定変更はfullに倒し、renameは旧新pathを評価。required check `Release / Readiness` を維持する。
- **Task 4:** `AGENTS.md` と `docs/development/verification-and-release.md` にscope判定、成功済みSHAの再利用、browser接続障害の扱いを簡潔に記録。

### 今回実行した検証

- React unit: **200 passed**。
- scope / browser report / production release contract: **17 passed**。
- static contracts: **36 passed**。
- 並列ブラウザー検証: Chromium **32 passed / 19.2秒**、WebKit **16 passed / 20.3秒**。Chromium/WebKitのUI audit撮影 **2 passed / 23.9秒**、出力先がproject別に分離されたことを確認。
- 変更前の保存済みreportを新validatorへ再評価: Chromium **270 passed**、WebKit **134 passed + 1既存skip**。新しいtest inventoryはChromium 262 + Visual 8で、既存のChromium実行270件から重複8件を除いた。
- workflow YAML parse、`git diff --check` は成功。

### 今回は実施しない項目

- **Task 3:** P9のフォーム作成・回答同期とworker由来データのrace/cleanup改善は、別Apps Script workerと本番Firebase書き込みを変更する。今回のCI短縮の効果に必要ではなく、本番公開・本番書き込み禁止の指示に従って変更しない。release smokeの既存ガードと専用P9制約は維持する。
- 導入時の全suite 3回反復は、ユーザーの「必要な検証だけ」に合わせて実施しない。1回のPR CIと短いChromium/WebKitの並列操作確認で安定性を判断し、以後の自然なCIで傾向を見る。
- **Task 5:** 変更後のCI実測はPRのrequired CI完了後に記録する。main mergeや本番公開は行わないため、merge後Readiness / release時間は今回は比較できない。
