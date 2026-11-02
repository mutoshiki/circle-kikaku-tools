# Googleマップでの距離確認ガイドと本番公開復旧の実装計画

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. 必要な範囲だけ検証し、成功済み同SHAのcheckを理由なく再実行しない。

**Goal:** 利用者がGoogleマップで確認した車の移動距離をサイトへ入力し、既存のガソリン代・タイムズ料金・精算に使えるようにする。Maps APIへの依存を公開条件から取り除く。

**Architecture:** 現在の車費用編集にある距離入力を残し、ルート自動計算の入口を画像付き操作ガイドへ置き換える。ガイドから通常のGoogleマップリンクを開く。検索・ルーティング・距離の自動取得はサイト側で行わない。既存のFirebaseと精算計算を再利用する。

**Tech Stack:** 既存React/Vite、Carbon、Firebase Authentication／Realtime Database、Playwright、GitHub Actions／Pages。外部API・地図SDK・追加サーバーは不要。

**Spec:** 2026-11-02のユーザー指定：添付4画像を使用し「検索→経路→経由地を追加→距離の確認」を案内する。操作を理解してからGoogleマップを開き、サイトへ戻って入力する。文言は自然なものへ変更可。「次回から表示しない」を設ける。今回は計画書修正のみ。

## 1. 今回の方針決定

- **Google Maps APIの自動計算から、Googleマップアプリ／Webで確認して入力する方式へ変更する。**
- Geoapify・ORSへの移行、provider factory、無料quota管理、APIキー発行、品質比較は今回の計画から取り除く。
- 一時的なCSS非表示は最終形にしない。距離入力の横／下に、使えるガイド入口を表示する。
- ユーザー指定の文言は意味を保って調整する。「移動距離を計算する」はサイト内で自動計算する印象があるため、入口を **「Googleマップで距離を確認」** とする。
- 「理解しました」は押した後の動作が分かる **「Googleマップを開く」** にする。別途の理解確認操作は設けない。
- 希望されたチェックボックス **「次回からこの説明を表示しない」** を追加する。共有企画の設定にはせず、ブラウザー単位で記憶する。
- Maps URLsはAPIキーなしで利用できる。Google Cloudの有料化・Maps API復旧を実装／公開の前提にしない。[Google公式：Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)

## 2. 現状の問題と調査済みの根拠

以下は前回調査時の状態であり、今回再公開や再診断はしていない。

