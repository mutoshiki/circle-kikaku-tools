# CSS Architecture

## 読み込み順

1. `assets/css/tokens/*`
2. `assets/css/components/*`
3. `assets/css/app-shell/*`
4. `assets/css/guides-modals/*`
5. `assets/css/cars-members-tray/*`
6. `assets/css/settlement/*`
7. `assets/css/sheet-view/*`
8. 共通ユーティリティと文字ウェイト調整

全画面へ後から被せるvisual、skin、override層は使用しません。配置、寸法、色、境界、状態、レスポンシブ挙動は、その要素を管理する正規ownerへ直接記述します。

## ownerの原則

- レイアウト問題は親コンテナのownerで直す。
- 同じセレクタを無関係なファイルへ追加しない。
- 共通値はtokens、共通部品はcomponentsへ集約する。
- 画面固有の表現は各画面のownerに残す。
- `!important`は使用しない。
- 後勝ちの修正ファイル、全画面スキン、末尾パッチを追加しない。
- 既存ブレークポイントの責任範囲へ合わせる。
- 変更前に同一セレクタ、詳細度、メディア条件、読み込み順を確認する。

## 主な責任範囲

| 対象 | owner |
|---|---|
| 色、余白、角丸、文字、影、操作寸法 | `tokens/` |
| 共通ボタン、入力、表面、状態契約 | `components/` |
| アプリ全体のフレーム | `app-shell/layout/` |
| ヘッダー、企画名、同期状態、タブ、ヘッダー操作 | `app-shell/header/` |
| 編集ツールバー | `app-shell/edit/` |
| モーダル、ガイド、ドロワー | `guides-modals/` |
| 車、班、参加者、未割当トレイ | `cars-members-tray/` |
| 精算画面 | `settlement/` |
| 発表ビュー | `sheet-view/` |

## ヘッダーowner

ヘッダーは次の3ファイルに限定します。

- `header/01-header-base.css`: シェル、基本配置、共通状態
- `header/02-room-status.css`: 企画名入力、同期状態、関連レスポンシブ
- `header/03-tabs-actions.css`: 画面タブ、共有・その他操作、関連レスポンシブ

ヘッダー専用の追加responsiveファイルを増やさず、責任を持つ上記owner内で通常時と各ブレークポイントを対応させます。

変更後は`npm run lint:css`、`npm test`、`npm run test:ui`、`npm run test:visual`を実行します。
