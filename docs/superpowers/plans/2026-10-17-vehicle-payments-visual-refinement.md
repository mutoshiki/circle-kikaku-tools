# 各車への支払い：表示整理の実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. この変更は同じCSS領域に集中するため、既存worktreeで順番に実装する。

**Goal:** 割勘・部費を別々に常時表示する構成を保ちながら、二重線、小さすぎる調整金額、余白の偏りを解消する。

**Architecture:** 支払額計算や保存処理には触れず、アプリ所有のSCSSを中心に整理する。Carbon標準Accordionの境界線・開閉・フォーカス表示を使い、アプリが重ねている線と余白を減らす。共通化するのは設計上の役割であり、他画面へ新しいCSSを一括適用しない。

**Tech Stack:** React、インストール済み `@carbon/react` / `@carbon/type` / `@carbon/layout`、SCSS、既存Playwrightテスト。

**Spec:** 本計画の「確定する表示仕様」と、`docs/design/react-typography-spacing.md`。根拠は直前のCarbon MCP監査と、430×932px・ライト表示のDOM/CSS測定。

## Global Constraints

- 作業先：`C:/Users/toshi/.codex/worktrees/site-type-spacing/circle-kikaku-tools`、branch `codex/site-typography-spacing`。一次checkoutから始め直さない。
- 今回は計画書の作成のみ。実装、commit、push、本番公開は本計画の作成作業には含まない。
- 後続の実装でも既存の未コミット変更・未追跡ファイルを保持し、reset / stash / 一括stageをしない。
- 割勘・部費は、0円を含めて別々に常時表示する。合計への統合、区分の非表示、支払い済み機能の追加をしない。
- 計算、符号、端数処理、集金分差し引き、localStorage / Firebase、人数だけの精算、運転手名編集は変更しない。
- 車名16px・600・行高22px、支払額20px・600・行高28px、ラベル14px・400・行高18pxを維持する。
- 車名から内訳本文への16pxの字下げは階層として維持する。文字開始位置を要素枠の座標と混同しない。
- Carbon内部の `.cds--*` セレクタや疑似要素に新しい上書きを追加しない。既存の内部クラス上書きは本変更に必要な範囲で評価し、無関係な除去をしない。
- 新しい依存関係、カード、影、色分け、操作UIを追加しない。
- サンプルはローカルpreviewの合成データだけを使う。本番ルームへ書き込まない。
- 同じ問題で20分以上進捗がない場合は停止し、原因・未完了範囲を報告する。

## 公式根拠とプロジェクト判断