- [公開run 41405070638](https://github.com/mutoshiki/circle-kikaku-tools/actions/runs/41405070638) は、main Readinessとbuild成功後、compatibilityの本番smokeで停止。`apps/react/tests/production/production-smoke.spec.js:159` の東京駅検索結果が表示されず、Chromium／WebKitとも失敗した。
- root公開はskip、P9 cleanupは成功。調査時のroot manifestは `e1c43ff3693d8d6a992e276b71c117b878b13e54`、`/react/` は検証対象の `4fe614ad9f517a46647b3f481c66c6980589049d`。root更新済みとは扱わない。
- Google Cloudでは無料トライアル終了を確認。一方、APIキー3にはMaps JavaScript／Places (New)／Routesと本番originが許可されていた。先行プローブの403の直接原因を「許可不足」「課金だけ」と断定しない。
- `src/runtime.js:179` は `debugSample=all-tools` で `routeService: null` とする。それでも検索UIが出るため、サンプルで `Cannot read properties of null (reading 'search')` が発生した。新ガイドは外部APIが不要なので、この食い違いも解消できる。
- 既存production smokeはGoogle実APIを必須にし、workflowもGoogleキーを常時必須にしている。ボタンをCSSで隠すだけでは公開停止を解消できない。

**結論:** 現行Google APIの追加調査・課金契約修正は、この機能の完成条件から外す。実装した機能が「外部リンク案内＋距離手入力」へ変わるため、本番テストもその実動作へ置き換える。

## 3. 画面・操作フロー

### 3.1 距離入力画面

ガソリン代／タイムズ移動料金の設定画面内で、既存の「移動距離（km）」入力に続けて、補助操作「Googleマップで距離を確認」を表示する。既存の燃費・単価・負担区分・計算プレビュー・適用操作を再利用する。

通常時の流れ：

1. 「Googleマップで距離を確認」を押す。
2. 操作ガイドを表示する。
3. 「Googleマップを開く」を押す。
4. Googleマップで距離を確認する。
5. 元のサイトへ戻り、「移動距離（km）」に入力する。
6. 既存の適用→費用保存で精算へ反映する。

距離欄への手入力はガイドを開かなくても利用できる。Googleマップから距離が自動で戻るような表示や挙動は作らない。

### 3.2 ガイドの構成・採用文言

**見出し：Googleマップで移動距離を確認**

既存 `CarEditor` の同じComposedModal内で、表示内容を `distance-guide` へ切り替える。新しいmodalを上に重ねない。スマホでは本文だけ縦スクロールし、フッターの操作へ到達できる構成にする。4手順は同一画面に並べ、カルーセルや「次へ」の4段階操作は増やさない。

| 手順 | 見出し | 本文 | 添付画像 |
|---|---|---|---|
| 1 | 目的地を検索 | Googleマップで目的地を検索します。 | 写真1：「ここで検索」 |
| 2 | 車の経路を表示 | 「経路」を押し、移動手段を車にして、出発地を設定します。 | 写真2：「経路」 |
| 3 | 立ち寄る場所を追加 | 必要な場合は「経由地を追加」から、立ち寄る場所を順番に追加します。 | 写真3：「経由地を追加」 |
| 4 | 距離を確認して入力 | 表示された「km」を確認し、このサイトに戻って「移動距離（km）」へ入力します。 | 写真4：「39 km」 |

4の補足は **「往復の場合は、帰りの分も含めて確認してください。」** の1文。例の39kmを初期値や自動入力値にしない。車ごとに経路が異なる場合は各車の距離を入力し、人数倍はしない。往復を機械的に2倍にする機能も追加しない。

フッター：

- チェックボックス：「次回からこの説明を表示しない」
- 補助ボタン：「戻る」→ガソリン代／タイムズ料金の設定へ戻る。
- 主ボタン：「Googleマップを開く」→Googleマップへ移動し、元画面は距離入力に戻しておく。

「ナビ開始」「開始」を押す案内は不要。ルートの距離を読むだけでよい。Googleマップのバージョンにより「経由地を追加」が別の位置・メニューにある場合に備え、3の行だけ「見当たらない場合は、右上のメニューから経由地を追加します。」を補足候補とする。実機で必要性が確認できた場合に採用する。[Google公式：経路と経由地](https://support.google.com/maps/answer/144339?co=GENIE.Platform%3DiOS&hl=ja)

### 3.3 添付画像の利用

使用する元画像：

1. `C:/Users/toshi/.codex/codex-remote-attachments/01a11e42-00c7-7603-a581-403c6c082f72/6CCC97D2-F9D3-4857-9EC6-269860781FD9/1-写真1.jpg`
2. 同ディレクトリの `2-写真2.jpg`
3. 同ディレクトリの `3-写真3.jpg`
4. 同ディレクトリの `4-写真4.jpg`

実装時に `apps/react/public/images/distance-guide/` へWeb用の4画像として配置する。今回はコピー・変換を実施しない。

- 写真1は検索欄を中心に整え、不要な時刻／背景の面積を減らす。写真2〜4も対象操作・距離が読める範囲にそろえる。
- Googleロゴ等の必要な表示・帰属は消さない。架空のGoogle UIへ描き換えない。加工前に公開利用の条件を確認する。
- 画像ごとにサイズ・縦横比を指定し、390px程度の幅で文字を読めるようにする。4枚を小さなサムネイルに押し込まない。
- 操作説明は必ずHTMLテキストでも記載する。画像が読めない／読み込めない場合も手順が分かるようにする。代替テキストは「Googleマップの検索欄」「目的地の『経路』ボタン」「『経由地を追加』ボタン」「経路の距離『39 km』の表示」とする。
- 添付画像はiPhone版の操作例であり、全端末で配置まで同一とは扱わない。本文に不要な注意書きを大量追加せず、実機で行き詰まる箇所だけ調整する。

### 3.4 「次回から表示しない」の仕様

- 初回は未チェック。チェックを付けて「Googleマップを開く」を押したときに、そのブラウザーへ記憶する。戻る／閉じるだけでは設定を確定しない。
- 設定後は、入口の「Googleマップで距離を確認」から直接Googleマップを開く。
- 省略設定が有効な場合だけ、入口の近くに小さな「操作方法」を表示し、いつでもガイドを再表示できるようにする。
- 再表示したガイドでチェックを外して「Googleマップを開く」を押せば、次回から案内を表示する。
- 企画全体や別端末とは共有しない。通常はブラウザーlocalStorageへ、例として `sanpo:google-maps-distance-guide:v1:hidden` を保存する。画像／手順の大幅変更時だけバージョンを更新する。
- サンプルでは既存の隔離storageを使い、通常利用の設定を変えない。保存不能時は毎回ガイドを表示するだけとし、エラー画面や設定操作を増やさない。

## 4. Googleマップの開き方と復帰

### 遷移方法

- 初期URLは **`https://www.google.com/maps`**。目的地を勝手に補完せず、添付1枚目と同じ検索開始の流れにする。URLに利用者の名前・住所・座標・企画データを載せない。
- これはパラメーターなしの通常リンク。Maps APIキーは不要。将来Search等のMaps URLsパラメーターを使うなら公式仕様の `api=1` 等を検証するが、今回は追加しない。
- Carbonのリンクとして動くButton等を使い、`href` と `target="_blank"`、`rel="noopener noreferrer"` を付ける。実装時に導入済みCarbonのpropsを確認する。
- 新しいタブに開くことで、元の精算画面を残す。端末・ブラウザーが対応する場合はGoogleマップアプリへ引き継がれ、アプリなしではWebへ移動する。必ずアプリが起動すると断定しない。
- OS別URLスキーム、UA分岐、遅延fallback、アプリ起動可否の検出は追加しない。通常リンクでiPhone／Androidの動作を確認してから、具体的な不具合がある場合だけ見直す。
- クリック中にガイドを閉じて元の距離設定へ戻す。外部リンクを開く前に非同期処理をawaitしてポップアップを阻害しない。

### 入力中の内容を守る

現在の `beginSettlementEdit()` は編集中のstateとsessionを保持し、`commitSettlementEdit()` で共有反映する。Googleマップへ移動するだけで費用を確定保存したりFirebaseへ書き込んだりしない。

- 通常のアプリ切替／別タブから戻った際は、同じCarEditor・移動距離欄・燃費・単価・費用編集中の状態を保つ。
- iPhone等で元ページが破棄・再読込される場合に備え、外部リンクを開く直前に、その車の未確定編集・車ID・企画ID・基準状態をtab内sessionStorageへ一時退避する。一般的な下書き管理画面や保存ボタンは増やさない。
- 再読込時は、同じ企画・車の基準状態が変わっていない場合だけ新しい有効な編集sessionを作って復元する。古いsession IDをそのまま再利用しない。
- 共有先で車や費用が変更されていた場合は、既存の競合チェックを使い、古い値で自動上書きしない。競合時の編集内容をいきなり破棄しない。
- 保存・キャンセル・企画reset後は退避を破棄し、別企画・別車へ流用しない。TTL等は必要最小限とし、永続的な編集履歴システムは作らない。
- 戻った際にclipboard読み取り・距離推測・自動入力はしない。復帰トーストや「反映」専用操作も追加しない。

## 5. 不要になる依存・データの扱い

| 対象 | 実装時の変更方針 |
|---|---|
| `apps/react/src/main.jsx` | Google adapter importと生成を削除。ルート機能注入のtest専用入口も利用箇所を調べて整理 |
| `src/components/Settlement.jsx` | RoutePlannerとrouteStatus/ref／route viewを外し、distance-guideへ置換。距離入力・適用・保存の既存経路を維持 |
| `src/components/RoutePlanner.jsx` | 自動検索・計算UIをproduction importから外し、他に参照がなければ削除 |
| `src/route/google-maps-adapter.js` と `service.js` | Maps SDKロード／API呼び出しを除去。共有参照を調べ、自動route専用ならファイルも削除 |
| `src/route/legacy-domain.js` | 他の既存データ正規化・互換用途の参照を確認してから整理。共有ロジックを一括削除しない |
| `src/runtime.js` | API用routeService生成／注入を整理。外部リンクガイドを通常・サンプルで共通利用可能にする |
| 旧routeDraft／routePlaceCatalog | データ移行・一括削除しない。新UIでは利用しない。確定済みcar.distは保持 |
| Firebase schema／Rules／Auth／精算domain | 変更不要。generated正規化は互換維持のため残す |
| Google Cloud／Firebaseアカウント | 課金変更・APIキー削除・project削除・安全設定解除を行わない |

今回のReact本体（root／react）からGoogle Maps／Places／Routes API依存を取り除く。旧データを保持するためだけに、新provider管理やcapability JSONを追加しない。前案の `route-capabilities.json` とprovider別smoke構成は不要。

### legacyとの境界

`/legacy/` と過去のrollback成果物にはGoogleルート機能が含まれる。Reactを直しただけで、過去版のAPIまで復旧したとは扱わない。

- 保存済みlegacy資産・検証済みrollback archiveは書き換えない。
- 今後の公開artifactに含むlegacyを利用者向けに残す場合は、`assets/js/templates/settlement/03-car-cost-templates.js` の自動ルート入口と `assets/js/features/settlement/04-route-helper.js` の起動経路を調べ、API操作を案内リンクへ寄せるか無効にする最小修正を行う。React用の画像ガイド全体を二重実装しない。
- legacyのMaps loader／`maps-config.js`参照は、他機能の使用を確認して、不要なscript読込とAPIキー配布を除く。Firebase設定は触らない。
- これらはprotected対象を含む。正規の変更確認と影響するlegacy互換テストを通し、失敗を隠すために保護checkを解除しない。

## 6. 本番公開テストの変更方針

Maps APIを使う機能そのものがなくなるため、公開にGoogleの検索・ルート計算の成功を要求しない。単にテストをskipして元機能を残す変更にはしない。

### 必須にする確認

1. 距離入力画面からガイドを開ける。4手順・画像・チェックボックス・操作が読める。
2. 主操作のリンク先が通常のGoogleマップHTTPS URLであり、APIキーや企画データを含まない。
3. 説明を省略する設定後の直接リンクと、「操作方法」からの再表示が動く。
4. 例：距離186km・燃費18km/L・単価158円/Lなら、既存計算規則でガソリン代が算出され、適用・費用保存・reload後も保持される。
5. タイムズ料金でも距離入力が動く。入力中の内容を保ってガイドから戻れる。
6. 本体の起動・ガイド表示だけではGoogle Maps SDK／Places／RoutesへAPI通信しない。
7. Firebase保存・共有・車割・班割・legacy互換・P9 cleanup・rollbackの既存必須確認は維持する。

### 外部Google UIをCIの必須条件にしない

CI／production smokeはリンクURLとサイト内の動作を確認する。新規タブのnavigationはテストで受け止め、第三者のGoogleマップ画面に依存するselectorや検索結果を合否条件にしない。

実装の初回だけiPhone（アプリあり）と、Androidまたはアプリなしブラウザーで、リンク遷移・経由地操作・サイト復帰を確認する。実機を確認できない場合はその項目を未確認と報告し、PCだけの結果でアプリ起動成功としない。

### 対象ファイル

- `.github/workflows/react-production-release.yml`：`REACT_MAPS_API_KEY`の必須チェックとbuild注入を外す。Maps／Places／Routes必須というstep名も実際の検証内容へ更新する。
- `apps/react/tests/production/production-smoke.spec.js`：東京駅・新宿駅の実API検索を、ガイド／リンク確認と距離手入力・保存の経路へ置換する。
- `apps/react/tests/browser/settlement-smoke-actions.mjs`：自動routeを開くhelperを新ガイドhelperへ整理する。
- `settlement.spec.js`、`route-planner-carbon.spec.js`、`phase6.spec.js`、`modal-layout.spec.js`、`modal-accessibility.spec.js`、`ui-audit.spec.js`：廃止される自動計算UIのテストを、新ガイド・復帰・編集保持・アクセシビリティの確認へ置換する。
- `apps/react/tests/route.test.mjs`／`route.wip.mjs`：廃止API実装だけのテストは参照とともに整理。データ互換・保存・計算の検証は残す。
- `apps/react/tests/react-production-release-contract.test.mjs`：Mapsキーなしbuildと、Firebase／Rules／Readiness／両ブラウザーsmoke維持を検証する。
- `docs/development/verification-and-release.md`：Google API診断を通常公開手順から外し、実装された案内・手入力経路を完了条件とする。

Maps向け診断基盤を新設する前案は取り消す。既存のFirebase診断は残す。秘密のマスクを弱めない。

## 7. 実装フェーズと完了条件

### Phase A：画像ガイドと外部リンク

**変更候補:** `Settlement.jsx`、新規 `components/settlement/DistanceGuide.jsx`、`styles.scss`、`public/images/distance-guide/`、省略設定用の小さなstorage helper。

- [ ] 既存の未コミット差分と最新mainを確認し、無関係な作業を保護する。
- [ ] 添付4枚をWeb用に準備し、本文＋画像の4手順を実装する。
- [ ] 入口文言を変更し、同一modal内でガイドと距離入力を切り替える。
- [ ] 通常のGoogleマップリンク、省略チェック、操作方法の再表示を実装する。
- [ ] 編集sessionを保ち、外部遷移前のtab内退避と安全な復元を追加する。

**完了条件:** 初回／省略後／再表示の3状態が動く。390pxで画像・本文・footerが収まり、keyboard／スクリーンリーダーから操作でき、元の費用編集へ戻れる。

**必要な検証:** 対象ブラウザーの操作・focus復帰・長いガイドのスクロール、入力保持、再読込復元、別端末変更との競合、localStorage使用不可。fixtureだけでなく手入力金額の結果も確認する。

### Phase B：API依存と旧自動計算経路を整理

**変更候補:** `main.jsx`、`runtime.js`、旧RoutePlanner／route関連ファイル、必要最小限のlegacy入口・loader参照。

- [ ] production importの参照を調べて自動検索／計算経路を除去する。
- [ ] サンプルでnull routeServiceへアクセスする経路をなくし、新ガイドを共通で利用する。
- [ ] 旧地点・下書き・確定済み距離の互換読込を保つ。新データへの一括変換は行わない。
- [ ] activeなlegacy入口も含めて不要なAPI通信が残っていないか確認する。過去archiveは保全する。

**完了条件:** 画面表示・ガイド・距離入力にMapsキーが不要。Firebase schemaや計算式が変わらず、旧企画を読み込める。

**必要な検証:** 廃止import／環境変数の参照確認、起動・ガイド時のネットワーク、対象unit、影響するlegacy互換check。保存境界の変更がある場合のみ対象Emulatorを追加する。

### Phase C：公開ゲートを新機能へ対応

**変更候補:** 第6節のworkflow・production smoke・対応browser spec・契約テスト・開発手順。

- [ ] Googleキーの必須条件とbuild注入を取り除く。
- [ ] 自動APIのsmokeをガイド／外部リンク／手入力精算のsmokeへ置換する。
- [ ] Readiness、Firebase Rulesゲート、両ブラウザー、P9 cleanup、検証済みrollbackを維持する。
- [ ] 旧自動routeを前提とするtest／screenshot名・workflow説明を新機能へそろえる。

**完了条件:** Google APIが使えなくても、新しい利用者の操作を正しく検証して公開判断できる。成功判定のための全skipや無関係なassertion緩和がない。

**検証範囲:** service/runtime/workflow変更なので既存分類に従い必要なfull CIを1回。失敗時は原因と影響範囲を調べ、成功済みの工程を理由なく再実行しない。

### Phase D：本番公開時の手順

- [ ] PR→必要CI→merge→main対象SHAのReadiness→既存 `React Production Release` を使う。
- [ ] compatibility／rootは同SHA・同buildを使用し、両ブラウザーsmokeとP9 cleanupを確認する。
- [ ] rootと/react/のmanifestを照合し、公開成果物がそろったことを確認する。
- [ ] 失敗時は既存の検証済みrollback経路を使う。Maps APIを復旧させるための課金契約変更を混ぜない。

## 8. 今回の計画修正で取り除く作業

- Geoapify／ORSアカウント、APIキー、検索精度benchmark、provider選択・自動fallback。
- Google Maps API復旧の追加診断、有料化、quota・課金管理。
- `route-capabilities.json`などprovider構成を管理する新しい仕組み。
- Maps APIへの実リクエストを通常公開の必須条件にすること。
- Googleマップ画面の距離の自動取得、スクレイピング、clipboard読取、自動距離入力。

これにより、この距離確認機能は通常リンクとユーザー入力だけで運用できる。Firebaseやホスティングの無料枠はそれぞれ既存条件に従うが、距離機能のための従量課金APIは不要になる。

## 9. 実装・検証記録

- 実装：画像付き4手順ガイド、次回から非表示の端末内設定、Googleマップへの通常リンク、距離入力と既存精算計算を実装。Maps API呼び出しと旧Reactルート計算を削除し、公開workflowからMaps APIキー必須条件を除いた。
- 維持：Firebase・精算計算・距離入力値の保存、P9専用smoke、両ブラウザーの公開確認、rollbackのrelease gate。
- ローカル確認：専用unit 10件、Chromium desktop/mobileとWebKit mobileのbrowser 9件、production buildを確認。CI・main merge・本番公開結果はPR実行後に追記する。
- 実機：iPhone／AndroidのネイティブGoogleマップ起動・復帰は未確認。リンク遷移とサイト側の入力保持は自動テストで確認した。
- 公開用ルートのMaps API検索結果に依存するsmokeを、ガイド・外部リンク・距離手入力・精算保存の確認へ置換した。
