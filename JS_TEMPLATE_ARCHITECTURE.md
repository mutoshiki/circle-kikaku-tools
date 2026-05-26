# JSテンプレート構成

精算画面のHTMLテンプレートは、`assets/js/templates/settlement/` に分割して管理します。
外部からの呼び出し口は従来通り `window.SanpoApp.templates.settlement` です。

## 読み込み順

`index.html` では、次の順で読み込みます。

1. `00-template-utils.js`：共通ヘルパーとCSSクラス契約
2. `01-cost-parts.js`：金額、タグ、費用行
3. `02-summary-templates.js`：サマリーと内訳
4. `04-extra-input-templates.js`：諸経費入力行
5. `03-car-cost-templates.js`：車別費用カードと車入力カード
6. `05-collection-check-templates.js`：集金チェック
7. `06-driver-pay-templates.js`：車出しへの支払チェック
8. `07-empty-state-templates.js`：空状態
9. `08-route-helper-templates.js`：移動距離計算ツール
10. `09-register-settlement-templates.js`：公開APIへの登録
11. `settlement-templates.js`：互換用の薄い再登録入口

`04-extra-input-templates.js` は `03-car-cost-templates.js` より前に読み込みます。車入力カード内で `extraRow` を使うためです。

## 公開API

呼び出し側は、分割後も次の形を使います。

```js
window.SanpoApp.templates.settlement.summary(...)
window.SanpoApp.templates.settlement.carRow(...)
window.SanpoApp.templates.settlement.collection(...)
```

公開名を変えないことで、`features/settlement/*.js` 側の変更を最小限にします。

## テンプレート側の責務

テンプレートは文字列を返すだけにします。

- DOMを書き換えない
- イベントを登録しない
- 状態を書き換えない
- `data-action` など、イベント処理に必要な属性だけを出力する

状態変更やクリック処理は、`features/settlement/` とイベント管理側で扱います。

## テスト

`tests/settlement-template-split-check.js` で次を確認します。

- 分割ファイルが存在すること
- `index.html` の読み込み順が正しいこと
- 従来の公開API名が残っていること
- `settlement-templates.js` が薄い互換入口になっていること

既存テストでテンプレート全体を見る場合は、`tests/helpers/read-project.js` の `readSettlementTemplateBundle()` を使います。

## 発表ビュー機能

発表ビューは表示、同期、入力操作を分けて読み込みます。

1. `features/sheet/00-data-sync.js`: クイック編集のスナップショット保存と本データ同期
2. `features/sheet-view.js`: 発表ビューの描画とタイムテーブル HTML
3. `features/sheet/01-drag-interactions.js`: カードのポインター/タッチ移動
4. `features/sheet/02-viewport-controls.js`: パン、ズーム、表示上の入力イベント

HTML やテンプレートには inline handler を置かず、動的操作は `data-action` または `addEventListener` で所有します。互換用の `window` 公開関数は既存画面から呼ばれる薄い入口に限ります。
