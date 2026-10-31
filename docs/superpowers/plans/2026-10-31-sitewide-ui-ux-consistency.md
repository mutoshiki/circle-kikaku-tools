# サイト全体のUI・UX統一 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. この計画の作成は実装・公開の許可ではない。実装を依頼された後に着手する。

**Goal:** 企画一覧から各ツールとモーダルまで、情報の役割・操作・文言・表示密度を揃え、同じ企画サイトとして迷わず使える状態にする。

**Architecture:** 現行のCarbon UIを基準として、既存の規約と画面一覧を更新する。共通サイトには小さな共通UIと余白の共通定義を設け、別パッケージのメーカーは自身のソースで同じ表示契約に合わせる。状態管理、認証、同期、計算、保存方式、PDF生成は既存処理を利用する。

**Tech Stack:** Circle: React 19.2.8、Carbon React 1.115.0、Sass、Vite 8.2.2、Playwright 1.61.0。組込パッケージ: form-maker-workspace 1.0.5、mountain-plan-workspace 1.0.8（Task 0実装時点）。

**Spec:** この計画の「統一する仕様」、`docs/design/react-typography-spacing.md`、`docs/design/ui-consistency.md`。ユーザーの直前の依頼は、前回答で提案した全画面調査→共通ルール→代表画面→全体適用→再発防止の具体化。

## Global Constraints

- 今回は計画書の作成のみ。コード変更、テスト実行、DB変更、commit、push、本番公開はしない。
- 実装時は現在の公開manifestとorigin/mainを再確認する。調査時の公開SHAは `1936ea8dc7ff260e348946c25f295d8ce6563577`。古いportや文書の公開状態を現行版とみなさない。
- 現行UIを活かす。過去に中止したcarbon-redesignや構造簡略化の計画は再開しない。
- 企画一覧からの別タブ表示、ヘッダーの企画名・名称変更、横スクロールタブ、ツールの利用と固定の区別を維持する。
- 手動保存を自動保存に変える、確認操作を増やす、機能や説明を追加することを統一作業の目的にしない。
- フォーム作成は明示的な実行、登山計画書は現在の自動保存を維持。既存の集金・費用編集・ツール設定の確定タイミングも維持する。
- 割勘と部費の意味、0円時の表示仕様、人数だけの精算、定員、固定、ランダム回数、応募者と確定参加者の扱いを維持する。
- 企画データ、Firebase Rules、schema、worker、計算処理は対象外。UIを直すためにそれらの不具合が見つかった場合は別件として記録し、無断で範囲を広げない。
- 本番の通常企画を検証用に編集しない。入力確認はlocal previewと架空データで行い、公開時のproduction smokeはP9A93LMQだけを使用する。
- 未コミット・未追跡ファイル、既存worktree、参照タブを保持する。既存メーカーtgzやnode_modulesを直接編集しない。メーカーのソース修正が必要な場合はpackage versionを上げ、新しいtgzを作成して参照を更新する。
- Carbon API・型・トークンはMCPとインストール済みパッケージで確認する。公式指針とサイト固有の採用判断を区別する。
- 同じ問題で20分以上進捗がない場合は停止し、原因・実施済みの切り分け・未完了項目を報告する。

## 調査で確認した実装と変更対象

