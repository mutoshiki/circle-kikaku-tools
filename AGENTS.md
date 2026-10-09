# Repository working rules

- 通常の完了条件は、本番rootでのproduction smoke成功です。ユーザーが「ローカルだけ」「本番反映しない」と指定した場合は、その範囲を優先します。
- 通常は実装、必要なtest、commit、push、PR、CI、merge、mainの対象SHAに対する `Release / Readiness`、既存の `React Production Release` dispatch、production smokeまで自律して進めます。途中承諾は求めません。
- 認証・権限不足、不可逆な本番データ変更など、人間の操作または判断が本当に必要な場合だけ停止します。
- CI失敗時は即停止せず、base/mainとのテストID・テスト名単位の差分で今回の回帰と既知baselineを切り分けます。React-only変更では、legacyの既知baseline失敗だけをrelease blockerにしません。
- 同じSHAで成功済みのCIは手動で再実行せず、失敗した場合は原因を確認して必要な検証だけをやり直します。PR headの結果をmerge後main SHAの `Release / Readiness` の代用にしません。
- shared core、Firebase、schema、sync、persistence、calculation等の変更では、影響するshared/legacy互換checkも必須にします。失敗を隠すためのtest削除、skip、assertion緩和はしません。
- Required checks、Firebase Rules、Maps/Places/Routesの安全設定を迂回しません。production smokeは専用room `P9A93LMQ` のみを使い、完了後にcleanupを確認します。通常の企画データには書き込みません。
- `React Production Release`は前回成功したproduction SHAから全変更pathを分類します。React UI component・style・public UI assetだけの変更はrootを一度だけ公開し、shared/domain/sync/store/schema/Firebase/config/dependency/release workflow/unknown/履歴不足はcompatibility確認後にrootを公開します。
- migrationのcompatibility artifactは現在の成功済みReact rootを保ち、旧legacyは `/legacy/`、移行対象Reactは `/react/` で検証します。compatibilityとrootの公開では同じSHA・同じproduction buildを使い、buildし直して差し替えません。
- どちらの経路でも両ブラウザのroot smoke、smoke roomのcleanup確認、失敗時の検証済みrollbackを維持します。rollbackは現在の公開manifestと一致する成功済みSHAのPages artifactのみを使います。
- production smokeが失敗した場合は、既存workflowのrollback経路に従い、原因を修正して再検証します。
- 既存の `Release / Readiness` と `.github/workflows/react-production-release.yml` (`React Production Release`) を標準経路として使い、同じ処理を別途再実装しません。
- ユーザーの無関係な未コミット変更や作業ファイルを変更・破棄しません。
