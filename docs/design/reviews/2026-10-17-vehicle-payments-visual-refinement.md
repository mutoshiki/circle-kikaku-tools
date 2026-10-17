# 各車への支払い：表示調整レビュー記録

## 対象と出所

- 対象：精算タブの「各車への支払い」
- worktree：`C:\Users\toshi\.codex\worktrees\site-type-spacing\circle-kikaku-tools`
- branch / HEAD：`codex/site-typography-spacing` / `6b24c165445f0131c526c4f2af26efe15efb675f`
- 公開manifest基準：`851cb1a4c90fde012ad84eee47a3403689dac9ef`
- preview：`http://127.0.0.1:4280/?room=TYPE-SPACING-20261017&view=seisan`
- データ：ローカル専用の合成サンプル。公開ルームやFirebaseへは接続していない。

## 実施結果

- 車articleの下線を外し、車ごとの間隔を16pxにした。開閉部はCarbon Accordionの標準線を使い、隣接する二重線がないことを確認。
- 費用行と調整行を14px/400/18pxに統一。車名16px/600/22px、支払額20px/600/28px、ラベル14px/400/18pxを維持。
- ラベルと支払額のgapは8px。割勘・部費は0円を含めて別表示。長額は縮小・隣列への重なりを避け、ラベルの下へ折り返す。
- `@carbon/type` の `font-weight('semibold')` と `@carbon/layout` の `spacing-02`〜`spacing-05` をインストール済みソースで確認。Carbon MCP再監査ではGrid提案1件（情報）だけが残った。意味構造が定義リストの二列であるため置換していない。

## ブラウザー確認

| 幅・高さ | テーマ | 状態 | 確認内容 | 結果 |
| --- | --- | --- | --- | --- |
| 390×844 | ライト | 1台の内訳を展開 | screenshot、14px/18px調整行、20px/600支払額、8pxラベル間隔、16px車間、横overflow | 合格。横overflowなし |
| 390×844 | ダーク | 1台の内訳を展開 | screenshot、同上のcomputed style、Carbon標準境界線 | 合格。横overflowなし |
| 1280×900 | ライト | 1台の内訳を展開、他車は閉じる | full-page screenshot、支払列・内訳・車間 | 合格。横overflowなし |
| 1280×900 | ダーク | 1台の内訳を展開、他車は閉じる | full-page screenshot、14px調整行、車境界 `border: none` | 合格。横overflowなし |
| 1280×900 | ライト | 費用編集modalを開いて閉じる | dialog表示、閉じるボタン後のフォーカス復帰 | 合格。起動ボタンへ復帰 |
| 1280×900 | ライト | 参加者タブ | 隣接画面の文字・余白、タブ移動 | 合格。変更の漏れなし |

上記のブラウザー画像は確認時にサイドブラウザーへ表示した。画像ファイル自体はレビュー資料へ保存していない。

## 自動確認

- `vehicle settlement presents`, `settlement rows wrap`, `payment amounts fit`, `one payment category`, `zero net payment`：Chromium desktop/mobile 10/10 passed、WebKit desktop/mobile 10/10 passed。
- 対象確認は計算結果・別区分表示・0円・相殺費用・長い名前／金額・320/375/390/1280幅・両テーマ・AccordionのEnter/Space・focus・localStorage不変を含む。
- `npm.cmd run build:preview -- --baseline-source-sha 851cb1a4c90fde012ad84eee47a3403689dac9ef`：成功。
- `npm.cmd run check:preview -- --url http://127.0.0.1:4280/ --expected-source-sha 851cb1a4c90fde012ad84eee47a3403689dac9ef`：成功。worktreeの現在のsource fingerprintと配信中資産を照合。
- `git diff --check`：成功。文字コードのLF→CRLF警告のみ。
- buildは大きなchunk（500kB超）の警告を出すが、buildは成功。今回の変更とは別の既存バンドル構成。

## 未検証・制約

- 200%ブラウザーzoomはサイドブラウザーの操作APIでは適用できず未検証。通常の狭幅と320px幅のPlaywright確認は通過。
- 物理端末、スクリーンリーダー、実機Safariの確認はしていない。WebKit自動テストは通過。
- 見た目以外の既存システム全体テストは実行していない。
- push・本番公開は行っていない。
