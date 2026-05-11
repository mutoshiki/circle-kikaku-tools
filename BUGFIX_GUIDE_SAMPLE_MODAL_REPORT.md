# BUGFIX: ガイド/サンプルデータのモーダル階層修正

## 症状
- ヘッダーの「使い方」は開くが、車割メーカーの「使い方」、精算ツールの「使い方」、サンプルデータが開かない。

## 原因
SAB整理でガイド本文を `assets/js/templates/guide-content.js` に外出しした際、`index.html` の3つのガイドモーダルで `.modal-body` の閉じタグが抜けていた。
その結果、以下のモーダルが前のモーダルの内側にネストされていた。

- `#guideModal`
- `#seisanGuideModal`
- `#routeDistanceModal`
- `#historyModal`
- `#debugModal`

さらに、`.modal-footer` が `.unified-guide-body` の内側に入っていたため、ガイドテンプレートの `innerHTML` 差し込み時にフッターが消えるリスクもあった。

## 修正内容
- `#globalGuideModal`、`#guideModal`、`#seisanGuideModal` の `.modal-body` を正しく閉じた。
- `.modal-footer` を `.modal-body` の外へ戻した。
- 各モーダルが `body` 直下に並ぶ構造へ復旧した。
- 再発防止用に `tests/modal-hierarchy-check.js` を追加した。

## 確認
- 全JS構文チェック OK
- 既存Node静的テスト OK
- 追加したモーダル階層チェック OK
- `@playwright/test` が同梱されていないため、Playwright画面操作テストのみ未実行