| 根拠 | 公式の指針 | このサイトで採用する判断 |
| --- | --- | --- |
| [Spacing / Creating relationships](https://carbondesignsystem.com/building-blocks/foundations/spacing/overview/#creating-relationships) | 余白が情報同士の関係やまとまりを表す。線以外でも区分できる | 車境界を一本にし、行間4px・区分間16pxとする |
| [Accordion / Flush alignment](https://carbondesignsystem.com/building-blocks/core/components/accordion/guidelines/#flush-alignment) | flush配置は周囲の情報との整列や近接する線の整理に使える | 既存の `align="end" isFlush size="sm"` を維持し、車article側の線を外す |
| [Typography / Productive type](https://carbondesignsystem.com/building-blocks/foundations/typography/overview/#productive-and-expressive-type-sets) | 製品内では作業を支える階層とコンパクトな表現を使う | 支払額20pxの強調を維持し、計算に必要な調整行を本文14pxにする |
| [Typography / Base type sizes](https://carbondesignsystem.com/building-blocks/foundations/typography/type-sets/#base-type-sizes) | productive本文の基準は14px | 全画面一律の最小16pxは導入しない。12pxを一律に不適合とも扱わない |

MCPのコード監査はJSX指摘0件、SCSSは直接指定のウェイト2件、Grid関連3件だった。これは見た目やアクセシビリティ全体の合否ではない。定義リスト内の二列配置をページ用Carbon Gridへ置換する提案は、意味構造と変更範囲に対して利点が小さいため採用しない。

## 確定する表示仕様

| 対象 | 実装仕様 |
| --- | --- |
| 車の区切り | `.settlement-car` の下線を外し、Carbon Accordion標準の線だけを使う。先頭・末尾専用のborder/padding例外は不要になったものだけ除く |
| 車間 | 車articleの上下paddingを0、`.settlement-car-list` のgapを `$spacing-05` = 16pxにする。Accordion標準の本文下余白24pxは残す |
| 車内のまとまり | 車見出し→支払額→Accordionのgapは現在の4pxを維持する |
| 内訳の費用行 | `body-compact-01`、14px・400・行高18px・字間0.16px。行間を `$spacing-02` = 4pxにする |
| 内訳の調整行 | `.settlement-cost-adjustment` と配下の金額を `body-compact-01` に揃える。補助色、符号、桁揃え、金額の折返し禁止は維持する |
| 内訳の区分 | `.settlement-cost-list` のgapを `$spacing-05` = 16px、追加の上marginを0にする。標準Accordionの上余白8pxを使う |
| 区分の見出し→費用 | `.settlement-cost-group` のgapを4px。区分見出しの14px・600は維持する |
| 調整行のまとまり | 調整行同士は4px、調整ブロックの上marginは4px。親gridのgap4pxと合わせ、費用行から計8px離す |
| ラベルと支払額 | `.settlement-car-amounts > div` のcolumn-gapを `$spacing-03` = 8pxにする。二列間16px、baseline整列、折返しを維持する |
| 支払額の太さ | `heading-03` にインストール済み `carbon-type.font-weight('semibold')` を組み合わせる。20px・600・28pxはサイト独自の強調役割と明記する |
| レンタカー注記 | `body-compact-01` に既に400が含まれるため、重複する `font-weight: 400` を除く |

上記の余白値はプロジェクト判断。Carbon標準の必須値として説明しない。長額で折り返しても、文字を縮小せず、二つの区分の表示順とラベルの関連を守る。

## Review Focus

1. 割勘・部費の双方に金額がある場合、0円・負額の場合にも別々の支払先区分が読み取れること。Task 2の既存金額テストとTask 3の目視で確認する。
2. 長い車名・費用名・8桁級の金額と320px幅でも、金額欠落・横はみ出しがないこと。Task 2の既存狭幅テストを使う。
3. Accordion開閉・hover・キーボードfocus時に、標準線やフォーカス輪郭まで消していないこと。Task 2の既存Enter/Space確認とTask 3の目視で確認する。
4. 区分が一つだけ、両方ある、費用なしの場合に余白の空洞や二重線が出ないこと。Task 2の既存内訳テストとTask 3の状態別目視で確認する。
5. テーマ変更・文字拡大で調整金額や補助色が読め、隣接画面やモーダルへCSSが漏れないこと。Task 3で確認し、実施できない条件は未検証と記録する。

## Task 1: 支払い画面の表示と共通契約を更新する

**Files:**
- Modify: `apps/react/src/styles.scss`（settlement-car / amounts / cost関連のアプリ所有セレクタ）
- Modify: `docs/design/react-typography-spacing.md`（支払額と調整金額の役割、余白と区切りのルール）
- Reference only: `apps/react/src/components/Settlement.jsx`（支払いsection、`dl`、Accordion。原則JSX変更なし）

**Interfaces:**
- Consumes: 既存の支払額・内訳DOM、Carbon標準Accordion、インストール済みSCSS API。
- Produces: 「確定する表示仕様」の見た目。データや関数のインターフェースは変更しない。

- [x] 作業開始時にbranch / HEAD / dirty状態を確認し、今回変更する行と既存変更を区別する。
- [x] 既存のCarbon MCP監査結果を読み、編集前に関連Accordion APIとTypography APIを確認する。ウェイト関数はインストール済み `@carbon/type/index.scss` のexportを確認する。
- [x] 上表の値をSCSSへ反映する。article下線のみを除去し、Accordion内部の線を消す上書きは追加しない。
- [x] 設計基準に「支払額20px・600はサイト独自」「調整金額は本文」「車境界は線を重ねない」を追記する。他タブへ表示変更を広げない。
- [x] Carbon MCPで変更したJSX/SCSSの範囲を再監査する。直接ウェイト値の指摘が解消したことを確認し、残るローカルGrid指摘は意味構造に照らして判断する。

## Task 2: 旧仕様のテストを調整し、既存回帰確認を実行する

**Files:**
- Modify: `apps/react/tests/browser/settlement.spec.js`

**Interfaces:**
- Consumes: Task 1の表示仕様と既存の合成データfixture。
- Produces: 旧仕様の外枠線・ラベル最小16px・旧ボタン名に依存しない既存回帰確認。

- [x] `vehicle settlement presents expense and breakdown with an accessible Carbon accordion` のarticle下線期待を「全車でなし」に更新する。標準Accordionの線、Enter/Spaceでの開閉、localStorage不変の確認は残す。
- [x] `payment amounts fit narrow screens in both themes` のラベル最小16pxを14pxへ更新する。既存のコントラスト4.5、長額の収まり、二列幅、横はみ出し確認は維持する。金額の確認とラベルの確認を混同しない。
- [x] このファイルの起動ボタンlocator `getByRole('button', { name: '精算設定を編集' ... })` を現在の `精算設定` に合わせる。dialogの名称 `精算設定を編集` は変更しない。
- [x] CSSの指定値をそのまま写す新規テストは追加しない。境界線・文字サイズの見た目はTask 3で確認する。
- [x] 下記の既存支払いテストをChromium desktop/mobileで先に実行し、通過後に同じ対象をWebKit desktop/mobileで一度実行する。

実行場所：`apps/react`。

```powershell
$env:SANPO_TEST_FIREBASE_TARGET = 'offline'
$env:SANPO_TEST_FIREBASE_PROJECT_ID = 'demo-circle-kikaku-tools'
$env:SANPO_TEST_FIREBASE_DATABASE_URL = 'http://127.0.0.1:9000'
npx.cmd playwright test tests/browser/settlement.spec.js --project=chromium-desktop --project=chromium-mobile --grep 'vehicle settlement presents|settlement rows wrap|payment amounts fit|one payment category|zero net payment'
npx.cmd playwright test tests/browser/settlement.spec.js --project=webkit-desktop --project=webkit-mobile --grep 'vehicle settlement presents|settlement rows wrap|payment amounts fit|one payment category|zero net payment'
```

期待：対象テスト通過、計算結果不変、ブラウザーエラーなし。既存の別問題が出た場合は原因を分け、本タスクの完了を理由に成功扱いしない。4176が使用中なら既存serverを流用せず、専用設定でbaseURLとwebServerを同時に空きportへ変更する。

## Task 3: preview照合とサイドブラウザで最終確認する

**Files:**
- Create: `docs/design/reviews/2026-10-17-vehicle-payments-visual-refinement.md`（実施条件、実測値、スクリーンショット、未検証条件）

**Interfaces:**
- Consumes: Task 1/2の変更と、`docs/development/current-workspace.md` のpreview手順。
- Produces: 現在のworktree由来であると照合したローカルpreviewと、状態別の確認記録。

- [x] 公開manifestを取り直し、基準SHAを確認する。計画作成時の公開SHAは `851cb1a4c90fde012ad84eee47a3403689dac9ef`。異なる場合は無言で基準を差し替えず、作業元との関係を確認する。
- [x] `npm.cmd run build:preview -- --baseline-source-sha <確認した公開SHA>` を実行し、`npm.cmd run check:preview -- --url http://127.0.0.1:4280/ --expected-source-sha <同SHA>` の成功を確認する。
- [x] サイドブラウザで実画面を見る。390〜430pxおよび1280px、ライト／ダーク、内訳の開閉、片方の区分だけ・両方の区分・費用なし・長い名前と金額を確認する。
- [x] 通常状態とhover/focusを分け、車境界が一本であること、車名の文字開始位置と内訳の16pxの差、調整行14px、支払額20px、ラベル間8pxをcomputed styleで確認する。
- [x] 200%表示相当の文字拡大／ズームで欠落・横はみ出しを確認する。実行できない場合は未検証として明記し、通常表示での合格と混同しない。
- [x] 隣接する参加者タブを目視し、見出し・余白に予期しない変化がないことを確認する。費用編集モーダルを開閉し、既存の操作・閉じた後のfocusを確認する。
- [x] 見た目に修正が必要なら今回の表示範囲で修正し、変更に関係する確認だけ再実行する。ソース変更後はpreviewを再build・照合してから最終状態を見る。
- [x] `git diff --check` を確認し、サイドブラウザには精算タブ・一台の内訳を開いた状態を残す。計画の完了欄とレビュー記録へ実際の結果を記入する。

## 完了条件と報告

- [x] 直前の提案5件がTask 1の仕様と対応し、二重線・調整金額・余白・ラベル間隔・ウェイトトークンを反映している。
- [x] 対象の既存テスト、build、preview照合、実表示確認の結果を区別して記録している。
- [x] 物理端末、スクリーンリーダー、未実施のブラウザー／倍率を成功扱いしていない。
- [x] 変更ファイル・見た目・確認範囲・未完了範囲を短く報告している。push／本番公開の有無も明記する。

## 計画の自己確認

- 監査の5案 → Task 1、既存仕様との衝突 → Task 2、実表示の不足 → Task 3で対応する。
- 計算・データ処理を変更するタスクは含まない。
- 未確認のCarbonトークン名や内部クラス上書きを前提にしていない。
- 既存の「外枠線あり」「ラベル最小16px」「旧起動ボタン名」を、そのまま新仕様の合否基準にしない。
