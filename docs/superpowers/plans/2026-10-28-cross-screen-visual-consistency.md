# 参加者・車割・班割・精算の見た目統一 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. この計画は同じセッションで順に実行する。subagentは自動的に起動しない。

**Goal:** 4画面の同じ役割の文字、余白、一覧、補助操作を揃え、画面を切り替えても密度と整列が変わりすぎない状態にする。

**Architecture:** 既存のCarbonコンポーネントと画面構造を使い、アプリ所有のclassNameとSCSSを調整する。共通のTabPanel余白と文字の役割を先に定義し、画面固有の差分をその基準へ寄せる。計算・データ・権限の処理は変更しない。

**Tech Stack:** React 19.2.8 / @carbon/react 1.115.0 / @carbon/icons-react 11.87.0 / Sass / Playwright / Vite。

**Spec:** 本書「採用する共通仕様」と、この会話で提示された3枚のスクリーンショット。既存の `docs/design/react-typography-spacing.md` は本書の決定に合わせて更新する。

## 現在地と作業境界

- 作業先: `C:/Users/toshi/.codex/worktrees/site-copy-improvements/circle-kikaku-tools`。
- 計画作成時HEAD: `428224eba22e1358951c4002028b3fc5952af50e`。
- 実装branch: `codex/cross-screen-visual-consistency`（実装開始時に最新mainと公開manifestのsource SHAが一致することを確認）。
- 未コミットの `Allocation.jsx` / `styles.scss` には直前に依頼された表示変更がある。この計画はその差分を引き継ぐ。
- `apps/react/dist-offline-test/` と `artifacts/` は既存の未追跡作業物。今回のcommitへ一括追加しない。
- 実装preview: `http://127.0.0.1:4285/?room=CONSISTENCY-LOCAL-20261028&view=seisan`。syntheticなsample dataをpreview originのlocalStorageに保存する。既存使用中の4284には触らない。
- 前回の変更は「未割り当てを見る」「空きN人／参加者を追加」、回数の短縮、班見出しの余白、767px以下のtoolbar配置。学年の列揃え・固定状態の視認性は未実装。
- 2026-10-28: ユーザーが本計画の全項目実装を依頼。コード・対象テスト・記録を更新し、リポジトリ標準のreleaseまで実施する。

## Global Constraints

- Firebase / schema / store / sync / persistence / calculation / 参加者確定・権限判定・割り当て処理は変更しない。
- 部費0円の簡略表示、常時表示の費用編集、独立した「内訳を見る／内訳を閉じる」、複数車の同時展開、集金トーストを保持する。
- 車名横の編集と金額下の内訳toggleという現在の操作順を保持する。
- 新規依存、新しいデザインシステム、画面全体の作り直しは追加しない。
- Carbon APIはMCP、型・出力DOM・SCSSの実態はインストール済みパッケージで確認する。内部classへの新規依存を増やさず、公開classNameやアプリ所有classを優先する。
- 長文や大きな金額を文字縮小・切り捨て・固定高で収めない。操作領域とフォーカス表示を保つ。
- 同じ原因で20分以上進捗がない場合は停止し、原因と未完了のTaskを報告する。

## 採用する共通仕様

### 文字

| 役割 | 値・Carbonの参照 | 対象 |
| --- | --- | --- |
| 企画名 | heading-03、20px / 400 / 28px | 画面共通の企画名 |
| 区切りの見出し・班名・車名 | heading-compact-02、16px / 600 / 22px | 参加者確定後、参加者発表、引き継ぎデータ、A車・A班。精算の車名は現在の400を600へ統一 |
| 状態サマリー | body-01、14px / 400 / 20px | 応募者・参加者・未割り当て・人数・台数・班数。単なる件数のstrongは外す |
| 名前・説明文 | body-01、14px / 400 / 20px | 参加者名と説明。参加者一覧の名前だけがstrongにならないよう揃える |
| 補足 | label-01、12px / 400 / 16px、text-secondary | 学年、実行回数、同期状態など。読めるコントラストを保つ |
| 操作ラベル | body-compact-01、14px / 400 / 約18px | 編集・追加・内訳。Carbon Button標準の文字設定を優先 |
| 車への支払額 | heading-03、20px / 400 / 28px | 割勘・部費とも通常の太さ |
| 1人あたりの集金額 | heading-03 + semibold、20px / 600 / 28px | 精算上部の主な金額 |

