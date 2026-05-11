# SAB cleanup report

## 実行内容

### S: JavaScript feature split

`assets/js/app.js` を起動・保存・読込・同期中心に縮小しました。大きなUI機能は次へ分離しています。

| ファイル | 担当 |
|---|---|
| `assets/js/core/data-state.js` | 保存データの取得・復元、固定/性別切替 |
| `assets/js/features/lock-protection.js` | ロック、合言葉、保護メニュー、通知 |
| `assets/js/features/waiting-tray.js` | 未割り当てトレイ |
| `assets/js/features/person-cards.js` | 参加者カード・車カード生成 |
| `assets/js/features/drag-edit-view.js` | 編集画面の手動ドラッグ |
| `assets/js/features/sheet-view.js` | 発表ビュー、クイック編集、ズーム |
| `assets/js/features/auto-assign.js` | 自動割当、性別推定 |
| `assets/js/features/person-menu.js` | 人物メニュー、名前/メモ編集 |
| `assets/js/features/batch-import.js` | 参加者登録、一括取り込み |
| `assets/js/features/share-actions.js` | 共有URLコピー、学年選択 |
| `assets/js/features/debug-history.js` | サンプルデータ、履歴復元 |

### A: CSS patch layer absorption

旧 `07-repair-safety.css` と `08-final-polish.css` は読み込みから外し、内容を `06-structure.css` 後半へ吸収しました。

読み込みCSSは9ファイルから7ファイルになりました。

### B: Long guide HTML externalization

`index.html` 内の長いガイド本文を `assets/js/templates/guide-content.js` に移しました。
`index.html` はモーダル外枠と主要画面構造中心になり、725行から559行へ短縮されました。

## 確認結果

- 全JSファイルの `node --check` OK
- 既存の静的テスト OK
- `!important` 検出 0件
- `index.html` のCSS読み込み順 OK
- 人物メニュー、メモ/名前変更、サンプルボタン、発表ビュー分割の静的チェック OK

## 注意

Playwrightの画面操作テスト `tests/basic-ui.spec.js` は、依存パッケージがzip内にないため未実行です。静的検査では欠陥は見つかりませんでした。
