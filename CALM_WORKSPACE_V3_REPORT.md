> **履歴資料**: このレポートに記載された`assets/css/visual/`構成は、正規owner統合前の状態です。現在の構成は`OWNER_INTEGRATION_REPORT.md`と`CSS_OWNER_MAP.md`を参照してください。

# Calm Workspace V3 UI刷新レポート

## 1. 今回の判断

前案の Product Shell V2 は、見た目の変化を強く出すために濃色ヘッダー、ピル型ナビゲーション、左アクセント、強いモーダルヘッダーを多用していました。しかし、このサイトは車割・班割・発表・精算・編集・共有などを同一画面群で扱う高密度な日本語ツールです。装飾が複数の情報階層と競合し、操作を理解する前に外観が目に入る状態になっていました。

今回は「SaaSらしく見せる」ことではなく、**日本語の情報を速く読み、迷わず操作できる作業画面**を目標に設計し直しました。

## 2. 参考にした公式ガイド

- [デジタル庁デザインシステム：タイポグラフィ](https://design.digital.go.jp/dads/foundations/typography/)
  - 管理画面や業務システム向けの Dense テキストでは、表示情報量を保ちながら文字間隔を 0 にする考え方を採用しています。
- [デジタル庁デザインシステム：余白](https://design.digital.go.jp/dads/foundations/spacing/)
  - 余白を装飾ではなく、情報の関係・序列・読みやすさを示す手段として扱っています。
- [デジタル庁デザインシステム：リンクテキストのアクセシビリティ](https://design.digital.go.jp/dads/foundations/link-text/accessibility/)
  - タップ可能領域と隣接要素との間隔を確保する考え方を参照しました。
- [IBM Carbon：Spacing](https://carbondesignsystem.com/elements/spacing/overview/)
  - 一部を高密度にしてもページ全体を過密にせず、視線を休める余白を残す方針を参照しました。
- [IBM Carbon：2x Grid](https://carbondesignsystem.com/elements/2x-grid/usage/)
  - 高密度な製品UIでも整列線を明確にし、深い画面ほど密度を上げる考え方を参照しました。
- [Material Design 3：Touch targets](https://m3.material.io/foundations/designing/structure)
  - 見た目が小さいアイコンでも、操作領域は十分に確保する原則を参照しました。

## 3. 採用した設計原則

1. **主操作以外を無彩色にする**
   - 青は選択中、共有、保存などの主要操作に限定しました。
2. **画面全体をカードで埋めない**
   - 外側のまとまりだけを囲み、内側は線・行・背景差で整理しました。
3. **日本語本文に負の字間を使わない**
   - 日本語の可読性を優先し、本文・項目名・氏名は自然な字間に統一しました。
4. **密度と余白を画面単位で分ける**
   - 表・一覧の内部はコンパクトに、セクション間には明確な余白を設けました。
5. **同じ意味の状態は同じ表現にする**
   - 選択、ホバー、フォーカス、無効、主要操作の色と境界を統一しました。
6. **情報の序列を文字サイズだけに依存しない**
   - 太さ、色、余白、境界、整列を組み合わせました。

## 4. 主な変更

### ヘッダー・ナビゲーション

- 濃色プロダクトヘッダーを廃止し、白い作業ヘッダーへ変更
- ピル型タブを廃止し、下線式の静かなナビゲーションへ変更
- 共有以外のヘッダー操作をニュートラルなアイコンボタンへ変更
- モバイルとデスクトップで同じ優先順位を維持

### 車割・班割

- 左側の装飾アクセントを削除
- 外側カードを1つのまとまりとして扱い、人物カードを静かな入力・一覧面へ変更
- 氏名、学年、メモ、人数の階層を整理
- 待機トレイを装飾面ではなく作業領域として統一

### 共有画面

- 濃色の集計バーを廃止
- 車割・班割ラベルを小さな意味ラベルへ変更
- 表の列幅をデスクトップでわずかに拡大し、日本語氏名とメモの読みやすさを改善
- 表内部は高密度を維持し、画面外側には余白を残す構成へ変更

### 精算

- カード上端の装飾色を削除
- 支払額だけを青で強調し、割勘・部費・支払の意味色は淡い背景に限定
- 金額を等幅数字・同一整列で表示
- 車別内訳は外枠と行区切りを中心にし、入れ子カード感を軽減

### モーダル・フォーム

- 濃色モーダルヘッダーを廃止
- タイトル、閉じる、内容、保存の順序を明確化
- 入力欄、候補チップ、トグル、削除操作の境界と状態を統一
- 主要操作の保存ボタンだけを青で強調

## 5. テーマ機能

テーマ切替機能は前工程で削除済みで、今回も復活させていません。

- テーマ切替UIなし
- `data-theme`なし
- OSテーマ連動なし
- テーマ保存キーなし
- ダークモード専用CSSなし
- 単一の配色・状態体系のみ

## 6. 変更した本体ファイル

- `assets/css/tokens/01-color-scheme.css`
- `assets/css/tokens/02-radius-spacing-type.css`
- `assets/css/tokens/05-control-surface-tokens.css`
- `assets/css/visual/01-product-shell.css`
- `assets/css/visual/02-allocation-sheet.css`
- `assets/css/visual/03-settlement.css`
- `assets/css/visual/04-overlays-responsive.css`
- `assets/css/visual/05-header-resolution.css`
- `assets/css/sheet-view/layout/01-sheet-frame.css`
- `assets/css/sheet-view/timetable/01-timetable-base.css`
- `assets/css/sheet-view/timetable/02-timetable-edit.css`
- `package.json`
- `package-lock.json`

HTML構造、画面順序、情報構造、主要な操作方法、JavaScriptの機能は変更していません。

## 7. ブラウザ確認

Playwright専用Chromiumで以下を撮影しました。

- 360×800
- 390×844
- 430×932
- 768×1024
- 1280×720
- 1440×900

390pxと1280pxでは、通常画面に加えて班割、クイック編集、空状態、入力不足状態、概要ドロワー、ヘッダーメニュー、各モーダルも撮影しました。

最終成果：

- スクリーンショット：84枚
- 監査JSON：6件
- コンソールエラー：0件
- ネットワーク失敗：0件
- 文書全体の意図しない横スクロール：0件
- 主要スクロール領域の意図しない横スクロール：0件

## 8. テスト結果

- `npm run lint:css`：成功
- 静的テスト：65件成功
- Playwright操作テスト：4件成功
- Visual Regression：6表示幅の基準画像を更新
- Visual Regression再確認：360、390、430、768、1280、1440で成功

## 9. スクリーンショット

- `screenshots/32-v3-final/`
- `screenshots/32-v3-final/contact-sheets/final-mobile-key-v3.jpg`
- `screenshots/32-v3-final/contact-sheets/final-desktop-key-v3.jpg`
- `screenshots/32-v3-final/contact-sheets/comparison-v2-v3-mobile-overview.jpg`
- `screenshots/32-v3-final/contact-sheets/list-car-all-sizes-v3.jpg`
- `screenshots/32-v3-final/contact-sheets/sheet-all-sizes-v3.jpg`
- `screenshots/32-v3-final/contact-sheets/settlement-all-sizes-v3.jpg`

## 10. 残る制約

- 実データで極端に長い企画名、氏名、メモを入力した場合は、既存仕様に従い省略または折り返しが発生します。
- 共有画面は一覧性を優先するため、デスクトップでも内容を無理に横へ引き伸ばしていません。
- 車割画面の待機トレイは既存の固定作業領域を維持しているため、人数が少ない場合は空白が大きく見えます。