- 字間は各Carbon type mixinが出す値を使い、画面ごとに独自調整しない。
- h2/h3などの見出し構造は保つ。見た目を揃える目的で見出しをdivへ置換しない。
- 班長・運転手など既存の役割タグは保持する。

### 余白・線・操作

- `.app-tab-panel` を4つのTabPanelへ付与し、共通内側余白を16pxにする。既存Carbonのpaddingとの二重加算を防ぐ。
- サマリーはpanelの基本左端。名前付きの一覧ブロックは共通の内側16px。費用内訳など意味のある子階層はさらに16pxとし、全要素の左端を無理に一致させない。
- 同じ項目のラベルと説明は8px、別の項目は16px、主要なセクション間は24px。
- 通常の参加者行は最低48px。複数行になったときは内容に応じて伸びる。
- 班・車見出しは最低48px、通常は48〜56pxを目安とする。メニューの操作領域を縮めない。
- 補助操作はCarbonの40pxサイズを基本にし、一覧のicon操作は既存の48px領域を保持する。「集金を記録」は48pxの主ボタン。
- 同じ一覧内の線の左右端を揃える。セクション境界は薄い1px線を1本とし、同じ境界に親と子の二重線を置かない。
- 767px以下の割り当てtoolbarは状態→操作の2段。操作が収まらない幅ではまとまり単位で折り返す。横スクロールは禁止。
- 参加者の後続タスクは同じ面に見出し・説明・補助操作を縦に並べる。独立したカード枠や入れ子の背景による強調を減らす。
- 精算は3行構造を保ち、車名→金額→内訳操作のgapを8pxへ揃える。金額ラベルと値は4px、次の車までは線と16pxの間隔。固定高は付けない。

## Review Focus

1. 長い名前・班名・レンタカー表記・権限の説明が折り返しても操作と重ならない（Task 2〜4）。
2. 320/393/676pxで空き枠・toolbar・2区分の金額が横にはみ出さない（Task 3〜4）。
3. 未選択・確定済み・権限なしで説明とdisabled状態が欠落しない（Task 2）。
4. 内訳開閉と費用編集が別操作で、キーボード操作後のフォーカスが戻る（Task 4）。
5. ライト／ダークで小さな補足・区切り線・固定状態が読め、空データの導線も使える（Task 1〜5）。

## ファイル構成

| ファイル | 責務 |
| --- | --- |
| `apps/react/src/App.jsx` | 共通TabPanelへのアプリclassName追加 |
| `apps/react/src/styles.scss` | 共通文字の役割と余白、各画面の差分調整 |
| `apps/react/src/components/Participants.jsx` | 人数・名前の過剰なstrong、後続タスクの意味構造 |
| `apps/react/src/components/Allocation.jsx` | 現在の差分を維持し、学年・固定状態の表示を整える |
| `apps/react/src/components/settlement/SettlementPaymentRow.jsx` | 必要なclassNameのみ。計算や表示条件は維持 |
| `apps/react/tests/browser/visual-consistency.spec.js` | 画面間の整列・密度・overflowの既存確認を拡張 |
| `apps/react/tests/browser/{allocation,randomization-count,participants,settlement}.spec.js` | 既存動作の確認と変更した文言参照の追随 |
| `docs/design/react-typography-spacing.md` | 矛盾を除いた共通仕様と実測QA記録 |
| `docs/development/current-workspace.md` | 実装時点の公開baselineとpreview対応記録 |

### Task 1: 共通余白と文字ルールを一本化

**Interfaces:** 4つのTabPanelは `.app-tab-panel` を公開する。既存の画面コンポーネントのpropsは変更しない。

- [x] `App.jsx`の4つのTabPanelに `.app-tab-panel` を付け、SCSSで共通16px paddingを一度だけ適用する。
- [x] 上表の役割ごとに既存selectorへCarbon mixinを適用する。グローバルh2/strong/buttonの一括上書きは避ける。
- [x] 指針内の「全金額600」「部費0円でも両方表示」など、後続仕様と矛盾したチェック項目を修正する。本文・表・チェックリストを同一仕様へ合わせる。
- [x] 既存の `.settlement-collection-summary__amount` 重複定義と767px/672pxのtoolbar重複を今回の所有範囲で整理する。
- [x] `visual-consistency.spec.js`で、各画面のサマリーが同じpanel insetを持ち、非表示panelを測定しないことを確認する。比較許容差は2 CSS px。

