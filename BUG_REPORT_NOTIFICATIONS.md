# バグ報告メール通知

## 構成

- ブラウザは Firebase Realtime Database の `bugReports/<自動生成ID>` に報告を新規作成するだけ。
- `bugReports` は匿名認証済みクライアントから新規作成のみ許可し、読取・更新は禁止。
- Cloud Functions の `notifyBugReport` が `bugReports/{reportId}` の作成を検知する。
- メール送信は Cloud Functions から Resend API を呼ぶ。ブラウザにはメール送信用の秘密情報を置かない。
- `RESEND_API_KEY`、`BUG_REPORT_NOTIFY_TO`、`BUG_REPORT_NOTIFY_FROM` は Firebase Secret Manager で管理する。
- Resend の Idempotency Key に `circle-kikaku-bug-report/<reportId>` を使い、同じ報告の再実行による重複メールを防ぐ。
- 送信状態は `bugReportNotifications/<reportId>` にサーバー側だけで保存する。クライアントからは読取・書込とも不可。
- メール失敗時も `bugReports/<reportId>` は変更・削除しない。

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

## Secret

値はリポジトリへ保存しない。

```powershell
firebase functions:secrets:set RESEND_API_KEY --project <staging-project-id>
firebase functions:secrets:set BUG_REPORT_NOTIFY_TO --project <staging-project-id>
firebase functions:secrets:set BUG_REPORT_NOTIFY_FROM --project <staging-project-id>
```

`BUG_REPORT_NOTIFY_TO` には通知先 Gmail アドレス、`BUG_REPORT_NOTIFY_FROM` には Resend で送信可能な検証済み送信元を設定する。

## staging 検証

本番 `sanpokai-tool` では直接試さない。別の staging Firebase project を使う。

1. staging project で Anonymous Authentication と Realtime Database を有効化する。
2. staging project を Blaze plan にする。Cloud Functions のデプロイには Blaze plan が必要。
3. 上記3つの Secret を staging project に設定する。
4. Rules と Function を staging にデプロイする。

```powershell
firebase deploy --only database,functions:notifyBugReport --project <staging-project-id>
```

5. staging 用 Firebase config を使い、次の smoke test を実行する。

```powershell
$env:SANPO_BUG_REPORT_STAGING = '1'
$env:SANPO_STAGING_FIREBASE_CONFIG = '{"apiKey":"...","authDomain":"...","databaseURL":"...","projectId":"..."}'
npm run test:bug-report:staging
```

このテストは production project ID `sanpokai-tool` を拒否し、一意な `BUG-MAIL-...` マーカーを含む報告を送る。

6. Firebase Console で `bugReports` に同じマーカーが保存されていることを確認する。
7. Firebase Console で `bugReportNotifications/<reportId>/status` が `sent` になっていることを確認する。
8. 通知先 Gmail で件名 `【サークル企画ツール】新しいバグ報告` と同じ `BUG-MAIL-...` マーカーを確認する。
9. 同じイベントを再試行しても同一報告のメールが増えないことを確認する。

## production 反映条件

staging で「報告保存 → Function 実行 → Gmail 受信 → 重複なし」まで確認できるまでは、production の Rules / Functions をデプロイしない。
