# Menu and Search QA — v31

## Scope

v30を基準に、車カードの人数表示、人物Overflow Menu、移動距離計算ツールの検索表示を修正した。後付けの包括overrideは追加せず、それぞれの所有CSS・JavaScriptを直接変更した。

## Changes

1. 車カードの人数表示
   - `3/3`や`4/4`を24pxへ変更
   - Carbon Editアイコンも24pxへ統一
   - 48pxの操作高と76pxの最小幅を確保し、数字とアイコンを一つの編集操作として整列

2. 人物カードのCarbon Overflow Menu
   - `enable-v12-overflowmenu`、`autoalign`、`menu-alignment`を使用
   - Carbonのフォーカス、キーボード、Menu Item、サブメニューを維持
   - CarbonのFloating UI計算後に、画面端と常設の未割り当てトレイを境界として最終位置を制約
   - トリガー右端へのend揃え、上下の空きに応じた反転、必要時の内部スクロールを実装
   - iOSで`backdrop-filter`がfixed配置の包含ブロックになる問題を、メニュー表示中だけ解除
   - 開いているメニューだけを高いレイヤーへ上げ、後続カードの三点トリガーがメニュー上へ透ける問題を解消
   - 未割り当てトレイより上のレイヤーへ表示

3. 移動距離計算ツール
   - 地点行と検索専用画面の両方に公式Carbon Searchアイコンを表示
   - 48pxのアイコン領域内へ20pxのSearch glyphを配置
   - 入力文字の開始位置を48px確保して重なりを防止

## Isolated browser validation

- プロジェクトをrepository外の一時コピーで検査
- policy pathを空ディレクトリへ指定
- Chromium binary: `/usr/bin/chromium`
- repository本体とsystem policyは変更していない
- ローカル資産をインライン化し、`page.set_content()`でレンダリング

### Viewports and states

- 360×800 dark
- 390×844 dark / light
- 1440×900 dark
- 人物メニュー index 0, 1, 5, 12を含む左右列・上下位置
- 移動距離計算ツールの地点行と検索画面

### Measured results

- 人数文字: 24px
- Editアイコン: 24×24px
- 人物メニュー: 全検査位置で左右の画面外はみ出し0
- 人物メニュー: 全検査位置で未割り当てトレイとの重なり0
- メニューと後続カードの三点トリガーが重なる座標で`elementFromPoint()`は`CDS-MENU-ITEM`を返し、トリガーの透過表示0
- 必要なメニューは内部スクロール可能
- Searchアイコン領域: 48×48px
- Search glyph: 20×20px
- 入力左padding: 48px
- Page error / relevant console error: 0

## Automated checks

- `npm test`: PASS
- `npm run test:share`: PASS
- `npm run lint:maps`: PASS
- `npm run typecheck:maps`: PASS
- `npm run test:maps:contract`: PASS
- `npm run test:driver-reward`: PASS
- CSS parser: 121 files, 0 errors

## Remaining limits

Google Maps APIキーを使う実通信、実機iOS Safari、Live Firebase同期はこの隔離環境では未検証。Maps未設定時のエラー状態と、検索UIのレンダリング・操作遷移は確認済み。
