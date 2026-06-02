# CSS整理ルール

このプロジェクトのCSSは、画面ごとの「持ち主」と共通部品の「契約」を分けて管理します。過去の修正を最後の上書きファイルに積む方式は禁止です。

## 読み込み順

`index.html` は集約CSSを使わず、小さな leaf CSS を直接読み込みます。順番は次の固定です。

1. `assets/css/tokens/*`  
   色、テーマ土台、リセット、Bootstrap補正、入力欄の基礎。
2. `assets/css/components/*`  
   共通の面、金額、タグ、入力欄、タブ、ボタン、アイコンの契約クラス。
3. `assets/css/app-shell/*`  
   アプリ外枠、編集バー、ヘッダー、ルーム欄、モバイルヘッダー。
4. `assets/css/theme/*`  
   テーマ契約、ライト/ダークの意味変数、枠線正規化。テーマピッカーUIは現在なし。
5. `assets/css/guides-modals/*`  
   ガイド、モーダル、取り込みガイド、コピー/ロック通知、概要ドロワー、z-layer。
6. `assets/css/cars-members-tray/*`  
   待機トレイ、参加者カード、車カード、班カード、ドラッグ表示。
7. `assets/css/settlement/*`  
   精算ページ、サマリー、入力、距離補助、集金/支払チェック、共有文面、費用タグ、ダーク面、車別費用。
8. `assets/css/sheet-view/*`  
   発表ビュー、待機欄、タイムテーブル、編集モード、印刷/ズーム。
9. `07-drag-interactions.css` / `08-utilities.css`  
   横断的なドラッグ補助とユーティリティ。

旧集約CSS、修正履歴名のCSS、巨大なowner CSSは削除済みです。

## 役割別の編集先

| 直したい場所 | 編集先 |
| --- | --- |
| 色・角丸・余白・文字・z-indexの基準 | `assets/css/tokens/*` / `assets/css/components/00-component-contracts.css` |
| 共通ボタン | `assets/css/components/buttons/*` |
| 共通の面・枠線・影 | `assets/css/components/surfaces/*` |
| アプリ全体の外枠 | `assets/css/app-shell/layout/*` |
| 編集/操作バー | `assets/css/app-shell/edit/*` |
| ヘッダー、共有、ロック、ルーム欄、タブ | `assets/css/app-shell/header/*` |
| テーマの色セットを追加・変更 | `assets/css/theme/00-theme-contract.css` |
| ライト/ダークの意味変数への変換 | `assets/css/theme/01-theme-tokens.css` |
| テーマ由来の枠線の濃さ調整 | `assets/css/theme/02-border-normalization.css` |
| 通常モーダル | `assets/css/guides-modals/modal/*` / `assets/css/guides-modals/dialog/*` |
| ガイドカード・ガイド内モック | `assets/css/guides-modals/guide/*` |
| Googleフォーム取り込みガイド | `assets/css/guides-modals/import-guide/*` |
| コピー、ロック、通知 | `assets/css/guides-modals/notices/*` |
| 概要ドロワー | `assets/css/guides-modals/overview/*` |
| モーダルの重なり順 | `assets/css/guides-modals/z-layer/*` |
| 待機トレイ | `assets/css/cars-members-tray/waiting-tray/*` |
| 参加者カード | `assets/css/cars-members-tray/person-card/*` |
| 車カード・班カード | `assets/css/cars-members-tray/car-card/*` |
| ドラッグ/ドロップ | `assets/css/cars-members-tray/drag-drop/*` |
| 精算ページ土台 | `assets/css/settlement/page-shell/*` |
| 精算サマリー | `assets/css/settlement/summary/*` |
| 精算ボタン/トグル/設定 | `assets/css/settlement/controls/*` |
| 車ごとの入力欄 | `assets/css/settlement/car-inputs/*` |
| 距離補助 | `assets/css/settlement/route-helper/*` |
| 集金チェック/支払チェック | `assets/css/settlement/checklists/*` |
| 共有文面 | `assets/css/settlement/share/*` |
| 割勘・部費・支払タグ | `assets/css/settlement/cost-tags/*` / `assets/css/settlement/payment-chip/*` |
| 精算ダーク面 | `assets/css/settlement/dark/*` |
| 車別費用カード | `assets/css/settlement/car-cost-summary/*` |
| 発表ビュー基本表 | `assets/css/sheet-view/layout/*` |
| 発表ビュー待機欄 | `assets/css/sheet-view/waiting/*` |
| タイムテーブル | `assets/css/sheet-view/timetable/*` |
| 発表ビュー編集モード | `assets/css/sheet-view/edit/*` |
| 印刷・ズーム | `assets/css/sheet-view/print/*` |

