# Code cleanup notes

今回の整理は、動作への影響が小さい範囲に絞っています。

## CSS

- 古い `member-card` / `driver-seat` 全体を性別で塗るCSSを削除
- 現在使っていない `gender-badge` 系CSSを削除
- `03e-late-maintenance.css` の重複CSSルールを削除
- `03e-late-maintenance.css` と `04-waiting-tray.css` の `!important` を安全寄りに削減

削除量の目安：

```json
{
  "01-foundation-components-guide.css": 646,
  "03e-late-maintenance.css": 1020,
  "03e_duplicate_rules": 854
}
```

`!important` 削減：

- `03e-late-maintenance.css`: 127 → 37（90個削減）
- `04-waiting-tray.css`: 13 → 3（10個削減）

## JS

- `byId(id)` と `bindClick(id, handler)` を追加
- 直近でよく触る待機タブ・ドラッグ・発表ビュー周りの `document.getElementById(...)` を一部 `byId(...)` に置換
- ドラッグ中スクロール処理の中身は前回復元した状態を維持

## CSS stats

```text
01-foundation-components-guide.css     bytes= 40682 important=  62 braces=286/286 data-gender=0
02-seisan.css                          bytes= 10861 important=   2 braces=94/94 data-gender=0
03-app-layout-and-themes.css           bytes= 19251 important=  15 braces=163/163 data-gender=0
03b-guides-and-modals.css              bytes= 38604 important= 101 braces=325/325 data-gender=0
03c-mobile-polish.css                  bytes= 12323 important=  94 braces=112/112 data-gender=0
03d-legacy-theme-mobile-overrides.css  bytes= 58331 important= 609 braces=307/307 data-gender=0
03d-theme-picker-cleanup.css           bytes=  2756 important=   0 braces=14/14 data-gender=0
03d-theme-picker.css                   bytes= 10811 important=   0 braces=75/75 data-gender=0
03e-late-maintenance.css               bytes= 21453 important=  37 braces=154/154 data-gender=17
04-person-cards.css                    bytes=  1451 important=   0 braces=11/11 data-gender=0
04-waiting-tray.css                    bytes= 12218 important=   3 braces=73/73 data-gender=0
99-final-overrides.css                 bytes=  2932 important=   0 braces=7/7 data-gender=0
```

## 2026-05 compact density reset

ユーザー指定に合わせて、前回のような大きなレイアウト変更ではなく、余白・高さ・文字サイズの微調整に戻しました。

- `108-density-restore.css` を追加し、最終調整を1ファイルに分離
- スマホでも精算サマリー3カードを横並びに戻した
- 企画者選択と企画者チェックを2列の横並びに戻した
- 車ごとの費用入力と諸経費入力を横並びに戻した
- 車割・発表・精算タブの実テキストを短くし、疑似要素に依存しない表示に整理
- 既存JSの動作は変更なし

## 2026-05-10: 精算画面の0人時表示
- 参加者が0人のときは精算画面の入力UIを非表示にし、参加者登録へ誘導する空表示だけを出すようにしました。
- 既存レイアウトは変更せず、表示切り替えは `toggleSettlementEmptyState()` に分離しています。
