# 諸経費入力行のレイアウト修正

## 修正内容

- 車の精算ダイアログで、諸経費の「名称・金額・割勘/部費・削除」をスマートフォン幅でも同じ1行へ戻した。
- 360pxでは `名称 / 金額 / 精算区分 / 削除` の4列を維持し、入力欄や削除ボタンが重ならない幅へ調整した。
- 「諸経費を追加」は入力行の下に維持し、全幅ではなく内容に合う幅へ変更した。
- 追加ボタンと削除ボタンは48px以上のタップ領域を維持した。

## 根本編集

諸経費行のレイアウト責務を `assets/css/settlement/car-inputs/03-extra-costs.css` に一本化した。

次の重複定義を削除した。

- `assets/css/settlement/page-shell/01-layout.css` の追加行レイアウト
- `assets/css/settlement/controls/02-toggles.css` の削除・追加ボタン寸法
- `assets/css/settlement/car-inputs/04-edit-modal.css` の追加行余白
- `assets/css/settlement/car-inputs/05-mobile-inputs.css` の諸経費行モバイル分岐

`!important`、CSS末尾へのスキン追加、インラインスタイルは使用していない。

## 回帰防止

- 静的契約で、諸経費行のCSS ownerが1ファイルだけであることを確認。
- 360px・390pxで4要素が同じ高さ位置にあり、互いに重ならないことを座標検査。
- 追加ボタンが下段にあり、48px以上かつ全幅へ不必要に広がらないことを検査。
- 視覚回帰画像を意図した新レイアウトへ更新。

## 検証結果

- CSS lint: 合格
- 静的契約: 76件合格
- 基本UI: 4件合格
- owner/UI契約: 6件合格
- レイアウト回帰: 5件合格
- 視覚回帰: 6画面幅合格
- 詳細UI監査: 4件合格
