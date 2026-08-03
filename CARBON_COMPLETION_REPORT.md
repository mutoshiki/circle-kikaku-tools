# Carbon UI Completion Report

更新日: 2026-08-03  
対象: `circle-kikaku-tools`

## 結論

汎用UIを公式Carbon Web Componentsへ移し、Carbonに直接対応する部品がない車両・座席・参加者・精算内訳・共有キャンバスは、Carbonのtoken、layer、type、spacing、focus、state、accessibility契約で構成した。

「Carbonに似せた独自ボタンや入力」を完成扱いには含めていない。現在は、アプリソースから汎用のネイティブ`button`、`input`、`select`、`textarea`を生成せず、Bootstrap／Font Awesomeのruntime依存も持たない。

## 公式Carbon基盤

- `@carbon/web-components`: 2.60.0（exact pin）
- `@carbon/icons`: 11.85.0（exact pin）
- `@ibm/plex-sans`: 1.1.0（exact pin）
- `@ibm/plex-sans-jp`: 3.0.0（exact pin）
- 静的配信向けにesbuildで単一ES moduleを生成
- Carbon bundle、Plex font、licenseをself-host
- build manifestを決定的に生成し、CIのvendor差分検査を可能にした

## 公式部品へ統一した分類

1. Button／Icon Button
2. Content Switcher
3. Toast／Inline Notification
4. Tag
5. Text Input
6. Number Input
7. Textarea
8. Select
9. Checkbox
10. Toggle
11. Modal
12. Overflow Menu／Menu
13. Popover
14. Carbon Icons

## 画面別の完成範囲

### アプリシェル

- IBM Plexと16px root scale
- Carbon White／Gray 100 theme
- ヘッダー操作をCarbon Icon Button／Overflow Menuへ統一
- 下部3画面ナビをCarbon Content Switcherへ統一
- safe-areaを背景帯として塗らず、ナビ本体だけを浮かせる構造
- Tray、Toast、Bottom Navigation、Menu、Modalのlayer順を整理

### 車割・班割

- 車割／班割切替をCarbon Content Switcherへ統一
- 参加者追加、定員、戻す、メニューをCarbon操作へ統一
- 人カード操作を公式Carbon Menuへ移行
- MenuをVisual Viewport内へ自動配置し、黒い余分なtooltipを除去
- 学年、性別、車出し等の状態をCarbon Tagとsemantic colorで表現
- 未割当トレイの開閉、空席、ランダム、設定を48px操作へ統一
- 割り当て条件をCarbon Popover／Checkbox／Buttonへ移行
- 0人時に不要な空白を確保しない

### 共有画面

- 既存の車割上／班割下の情報構造を維持
- パン／ピンチ、端の移動導線、初期表示を整理
- 編集操作をCarbon Icon Buttonへ統一
- 編集ドロワーの入力、時刻、追加、コピーをCarbon部品へ統一
- 下部ナビと編集操作が重ならないclearanceを実装

### 精算

- 設定をCarbon Modal／Content Switcher／Checkbox／Select／Text Inputへ統一
- 車両費をCarbon Modal内のNumber Input／Text Input／Selectで編集
- 距離、燃費、単価のplaceholderとモバイル入力寸法を復元
- 諸経費を費用名・金額・負担・削除の1行構成に整理
- 諸経費のinvalid状態を保存後も正しく復元し、入力修正時に即時解除
- エラー文表示時に行全体の上端を揃える
- 距離計算ツールは既存の削除｜場所名｜並べ替えUIを維持し、周囲layerだけを区別
- 集金、支払済み、コピー、共有操作をCarbon状態契約へ統一

### Modal／参加者登録／ガイド

- 10個の静的Modalを公式Carbon anatomyへ統一
- 動的確認／警告Modalも同じcontrollerで管理
- 初期フォーカスをボタンではなく見出しへ移動
- X、キャンセル、Escape、フォーカス復帰、閉じる際のghostを整理
- 長い参加者登録は左右余白、2列入力、固定footerを維持
- 使い方画像11枚を完成版UIから再撮影

## Form state契約

すべてのCarbon入力で次を扱う。

- default
- hover
- focus
- active／selected
- invalid + error text
- warning + warning text
- readonly
- disabled

モバイルでは内部入力を16px以上にし、iOS Safariの入力時自動ズームを誘発しない。デスクトップはCarbon標準の14px入力文字を維持する。

## 構造と保守

- 119 CSS filesをowner制で維持
- 65 app JavaScript filesを責務別に維持
- `99-*`、`override-*`、`final-fix*`等の後付け修正なし
- runtime Bootstrap／Font Awesome参照なし
- native generic form controlsの生成なし
- inline `onclick`なし
- catch-all visual patchなし
- build、lint、static、PlaywrightのスクリプトとCIを復旧

## 検証範囲

- Chromium: 320、390、768、1280px
- Light／Dark
- 車割・班割、共有、精算
- Header、Overview、Bottom Navigation、Tray
- Carbon Menu／Popover
- 人物編集と学年変更
- 参加者一括登録
- 主要Modalの開閉とfocus
- 精算設定、車両費、諸経費validation
- 距離計算の追加・削除・編集
- 横overflow、操作領域、accessible name、console/page error

## 実環境で残る確認範囲

次はローカル静的Chromiumだけでは完全には証明できないため、配信環境で最終確認する。

- Firebaseの実通信、競合、オフライン復帰
- 実際の共有URLを別端末で開くフロー
- Google Mapsへの外部遷移結果
- iOS Safari実機のブラウザchrome透過とキーボード復帰
- Firefox／WebKitのvisual差分

これらはCarbon構造の未移行ではなく、外部サービス／ブラウザ固有の受入確認項目である。

## 最終検証結果

| 種別 | 成功 | 失敗 |
|---|---:|---:|
| Chromium実操作・レスポンシブ | 154 | 0 |
| 静的Carbon契約 | 21 | 0 |
| JavaScript構文 | 71 | 0 |
| CSS構文解析 | 119 | 0 |
| **合計** | **365** | **0** |

詳細は`test-results/verification-summary.json`、`test-results/carbon-complete-runtime.json`、各group JSON、`static-results.json`、`javascript-syntax.json`、`css-parse.json`に保存した。