## テーマを増やすときの方針

現在のUIは単一テーマですが、CSS側はテーマ追加に備えて `data-app-theme` と `data-theme` を分けています。

- `data-app-theme`: 色セットの種類。現在は `single`。将来テーマを増やす場合はここに `forest` や `warm` などを追加する。
- `data-theme`: ライト/ダーク。現在も端末設定またはデバッグ切替で `light` / `dark` が入る。
- 新しいテーマを足すときは、まず `assets/css/theme/00-theme-contract.css` に `--theme-light-*` と `--theme-dark-*` だけを追加する。
- 画面別CSSに `body[data-app-theme="..."] .xxx` のような個別指定を増やさず、既存の `--bg-body`、`--bg-card`、`--accent-color`、`--border-color` に流し込む。
- テーマピッカーUIを復活させる場合も、CSSは `00-theme-contract.css` に色セット、JSは `data-app-theme` の切替だけを担当させる。

## 追加・修正時のルール

- `!important` を使わない。
- `@import` を使わない。CSSは `index.html` から直接読む。
- `repair`、`guard`、`fix`、`continued`、`final`、`adjustments`、`followup` のような修正履歴名のCSSファイルを作らない。
- 1ファイルが大きくなったら、その場で責務別に分ける。
- 枠線を足す前に `components/surfaces/*` を確認する。
- 金額表示を足す前に `.ui-amount` を使う。
- タグ表示を足す前に `.ui-chip` と既存の `seisan-*tag` を使う。
- z-indexは数値直書きせず、`--z-*` を使う。
- ライト/ダークの個別上書きを増やす前に、変数で吸収できるか確認する。

## 確認コマンド

```bash
npm test
```

追加でUIの目視確認をする場合:

```bash
npm run test:ui
npm run test:visual
```

## 2026-05 45項目CSS整理

今回の整理では、巨大CSSをすべて320行以下のleaf CSSへ分割し、トークン、部品契約、画面別owner、チェック用テスト、ドキュメントを更新しました。旧CSSは読み込みだけでなくファイル自体も削除しています。


## モーダルのz-index注意

ポップアップ本体は常に暗い背景（`.modal-backdrop`）より前面に出す必要があります。

- アプリ全体のz-indexは `assets/css/tokens/04-forms-inputs.css` を正とする
- `.modal-backdrop` は `--z-modal-backdrop`
- `.modal` は `--z-modal`
- `--z-modal` は `--z-modal-backdrop` より大きい値にする
- `components/00-component-contracts.css` などの共通部品ファイルで `--z-modal`、`--z-dropdown`、`--z-tray` を再定義しない

CSS分割時に共通部品側で `--z-modal` を上書きすると、背景だけが前面に出て、使い方・サンプルデータ・各種設定モーダルが暗くなったまま押せなくなります。

## Theme picker note

- Theme selection is active again. The current first-paint theme is `standard`.
- Add or remove selectable themes in `assets/js/modules/theme-presets.js`.
- Add the matching color variables in `assets/css/theme/00-theme-contract.css`.
- Component and screen CSS should continue to use semantic tokens such as `--bg-body`, `--bg-card`, `--text-main`, `--border-color`, `--accent-color`, and `--accent-soft`.
- Do not put theme-specific colors directly into screen CSS unless the color is a fixed semantic state such as error, warning, or success.