| 所有箇所 | 現状・実装時の対象 |
|---|---|
| `apps/react/src/App.jsx`、`components/AppHeader.jsx`、`components/ProjectEntry.jsx` | 共通シェル、企画一覧・作成、企画名、タブ、通知。直近のヘッダー変更を基準にする |
| `apps/react/src/styles.scss` | Carbon読込、共通クラス、各画面の文字・余白・モーダルスタイルが同居。全量分割は行わず共通基礎だけ切り出す |
| `components/Participants.jsx`、`ParticipantEditor.jsx`、`RegistrationModal.jsx` | 一覧、選択、検索、登録・編集・確認。共通化対象は見出し・操作列・入力グループ |
| `components/Allocation.jsx` | 車割と班割の共通owner。氏名・役割・学年・操作列、定員、固定表示を両タブで揃える |
| `components/Settlement.jsx`、`settlement/SettlementPaymentRow.jsx` | 金額と内訳の固有パターン。金額を一般本文と同じにしない |
| `SettlementSettingsModal.jsx`、`StandaloneDriverNameModal.jsx`、`RoutePlanner.jsx`、`ProjectTools.jsx` | 設定、集金、費用、ルート、各補助画面。状態ごとの確認が必要 |
| `components/ProjectToolsWorkspace.jsx` | ツール管理とメーカー組込。両メーカーのCSSを別々にimportしている |
| `src/services/form-maker-workspace.js`、`mountain-plan-workspace.js` | 既存props・lazy load・onNoticeの接続。原則変更せず、外観変更が契約に影響しないことを確認 |
| `docs/design/ui-consistency.md`、`ui-screen-matrix.md`、`react-typography-spacing.md` | 既存規約・一覧・検証記録。旧ProjectIdentityを前提にした記述や過去の「未公開」記録は、履歴と現行仕様を区別して更新する |

メーカーの調査先（実装開始時に各repoのAGENTS、差分、公開ソースとの対応を再確認）：

- Form Maker: `C:/Users/toshi/.codex/worktrees/inline-form-maker-workspace`。`packages/form-maker/src/FormMakerWorkspace.jsx`、`form-maker.scss`、`packages/form-maker/package.json`。既存exportは `FormMakerWorkspace({ project, session, createProjectLink, linkedForm, active, onNotice, onHandoffReady })`。
- Mountain Plan: `C:/Users/toshi/.codex/worktrees/mountain-draft-recovery`。`src/App.jsx`、`src/styles.scss`、`packages/mountain-plan/src/MountainPlanWorkspace.jsx`、`style.scss`。既存exportは `MountainPlanWorkspace({ project, active, onNotice })`。
- Circleは `apps/react/vendor/` のtgzとpackage-lockで固定している。ソースの既存変更を丸ごと再packせず、現在の組込版に対応するソースから今回の変更だけを追加する。

## 統一する仕様

### 見た目

| 役割 | 採用仕様 |
|---|---|
| 企画ヘッダー | 現行Carbon Header、企画名とグローバル操作。ツール側でサイトヘッダーを重ねない |
| 通常の画面見出し | Carbon `heading-02`。企画一覧のトップ見出しは既存の`heading-04`を維持し、入口として区別 |
| 車・班の見出し | `heading-compact-02`。氏名等の本文は`body-compact-01` |
| 小見出し | `heading-compact-01`。補足・状態・学年・日時は`label-01`とsecondary色 |
| 精算金額 | 車への金額は`heading-03`/通常ウェイト、1人あたりの集金額は既存semibold。値の右揃えと区分の意味を維持 |
| 入力値 | 狭幅の編集可能な値は`body-02`。ラベル・補足は独自の役割を保持 |
| 余白 | 画面内側16px、項目間16px、グループ間24px、大区分間32px、密接な情報8px、細かな補足4pxを基準とする。既存の入れ子・フォームの幅・データ行の密度は用途ごとに保持 |
| ボタン | フォーム作成・集金記録等の主操作をprimary、編集・再読込等の補助操作をghost等の既存Carbonパターンで統一。同じ操作文脈のサイズを揃え、文字だけ縮小して収めない |
| 区切り・背景 | セクションの意味が分かる最少の線とlayer。Accordionの線に外枠を重ねない。ライト／ダークはCarbon semantic tokenを使用 |

