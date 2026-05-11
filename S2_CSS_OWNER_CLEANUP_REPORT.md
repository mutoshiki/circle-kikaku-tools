# S2 CSS owner cleanup report

## 目的

今後UI・動き・機能を変更しやすくするため、S優先度のCSS整理を完了しました。

対象にしたS課題は次の3つです。

1. `06-structure.css` が「何でも入る最終上書き置き場」になっていた問題
2. `04-theme-mobile-compat.css` にテーマ・スマホ・ドラッグ・モーダルが混在していた問題
3. 同じセレクタが複数CSS ownerに散っていて、どこを直すべきか分かりにくい問題

## 実施内容

### 1. 旧巨大CSSを読み込み対象から削除

以下のCSSは `index.html` から外しました。

- `assets/css/04-theme-mobile-compat.css`
- `assets/css/05-feature-components.css`
- `assets/css/06-structure.css`

比較用として、旧状態は次に退避しています。

- `assets/css/_archived_consolidated_before_s2_cleanup/`
- `assets/css/_archived_s2_source_order_split/`

### 2. CSSを8つの責務別ownerへ再配置

現在 `index.html` が読み込むCSSは次の8ファイルです。

| ファイル | 担当 |
|---|---|
| `00-base-tokens.css` | CSS変数、reset、共通ボタン、フォーム、汎用ユーティリティ |
| `01-app-shell.css` | アプリ全体、ヘッダー、タブ、企画名、同期バッジ、上部操作 |
| `02-theme-appearance.css` | テーマ変数、テーマ選択、テーマプレビュー、外観設定モーダル |
| `03-guides-modals.css` | 使い方ガイド、Bootstrapモーダル、一括登録、履歴、デバッグ、トースト |
| `04-cars-members-tray.css` | 参加者カード、車カード、座席、待機トレイ、人数バッジ、人物メニュー |
| `05-settlement.css` | 精算画面、集金/部費/渡すカード、運転者入力、距離計算、支払いチェック |
| `06-sheet-view.css` | 発表ビュー、sheet chip、発表用カード、ズームUI |
| `07-drag-interactions.css` | ドラッグ中表示、ドロップ対象、swap/return/drop状態、ドラッグ用トークン |

### 3. 同一セレクタの複数owner分散を解消

CSSをセレクタ責務ベースで再配置し、同じセレクタが複数CSS ownerに散らばらないようにしました。

自問チェック結果：

- CSS構文エラー: 0
- CSS root直下の `!important`: 0
- CSS owner間の同一セレクタ重複: 0

## 更新したガイド

- `CSS_OWNERSHIP.md`
- `AI_EDITING_GUIDE.md`
- `assets/js/modules/theme-presets.js` のCSS参照コメント

## 検証

実行した検証は次の通りです。

- CSS構文チェック: OK
- CSS owner間の同一セレクタ重複チェック: 0件
- JS構文チェック: OK
- 既存Node静的テスト: OK
- `!important` チェック: OK

`tests/basic-ui.spec.js` のPlaywright画面操作テストだけは、このzip内に `@playwright/test` が入っていないため未実行です。

## 今後の編集ルール

- 新しい `final-overrides` 系CSSを追加しない
- 旧 `04-theme-mobile-compat.css`、`05-feature-components.css`、`06-structure.css` を復活させない
- CSSを触る前に `CSS_OWNERSHIP.md` で担当ownerを確認する
- 同じセレクタを複数CSSファイルへ再び散らさない
