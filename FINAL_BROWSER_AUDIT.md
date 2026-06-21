# 最終ブラウザ監査レポート

作業日: 2026-06-21  
対象: `circle-kikaku-tools-owner-integrated (1).zip`

## 1. 結論

- Critical: **0件**
- High: **0件**
- 明確に修正可能な Medium: **0件**
- CSS lint、静的テスト、Playwright操作テスト、追加監査、画像回帰はすべて成功。
- 360 / 390 / 430 / 768 / 1280 / 1440px の最終監査で、コンソールエラー、通信失敗、文書全体・主要スクロール領域の横方向オーバーフローはすべて0件。
- 画像回帰の基準画像は更新していない。既存の基準に対して変更後実装がそのまま合格した。

## 2. 初期監査で確認した問題と最終状態

| 重要度 | 初期問題 | 対応 | 最終状態 |
|---|---|---|---|
| High | 人物カードの三点メニューが実測26〜28px程度で、モバイル操作領域が小さい | 人物メニュー owner で32px、モバイル34pxへ統一 | 解消 |
| High | 一部入力・参加者登録操作で共通フォーカスが後段指定により消える | 局所の `outline: 0` / `box-shadow: none` を削除し、共通2pxリングへ接続 | 解消 |
| High | Bootstrapの disabled 不透明度が共通規則に勝ち、状態差が弱い | button owner の適切な詳細度で opacity 0.48、操作遮断、カーソルを統一 | 解消 |
| High | 390pxで一括登録・精算ガイドの下端が約10px画面外へ出る | 各モーダル owner で外側余白を差し引いた動的高さに修正 | 解消 |
| Medium | 角丸tokenの正規値8pxが後段の12px定義で打ち消される | radius owner を一本化し、4/6/8/10/12pxへ整理 | 解消 |
| Medium | 色、表面、z-index、文字、フォーカス、ドラッグ token が複数ownerに分散 | palette/token/layer/dragの正規ownerへ移動・重複削除 | 解消 |
| Medium | 人物カードの同一責務が複数ファイル・同一ファイル内の後勝ち定義に分散 | shell/name/menu/mobile の4 ownerへ整理 | 解消 |
| Medium | 学年・費用区分・支払区分等に完全ピル形状が残り、装飾が強い | 意味のある円・トグル以外を既存角丸tokenへ接続 | 解消 |
| Medium | 閉じた概要ドロワーが画面外に残り、操作対象になり得る | 閉状態のvisibilityとpointer-eventsを遮断 | 解消 |
| Medium | 日本語の一部ラベル・入力に負の字間や局所的な文字位置差が残る | 日本語コントロールの字間を0へ統一し、役割別文字tokenに整理 | 解消 |
| Low | 車カード、精算、発表ビュー、ガイドモックに近似角丸・境界値が残る | 各画面ownerで既存tokenへ置換 | 解消 |

## 3. 最終画面監査

| 幅 | 画面高 | 撮影数 | コンソールエラー | 通信失敗 | 横方向overflow |
|---:|---:|---:|---:|---:|---:|
| 360px | 800px | 4 | 0 | 0 | 0 |
| 390px | 844px | 34 | 0 | 0 | 0 |
| 430px | 932px | 4 | 0 | 0 | 0 |
| 768px | 1024px | 4 | 0 | 0 | 0 |
| 1280px | 720px | 34 | 0 | 0 | 0 |
| 1440px | 900px | 4 | 0 | 0 | 0 |

390pxと1280pxでは、上部だけでなく中部・下部まで撮影した。対象には以下を含む。

- 空状態
- 車割、班割
- 発表ビュー、クイック編集
- 精算、入力不足状態
- 概要ドロワー、ヘッダーメニュー
- 一括登録、全体ガイド、精算設定、車別精算、経路補助の各モーダル

## 4. 状態・ストレス監査

390pxと1280pxで計28枚を追加撮影し、次を確認した。

- hover / keyboard focus / active / disabled / selected
- 人物メニュー
- 実ポインタ操作によるドラッグ中状態
- 長い企画名、長い車名、長い氏名
- `¥99,999,999` の長い金額
- 共通編集、車割ガイド、精算ガイド、履歴、デバッグの各モーダル

結果:

- コンソールエラー: 0
- 通信失敗: 0
- 横方向overflow: 0
- ドラッグ中クラス `manual-card-dragging`: 390px / 1280pxの両方で検出
- キーボードフォーカス: 最初の5操作対象すべてで2px以上の輪郭と2px以上のオフセットを検出
- 閉じたドロワー: `visibility: hidden` / `pointer-events: none`
- 全10モーダル: 390px / 1280pxで上下左右がviewport内、本文スクロール領域へ到達可能

## 5. テスト結果

| 検証 | コマンド | 結果 |
|---|---|---|
| CSS lint | `npm run lint:css` | 成功 |
| 静的テスト | `npm test` | 65/65 成功 |
| 基本Playwright操作 | `npm run test:ui` | 4/4 成功 |
| 追加Playwright監査 | `npm run test:refinement` | 3/3 成功 |
| 画像回帰 | `npm run test:visual` | 6/6 成功、基準画像更新なし |
| `!important`検査 | `rg '!important' assets/css` | 0件 |
| 禁止CSS層検査 | CSS名に `visual` / `override` / `final` / `fix` / `repair` / `skin` | 0件 |
| CSS owner・重複検査 | 既存静的guard＋selector監査 | 合格。基礎コンテキストで複数fileに現れるselectorは297→280へ減少。残存分は既存の構造・状態・responsive等の別責務スライスで、owner guard違反は0件 |

Playwright実行時は、外部CDNをローカルの同一依存ファイルへrouteし、不要な外部通信を遮断した。

## 6. 実行環境上の制約

Playwright同梱Chromiumの取得は、実行環境のDNS制限によりダウンロードできなかった。そのため、Playwrightから `executablePath=/usr/bin/chromium` を明示し、環境内Chromium **144.0.7559.96** を専用のheadless contextで起動して、同じ操作・撮影・回帰条件を実行した。Playwright以外の手動ブラウザ操作で代替してはいない。

## 7. 公式資料を適用した判断

各デザインシステムの外観は移植せず、現在の静かな日本語業務UIに原則のみ適用した。

- デジタル庁「余白」: 余白を情報の関係性と階層に使い、近似値を4px系tokenへ整理。
- デジタル庁「タイポグラフィ」: 見出し・本文・補足・ラベルの役割差を維持し、日本語に不自然な負の字間を除去。
- Atlassian「Spacing / Tokens」: raw値の追加ではなく既存tokenを単一の判断元として使用。
- Atlassian「Border / Radius」: selectedとfocusを区別し、2pxのfocus輪郭と2pxオフセットを共通化。
- Atlassian「Elevation」: 境界と余白で足りる場所に新しい影やカード面を追加しない。
- Carbon「Spacing / Typography」: 高密度なproduct UI向けの小さな間隔・productive type hierarchyを参照。
- Carbon「Modal」: header/body/footerの既存構造を維持し、内容量とviewportに応じた高さ・スクロール到達性を確保。
- Carbon「Form / Text input」: 業務画面の密度を保ちつつ、入力状態と補助情報の一貫性を優先。

### 参照した公式資料

- [デジタル庁デザインシステム: 余白](https://design.digital.go.jp/dads/foundations/spacing/)
- [デジタル庁デザインシステム: タイポグラフィ](https://design.digital.go.jp/dads/foundations/typography/)
- [デジタル庁デザインシステム: カラー](https://design.digital.go.jp/dads/foundations/color/)
- [Atlassian Design System: Spacing](https://atlassian.design/foundations/spacing)
- [Atlassian Design System: Design tokens](https://atlassian.design/tokens/design-tokens)
- [Atlassian Design System: Border](https://atlassian.design/foundations/border)
- [Atlassian Design System: Radius](https://atlassian.design/foundations/radius)
- [Carbon Design System: Spacing](https://carbondesignsystem.com/elements/spacing/overview/)
- [Carbon Design System: Typography](https://carbondesignsystem.com/elements/typography/overview/)
- [Carbon Design System: Modal](https://carbondesignsystem.com/components/modal/usage/)
- [Carbon Design System: Form](https://carbondesignsystem.com/components/form/style/)
- [Carbon Design System: Text input](https://carbondesignsystem.com/components/text-input/usage/)

## 8. 成果物内の証跡

- `screenshots/final-audit-*`: 6幅の最終画面
- `screenshots/final-interactions`: 状態・長文・長金額・ドラッグ・モーダル
- `representative-before-after/`: 変更前後の代表画像と比較シート
- `CHANGE_OWNER_MAP.md`: 実変更と正規ownerの対応
- `BEFORE_AFTER_INDEX.md`: 比較画像の索引