上記の役割と余白の割当てはこのサイトへの判断。Carbon公式の根拠は [Typography](https://carbondesignsystem.com/building-blocks/foundations/typography/code/#type-scale)、[Spacing](https://carbondesignsystem.com/building-blocks/foundations/spacing/overview/#spacing-scale)。役割ごとのtype styleとspacing scaleを利用し、すべてを同じサイズ・高さにしない。

### 操作・文言

- 同じ操作は「追加」「編集」「保存」「キャンセル」「削除」を基本に、対象が分からないときだけ対象名を加える。既存の意味を変える一括文字置換はしない。
- モーダルは見出し→入力→操作、本文のみスクロール。キャンセルと主操作の順序はCarbon Modalに合わせる。Escapeとフォーカス復帰、IME確定中のEnterを確認する。
- 成功の短い通知は既存onNotice経由のトースト。修正が必要な入力エラーは該当欄、解消が必要な通信失敗は関連箇所に残す。自動保存のたびにトーストを連発しない。
- ボタンで十分分かる説明、内部のpackage・worker・保存先の説明、手動同期を促す文言は増やさない。入力判断に必要な単位・条件・エラーからの復帰案内は残す。
- 不要な重複見出しを除く場合も、領域のaccessible nameを残す。ツール固有の入力手順、PDF表示、権限による操作制限は保つ。

## Review Focus

1. 長い企画名・氏名・金額・日本語エラーでも、狭幅で操作を押し出さず内容と操作の対応が分かる（Task 2/3/6）。
2. タブ移動、固定解除、モーダルのキャンセル後も入力や下書きが残り、重複作成しない（Task 4/5/6）。
3. 狭幅の折返しとPCの列配置を両立し、学年と固定・メニューが重ならない（Task 3/6）。
4. メーカーのCSSが共通ヘッダー・他ツール・印刷帳票へ漏れない（Task 4/5/6）。
5. 初期・作成中・成功・失敗・権限不足が見分けられ、必要な復帰操作を消さない（Task 1/3/4/5）。

## Task 0: 全ツールで使える架空サンプルデータを準備

**Files:** Circle: `apps/react/src/services/form-maker-workspace.js`、`src/runtime.js`、`components/ProjectToolsWorkspace.jsx`、関連unit/browser tests、`apps/react/vendor/` と依存manifest/lockfile。Form Maker source: `packages/form-maker/src/FormMakerWorkspace.jsx`、`src/index.d.ts`、package manifest/new tarball。

- [x] 既存all-toolsサンプルが参加者・応募者・車割・班割・精算・CSV・登山計画書に表示されることを確認し、不足する画面データだけ補う。
- [x] 応募フォームタブの案内だけの分岐をなくし、実際のFormMakerWorkspaceに企画名・編集者メール例・日付・締切・説明の入力例を渡す。
- [x] フォームメーカーの入力例は編集・入力検証・サンプル保存まで試せるようにする。サンプル保存では画面内の入力値だけをdebug専用領域へ保存し、Firebase・専用worker・Google Formsへの接続やフォーム作成は行わない。ボタンも「入力内容を保存」とし、実際の作成と誤認させない。
- [x] サンプルを開いて各ツールが入力済みであること、メーカーの実画面がmountすること、編集・保存・タブ移動後の復元ができること、外部通信・作成要求が0件であること、通常の企画データへ書かないことを確認する。
- [x] 対象unit・browser testを追加し、テストを先に失敗させてから実装する。

**完了条件:** `debugSample=all-tools`で全ツールの実画面に編集可能な架空データが入り、UIの主要操作を調査できる。外部フォームを作らず、実企画・Firebaseデータに触れない。

## Task 1: 現行表示の全体調査と差分一覧

**Files:** 更新 `docs/design/ui-screen-matrix.md`、`ui-consistency.md`、`react-typography-spacing.md`。

**成果物:** 各ルート・状態について、現行表示、採用ルールとの差、優先度、変更owner、採用／現状維持理由、検証状況を記録した一覧。以後のTaskはこの一覧の対象を消化する。

- [x] 公開manifest・HEAD・各メーカー組込版を確認し、現行規約と過去の検証履歴を区別する。
- [x] 企画一覧、新規作成、参加者、車割、班割、精算、ツール、応募フォーム、学務書類CSV、登山計画書を既存のscreen specs・Task 0 fixture・今回の到達可能な状態フローで照合し、未確認を明記する。
- [x] modal inventoryを実装ownerと既存specに照合。今回の到達可能なダイアログを記録し、メーカーの全成功・失敗状態など開かなかったものは未確認として残す。
- [x] 390×844と1440×1000で画面状態を採取。1280px・両テーマ・320px・200%は既存specの範囲を照合し、手動確認と自動確認を区別した。今回の手動computed-style全組合せは未実施として残す。
- [x] Task 0架空データの実画面を確認。フォームのローカル編集・保存・復元を既存ブラウザーテストで確認し、メーカーの外部API/本番受付・出力は対象外と記録する。
- [x] Carbon MCPの公式指針・現行パッケージ・コード監査を照合。120件の機械指摘は候補として扱い、実DOMとソースに根拠がない一括修正はしない。
- [x] `ui-screen-matrix.md`、`ui-consistency.md`、`react-typography-spacing.md`に所有者・採否・証拠・未確認範囲を記録。

**完了条件:** 全画面の調査範囲が明記され、未確認が「合格」に混ざらない。変更候補をTask 2〜5のownerへ割り当て済み。

## Task 2: 共通基礎と代表画面

**Files:** 新規 `apps/react/src/styles/_ui-foundations.scss`、`src/components/ui/SectionHeading.jsx`。更新 `src/styles.scss`、`components/ProjectToolsWorkspace.jsx`、`Participants.jsx`、`Allocation.jsx`、`settlement/SettlementPaymentRow.jsx`。検証は既存 `tests/browser/visual-consistency.spec.js` と各画面specを使用。

**Interfaces:** `SectionHeading({ as = 'h2', id, title, description, actions })` は見出し・任意の補足・任意の操作列だけを描画する。フォーム状態・保存・ルーティングを持たない。グループ名、タブが見出しを兼ねる箇所、金額のヘッダーには機械的に追加しない。

- [x] 共通見出し・余白・補助操作列のスタイルを基礎SCSSへ切り出し、現行の画面固有ルールはそのまま参照できるようにする。Carbon全体のCSSは重複生成しない。
- [x] 余白用の独自CSS変数を `.application` に定義する：`--sanpo-ui-page-inset: 1rem`、`--sanpo-ui-field-gap: 1rem`、`--sanpo-ui-group-gap: 1.5rem`、`--sanpo-ui-section-gap: 2rem`。Carbon Sass spacingから生成する。文字はCarbon type mixinを使用し、架空のcds変数を作らない。
- [x] SectionHeadingをツール管理と参加者の同じ役割の小見出しに適用する。既存のsemantic heading階層とIDを保持する。
- [x] 車割／班割を一覧型、ツール管理を入力・操作型、精算を金額型の代表にして整える。金額、氏名、役割、学年、固定、メニューの意味と操作は保持する。
- [x] 代表画面をサイドブラウザで実操作し、車割・ツール管理・精算を架空データで確認。表示幅521px・ダークテーマでの目視のみ。長い名称・大きい金額・区分0円・390/1280px・両テーマの検証は既存specの実行結果を確認し、手動確認はTask 6へ残す。
- [x] `allocation.spec.js`、`settlement.spec.js`、`visual-consistency.spec.js`、`project-workspace.spec.js`の変更に関係するケースを実行。固定pxを列挙するだけのテストは増やさない。まとまった変更はTask 7で一括commitする。

**完了条件:** 代表画面が同じ基準で整い、他画面に展開できる。共通化による機能変更・横溢れがない。

## Task 3: Circle全画面・モーダルへ適用

**Files:** Task 2の基礎と`src/styles.scss`、`ProjectEntry.jsx`、`AppHeader.jsx`、`Participants.jsx`、`ParticipantEditor.jsx`、`RegistrationModal.jsx`、`RegistrationPeoplePreview.jsx`、`Allocation.jsx`、`Settlement.jsx`、`SettlementSettingsModal.jsx`、`StandaloneDriverNameModal.jsx`、`RoutePlanner.jsx`、`ProjectTools.jsx`、`InitialEmptyState.jsx`、`ProjectToolsWorkspace.jsx`。Task 1で差がないファイルは編集しない。

- [x] 一覧・作成・ツール管理を共通見出し・操作配置へ合わせる。SectionHeadingは既存の見出し階層を保ち、共有していない履歴・権限仕様に説明を追加しない。
- [x] 参加者・車割・班割・精算へ共通の余白基礎を適用し、車/班行の密度と決済額の階層を維持する。不要な太字・二重余白・線は実画面またはDOMで確認できた範囲だけ直す。
- [x] 既存のCarbon modal順序・スクロール・フォーカス契約を全画面specで再確認。変更なしで要件を満たすdialogは現状維持とし、今回modal markup/操作は改変しない。
- [x] 文言は表示実態と操作に沿う範囲で点検し、不要だったdebugサンプルの初期化操作だけを削除。説明文の一括置換や内部実装説明の追加はしない。
- [x] 関係するregistration、participants、allocation、settlement、project-navigation、initial-empty-state、modal-layout、modal-accessibility specを含む最終browser matrixを実行。最終Circle matrixは524件（521 pass、2既存skip、allocationの単発失敗1件は単独再実行pass）。
- [x] モーダル結果は画面一覧の実際のviewport/theme/操作とspec evidenceに記録。2件のWebKit geometry testは既知のviewport resize制限でskipしChromiumで実行。画面リーダー、物理端末、全モーダルの手動操作は未実施と明記。

**完了条件:** Task 1のCircle側差分が採用／現状維持理由付きで消化され、既存操作と表示仕様が維持される。

## Task 4: フォームメーカーへ適用しパッケージを更新

**Files:** Form Maker repoの `packages/form-maker/src/FormMakerWorkspace.jsx`、`form-maker.scss`、package manifest。Circleの`apps/react/package.json`、`package-lock.json`、新しいvendor tgz。検証ownerはCircleの`tests/form-maker-workspace.test.mjs`、`tests/browser/project-workspace.spec.js`とForm Maker既存テスト。

- [x] 現行組込tgzとソースSHAを照合し、専用worker、session/job復旧、二重送信防止、handoffの処理を保持する。
- [x] embedded rootだけへmodifierと共通余白を追加。standalone shell、enqueue、worker lifecycleを変更しない。
- [x] Carbon type/spacingを埋込範囲内に適用。入力幅の一括拡大や追加カードは行わない。
- [x] FormMakerWorkspaceの入力例、編集・validation・local-only保存と既存の受付/履歴状態をpackage/browserテストで確認。実フォームの作成・送信は行わない。
- [x] 既存browser/package testで明示作成だけのenqueueとタブ再訪時の重複防止・通知/復旧を確認。
- [x] `npm run test:form-maker-workspace` 10/10・build・packに成功。1.0.7へ更新しCircle lockfile/artifactを一致させた。
- [x] ソースPR #26 merge。build/browser・Pages production smokeが成功。Circle packageはForm Maker 1.0.7。

**完了条件:** 実フォームUIの全状態が確認され、受付・作成・復旧の意味が維持される。CSSがCircleの他画面へ漏れない。

## Task 5: 登山計画書へ適用しパッケージを更新

**Files:** Mountain repoの `src/App.jsx`、`src/styles.scss`、`packages/mountain-plan/src/style.scss`、`MountainPlanWorkspace.jsx`、package manifest。Circleの依存・lockfile・新vendor tgz。検証ownerは `e2e/draft-controls.spec.js`、`carbon-accessibility.spec.js`、`pdf-export.spec.js`、`standalone-runtime-compatibility.spec.js` とCircle `tests/browser/project-workspace.spec.js`。

- [x] 現行組込版のsource/head SHAとembedded・standalone・PDF style境界を照合。
- [x] embedded app styleの余白とtype roleだけ変更。step・入力契約・`.doc-page`・印刷単位とPDFレイアウトは維持。
- [x] `.mountain-plan-inline` root内に限定してCSSを適用。standalone and print CSSは触らない。
- [x] autosave/restore、tab away/return、draft preservation、image/path states、long route are covered by existing package and E2E tests. No manual save/import/delete controls or sync prose added.
- [x] root Mountain tests 21/21, E2E 21/21, embedded package build/pack passed; package bumped to 1.0.9 and Circle dependency updated.
- [x] Source PR #22 merged. Main's validation, Pages deploy, and production smoke passed; PDF composition remains outside this appearance change and real printer output was not tested.

**完了条件:** 同じサイトの入力画面として整い、自動保存・画像・行程・PDF出力と単独利用が維持される。

## Task 6: 全体確認と再発防止

**Files:** 更新 `tests/browser/visual-consistency.spec.js`、`project-workspace.spec.js`、既存modal spec、`docs/design/`の3文書。独立のui-consistency specは追加しない。既存visual-consistency/project-workspace specが同じcontractを確認し、重複を避けるため。必要な運用追記は`apps/react/AGENTS.md`の既存UI確認ルールに統合する。

- [x] Existing “five-screen” contract now covers entry/project workspace, all eight tool tabs and embedded makers through screen specs and matrix; no duplicate audit spec added.
- [x] Computed type role, shared inset, no-overflow, long-content, and primary action checks are in existing visual/screen specs; redundant assertions were not duplicated.
- [x] Reused existing deterministic synthetic fixtures and audit captures. Visual screenshots serve as review aids, not image-only pass/fail snapshots.
- [x] Final Circle Chromium/WebKit desktop/mobile browser matrix ran 524 tests: 521 passed, 2 existing WebKit-only skips, and one Chromium desktop allocation summary case failed once because the forced checkbox click did not update state after native `selectOption`. The exact case passed when rerun alone. The matrix covers themes and desktop/mobile viewports; the earlier 4-project 526/528 result is historical. Manual checks were representative, not every dialog in each pair. Known WebKit viewport-resize geometry limitation remains explicitly documented.
- [x] Fresh local preview passed identity check and was inspected in Side browser. All eight tabs, sample form inputs, project menu, settlement and major settings/expense/collection dialogs were checked; no real create/write occurred.
- [x] `ui-consistency.md`, `ui-screen-matrix.md`, and typography/modal evidence now include current test results and unverified scope. Manual device/screen-reader checks remain unverified.
- [x] Added the new-screen inventory/pattern/boundary check to existing React `AGENTS.md` rather than introducing another workflow file.

**完了条件:** 全対象の差分が解消または理由付きで維持され、再現できる検証がある。全文言や全modalを見たと主張する場合は一覧の全行に結果があること。

## Task 7: 最終検証・公開（実装の依頼後）

- [x] 関係repoの単体・パッケージ検証後、Circleの単体179/179、対象debug sample 4/4、最終候補browser matrix 524件（521 pass、2 skip、1単発失敗；単独再実行pass）、build、`check:preview`、`git diff --cached --check`を実行。単発失敗はテスト名単位で再実行して解消を確認。
- [x] Form Maker source PR #26とMountain Plan source PR #22をmerge済み。各source CI／Pages公開／smoke成功を確認し、CircleのtgzはForm Maker 1.0.7／Mountain Plan 1.0.9。
- [x] Circle PR #125の全required checks成功後merge。Circle merge SHAは`c87d938e7b9a86d16dc1b36720d1650d9061d004`。
- [x] merge後mainの`React and Legacy CI`と同SHAの`Release / Readiness`成功を確認。
- [x] 既存`React Production Release` run `41252865163`でcompatibility artifactとReact rootを同じproduction buildから公開。依存変更を受けて互換経路を使用。
- [x] compatibilityとrootの本番Chromium/WebKit smoke、Firebase/Maps/Places/Routesとlegacy read compatibility、`P9A93LMQ` cleanupを確認。run-scoped build artifactとrollback payloadも保存成功。rollbackは不要。
- [x] production manifestの`sourceSha`が`c87d938e7b9a86d16dc1b36720d1650d9061d004`、digestが`7e62879f2f70bb231237ff19c6b5c56623c44f8dca4d6447b2073aedebe19616`であることを確認。本番サイドブラウザの架空all-toolsサンプルで8タブ・精算画面の描画も確認。通常企画への書き込みはしていない。

## 実装順序と完了判定

`Task 0 全ツールの架空データ → Task 1 全画面・全モーダル調査 → Task 2 代表画面と共通基礎 → Task 3 Circle全画面 → Task 4 フォーム → Task 5 登山計画書 → Task 6 全体確認・再発防止 → Task 7 公開`

Task 0–7 are complete. Full modal pointer walkthrough in every viewport/theme, physical devices, and screen-reader verification remain explicitly unclaimed; existing automated assertions and sampled manual checks are recorded separately.
