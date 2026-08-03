# Google Maps / Places (New) / Routes integration

更新日: 2026-08-03

## 目的

各車の精算設定からGoogleの地点候補とルート候補を使って移動距離を取得し、開いた車だけへ距離を反映する。旧Places API、Directions API Legacy、Distance Matrix API Legacyは使用しない。

## APIと読み込み責務

- `maps-config.js`: ブラウザAPIキー、language、region、version、mapIdの唯一の設定owner。
- `assets/js/core/google-maps-loader.js`: Maps JavaScript API scriptの唯一の生成owner。遅延読み込み、Promise共有、タイムアウト、ネットワーク失敗、`gm_authFailure`、再試行を管理する。
- Places: `AutocompleteSuggestion.fetchAutocompleteSuggestions()`で候補データを取得し、Carbon Text Inputを使う検索サブ画面へ表示する。選択後に`PlacePrediction.toPlace()`と`Place.fetchFields()`でID・名称・住所・座標を取得する。
- Routes: Maps JavaScript APIの`google.maps.routes.Route.computeRoutes()`。文字列ではなく選択済みPlaceまたは座標を渡す。
- Map: Maps JavaScript API `Map`、`Polyline`、Marker/AdvancedMarkerで全候補と全地点を描画する。

## 状態owner

`assets/js/features/settlement/01-state.js`の`settlementState.routePlanner`が永続状態を所有する。

```ts
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
  targetCarName,
  returnTo,
  roundTrip,
  calculatedAt
}
```

地点は `{ placeId, name, address, latitude, longitude }`、ルートは距離・時間・legs・viewport・encoded polyline・toll/highway情報を保持する。入力中の未選択文字列は状態へ保存せず、Routes APIを呼ばない。

## 車連携

1. 車ごとの費用モーダルから開く。
2. `targetCarId = planId + encoded car name`と`targetCarName`を保持する。
3. 車費用モーダルの未保存内容を先にDOMからstateへ同期する。
4. 適用時は現在のplanと対象車名からtargetCarIdを再計算し、一致しない場合は反映しない。
5. `selectedRoute.distanceMeters / 1000`をkmへ変換し、往復時は2倍する。
6. 対象車の`dist`だけを更新し、既存の`renderSettlementView({ force: true })`と`save()`でガソリン代・精算額・一人あたりを再計算する。
7. X、戻る、キャンセル、browser backは元の車費用モーダルを復元する。

## API呼び出し制御

- 出発地と目的地がGoogle候補から選択済みの場合だけ計算する。
- 地点選択、選択済み経由地の削除・並べ替え、回避設定変更時だけ再取得する。
- 空の経由地追加や文字入力中は取得しない。
- `requestSequence`で古いレスポンスを破棄する。
- 経由地は最大25件。11件以上はGoogle側の課金区分が変わり得るため、追加数を増やす設計変更時は料金も再確認する。
- Googleの仕様上、中間経由地を含む単一リクエストでは代替ルートが返らない。そのため、地点間を区間へ分割し、各区間を`computeAlternativeRoutes: true`で取得する。
- 各区間の候補は所要時間順の上位3件へ制限し、組み合わせ段階ごとに上位候補だけを残す。最終候補は距離・時間・legs・polylineを合算して最大3件へ制限する。
- 区間リクエストは回避条件と地点IDを含む短時間キャッシュを利用し、同一条件の不要な再取得を抑制する。

## Carbon UI owner

- `index.html`: Carbon Modal、Accordion、Button、Icon Button、Text Input、Checkbox、Inline Loading、Inline Notificationの構造。
- `assets/css/settlement/route-helper/01-route-shell.css`: モーダル、地図、responsive layout。
- `02-route-stops.css`: origin/waypoint/destinationの同率地点行、常設追加枠、縦コネクター、drag state、48px controls。
- `03-route-candidates.css`: route selection rows、metrics、leg/total summaries。
- `assets/js/templates/settlement/08-route-helper-templates.js`: waypoint、route candidates、leg summary。

業務固有の地図とルート候補はCarbonのlayer/type/spacing/focus/semantic colorで構成し、汎用操作は公式Carbon Web Componentsを使う。

## テスト

- `tests/google-route-planner-contract.mjs`: API・state・legacy禁止・car guard・race guard。
- `tests/google-maps-loader.spec.js`: network/auth失敗後のclean retry。
- `tests/google-route-planner.spec.js`: Places選択、候補、地図同期、経由地、設定、exact-car apply、browser back、race。
- `tests/google-route-planner-live.spec.js`: 許可済みHTTPS referrerでのみ実行する有料live check。
- `tools/lint-google-route-planner.mjs`: key single owner、legacy API禁止、構文、route CSS owner。
- `tsconfig.maps.json`: route planner JavaScriptの型検査。
