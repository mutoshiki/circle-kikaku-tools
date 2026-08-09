# Feature Fixes QA — v30

## 対象

v29を基準に、精算設定、経路検索、モバイルのフォーカス状態、人物メニュー、精算メモのコピー操作、車カード定員編集、タイムテーブル編集を修正した。

## 実装内容

### 精算設定

- 「企画者から集金しない」が有効で企画者が未選択の場合、Carbon Selectをinvalid状態にする。
- エラー文言は「企画者を選択してください」。
- 不正状態では保存しない。
- 閉じる操作ではCarbon確認モーダルを表示し、「破棄して閉じる」または「編集を続ける」を選択できる。

### 移動距離計算ツール

- 地点検索画面にCarbon Searchアイコンを復元した。
- 検索画面を閉じた後のフォーカス復帰は、キーボード操作時だけ行う。

### モバイルの操作後ハイライト

- Shadow DOM内のactiveElementまで再帰的にblurする。
- pointer操作後はフォーカスを戻さず、keyboard操作時のみフォーカスを復元する。
- ヘッダー操作の外側フォーカスリングはkeyboard navigation時だけ表示する。

### 人物カードメニュー

- 人物Overflow MenuとPopoverを未割り当てトレイより上のレイヤーへ移動した。
- メニュー表示中は待機トレイと車カードのz-indexを役割別に調整した。

### 精算メモをコピー

- ダークモードでCarbon tertiary actionとして識別できる文字色、背景、境界を設定した。

### 車カードの定員編集

- Pencilアイコンを24pxへ拡大し、48pxの操作領域は維持した。

### タイムテーブル

- 入力開始時にCarbon Textareaの公式`rows` APIで4行へ拡張する。
- 入力中は改行と折り返しを維持する。
- 短い内容はblur時に1行へ戻し、長文・改行済み内容は拡張状態を維持する。

## 隔離ブラウザ検査

- リポジトリ外の一時コピーで実施。
- System Chromium: `/usr/bin/chromium`
- システムおよびリポジトリのブラウザポリシーは変更していない。
- ローカル資産をインライン化し、`about:blank?room=QA30`へ`page.set_content()`で描画した。
- Firebaseへの書き込みは行っていない。

## Viewport

- 390 × 844: ダーク、全対象フロー
- 390 × 844: ライト、基本表示
- 360 × 800: ダーク、狭幅表示
- 1440 × 900: ダーク、デスクトップ表示

## 実画面測定

- 横方向のページはみ出し: 全Viewportで0px
- 企画者未選択エラー: 表示・保存阻止を確認
- 破棄確認: 指定文言と2操作を確認
- Searchアイコン: 48 × 48pxの検索操作内で描画
- ロック操作後の残留フォーカス: なし
- 人物メニュー: menu z=800、waiting tray z=798
- 精算メモコピー: ダーク背景上でアクセント境界と文字を確認
- 定員編集Pencil: 24 × 24px
- タイムテーブルTextarea: rows=4、約114px、`white-space: pre-wrap`
- Console/Page Error: 対象フローで0件（APIキー未設定のGoogle Maps通信を除く）

## 自動検査

- `npm test`: PASS
- `npm run test:share`: PASS
- `npm run lint:maps`: PASS
- `npm run typecheck:maps`: PASS
- `npm run test:maps:contract`: PASS
- `npm run test:driver-reward`: PASS
- 変更対象JavaScriptの構文検査: PASS
- CSS 121ファイルの構文解析: エラー0

## 制限

- 実機iOS Safariは未検証。
- Live Firebase同期は未検証。
- Google Maps APIキーを使った実通信は未検証。
- アップロードされた成果物に`node_modules`がないため、Carbon bundleの再ビルドとstylelintは未実行。静的配布用bundleにはSearchアイコンを反映し、ソース側にも正式なimportを追加した。
