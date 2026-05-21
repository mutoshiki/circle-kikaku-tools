# CSS整理ルール

このプロジェクトのCSSは、画面ごとの「持ち主」を固定して管理します。過去の修正を最後の上書きファイルに積む方式は禁止です。

## 読み込み順

`index.html` のCSS読み込み順は以下を基本にします。

1. `00-base-tokens.css`  
   色、角丸、余白、影、z-index、リセット、Bootstrap補正などの土台。
2. `01-app-shell.css`  
   ヘッダー、ルーム入力、上部タブ、共通ツールバー。
3. `02-theme-appearance.css`  
   テーマ変数、ライト・ダーク切替、テーマ選択画面。
4. `03-guides-modals.css`  
   使い方ガイド、モーダル、ドロワー、ポップアップの共通外枠。
5. `04-cars-members-tray.css`  
   参加者カード、車カード、班カード、待機トレイ、カード内ドラッグ表示。
6. `05-settlement.css`  
   精算画面、精算カード、入力モーダル、距離補助、集金・支払いチェック。
7. `06-sheet-view.css`  
   発表ビュー、表、未割り当て欄、タイムテーブル表示。
8. `07-drag-interactions.css`  
   画面横断のドラッグ中表示、ドロップ反応、ドラッグ時の操作抑制。
9. `08-utilities.css`  
   複数画面で共有する小さなユーティリティ、コントロール別名、安全補正だけ。

`08-control-consistency.css` は旧ファイルです。現在は読み込まず、中身も持たせません。

## 役割別の編集先

| 直したい場所 | 編集先 |
| --- | --- |
| ヘッダー、共有ボタン、その他メニュー、車割・班割タブ | `assets/css/app-shell/01-app-shell-owner.css` |
| テーマ選択、ライト・ダーク、色変数 | `assets/css/02-theme-appearance.css` |
| ガイド、確認ダイアログ、汎用モーダル | `assets/css/guides-modals/01-guides-modals-owner.css` |
| 共通カードの表面、カード基本形 | `assets/css/cars-members-tray/01-shared-card-primitives.css` |
| 待機トレイ、下部トレイ、トレイ内ボタン | `assets/css/cars-members-tray/02-tray-shell.css` |
| 参加者カード、名前、学年バッジ、メニュー | `assets/css/cars-members-tray/03-person-card.css` |
| 車カード、班カード、空席、車内メンバー | `assets/css/cars-members-tray/04-car-card.css` |
| カード内ドラッグ・ドロップ | `assets/css/cars-members-tray/05-drag-drop.css` |
| 精算サマリー、車ごとの精算結果 | `assets/css/settlement/01-layout-summary.css` |
| 精算ボタン、切替、設定サマリー | `assets/css/settlement/02-common-controls.css` |
| 精算入力、車編集、諸経費編集モーダル | `assets/css/settlement/03-car-inputs.css` |
| 距離補助、経由地、Google Maps関連UI | `assets/css/settlement/04-route-helper.css` |
| 集金チェック、支払いチェック、共有文面UI | `assets/css/settlement/05-checklists-share.css` |
| 発表ビューの表、タイムテーブル、未割り当て欄 | `assets/css/06-sheet-view.css` |
| 画面全体のドラッグ補助 | `assets/css/07-drag-interactions.css` |

## 変数ルール

直書きの色・角丸・z-indexを増やさず、まず既存変数を使います。

- 色: `--text-main`, `--text-sub`, `--bg-card`, `--bg-body`, `--border-color`, `--accent-color`, `--accent-soft`
- 面: `--surface-subtle`, `--surface-raised`, `--sheet-header`, `--hover-bg`
- 角丸: `--radius-xs`, `--radius-sm`, `--radius-main`, `--radius-md`, `--radius-lg`, `--radius-xl`
- 余白: `--space-1`, `--space-2`, `--space-3`, `--space-4`
- 操作: `--control-radius`, `--control-height`, `--control-primary-bg`, `--control-primary-text`
- 重なり: `--z-header`, `--z-tray`, `--z-dropdown`, `--z-modal`, `--z-drag`

