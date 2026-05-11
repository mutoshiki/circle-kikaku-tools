# AI編集ガイド

このリポジトリをAIで編集するときに、コードを再び読みにくくしないためのルールです。
UI・動き・機能を追加するときは、まずこのファイルを読んでから作業してください。

## 目的

このサイトは、車割・発表ビュー・精算を1つの画面で扱うため、HTML・CSS・JSが増えやすい構造です。
今後の編集では、次の状態を守ります。

- 変更箇所がすぐ分かる
- 後付けCSSで無理に上書きしない
- `index.html` を巨大な設定置き場にしない
- `app.js` に新機能を何でも足さない
- スマホ表示、テーマ設定、Firebase同期を壊さない

## 編集前に必ず確認すること

1. どの機能を触るかを決める
   - ヘッダー
   - 車割メーカー
   - 発表ビュー
   - 精算ツール
   - テーマ設定
   - ガイド
   - 履歴
   - デバッグ

2. 既存の責任ファイルを探す
   - CSSは `CSS_OWNERSHIP.md` を確認する
   - JSはまず `assets/js/modules/` を確認する
   - それでも見つからない場合だけ `assets/js/app.js` を触る

3. 既存のID・class名を壊さない
   - JSが `id` で取得している要素が多い
   - HTMLのID変更は、必ず `grep` で参照先を確認してから行う

## CSS編集ルール

### やってよいこと

- 既存コンポーネントの見た目は、必ず `CSS_OWNERSHIP.md` の担当ownerに追記する
- 小さなHTML整理用classは、該当する画面のownerに置く。迷ったら `00-base-tokens.css` に置く
- テーマ色はCSS変数を使う
- 色を直書きする場合は、テーマ定義かテーマプレビューなど理由がある場所だけにする

### やってはいけないこと

- `99-final-overrides.css`、`100` 番台CSS、旧 `04-theme-mobile-compat.css` / `05-feature-components.css` / `06-structure.css` を復活させない
- 新しい `final-overrides` や `patch` 系CSSファイルを追加しない
- 同じセレクタを別ownerに何度も追加しない
- `!important` を安易に追加しない
- `style="..."` をHTMLに増やさない
- ダークモードだけ確認してライトモードを放置しない

### CSS追加先の目安

| 変更内容 | 追加・修正する場所 |
|---|---|
| ヘッダー、共有、ロック、タブ、企画名 | `01-app-shell.css` |
| テーマ設定、テーマカード、外観プレビュー | `02-theme-appearance.css` |
| 参加者カード、車カード、待機トレイ | `04-cars-members-tray.css` |
| 精算画面、距離計算、集金/部費/渡す表示 | `05-settlement.css` |
| 発表ビュー、ズーム、発表用カード | `06-sheet-view.css` |
| ドラッグ中表示、ドロップ対象 | `07-drag-interactions.css` |
| ガイド、一括登録、履歴、デバッグ、一般モーダル | `03-guides-modals.css` / 長い本文は `assets/js/templates/guide-content.js` |
| 共通変数、共通ボタン、フォーム | `00-base-tokens.css` |

## HTML編集ルール

### `index.html` に直接増やしてよいもの

- 主要な画面構造
- IDが必要な最小限の入力欄やボタン
- Bootstrap Modalの外枠

### `index.html` に増やさない方がよいもの

- 大量の選択肢
- テーマカードの一覧
- 長い説明文
- 同じ形のカードを何十個も並べるHTML

テーマカード一覧は、`assets/js/modules/theme-presets.js` で生成します。
テーマを追加・削除するときは、`index.html` ではなくこのJSの `THEME_PRESETS` を更新してください。

## JS編集ルール

### 基本方針

`assets/js/app.js` は起動順だけを持つ薄いブートストラップです。保存・読込・同期・描画更新・精算入力保護は `assets/js/core/` に分離済みです。新機能や保存処理を `app.js` の末尾にそのまま足さないでください。

### 追加先の目安

| 変更内容 | 追加・修正する場所 |
|---|---|
| DOM helper、Firebase初期化、room id、共有状態 | `assets/js/core/runtime.js` |
| escapeHtml、schema migration、localStorage安全処理 | `assets/js/core/storage.js` |
| 入力中の遠隔同期保護 | `assets/js/core/remote-guard.js` |
| 保存・読込・Firebase同期 | `assets/js/core/sync-controller.js` |
| UI再描画、企画名、発表サマリー | `assets/js/core/render-controller.js` |
| 精算入力中のフォーカス保護 | `assets/js/core/settlement-edit-guard.js` |
| 保存ステータス表示 | `assets/js/core/app-status.js` |
| 履歴の定期保存 | `assets/js/core/history-scheduler.js` |
| 保存データの取得・復元、固定/性別切替 | `assets/js/core/data-state.js` |
| テーマ設定、ライト/ダーク、テーマモーダル | `assets/js/features/appearance.js` |
| 精算featureの公開口 | `assets/js/features/settlement.js` |
| 精算状態・DOM同期 | `assets/js/features/settlement/01-state.js` |
| 精算計算・検証 | `assets/js/features/settlement/02-calculator.js` |
| 精算UI描画 | `assets/js/features/settlement/03-render.js` |
| 距離計算補助 | `assets/js/features/settlement/04-route-helper.js` |
| 精算入力アクション | `assets/js/features/settlement/05-input-actions.js` |
| 精算メモコピー | `assets/js/features/settlement/06-share-text.js` |
| 使い方ガイドのページ送り | `assets/js/features/guides.js` |
| 使い方ガイドの長い本文テンプレート | `assets/js/templates/guide-content.js` |
| 車カード・人物カード生成 | `assets/js/features/person-cards.js` |
| 編集画面のドラッグ操作 | `assets/js/features/drag-edit-view.js` |
| 発表ビュー・クイック編集・ズーム | `assets/js/features/sheet-view.js` |
| 待機トレイ | `assets/js/features/waiting-tray.js` |
| 一括登録 | `assets/js/features/batch-import.js` |
| 自動割当・性別推定 | `assets/js/features/auto-assign.js` |
| 人物メニュー・名前/メモ編集 | `assets/js/features/person-menu.js` |
| 共有URLコピー・小さなUI操作 | `assets/js/features/share-actions.js` |
| デバッグサンプル・履歴復元UI | `assets/js/features/debug-history.js` |
| テーマカード一覧 | `assets/js/modules/theme-presets.js` |
| UI補助、確認ダイアログ、トースト | `assets/js/modules/ui.js` |
| 履歴保存 | `assets/js/modules/history.js` |
| ドラッグ補助 | `assets/js/modules/drag-cards.js` |
| 全体起動順 | `assets/js/app.js` |

