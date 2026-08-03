# Google Maps機能 実装・検証レポート

日付: 2026-08-03

## 完成した統合

Google Maps機能を既存のCarbon Design System v11画面、精算state、Modal lifecycle、保存処理へ直接統合した。

- `maps-config.js`をAPIキー・言語・地域・version・map IDの単一ownerとして使用
- Maps JavaScript APIを必要時だけ読み込む共有Promiseローダー
- Places API (New) `PlaceAutocompleteElement`
- Google候補選択後の`Place.fetchFields()`によるPlace ID、名称、住所、緯度、経度の取得
- 日本全域をsoft biasとし、日本国外の候補を禁止しない検索
- 選択済み地点だけを対象にした`Route.computeRoutes()`
- 経由地の追加、削除、ドラッグ、キーボード並べ替え
- 有料道路、高速道路、フェリー回避
- 代替ルート候補、推奨ルート初期選択、一覧／地図の双方向選択
- 距離、所要時間、区間情報、有料道路、高速道路、取得可能な料金、主な道路名
- 出発地、経由地、目的地と全ルート候補の地図描画
- 選択ルートを太く濃く、未選択ルートを薄く表示
- 車ごとの精算設定からの起動と、plan ID＋車名による厳密な対象車guard
- `distanceMeters / 1000`のkm変換、往復反映、ガソリン代・精算額・一人あたりの既存再計算
- 戻る、キャンセル、X、browser backによる元の車の費用画面への復帰
- ルート、地点、選択、回避条件、対象車、往復、計算日時の永続化
- request sequenceによる古いレスポンスの破棄
- 認証、quota、通信、ルートなし、Places失敗、地図失敗のCarbon通知
- 明示的なCarbon再試行操作
- ライト／ダーク、モバイル／デスクトップ対応
- runtime-only `dist` build

## Carbon UI

汎用操作には既存bundleの公式Carbon Web Componentsを使用した。

- Modal
- Button／Icon Button
- Checkbox
- Inline Loading
- Inline Notification

ルート候補はCarbon Buttonを使ったARIA radiogroupとして、地図skeletonと業務固有のroute tileはCarbonのlayer、type、spacing、focus、semantic tokenで構成した。GoogleのPlace AutocompleteはGoogle公式widgetの入力UIをそのまま使用している。

## 検証結果

- Google Mapsモック実操作: **72 / 72 PASS**
- 既存機能回帰: **28 / 28 PASS**
- ブラウザ実操作合計: **100 / 100 PASS**
- Static references: **190件、欠落0**
- Google route contract: PASS
- Maps feature lint: PASS
- TypeScript checkJs: PASS
- JavaScript syntax: PASS
- CSS parse: **119ファイル、エラー0**
- Legacy Directions／Distance Matrix runtime参照: 0
- 後付け`99-*`／override file: 0
- Static build: PASS
- source／dist主要10ファイルhash一致
- APIキー文字列のsource内所有者: `maps-config.js` 1ファイルのみ

確認した操作には、文字入力だけではAPIを呼ばないこと、Places選択、代替ルート、地図クリック、一覧クリック、キーボード選択、経由地、回避設定、競合破棄、エラー再試行、状態復元、対象車だけへの適用、往復、精算再計算、戻る動作を含む。

再開後の再監査で、JavaScriptとCSSには存在していたCarbon再試行操作のHTML本体が欠落していることを検出した。`routeDistanceModal`の正式なownerへ`routePlannerRetry`と`routePlannerRetryBtn`を追加し、再試行専用5項目を含む100項目を再実行して全件成功した。

## Carbon vendor build

欠落していた`tools/build-carbon-assets.mjs`を復旧した。CIでは`npm ci`後に、固定versionからCarbon bundleとライセンスを再生成できる。

この実行環境ではnpm proxyが`@carbon/web-components@2.60.0`および`@playwright/test@1.61.0`を404で返したため、Node依存の再取得は実行できなかった。lockfileは変更せず、既存のローカルCarbon bundleの構文・runtime・source／dist一致と、Python Playwright＋Chromiumによる同等の実ブラウザ回帰を確認済みである。

## 実API確認の制約

実Google APIを使うlive testを用意したが、この実行環境では次の外部アクセス制限により完走できなかった。

- 公開URL: administrator policyで遮断
- Google Maps host: DNS解決不可

そのため実APIの最後の確認は、設定済みHTTPリファラーに一致するHTTPS公開URLで次を実行する。

```bash
GOOGLE_MAPS_LIVE=1 \
GOOGLE_MAPS_LIVE_BASE_URL=https://<許可済み公開URL> \
npm run test:maps:live
```

APIキーはレポートやテスト結果へ複製していない。

## Google側の仕様として残る挙動

- 中間経由地がある場合、代替ルートは返らない。
- 代替ルートは常に同じ件数が返るとは限らない。
- 経由地は最大25件で、11件以上は料金区分が変わり得る。
- 回避設定は優先指定であり、有料道路などを絶対に含まない保証ではない。
- 高速料金はGoogleが推定料金を返した場合だけ表示する。