### Task 2: 参加者画面の太字・入れ子・余白を整理

**Interfaces:** 人数、確定状態、発表・引き継ぎ操作のhandlerと権限条件を保持する。

- [x] `.participants-page > .section-heading` の件数表示と `.participant-row-title` の名前を通常の太さにする。装飾のためだけのstrongをspanへ置き換える。
- [x] `.participants-post-confirm` を主要間隔24pxとし、h2/h3は16px/600へ統一する。異なる見出しレベルは保持する。
- [x] `.participants-post-confirm__actions` / `__item` はカードの重ね掛けを解消し、説明と操作の間を16px以内の通常gapへ揃える。各タスクの間は1本の線と16px。
- [x] モバイルのghost buttonを全幅にする既存ルールを外し、説明文の左端とボタン文字の左端を揃える。ボタンのfocus/hover領域は保持する。
- [x] 通常参加者、フォーム応募者の選択前・確定後、引き継ぎ権限なし、長い説明の状態を既存サンプルで確認する。disabled理由の本文を削らない。
- [x] `participants.spec.js`の選択・確定・再編集・操作権限の既存assertionを保持し、表示変更に必要なlocatorだけ更新する。

### Task 3: 車割・班割の一覧を共通仕様へ揃える

**Interfaces:** `.allocation-page` のcar/team分岐と同じ `Allocation` componentを使う。固定・移動・追加・ランダム実行のcommandを変更しない。

- [x] 未コミットの短縮文言・toolbar・空き枠差分を保持し、320/393/676pxでもまとまりを保つ。nowrapでoverflowを生む場合は適切に折り返す。
- [x] `0回`だけでは意味が曖昧なため回数は `実行 N回`へ戻す。詳細説明は既存aria-describedbyを保持する。
- [x] 人名・役割・学年の表示を分離し、通常名では学年を同じ列へ揃える。長い名前は折り返し、操作列を押し出さない。人物表示とaction列の役割を既存DOMで確認してから最小変更する。
- [x] 固定ピンの既存checked状態と表示を確認する。選択時は塗り・背景など既存Carbonの状態表現で区別し、Tab/Spaceで選択できること、名前付き説明が残ることを確認する。新しいアイコンを使う場合はMCPでexportを確認する。
- [x] 車・班の見出し／人数／メニュー位置と線の端を揃える。名前行は最低48pxを維持する。
- [x] `allocation.spec.js` / `randomization-count.spec.js` の旧文言参照（`未割り当て N人を確認`、`あとN人追加できます`など）を全件検索し、新しい操作名へ合わせる。件数・配置・保存の検証を削除しない。
- [x] 空き枠を開く→候補表示→閉じる、固定→解除、移動のcancel、ランダム確認のcancelをlocalサンプルで操作する。

### Task 4: 精算の密度と見出しを共通仕様へ寄せる

**Interfaces:** `SettlementPaymentRow` のprops、独立したexpense action / disclosureとaria-controls・expanded・describedbyを保持する。

- [x] `.settlement-car-heading` を16px/600/22pxへ揃え、レンタカー補足は12px/400にする。入る幅では横、足りなければ折り返す。
- [x] `.settlement-car-header` / amounts / toggleの間隔を本書の8px/4px/16pxへ揃える。ボタンの内側余白と外側gapの二重加算を実測する。
- [x] 金額は20px/400、集金額だけ20px/600とし、ラベルと値を近づける。部費0円・2区分・長い金額で既存の折り返しを保持する。
- [x] vehicle dividerをAccordionだけに持たせ、編集と内訳の右端を共通の内側基準へ合わせる。toggle内のlabel/arrowを離さない。
- [x] 内訳を閉じたまま費用編集→Escape→focus復帰、内訳をSpaceで開閉、複数車同時展開、集金modalのcancel・focus復帰を確認する。
- [x] `settlement.spec.js` の既存geometry・negative/zero・単一区分・2区分の検証を維持し、今回変える密度の期待値だけ合理的な範囲に更新する。

