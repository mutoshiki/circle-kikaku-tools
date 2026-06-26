# 共有画面の直接操作・概要レイヤー・班割見出し 修正報告

## 対象

元ファイル: `circle-kikaku-tools-pinpoint-followup-extra-row-fixed.zip`

## 1. 共有画面のズームボタン削除

共有画面左下にあった縮小・全体・拡大ボタンを、HTML、イベント登録、専用CSSから削除した。

操作は以下へ統一した。

- 1本指のスワイプ: 上下左右へ移動
- 2本指のピンチ: 指の中心を基準に自由に拡大・縮小
- 2本指の中心移動: 拡大縮小しながら表示位置も追従
- マウスドラッグ: デスクトップでの移動
- Ctrl / Command + ホイール: デスクトップでの拡大縮小

共有内容の内側要素だけを拡大する構造と、最下部まで到達できるスクロール範囲は維持している。

## 2. ジェスチャーCSSの責務整理

削除した `sheet-view/print/01-zoom-print.css` の代わりに、直接操作だけを所有する `sheet-view/gestures/01-touch-navigation.css` を作成した。

ここへ次を集約した。

- 1本指のネイティブパン
- 慣性スクロール
- マウスドラッグ中のカーソル
- キーボードフォーカス
- 操作説明

ズームボタン用の旧スタイルやイベントは残していない。

## 3. 概要を最上位の操作レイヤーへ修正

原因は、共有画面の編集ボタンなどが使う `--z-floating` がモーダル層より大きく、概要ドロワーの上へ表示されていたことだった。

アプリ全体のレイヤートークンを以下の順序へ整理した。

1. 通常UI・ヘッダー・メニュー
2. フローティング操作
3. ドラッグ表示
4. モーダル背景
5. モーダル／概要ドロワー
6. 通知

概要だけに局所的な巨大 `z-index` を追加せず、正規のレイヤー定義を修正した。概要を開くと、共有画面の編集ボタン、操作ヒント、その他の固定UIより常に上に表示される。

## 4. 共有画面の見出し

編集画面で使う短い名称「班」は維持し、共有画面の見出しだけを「班割」に変更した。

- 車側: 車割
- 班側: 班割

用途ごとの文言を分けるため、プラン設定に `sheetTitle` を追加した。

## 5. AndroidモバイルUIガイドとの対応

- 画面内コンテンツを直接触って移動・拡大する操作へ整理
- 操作対象と操作結果の対応を明確化
- 概要を独立した前面サーフェスとして表示し、背面操作との重なりを防止
- 「車割」「班割」の情報階層と命名を揃え、読み取り時の曖昧さを解消
- キーボードフォーカス、マウス操作、スマートフォン操作を併存

## 6. 検証結果

- CSS lint: 合格
- 静的契約: 76件合格
- 基本UI操作: 4件合格
- 既存UI契約: 6件合格
- レイアウト回帰: 5件合格
- 視覚回帰: 6画面幅合格
- フォーカス・状態監査: 合格
- 48pxタップ領域監査: 合格
- 390px実画面監査: コンソールエラー0、通信失敗0、横スクロール0
- CDPによる2点タッチ操作で、ピンチ後に倍率が増加することを確認
- 概要のレイヤー値がフローティング操作より上であることを確認

## 7. 主な変更ファイル

- `index.html`
- `assets/js/features/sheet/02-viewport-controls.js`
- `assets/js/features/events/05-view-feature-events.js`
- `assets/js/features/sheet-view.js`
- `assets/js/core/data-state.js`
- `assets/js/templates/sheet-templates.js`
- `assets/css/app-shell/layout/04-layering.css`
- `assets/css/sheet-view/layout/01-sheet-frame.css`
- `assets/css/sheet-view/gestures/01-touch-navigation.css`
- `tests/layout-regression.spec.js`
- `tests/shared-scroll-and-gas-grid-check.js`
- `tests/pinpoint-followup-contract-check.js`
