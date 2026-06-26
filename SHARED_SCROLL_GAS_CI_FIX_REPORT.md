# 共有画面・ガソリン代入力・Quality Guard 修正報告

## 対象

元ファイル: `circle-kikaku-tools-expense-summary-unified.zip`

## 1. 共有画面の下半分が切れる問題

### 原因

共有内容とスクロール領域が同じ `#sheet-canvas` に置かれ、その要素自体へ拡大・移動変形を掛けていたため、見た目の高さとブラウザが認識するスクロール範囲が一致していなかった。

### 根本修正

- `#sheet-canvas` をスクロール専用のビューポートに変更
- 内側へ `#sheet-content` を新設し、車割・班割・未割り当て・タイムテーブルをすべて格納
- スマートフォンではビューポートを変形せず、内容側だけを拡大縮小
- 共有画面の撮影・監査ツールも、実際のスクロール所有者である `#sheet-canvas` を検査するよう修正
- 下端へ `safe-area-inset-bottom` を含む余白を確保
- モバイルではスクロールバー用の固定余白を取り除き、画面幅を有効活用

### 確認値（390×844）

- 共有領域: `scrollHeight 1204px / clientHeight 710px`
- 縦スクロール: 可能
- 横スクロール: なし
- 最下段「17:10 大学到着・解散」まで表示可能
- コンソールエラー: 0
- 通信失敗: 0

## 2. ガソリン代の3入力欄が重なる問題

### 維持した文言

- 移動距離（km）
- 燃費（km/L）
- ガソリン単価（円/L）

### 原因

3列グリッド内の `input` がブラウザ既定の横幅を保持し、割り当てられた列の外へはみ出していた。また、同じ入力構成について複数CSSファイルに異なる列指定が残っていた。

### 根本修正

- 3項目専用の `.seisan-gas-field-row` を正規のレイアウト所有者に設定
- 常に `repeat(3, minmax(0, 1fr))` の横並び
- 各入力を `width: 100%; min-width: 0; box-sizing: border-box;` とし、列内へ収める
- 距離計算ツールは3入力の下へ分離
- モーダル用・モバイル用に重複していた列指定と入力装飾を削除
- タイムズ選択時だけ、不要な燃費・単価を隠して距離欄を1列にする

360pxと390pxで、3項目の上端一致、入力枠の非重複、モーダル横はみ出しなしを座標で検査した。

## 3. AndroidモバイルUIガイドから追加反映した点

- スクロール領域を `role="region"` と日本語ラベルで明示
- キーボードでも到達できるよう `tabindex="0"` を設定
- フォーカス時に明確な輪郭を表示
- 後続改修でズームボタンを削除し、1本指パンと2本指ピンチによる直接操作へ統一
- システムバーやホームインジケーターを考慮した下端余白
- スマートフォンでは通常の上下左右スクロールを優先し、独自ドラッグ操作による操作妨害を回避

## 4. Quality Guardへの対応

### CSS lint and static contracts

- CSS lint: 合格
- 静的契約: 75件合格
- 共有画面のスクロール所有者、下端余白、アクセシブルな領域、3入力横並び、入力幅制約を検査する契約を追加

### UI and visual regression

- 基本UI操作: 4件合格
- 既存UI契約: 6件合格
- 新規レイアウト回帰: 4件合格
- 視覚回帰: 360 / 390 / 430 / 768 / 1280 / 1440px の6件合格
- 詳細監査: 4件合格
- 横並びへ戻した新しい車両費モーダルを正しい基準としてスナップショットを更新
- CIでは1 workerで実行し、並列実行由来の不安定さを避ける設定を追加

## 5. 主な変更ファイル

- `assets/js/features/sheet-view.js`
- `assets/js/features/sheet/02-viewport-controls.js`
- `assets/css/sheet-view/layout/01-sheet-frame.css`
- `assets/css/sheet-view/layout/03-sheet-summary.css`
- `assets/css/sheet-view/gestures/01-touch-navigation.css`
- `assets/js/templates/settlement/03-car-cost-templates.js`
- `assets/css/settlement/car-inputs/01-car-form.css`
- `assets/css/settlement/car-inputs/02-distance-fuel.css`
- `assets/css/settlement/car-inputs/04-edit-modal.css`
- `assets/css/settlement/car-inputs/05-mobile-inputs.css`
- `assets/css/settlement/car-inputs/06-times-rental.css`
- `tests/layout-regression.spec.js`
- `tests/shared-scroll-and-gas-grid-check.js`
- `tools/capture-saas-audit.js`
- `package.json`
- `playwright.config.js`

## 6. 実装方針

`!important`、CSS末尾への追加スキン、同じセレクタの後勝ち上書きは使用していない。スクロール・車両費入力・モーダル・監査ツールそれぞれの正規所有ファイルを直接編集し、不要になった旧レイアウト定義を削除した。