### `app.js` を触るときの注意

- `DOMContentLoaded` の順番を変えない
- 保存・読込・同期処理は `assets/js/core/sync-controller.js` に置く
- UI更新は `assets/js/core/render-controller.js` に置く
- Firebase同期の保存処理を勝手に増やさない
- 保存データの形を変えるときは、必ずマイグレーションを考える
- `innerHTML` にユーザー入力を入れる場合は、必ず `escapeHtml()` を通す
- モーダルIDやボタンIDを変えたら、イベント登録も確認する

## テーマ追加ルール

テーマを追加するときは、最低限この3か所を確認します。

1. CSS側のテーマ変数
   - `data-app-theme="..."` の定義があるか

2. JS側の許可リスト
   - `assets/js/modules/theme-presets.js` の `SanpoThemeRegistry`

3. テーマカード一覧
   - `assets/js/modules/theme-presets.js` の `THEME_PRESETS`

この3つが揃っていないと、選べるのに表示されない、または保存後に標準へ戻る不具合が起きます。

## モーダル編集ルール

- モーダルの `id` と `aria-labelledby` は必ず1対1にする
- 同じ要素に `id` を2つ書かない
- モーダルの重なり順はCSSだけで無理に直さない
- 表示・非表示をJSで切り替える要素の `style="display:none;"` は、勝手にclass化しない
  - JSが `element.style.display = ''` で戻している場合、classの `display:none` が残って表示されなくなるため

## インラインstyleの扱い

原則として、HTMLに新しい `style="..."` は追加しません。
ただし、次のようなJS制御前提の初期非表示は例外です。

```html
<div id="top-area" style="display: none;">
```

理由は、既存JSが `style.display` を直接切り替えているためです。
このタイプは、JS側の表示制御を整理するまでは無理にclass化しないでください。

## 編集後の確認

最低限、以下を確認します。

```bash
node tests/inline-event-check.js
node tests/appearance-footer-check.js
node tests/guide-theme-preview-check.js
node tests/major-css-cleanup-check.js
```

可能なら次も確認します。

```bash
node tests/css-split-check.js
node tests/theme-preset-renderer-check.js
node tests/s-deep-refactor-check.js
```

ブラウザで確認できる場合は、次を見ます。

- テーマ設定を開ける
- ダークテーマ、ライトテーマを選べる
- 完了ボタンが押せる
- 車割、発表、精算のタブ移動ができる
- 参加者登録モーダルが開ける
- ガイドが開ける
- 精算画面が崩れていない

## AIへの指示テンプレ

AIに編集させるときは、次のように依頼してください。

```text
AI_EDITING_GUIDE.md と CSS_OWNERSHIP.md を先に読んでください。
既存レイアウトと機能は壊さず、担当ファイルにだけ最小限の変更をしてください。
新しい後付けCSSファイルや !important は原則追加しないでください。
index.html に大量のHTMLや inline style を増やさないでください。
編集後に、変更ファイル、理由、確認したテストを報告してください。
```

## S最終整理後の編集ルール

- `data-action` を使うボタンを追加した場合は、`assets/js/features/events.js` の `generatedActionHandlers` または各機能の `SanpoApp.registerActions()` に登録する。
- 新規のHTML文字列を `features/*.js` に直接大量追加しない。画面部品は `assets/js/templates/` に作る。
- 共有・通知・合言葉パネルなど、JSで生成するUIに `style.cssText` を追加しない。必ずCSS classを作る。
- `01-app-shell.css`、`03-guides-modals.css`、`04-cars-members-tray.css`、`05-settlement.css` は import aggregator。実体は配下フォルダの小ファイルに追加する。
- 既存互換のため `window.xxx` は残っているが、新規公開APIは `SanpoApp.exposeCompat()` または `SanpoApp.registerActions()` に寄せる。
- 状態を直接DOMから読む処理を増やしすぎない。保存・復元に関わる変更は `getData()`、`restore()`、`SanpoApp.state.snapshot` の3点を確認する。


## S deep cleanup後の追加ルール

- `04-cars-members-tray.css` は aggregatorです。実体は `assets/css/cars-members-tray/01-shared-card-primitives.css`、`02-tray-shell.css`、`03-person-card.css`、`04-car-card.css`、`05-drag-drop.css` に置きます。
- `05-settlement.css` は aggregatorです。実体は `assets/css/settlement/01-layout-summary.css`、`02-common-controls.css`、`03-car-inputs.css`、`04-route-helper.css`、`05-checklists-share.css` に置きます。
- 同一セレクタを別ownerに再追加しないでください。必要なら既存ownerへ移動してから編集します。
- Playwright実操作テストは `npm run test:ui` で実行します。管理制限でブラウザがブロックされる環境では、静的テスト `npm test` とJS構文チェックを最低限行ってください。
