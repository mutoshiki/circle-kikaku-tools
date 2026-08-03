# CSS Architecture

## 読み込み順

1. `assets/css/tokens/*`
2. `assets/css/components/*`
3. `assets/css/app-shell/*`
4. `assets/css/guides-modals/*`
5. `assets/css/cars-members-tray/*`
6. `assets/css/settlement/*`
7. `assets/css/sheet-view/*`

全画面へ後から被せるvisual／skin／override層は使用しません。配置、寸法、色、境界、状態、レスポンシブ挙動は、その要素を管理する正規ownerへ直接記述します。

## ownerの原則

- レイアウト問題は親コンテナのownerで直す。
- 同じセレクタを無関係なファイルへ追加しない。
- 共通値は`tokens/`、共通部品は`components/`へ集約する。
- 画面固有の表現は各画面のownerに残す。
- `!important`、末尾パッチ、包括的な上書きファイルを使用しない。
- ライト／ダークで切り替わる値はsemantic tokenを経由する。
- 汎用UIは公式Carbon Web Components、ドメイン面はCarbon契約に沿う独自構造とする。
- モバイルの可視操作は原則48px以上とし、狭さを理由に操作領域を縮めない。

## 主な責任範囲

| 対象 | owner |
|---|---|
| 色、余白、形、文字、影、操作寸法、フォーム状態 | `tokens/` |
| 共通ボタン、表面、通知、状態契約 | `components/` |
| アプリ全体のフレーム、下部ナビ、safe-area、layer | `app-shell/layout/` |
| ヘッダー、企画名、同期状態、公式Carbon actions | `app-shell/header/` |
| 編集ツールバー | `app-shell/edit/` |
| Modal、ガイド、ドロワー | `guides-modals/` |
| 車、班、参加者、Menu、未割当Popover | `cars-members-tray/` |
| 精算画面とフォーム | `settlement/` |
| 共有画面 | `sheet-view/` |

## 精算入力のowner境界

- `settlement/car-inputs/01-car-form.css`: 車両費フォームのシェル、共通入力、エラー、フォーカス
- `settlement/car-inputs/02-distance-fuel.css`: 距離・燃費・単価、距離計算導線
- `settlement/car-inputs/03-extra-costs.css`: 諸経費の1行構成、見出し、削除、負担区分
- `settlement/car-inputs/04-edit-modal.css`: 車両編集Modalの配置、ヘッダー、フッター
- `settlement/car-inputs/05-mobile-inputs.css`: モバイル補足と入力寸法
- `settlement/car-inputs/06-times-rental.css`: タイムズ／レンタカー固有状態
- `settlement/car-inputs/07-extra-candidates.css`: 諸経費候補
- `settlement/controls/03-settings.css`: 精算設定Modal

## テーマ

`assets/js/core/theme-controller.js`が`html[data-theme]`を管理し、`assets/css/tokens/01-theme-modes.css`がダークテーマのsemantic tokenを所有します。画面CSSはテーマ名を直接判定せず、`--surface-*`、`--text-*`、`--border-*`、`--status-*`を参照します。

## 検証

```text
npm ci
npm run build:carbon
npm run lint:css
npm test
npm run test:ui
npm run test:visual
```

`npm run test:guard`でCSS lint、静的契約、Chromium操作、レスポンシブ画像監査を一括実行します。Visual基準を更新する場合は、差分画像を1枚ずつ確認し、未確認の一括更新を行いません。
