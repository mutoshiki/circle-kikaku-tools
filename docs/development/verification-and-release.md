# 検証と公開の進め方

変更の大きさに合わせて検証し、成功済み工程を理由なく繰り返さない。

## 変更範囲の決定

1. 変更前に対象SHA、`origin/main`、未コミット変更を一度確認する。無関係な差分は保持する。
2. ローカルとCIの選択基準は `node tools/classify-release-changes.mjs <base-sha> <head-sha>` にそろえる。
3. `profile=docs` はアプリ検証なし、`profile=react-leaf` は明示された表示専用ファイルと対応specのみを実行する。それ以外、未知path、差分取得不能は全系列へ広げる。
4. 共有UI、App shell、style、domain、service、sync、store、Firebase、schema、依存/config変更はfull扱いを維持する。allowlistへ追加するときは実際のimportと保存・計算副作用を調べ、変更前に分類テストを追加する。

## ローカル検証

- UI修正は対象unitと対象browser specを実行する。例: `SANPO_TEST_FIREBASE_TARGET=offline` と `demo-circle-kikaku-tools` のloopback設定の下で `npm --prefix apps/react run test:browser -- <spec> --project chromium-desktop --project chromium-mobile --workers=2`。必要に応じ同じ対象を `webkit-mobile` でも実行する。
- Firebaseや共有境界はFirebase Emulatorと該当するlegacy互換checkを追加する。通常のテストから本番Firebaseへ接続しない。
- ブラウザーレポートは `tools/assert-browser-clean.mjs` で確認する。0件、全skip、未実行project、unexpected/flakyは成功にしない。明示skipは通過件数と分けて表示する。
- offline Playwrightだけ `SANPO_PLAYWRIGHT_WORKERS=1|2` を選べる。Emulatorと本番P9は直列のままにする。

## CIとベースライン

- `Release / Readiness` を唯一のrequired checkとして維持する。対象jobがskipされたときは、分類結果で不要と判定された場合だけ許容する。
- legacyのheadテストが成功したらbase checkout・install・再実行を省く。head失敗時はbaseを実行してテストID単位で比較し、shared/source変更の失敗を隠さない。
- 同じSHAで成功したCIは再利用する。新しいSHA、失敗、未確認の影響が出たときだけ該当範囲を再検証する。PR結果をmain SHAの必須checkの代わりにしない。
- CI summaryには選択profile/specと実行reportの件数を残す。比較ではテスト範囲とrunner経過時間を分ける。

## Firebaseと本番P9

- 通常のReact/legacyテストはofflineまたはEmulatorのrun固有環境を使う。P9 `P9A93LMQ` は既存release workflowのproduction smokeに限る。
- Apps Script worker/フォーム作成・回答同期は、queue/worker/同期コードを変更したときだけ追加検証する。CI短縮やブラウザー接続確認を理由にフォーム作成・回答送信・production diagnoseを実行しない。
- 手動の実フォーム検証が必要な作業では、P9限定のmanifestで今回作成したform/job/triggerだけを追跡・停止・削除し、終端jobとin-flight writer停止を確認してからcleanupを検証する。共有queue/定期triggerは止めない。
- production smokeやリリースはユーザーが公開を求めた作業だけで実施する。実行時は既存 `React Production Release` を使い、P9 cleanupと公開manifest確認を完了条件にする。

## ブラウザー操作と作業記録

- Browser/Chromeは現在のセッションで利用できるBrowser系ツールだけを使う。既知のtab/URLを選択してDOMまたはアクセシビリティ状態を一度読み、stale handleなど根拠がある場合だけ一度再接続する。
- 接続確認のためのproduction diagnose、フォーム操作、再公開をしない。接続が解消しないときはその事実を記録して、コード検証など独立した作業を続ける。
- 工程記録は「工程、SHA/run、結果、次の作業」を短く一度更新する。計画・進捗文書を各小修正ごとに書き直さない。
