# Repository working rules

- 通常の完了条件は、本番rootでのproduction smoke成功です。ユーザーが「ローカルだけ」「本番反映しない」と指定した場合は、その範囲を優先します。
- 通常は実装、必要なtest、commit、push、PR、CI、merge、mainの対象SHAに対する `Release / Readiness`、既存の `React Production Release` dispatch、compatibility smoke、root cutover、production smokeまで自律して進めます。途中承諾は求めません。
- 認証・権限不足、不可逆な本番データ変更など、人間の操作または判断が本当に必要な場合だけ停止します。
- CI失敗時は即停止せず、base/mainとのテストID・テスト名単位の差分で今回の回帰と既知baselineを切り分けます。React-only変更では、legacyの既知baseline失敗だけをrelease blockerにしません。
- shared core、Firebase、schema、sync、persistence、calculation等の変更では、影響するshared/legacy互換checkも必須にします。失敗を隠すためのtest削除、skip、assertion緩和はしません。
- Required checks、Firebase Rules、Maps/Places/Routesの安全設定を迂回しません。production smokeは専用room `P9A93LMQ` のみを使い、完了後にcleanupを確認します。通常の企画データには書き込みません。
- compatibilityとrootの公開には既存workflowが同じSHA・同じbuild artifactを使うことを確認します。buildし直して差し替えません。
- production smokeが失敗した場合は、既存workflowのrollback経路に従い、原因を修正して再検証します。
- 既存の `Release / Readiness` と `.github/workflows/react-production-release.yml` (`React Production Release`) を標準経路として使い、同じ処理を別途再実装しません。
- ユーザーの無関係な未コミット変更や作業ファイルを変更・破棄しません。
