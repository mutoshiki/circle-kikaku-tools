# CSS ownership notes

S2 cleanup / S deep cleanup 以降、CSSは「読み込み順ベースの後付け補正」ではなく、**セレクタの責務ベース**でownerに再配置しました。
旧 `04-theme-mobile-compat.css`、`05-feature-components.css`、`06-structure.css` と、一度目のS2分割で作った細かいCSSは、比較用として `assets/css/_archived_consolidated_before_s2_cleanup/` と `assets/css/_archived_s2_source_order_split/` に退避済みです。S deep cleanup直前のCSSは `assets/css/_archived_before_s1_responsibility_split/` に退避済みです。

新しい修正は、下の担当表に沿って既存ownerへ入れてください。`final-overrides`、`repair`、`compat` のような最後勝ちファイルを新規追加しないでください。

## Current CSS owners

| 順番 | ファイル | 主な担当 |
|---:|---|---|
| 00 | `assets/css/00-base-tokens.css` | CSS変数、reset、共通ボタン、フォーム、汎用ユーティリティ |
| 01 | `assets/css/01-app-shell.css` | アプリ全体、ヘッダー、タブ、企画名、同期バッジ、上部操作 |
| 02 | `assets/css/02-theme-appearance.css` | テーマ変数、テーマ選択、テーマプレビュー、外観設定モーダル |
| 03 | `assets/css/03-guides-modals.css` | 使い方ガイド、Bootstrapモーダル、一括登録、履歴、デバッグ、トースト |
| 04 | `assets/css/04-cars-members-tray.css` | 参加者カード、車カード、座席、待機トレイ、人数バッジ、人物メニュー |
| 05 | `assets/css/05-settlement.css` | 精算画面、集金/部費/渡すカード、運転者入力、距離計算、支払いチェック |
| 06 | `assets/css/06-sheet-view.css` | 発表ビュー、sheet chip、発表用カード、ズームUI |
| 07 | `assets/css/07-drag-interactions.css` | ドラッグ中表示、ドロップ対象、swap/return/drop状態、ドラッグ用トークン |

## Aggregator配下のowner

### `04-cars-members-tray.css`

| ファイル | 主な担当 |
|---|---|
| `assets/css/cars-members-tray/01-shared-card-primitives.css` | 参加者・運転者・座席で共通するカード基礎 |
| `assets/css/cars-members-tray/02-tray-shell.css` | 待機トレイ、トレイヘッダー、待機リスト |
| `assets/css/cars-members-tray/03-person-card.css` | 参加者カード、学年/性別バッジ、人物メニュー |
| `assets/css/cars-members-tray/04-car-card.css` | 車カード、運転者席、座席、人数バッジ |
| `assets/css/cars-members-tray/05-drag-drop.css` | ドロッププレビュー、戻す先、ドラッグ時の見た目 |

### `05-settlement.css`

| ファイル | 主な担当 |
|---|---|
| `assets/css/settlement/01-layout-summary.css` | 精算画面の外枠、カード、サマリー |
| `assets/css/settlement/02-common-controls.css` | 精算ボタン、ラベル、トグルなど共通部品 |
| `assets/css/settlement/03-car-inputs.css` | 車ごとの距離/燃費/燃料代/諸経費入力 |
| `assets/css/settlement/04-route-helper.css` | 距離計算モーダル、経由地入力 |
| `assets/css/settlement/05-checklists-share.css` | 集金/支払いチェック、内訳、コピー操作 |

## 編集ルール

- 新しい `99-*`、`100-*`、`final-overrides`、`repair-safety` 系ファイルを追加しない。
- 旧CSSを `assets/css/` 直下へ戻さない。
- 旧ソース比較用の `assets/css/_source_before_s_cleanup/`、`assets/css/_archived_consolidated_before_s2_cleanup/`、`assets/css/_archived_s2_source_order_split/`、`assets/css/_archived_before_s1_responsibility_split/` は編集対象外。
- 同じセレクタを複数ownerへ再び散らさない。
- `!important` は使わない。
- テーマ色は直接色ではなく、できるだけCSS変数で扱う。
- 見た目が直っても、読み込み順だけに頼る応急処置を増やさない。

## よく触る場所

| 変更内容 | 触るファイル |
|---|---|
| ヘッダー、共有、ロック、タブ | `01-app-shell.css` |
| テーマ変更、テーマカード、ダーク/ライト外観 | `02-theme-appearance.css` |
| 参加者カード、車カード、車出し、待機メンバー | `04-cars-members-tray.css` 配下の担当owner |
| 精算画面、距離計算、精算メモ、集金カード | `05-settlement.css` 配下の担当owner |
| 発表ビュー、ズーム、発表用カード | `06-sheet-view.css` |
| ドラッグ操作、ドロップ見た目 | `07-drag-interactions.css` |
| 使い方ガイド、モーダル、一括登録、履歴 | `03-guides-modals.css` |
| 全体の基礎変数、共通ボタン、フォーム | `00-base-tokens.css` |

## S cleanup の完了条件

- `06-structure.css` を削除し、「何でも入る最終置き場」をなくす。
- `04-theme-mobile-compat.css` を削除し、テーマ・スマホ・ドラッグ・モーダル混在をなくす。
- `05-feature-components.css` も分解し、車割部品だけが肥大化する状態を避ける。
- 同一セレクタが複数CSS ownerに散らばらない状態にする。
- `04-cars-members-tray.css` と `05-settlement.css` は、実体を配下ownerへ置き、aggregatorにはimportだけ置く。
- 既存の静的テストを通す。
