# CSS Architecture

## 読み込み順

1. `assets/css/tokens/*`
2. `assets/css/components/*`
3. `assets/css/app-shell/*`
4. `assets/css/guides-modals/*`
5. `assets/css/cars-members-tray/*`
6. `assets/css/settlement/*`
7. `assets/css/sheet-view/*`

全画面へ後から被せる visual / skin / override 層は使用しません。配置、寸法、色、境界、状態、レスポンシブ挙動は、その要素を管理する正規 owner へ直接記述します。

## owner の原則

- レイアウト問題は親コンテナの owner で直す。
- 同じセレクタを無関係なファイルへ追加しない。
- 共通値は `tokens/`、共通部品は `components/` へ集約する。
- 画面固有の表現は各画面の owner に残す。
- `!important`、末尾パッチ、包括的な上書きファイルを使用しない。
- ライト／ダークで切り替わる値は semantic token を経由する。
- 同じ役割は共通化し、表示目的が違う要素まで無理に共通化しない。
- モバイルの可視操作は原則48px以上とし、狭さを理由に操作領域を縮めない。

## 主な責任範囲

| 対象 | owner |
|---|---|
| 色、余白、角丸、文字、影、操作寸法 | `tokens/` |
| 共通ボタン、入力、表面、状態契約 | `components/` |
| アプリ全体のフレーム | `app-shell/layout/` |
| ヘッダー、企画名、同期状態、画面ナビゲーション | `app-shell/header/` |
| 編集ツールバー | `app-shell/edit/` |
| モーダル、ガイド、ドロワー | `guides-modals/` |
| 車、班、参加者、未割当トレイ | `cars-members-tray/` |
| 精算画面 | `settlement/` |
| 共有画面 | `sheet-view/` |

## 精算入力の owner 境界

旧版にあった同一セレクタの反復メディアクエリは削除し、次へ整理しました。

- `settlement/car-inputs/01-car-form.css`: 車両費フォームのシェル、見出し、共通入力、エラー、フォーカス
- `settlement/car-inputs/02-distance-fuel.css`: 距離・燃費・距離計算導線
- `settlement/car-inputs/03-extra-costs.css`: 諸経費行の1列構成、削除操作、追加操作、精算区分
- `settlement/car-inputs/04-edit-modal.css`: 精算編集ダイアログの枠、ヘッダー、フッター、画面内配置
- `settlement/car-inputs/05-mobile-inputs.css`: 車両編集ダイアログ内の補足ラベルと車出し名入力
- `settlement/car-inputs/06-times-rental.css`: タイムズ固有の状態と自動費用
- `settlement/car-inputs/07-extra-candidates.css`: 諸経費候補
- `settlement/controls/03-settings.css`: 精算設定ダイアログの全状態

## テーマ

`assets/js/core/theme-controller.js` が `html[data-theme]` を管理し、`assets/css/tokens/01-theme-modes.css` がダークテーマの semantic token を所有します。画面 CSS はテーマ名を直接判定せず、`--surface-*`、`--text-*`、`--border-*`、`--status-*` を参照します。

## 検証

変更後は次を実行します。

```text
npm run lint:css
npm test
npm run test:ui
npm run test:refinement
npm run test:visual
```