白黒の直書きは、透明度つきの影や固定で必要なアイコン色など、理由がある場合だけにします。ダークモードで浮く白は、基本的に `var(--bg-card)` や `color-mix()` へ置き換えます。

## ボタンルール

ボタンは見た目ではなく役割で分けます。

- 主要操作: accent色。例: 共有、登録、ルート計算、実行。
- 補助操作: 薄い面と本文色。例: 設定、入力、編集。
- 危険操作: 赤系。例: 削除、全解除。
- アイコン操作: ヘッダーやカード右端の小ボタン。背景は控えめ。

新しいボタンを追加するときは、個別IDで色を作る前に、既存の `.header-action`, `.tool-btn`, `.seisan-btn`, `.tray-action-btn` のどれに属すかを決めます。

## ダークモードルール

ダークモードは個別セレクタで白黒を上書きし続けないで、変数で切り替えます。

良い例:

```css
.card-like-block {
  background: var(--bg-card);
  color: var(--text-main);
  border-color: var(--border-color);
}
```

避ける例:

```css
[data-theme="dark"] .card-like-block {
  background: #111;
  color: #fff;
}
```

例外は、テーマに依存させたくない支払いタグなどの意味色だけです。その場合も `--settlement-pay-*` のような意味変数を使います。


## モーダルの重なりルール

Bootstrap系モーダルは、暗幕と本体のz-indexを必ず分けます。

```css
.modal-backdrop {
  z-index: var(--z-modal-backdrop);
}

.modal {
  z-index: var(--z-modal);
}
```

`--z-modal` は `--z-modal-backdrop` より大きい値にします。暗幕側に `--z-modal` を使うと、画面が暗くなるのにボタンや閉じる操作をタップできない状態になります。

`tests/modal-z-layer-check.js` でこの事故を検出します。

## 追加・修正時の禁止事項

- `08-control-consistency.css` に修正を戻さない。
- `!important` を使わない。
- 旧仕様のCSSを復活させない。
- 同じセレクタを別ファイルに無目的に重複させない。
- `#fff`, `white`, `#000`, `black` を新規に増やす前に変数化を検討する。
- z-indexの数値を直接増やさない。必ず `--z-*` を使う。
- 「一時的な最終調整」「あとで整理」用のCSSファイルを増やさない。

## 確認コマンド

```bash
npm test
```

最低限、以下を確認します。

- `!important` が増えていない
- CSS読み込み順が崩れていない
- 旧CSSが読み込まれていない
- ダークモードで共有ボタン、精算タブ、発表ビューが見える
- 精算カード・集金チェック・タイムテーブルの最近の修正が残っている

## 2026-05 CSS leaf-link refactor

この版では `@import` 集約をやめ、`index.html` から各CSSを直接読み込む方式に変更した。
読み込み順は次の考え方で固定する。

1. `00-base-tokens.css` はトークン、リセット、Bootstrap系の最小補正だけを持つ。
2. 00から追い出した部品CSSは、各ownerフォルダの `00-base-extracted.css` に置く。
3. app-shell、guides-modals、cars-members-tray、settlement は小さなleaf CSSとして直接読み込む。
4. `08-utilities.css` は横断的なutilityだけに限定する。画面固有の修正は禁止。
5. 色は `--color-*`、状態色は `--status-*`、影は `--shadow-rgb`、重なり順は `--z-*` を使う。
6. 新しいCSSを追加したら、`tests/css-quality-guard-check.js` が通るようにする。

### 禁止事項

- 新しい `@import` を追加しない。
- `00-base-tokens.css` に画面固有セレクタを追加しない。
- `z-index: 99999` のような数値直書きを追加しない。
- ownerをまたいで同じセレクタを後ろから何度も修正しない。
- `08-utilities.css` を最終上書き置き場として使わない。
