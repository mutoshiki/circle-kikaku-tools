# UI Components

## Card / Surface

外側カードは `.ui-surface ui-surface--card`、内側の控えめな面は `.ui-surface ui-surface--inset` を使います。

- 外側カード: 企画カード、車カード、精算サマリー、車別費用カード
- 内側面: 費用内訳、候補欄、補助情報

## Button

- 主要操作: `.tool-btn` / `.seisan-btn` のアクセント系
- 補助操作: 薄い背景、本文色
- 危険操作: 赤系
- アイコン操作: `.seisan-icon-btn` など小さな操作

新しいボタンを作るときは、個別IDで色を指定する前に既存の役割へ寄せます。

## Input

入力欄は `.ui-input` または既存の `.form-control` / `.form-select` を使います。角丸・線・フォーカスは共通トークンに従います。

## Amount

金額表示は `.ui-amount` を付けます。

対象:

- 精算サマリーの金額
- 車別費用カードのガソリン代・諸経費・端数処理・合計
- 集金チェック・支払チェックの金額

## Chip / Tag

タグは `.ui-chip` を土台にします。

- 割勘: `.seisan-cost-type-badge.split`
- 部費: `.seisan-cost-type-badge.club`
- 支払: `.seisan-payment-tag`

## Modal

モーダルは通常モーダル、ガイドモーダル、確認モーダルを分けて考えます。z-indexは `guides-modals/z-layer/*` と `--z-*` で管理します。

## Tabs

タブは `.ui-tab` の契約を使い、選択状態はテーマアクセントへ寄せます。ライト/ダークで形が変わらないようにします。
