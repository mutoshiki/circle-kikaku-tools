# S Cleanup Report

## 実行内容

### CSS
- 30近いCSSリンクを9個のowner bundleへ整理しました。
- 旧CSSは `assets/css/_source_before_s_cleanup/` に退避しました。
- `index.html` は新しいbundleだけを読み込みます。
- 今後のCSS編集は、旧ファイルではなく以下の新ownerファイルに行います。

| 新ファイル | 役割 |
|---|---|
| `00-foundation.css` | 変数、基礎UI、共通部品 |
| `01-settlement.css` | 精算ベース |
| `02-app-layout.css` | アプリ全体レイアウト、ヘッダー基礎 |
| `03-guides-modals.css` | ガイド、モーダル、通知 |
| `04-theme-mobile-compat.css` | テーマ、旧モバイル互換、ドラッグ互換 |
| `05-feature-components.css` | タブ、人物カード、待機トレイ、同期バッジ |
| `06-structure.css` | HTML構造補助 |
| `07-repair-safety.css` | 安全修正、モーダル、入力、バッジ、モバイル修正 |
| `08-final-polish.css` | 密度、ヘッダー、精算、角丸の最終調整 |

### JavaScript
- `app.js` から大きい塊を外部ファイルへ移しました。
- 既存の関数名、保存キー、Firebase room構造、UI文言は変えていません。
- `app.js` は車割・発表ビュー・全体起動の中心に残しています。

| 新ファイル | 役割 |
|---|---|
| `assets/js/core/runtime.js` | DOM helper、Firebase初期化、共有状態、room id |
| `assets/js/core/storage.js` | escapeHtml、schema migration、safe localStorage |
| `assets/js/features/appearance.js` | テーマ設定、ライト/ダーク、テーマモーダル |
| `assets/js/features/settlement.js` | 精算計算、精算UI、距離計算補助、共有テキスト |
| `assets/js/features/guides.js` | 使い方ガイドのページ送り |
| `assets/js/core/remote-guard.js` | 入力中の遠隔同期保護 |

## デバッグで重点確認するところ
1. 共有リンクでroomが開くか
2. テーマ設定が開くか、完了ボタンが押せるか
3. 車割、発表、精算タブを切り替えられるか
4. サンプルデータ投入後、精算計算が表示されるか
5. 諸経費入力中にキーボードが勝手に閉じないか
6. ダークモード・ライトモードでヘッダー、カード、モーダルが崩れないか


## SAB cleanup note

このレポートは前段階の記録です。SAB cleanup では、旧 `07-repair-safety.css` と `08-final-polish.css` を `06-structure.css` へ吸収し、`app.js` の車割・発表ビュー・一括登録・人物メニュー系をさらに機能別ファイルへ分離しました。最新の整理内容は `SAB_CLEANUP_REPORT.md` を参照してください。
