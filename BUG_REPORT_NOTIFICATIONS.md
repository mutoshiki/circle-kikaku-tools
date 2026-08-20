# バグ報告メール通知

## 構成

独自ドメイン、有料メール配信サービス、Cloud Functions、Secret Managerは使わない。
FirebaseはSpark planのまま運用する。

- ブラウザは Firebase Realtime Database の `bugReports/<自動生成ID>` に報告を新規作成するだけ。
- `bugReports` は匿名認証済みクライアントから新規作成のみ許可し、読取・更新は禁止。
- Google Apps Script の1分間隔のインストール型トリガーがサーバー側で新しい `bugReports` を確認する。
- Apps ScriptはFirebaseサービスアカウントのOAuth2アクセストークンをサーバー側で生成し、Realtime Database REST APIを使用する。
- サービスアカウントJSON、通知先Gmail、Database URLはApps ScriptのScript Propertiesに保存し、GitHubやブラウザへ置かない。
- メールはApps Scriptの `MailApp.sendEmail()` で指定Gmailへ送る。独自ドメインは不要。
- 送信状態は `bugReportNotifications/<reportId>` に保存し、ブラウザからの読取・書込はSecurity Rulesで禁止する。
- メール失敗時も `bugReports/<reportId>` は変更・削除しない。
- `rooms` は通知処理から一切読み書きしない。

## 重複抑止

`bugReportNotifications/<reportId>` の更新にはFirebase RESTのETagと `if-match` を使用する。これはRESTにおけるtransaction相当の条件付き更新で、同時実行された2つの処理が同じETagを使って書こうとした場合、一方だけが成功し、他方はHTTP 412となって再読込する。

状態は次のように扱う。

- 未処理 / `failed` / 期限切れの `sending` → 15分の送信リースを原子的に獲得可能
- 有効期限内の `sending` → 他の実行は送信不可
- `sent` → 永続的に送信不可。24時間を超えても再送しない
- メール送信が成功する前には `sent` にしない
- メール送信が失敗した場合は `failed` にして次回トリガーで再試行可能
- 実行が途中で消えた場合は15分後にリースを再取得可能

さらにApps Script側でも `LockService` を使って同一スクリプトの同時走行を抑止する。

「Gmailがメールを受理した直後、Firebaseへ `sent` を書く前にApps Scriptが終了した」場合のため、メール本文には `circle-kikaku-bug-report-<reportId>` の一意な報告IDを付ける。再試行時はScript Propertiesの送信済みマーカーを確認し、必要ならGmailの送信済みメールを同じ報告IDで検索する。見つかった場合はメールを再送せず、Firebaseの状態だけ `sent` に復旧する。

## メール内容

件名は固定で `【サークル企画ツール】新しいバグ報告`。

本文には次を含める。

- バグ内容
- 送信日時
- room ID
- URL
- build ID
- 企画名（取得できる場合）
- 現在の画面
- 端末 / ブラウザ情報
- 報告ID

## Apps Script の秘密情報

次の値はApps Scriptの「プロジェクトの設定 → スクリプト プロパティ」にだけ保存する。

- `FIREBASE_DATABASE_URL`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `BUG_REPORT_NOTIFY_TO`

`FIREBASE_SERVICE_ACCOUNT_JSON` はFirebase ConsoleからダウンロードしたサービスアカウントJSONの全文。これは秘密鍵を含むため、GitHub、チャット、共有Drive、ソースコードへ貼らない。

## staging 検証

本番 `sanpokai-tool` では直接試さない。別のSpark planのstaging Firebase projectを使う。

1. staging projectを新規作成する。課金設定は追加しない。
2. Authenticationで匿名認証を有効化する。
3. Realtime Databaseを作成する。
4. staging projectのWebアプリを1つ登録し、ブラウザテスト用Firebase configを取得する。
5. Firebase Console → プロジェクトの設定 → サービス アカウント → 新しい秘密鍵の生成、でstaging専用のサービスアカウントJSONをローカルへ保存する。
6. `firebase/database.rules.json` をstagingへデプロイする。

```powershell
firebase login
firebase deploy --only database --project <staging-project-id>
```

7. standaloneのGoogle Apps Script projectを作成し、次の3ファイルを反映する。

- `apps-script/bug-report-mailer/Code.gs`
- `apps-script/bug-report-mailer/State.gs`
- `apps-script/bug-report-mailer/appsscript.json`

8. Script Propertiesへstagingの `FIREBASE_DATABASE_URL`、サービスアカウントJSON全文、通知先Gmailを設定する。値はソースコードへ書かない。
9. Apps Scriptエディタから `verifyBugReportMailerSetup()` を手動実行し、必要なGoogle権限を許可する。成功時は秘密情報を表示せず、設定OKと残りメール送信枠だけをログへ出す。
10. `installBugReportTrigger()` を手動実行する。既存の同名トリガーを削除してから `processBugReports` の1分間隔トリガーを1つ作成する。
11. staging用Firebase configを環境変数へ設定し、UIから実際にバグ報告を1件送る。

```powershell
$env:SANPO_BUG_REPORT_STAGING = '1'
$env:SANPO_STAGING_FIREBASE_CONFIG = Read-Host 'staging Firebase config JSON をローカルで貼り付け'
npm run test:bug-report:staging
```

12. 最大約2分待ち、次を確認する。

- Firebase Consoleの `bugReports` に `BUG-MAIL-...` の報告がある
- `bugReportNotifications/<reportId>/status` が `sent`
- 通知先Gmailに件名 `【サークル企画ツール】新しいバグ報告` が1通届く
- メール本文に同じ `BUG-MAIL-...` と報告IDがある

13. Apps Scriptエディタから `processBugReports()` を続けて2回手動実行し、同じ報告のメールが増えないことを確認する。

## テスト

`tests/bug-report-notification-contract.mjs` は、Apps ScriptがETag / `if-match` / HTTP 412再試行、15分リース、Gmail送信済み復旧、Script Properties、1分トリガーを持つことを検証する。

`tests/firebase-rules-emulator-v67.mjs` は、実際のRealtime Database Emulatorで同じ状態遷移を使用し、以下を検証する。

- 同一報告に対する同時transactionで送信権を取れるのは1実行だけ
- 送信成功前は `sending` であり `sent` ではない
- `failed` から再試行できる
- 期限切れ `sending` は1実行だけが再取得できる
- `sent` は25時間後でも再取得不可
- クライアントは `bugReportNotifications` を読み書きできない

## production 反映条件

stagingで「UI報告保存 → Apps Script検知 → Gmail受信 → Firebase `sent` → 再実行しても重複なし」まで確認できるまでは、productionのRulesとApps Script監視を有効化しない。