### Task 5: 必要な回帰確認とサイドブラウザQA

- [x] 対象テストは `visual-consistency.spec.js`、`participants.spec.js`、`allocation.spec.js`、`randomization-count.spec.js`、`settlement.spec.js` の変更影響に絞る。まずchromium-mobileで失敗を解決し、最終候補を4既存projectで確認する。UIの値をそのまま写すだけの新規テストを増やさない。
- [x] PowerShellでoffline targetを指定して実行する（cwdは `apps/react`）。

```powershell
$env:SANPO_TEST_FIREBASE_TARGET='offline'
$env:SANPO_TEST_FIREBASE_PROJECT_ID='demo-circle-kikaku'
$env:SANPO_TEST_FIREBASE_DATABASE_URL='http://127.0.0.1:9000'
npm.cmd run test:browser -- tests/browser/visual-consistency.spec.js tests/browser/participants.spec.js tests/browser/allocation.spec.js tests/browser/randomization-count.spec.js tests/browser/settlement.spec.js --project=chromium-mobile
```

- [x] 残り3projectは同じ対象を指定して実行する。成功済みの同じsourceで同じ検証を繰り返さない。
- [x] 公開manifestを再取得し、`sourceSha`を使って `npm.cmd run build:preview -- --baseline-source-sha <SHA>` → `npm.cmd run check:preview -- --url http://127.0.0.1:4285/ --expected-source-sha <SHA>` を実行する。照合失敗時はブラウザの見た目で判断せず解決する。
- [x] CUAサイドブラウザで利用可能な実viewport（約420×594）で4画面をライト／ダーク確認し、Playwrightで393×852・1280×900の対象幅と320px・676pxのoverflow境界を検証する。CUAにviewport resize APIがないため実画面を指定寸法へ固定する確認は未実施。themeと表示画面を復帰する。
- [x] 各状態でvisible panelのみからfont-size/weight/line-height/letter-spacing、padding、bounding box、scrollWidthを取得する。hidden panelの0px値を証拠にしない。
- [x] 操作確認はTask 2〜4のpathを実際に行い、DOMの状態変化とfocus復帰を記録する。build成功やスクショだけで操作成功としない。
- [x] 各theme・4画面の実ブラウザ表示をスクリーンショットで照合し、Playwright geometry/overflow assertionsも確認する。CUAのviewport制約により厳密な同寸スクリーンショット比較は未実施とし、未追跡artifactsには混ぜない。
- [x] `docs/design/react-typography-spacing.md` に幅・theme・操作・実測値・証拠のQA表を追加する。zoom/実機/読み上げは実施しない限り未検証と明記する。
- [x] `git diff --check` と最終差分確認を行い、計画の全要件がTaskに対応していることを確認する。

### Task 6: 実装完了後の統合・公開

- [ ] 実行時のユーザー指定を確認する。ローカル限定や公開しない指定がある場合はその範囲で終了する。指定がない通常実装はrootのAGENTS.mdどおり本番smokeまで進める。
- [ ] 今回のsource・対象test・指針・計画進捗のみcommit/pushし、PRを作成してタスクへattachする。既存の未追跡作業物を含めない。
- [ ] PR CIを確認し、失敗は今回の回帰とbaselineを区別して修正する。成功後mergeし、merge後mainの対象SHAで `Release / Readiness` を確認する。
- [ ] 既存 `React Production Release` だけをdispatchし、workflowの分類・compatibility・root smoke・cleanup・rollback経路を使う。
- [ ] 公開manifestのSHA一致と専用room `P9A93LMQ` のproduction smoke・cleanup成功を確認して完了する。通常企画には書き込まない。
- [ ] 最終報告に変更概要、確認した画面/状態、未検証、preview URL、公開した場合のSHAとrelease結果を記す。

## 完了判定

全Taskの該当checkboxが実証付きで完了していること。表示調整は4画面で同じ役割が同じ値になり、権限やデータ条件による操作差が保持されていること。サイドブラウザを実際に操作しておらず、buildだけ成功した状態は完了としない。
