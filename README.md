# 山歩会 企画ルーム 分割安定版

## 前回版からの修正

前回版で一部UIが昔に戻ったり、ボタンが押せなくなった原因は主に以下です。

1. CSSを意味別に並べ替えたことで、元HTMLのカスケード順が変わった
2. JSを `type="module"` の外部ファイルにしたため、HTML内の `onclick` から一部関数を呼べなくなった

この安定版では、CSSは分割しつつ、**元HTMLと同じ読み込み順**を保っています。
JSは外部ファイル化していますが、既存の `onclick` 互換を保つため、まずは通常の `<script src>` として読み込んでいます。

## 構成

```text
index.html
firebase-config.js
assets/
  css/
    01-foundation-components-guide.css
    02-seisan.css
    03-app-layout-and-themes.css
    99-final-overrides.css
  js/
    app.js
    modules/
      README.md
```

## 確認方法

ローカルで `index.html` を直接開いても動きやすいようにしています。
より確実に確認する場合は、展開したフォルダで以下を実行してください。

```bash
python -m http.server 8000
```

その後、ブラウザで `http://localhost:8000` を開いてください。

## 次の本格JS分割について

現在のJSは `onclick`、`window`、グローバル状態、Firebase、ドラッグ処理が強く結びついています。
完全分割は、まず `onclick` を `addEventListener` に置き換えてから進めるのが安全です。


## 追加安定化パス

- 外部の性別判定APIを削除し、参加者名を外部へ送信しない形に変更しました。
- 削除・復元・再割り当ての確認を、ブラウザ標準confirmではなくサイト内モーダルへ寄せました。
- ヘッダーに保存状態バッジを追加しました。
- 履歴復元時に現在状態を一時バックアップし、短時間だけ「元に戻す」を表示します。
- ダークモードのモーダル、ドロップダウン、disabled入力欄を調整しました。
- `assets/js/modules/ui.js` に共通UI処理を分離しました。


## 追加ハードニング修正

今回追加した内容：

- 保存データに `schemaVersion = 2` を追加
- 古い保存データ用の `migrateAppData()` を追加
- `safeLocalGet()` / `safeLocalSet()` / `safeLocalRemove()` を追加
- ヘッダー、未割り当て欄など一部の `onclick` を `addEventListener` に移行
- モーダルに `aria-labelledby` / `aria-hidden` を追加
- 主要入力欄に `aria-label` を追加
- `assets/js/modules/storage.js` と `schema.js` を追加
- `03-app-layout-and-themes.css` を順番維持で段階分割
- `99-final-overrides.css` の一部 `!important` を削減
- Firebase同期競合の軽い保留判定を追加
- CDN読み込み失敗時の検知と警告クラスを追加

残っている課題：

- inline event handler 残数：42
- `!important` 残数：1213
- JS完全モジュール化は未完了。既存 `onclick` をすべて外してから進めるのが安全です。


## CSS段階分割

`03-app-layout-and-themes.css` は、カスケード順を変えないように以下へ分割しました。

- `03-app-layout-and-themes.css`
- `03b-guides-and-modals.css`
- `03c-mobile-polish.css`
- `03d-theme-picker.css`
- `03e-late-maintenance.css`

意味別に完全整理するより、まずは**元の順番を保って小さくする**方針です。


## 今回の追加修正

- `clientId` 未定義によって発表ビュー描画が止まる可能性があった箇所を修正
- `getData()` に `schemaVersion` を追加
- ビュー描画専用の `getData()` 呼び出しに不要な `stampSchemaVersion()` が混ざっていた箇所を修正
- `history.js`、`drag-cards.js`、`settlement.js` を classic-script 互換モジュールとして追加し、app.js から実際に利用
- 静的HTML上の inline event handler を追加で削減
- `99-final-overrides.css` の安全な範囲で `!important` を削減
- Playwright の主要画面・ドラッグ確認テストを追加

## 重要

今回、カードドラッグ不可と発表ビューUI欠落の主原因になり得る `clientId` 未定義を修正しています。


## メニュー残り対策

カードの三点メニューが画面に残り続ける問題に対して、以下で閉じるようにしました。

- 外側タップ / クリック
- スクロール / ホイール
- ドラッグ開始
- ビュー切替
- Escキー
- 画面回転 / リサイズ


## カードメニュー表示修正

前回版で `document.dataset` を参照していたため、カードメニュー初期化が止まる問題を修正しました。
`setupCompactPersonMenu.bound` を使う形に変更し、念のため基本クリック用のフォールバックも追加しています。
