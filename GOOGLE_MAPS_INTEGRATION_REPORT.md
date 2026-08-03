# Google Maps / Carbon Route Planner Integration Report

更新日: 2026-08-03  
対象: `circle-kikaku-tools`

## 結論

各車の精算設定から開くGoogle Maps距離計算を、既存の精算state、Modal controller、Carbon Web Components、保存処理へ直接統合した。

旧Places API、Directions Service、Distance Matrix Serviceは使用していない。場所検索はPlaces API (New) の`PlaceAutocompleteElement`、経路計算はMaps JavaScript APIのRoutes libraryにある`Route.computeRoutes()`、地図表示はMaps JavaScript APIを使用する。

本番コードに固定距離・ダミールートは含めていない。テスト用Google mockは`tests/`内だけに隔離している。

## 設定とキー管理

- 実行時設定は`window.SANPO_GOOGLE_MAPS_CONFIG`だけを参照する。
- 実キーは生成物`maps-config.js`の1箇所だけに格納する。
- ソース管理向けの雛形は`maps-config.example.js`。
- CI／配信環境では`SANPO_GOOGLE_MAPS_API_KEY`から`npm run build:maps-config`で生成できる。
- `maps-config.js`は`.gitignore`対象。配布ZIPには、依頼された制限済みキーで生成したファイルを同梱している。

## 実装構造

### JavaScript owner

- `assets/js/features/settlement/route-helper/01-model.js`
  - stateの正規化、永続化、選択ルート復元
- `02-google-loader.js`
  - Maps JavaScript APIの単一ロード、`maps`／`places`／`routes`／`geometry` library取得、エラー分類
- `03-route-service.js`
  - `Route.computeRoutes()`、waypoint、routeModifiers、toll計算、候補の正規化・重複排除
- `04-map-view.js`
  - 地図、全候補Polyline、地点marker、選択同期、viewport fitting
- `05-controller.js`
  - Places widget、経由地UI、競合制御、履歴、車への適用、Carbon loading/error/state
- `assets/js/features/settlement/04-route-helper.js`
  - 既存読み込み順との互換facade

### Template / CSS owner

- `assets/js/templates/settlement/08-route-helper-templates.js`
- `assets/css/settlement/route-helper/01-route-shell.css`
- `02-route-stops.css`
- `03-route-candidates.css`

包括的な`99-*`、override、final-fixは追加していない。

## 場所検索

- `PlaceAutocompleteElement`を出発地・経由地・目的地ごとに生成。
- 日本の範囲へ`locationBias`を設定し、海外地点を完全排除しない。
- 表示言語`ja`、地域`jp`、メートル法を指定。
- `gmp-select`後に`Place.fetchFields()`を実行し、次を保持する。

```js
{
  placeId,
  name,
  address,
  latitude,
  longitude
}
```

候補選択後だけルートを再取得する。選択後の文字列が編集された場合はPlaceを無効化し、文字列だけでは計算しない。

## 経由地

- 最大8地点を追加可能。
- Carbon Button／Icon ButtonとSortableで追加、削除、並び替え。
- 表示順のまま`intermediates`へ渡す。
- 変更時は選択済みrouteを破棄し、全地点がGoogle候補として確定している場合だけ再取得する。

## ルート取得

基本request:

- `travelMode: DRIVING`
- `routingPreference: TRAFFIC_AWARE_OPTIMAL`
- `computeAlternativeRoutes: true`（経由地なし）
- `routeModifiers.avoidTolls`
- `routeModifiers.avoidHighways`
- `routeModifiers.avoidFerries`
- `extraComputations: TOLLS`
- `polylineQuality: HIGH_QUALITY`
- 必要fieldだけを指定

Googleの現行仕様では中間waypoint付きrequestに代替ルートが返らないため、その場合は既定routeに加え、実際のRoutes APIへ「高速回避」「有料回避」等の追加requestを最大2件行い、同一polylineを重複排除する。固定候補は作成しない。

## 候補データ

```js
{
  id,
  label,
  distanceMeters,
  durationSeconds,
  legs,
  viewport,
  polyline,
  hasTolls,
  hasHighways,
  tollPrice,
  mainRoads,
  routeLabels,
  isRecommended
}
```

- 既定routeを推奨として先頭選択し、経由地なしではAPIが返す既定route＋最大3件の代替routeを省略せず表示する。
- 高速道路利用はdescription／step instructionからの推定であることをUIに表示。
- 料金情報はGoogleが返した場合だけ表示。
- 候補は公式Carbon Selectable Tileで表示し、radio semanticsとArrow／Home／End操作を持つ。

## 地図同期

- 出発地、各経由地、目的地markerを表示。
- 全route候補をPolyline表示。
- 選択routeはCarbon Blueで太く、その他は薄く表示。
- Polyline clickと候補tile選択を双方向同期。
- route変更時に全候補のviewportへfit。
- map loading／failureをCarbon Skeleton／Inline Loading／Inline Notificationで表示。

