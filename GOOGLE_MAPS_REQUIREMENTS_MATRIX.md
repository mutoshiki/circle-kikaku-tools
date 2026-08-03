# Google Maps 統合 要件適合表

更新日: 2026-08-03

| 要件 | 実装 | 主なowner／検証 |
|---|---|---|
| 1. Places (New)検索 | `PlaceAutocompleteElement`、日本bias、Google候補選択後にPlace ID・名称・住所・緯度経度を保持。文字列だけでは計算しない | `route-helper/05-controller.js`、Maps focused smoke |
| 2. 経由地 | 最大8件の追加・削除・Sortable並べ替え。表示順で`intermediates`へ渡し、確定後だけ再取得 | controller、route service、reorder test |
| 3. 回避設定 | 有料・高速・フェリーを`routeModifiers`へ反映し、変更時に再取得 | controller、route service、modifier tests |
| 4. 複数候補 | 経由地なしはAPIが返す既定＋最大3代替をすべて保持。経由地ありは現行API制約に合わせ、実APIへの条件違いrequestを最大2件追加 | route service、4-candidate test |
| 5. 地図 | 出発地・経由地・目的地marker、全候補Polyline、選択routeを太いCarbon Blueで表示。線clickと一覧選択を同期 | `04-map-view.js`、map/list sync tests |
| 6. 距離表示 | 各leg距離・時間、合計距離・時間、往復距離、選択中routeを表示 | template、summary tests |
| 7. 車別連携 | 車両費Modalのショートカットだけをproduction entryとし、`targetCarId`を確定 | car template、controller |
| 8. 距離適用 | 選択routeのmeterをkmへ変換し、往復設定を反映。対象車の存在を再確認し、他車へfallbackせず既存再計算・保存を実行 | controller、exact-car apply test |
| 9. 戻る | X、キャンセル、Escape、browser Backで同じ車の車両費Modalへ戻る | modal controller、history処理、return tests |
| 10. Carbon | Modal、Button、Checkbox、Selectable Tile、Inline Loading、Inline Notification、Skeleton、Tagを既存theme／responsiveへ統合 | HTML、route CSS、Carbon contracts |
| 11. 状態保持 | 指定state一式に加えroute metadataを既存settlement stateへ保存。閉じて再表示した際に候補・選択・mapを復元 | model、restore tests |
| 12. エラー | key／referrer／quota／通信／未選択／routeなし／候補／map読み込みをCarbon通知。sequenceで古いresponseを破棄 | loader、controller、error/race tests |
| 13. 実装方針 | 実API adapter、固定距離なし、キー1箇所、JSDoc型チェック、owner分割、mobile first | source contracts、typecheck、key audit |
| 14. 完了確認 | 静的23、Maps focused 228、全アプリMaps結合132、全画面Carbon回帰220、型・構文・参照監査を実施 | 各result JSON／最終レポート |

## 現行Google仕様に由来する表示上の注意

- 中間waypoint付きrequestでは、`computeAlternativeRoutes`を有効にしてもネイティブ代替routeは返らない。そのため固定データを作らず、同じ地点を使った実Routes requestの条件違い候補を追加する。
- 高速道路利用の直接Booleanはレスポンスにないため、route descriptionとstep instructionから推定し、UIにも「道路名から推定」と明記する。
- toll価格はGoogleが返した場合だけ表示する。価格不明でもtoll存在が返された場合は「料金不明」と表示する。