## 距離と精算連携

表示項目:

- 各legの距離・時間
- 合計距離・合計時間
- 往復距離
- 選択中route
- 有料道路、高速道路、料金、主な道路

route helperを開く前に、現在編集中の車名を`targetCarId`として確定する。適用時は、そのIDが現在の精算stateに存在することを再確認し、他の車へfallbackしない。

```js
kilometers = selectedRoute.distanceMeters / 1000
appliedDistance = roundTrip ? kilometers * 2 : kilometers
```

適用後は既存`normalizeCarSettlementState()`、`renderSettlementView()`、`save()`を通し、ガソリン代、精算額、一人当たり等の既存計算を再実行する。

## 戻る・キャンセル

- route helperを開く前に車両費draftを保存。
- 車両費Modalを閉じてroute helperを開く。
- X、キャンセル、Escape、ブラウザBack／戻るgestureでroute helperを閉じる。
- `targetCarId`と`returnTo:'carSettlement'`を読み、同じ車の車両費Modalを開き直す。
- 適用後も同じ車へ戻る。

## 保存state

```js
{
  origin,
  waypoints,
  destination,
  routes,
  selectedRouteIndex,
  avoidTolls,
  avoidHighways,
  avoidFerries,
  targetCarId,
  returnTo,
  roundTrip,
  calculatedAt
}
```

既存settlement state内へ保存し、再度開いた際に検索地点、候補、選択、設定、対象車を復元する。

## API呼び出し・競合対策

- 文字入力中はrequestしない。
- 地点選択、経由地変更、modifier変更後だけdebounceして取得。
- 同一request keyの同時実行を共有。
- 最後に成功したrequest keyを保持して不要な再取得を抑制。
- `requestSequence`で古いresponseを破棄。
- Modal close時にpending stateを無効化。

## エラー表示

Carbon Inline Notificationで以下を区別する。

- API key／HTTP referrer／API制限
- quota
- 通信失敗
- Maps／Places／Routes library読み込み失敗
- Google候補未選択
- routeなし
- 候補取得失敗
- map読み込み失敗
- 適用先の車なし

## Carbon UI

使用部品:

- Modal／Modal Close Button
- Button／Icon Button
- Checkbox
- Toggle
- Selectable Tile
- Inline Loading
- Inline Notification
- Skeleton Text
- Tag

390pxではmap、地点、設定、候補、summaryを縦に配置し、footer actionを固定する。768px以上ではmapとroute panelを2カラム表示する。Light／Darkのlayer、border、text、selected、focusは既存Carbon tokenに従う。

## 検証結果

| 種別 | 成功 | 失敗 |
|---|---:|---:|
| 静的Carbon／Maps契約 | 23 | 0 |
| Maps専用実操作（390／1280、Light／Dark） | 228 | 0 |
| 全アプリMaps結合（390／768／1280、Light／Dark） | 132 | 0 |
| 既存全画面回帰（390／1280、Light／Dark） | 220 | 0 |
| TypeScript型チェック | 1 | 0 |
| JavaScript／MJS構文 | 87 | 0 |
| CSS構造 | 119 | 0 |
| indexローカル参照 | 192 | 0 |
| **合計確認項目** | **1002** | **0** |

Maps専用テストでは、検索候補確定、未確定文字列のAPI抑制、APIが返す4候補すべての保持・表示・描画、推奨、keyboard選択、map/list同期、waypoint追加・削除・並べ替え、3modifier、保存復元、往復、対象車限定適用、再計算、戻る、古い対象車の誤利用防止、request競合、API error、no-routeを確認した。

## 外部Googleサービスの最終受入

この実行環境では`maps.googleapis.com`をDNS解決できず、npm依存tarballもローカルcacheに存在しなかった。また、制限済みHTTP referrerの本番originへ今回の作業コピーを配信できないため、実キーを使用したGoogle本番応答とnpm依存を使うbuild／Stylelint／Node Playwrightだけはここでは実行していない。生成済みCarbon assetの契約、型、構文、Python Playwright Chromium回帰は実行済みである。

本番originで実APIを検証する`tests/maps-route-helper.live.spec.js`を追加済み。次で実行する。

```bash
MAPS_LIVE_TEST=1 \
MAPS_LIVE_BASE_URL=https://<HTTPリファラー許可済みの配信先>/ \
npm run test:maps:live
```

GitHub Actionsの`maps-live`jobも、手動実行＋`MAPS_LIVE_BASE_URL`設定時だけ起動する。


設定・配布方法は`GOOGLE_MAPS_SETUP.md`、要件ごとの対応は`GOOGLE_MAPS_REQUIREMENTS_MATRIX.md`を参照。
