# 作業元・プレビュー対応表

この文書は、このworktreeの基準を記録したものです。作業開始ごとに、公開manifestを取り直して更新してください。ポート番号や画面の見た目だけでソースの一致を判断しません。

## 公開基準

- 公開URL: <https://mutoshiki.github.io/circle-kikaku-tools/>
- 確認日時: 2026-10-12 12:07 JST
- manifest: <https://mutoshiki.github.io/circle-kikaku-tools/release-build.json>
- 公開source SHA: `a8531f1be1353a156be4d2ed1c71f80af9c3ff6b`
- 公開asset digest: `3d1f509cba7141d6cd44addee59aac2937f74c58b481c769dc3723979d00c92e`
- 公開サイトはReactのルートビルド。CIで`apps/react/dist`からPagesルートを構成する。
- 公開サイトを開いた今回のブラウザーでは`auth/network-request-failed`となり、room画面を確認できなかった。公開SHA・digestと保存済みPages archiveは既存の検証ツールで一致を確認済み。

## 作業元

- 専用worktree: `C:\Users\toshi\.codex\worktrees\production-baseline\circle-kikaku-tools`
- branch: `codex/production-baseline-workspace`
- 起点HEAD: `a8531f1be1353a156be4d2ed1c71f80af9c3ff6b`（この文書を加えた後もHEADは同じ。実際のコード変更は未コミット）
- 公開ルートの`view=seisan`と費用編集のReact owner: `apps/react/src/components/Settlement.jsx`
- 設定・精算計算のdomain owner: `apps/react/src/domain/settlement.js`。画面変更時も計算・保存・同期・永続化の契約を守る。

## ブラウザーの使い分け

| 目的 | URL / 配信元 | 扱い |
|---|---|---|
| 実際の公開版を見る | `https://mutoshiki.github.io/circle-kikaku-tools/` | 読み取り専用の見た目参照。ライブの企画データは変更しない。版は毎回公開manifestで確認する。 |
| 以前から開かれている参照タブ | `http://127.0.0.1:4183/?room=148A7906&view=seisan` | ユーザー指定のタブとして維持する。配信プロセス・build SHAを特定できるまでは、公開版や今回のpreviewと同一とは扱わない。 |
| このworktreeの変更後preview | `http://127.0.0.1:4194/`（検証用port） | `apps/react/dist`をVite previewで配信。サンプル操作はローカル保存だけを使う。Firebase/Auth/本番ルームには接続しない。 |

## build・起動・照合

作業開始時に公開manifestを取得し、`sourceSha`を基準値にします。公開版が変わったらこの対応表を更新し、既存worktreeの基準を無言で入れ替えません。

```powershell
cd C:\Users\toshi\.codex\worktrees\production-baseline\circle-kikaku-tools\apps\react
npm ci
npm run build:preview -- --baseline-source-sha a8531f1be1353a156be4d2ed1c71f80af9c3ff6b
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4194 --strictPort
```

別のPowerShellで、ブラウザーで開く前に照合します。

```powershell
cd C:\Users\toshi\.codex\worktrees\production-baseline\circle-kikaku-tools\apps\react
npm run check:preview -- --url http://127.0.0.1:4194/ --expected-source-sha a8531f1be1353a156be4d2ed1c71f80af9c3ff6b
```

照合はmanifest基準SHA、worktreeのHEADとsource fingerprint、build metadata、配信中のHTMLとJS/CSSを確認する。ソースがbuild後に変わった場合、別worktree由来の場合、SHAやmetadataが違う場合は失敗する。成功は「このローカルpreviewが指定SHAを祖先に持つ現在のworktreeからbuildされ、ページ資産が一致する」ことを示す。公開manifestとpreviewを毎回取り直す前提なので、成功結果を次回の版確認に流用しない。

ローカルpreviewは公開source SHAからのビルドですが、データ接続をlocalに固定するため公開版と**同一バイナリではありません**。公開bundleの同一性はPages archiveの`assetDigest`で別に確認します。local previewは画面・ソース確認用です。

### データ接続

- `build:preview`は`VITE_REACT_SYNC_MODE=local`（未指定時もlocal）だけを許可し、Firebase設定値がある場合は停止する。
- 検証用room: `PREVIEW-ORIGIN-VERIFY-20261011`。このroomの内容はこのブラウザoriginのlocalStorageにのみ保存する。
- 公開版の画面確認は読み取り専用にする。`148A7906`をlocal previewへ持ち込まず、検証用roomにsample dataを入れる。

## 以前の作業場所

- `C:\Users\toshi\Documents\GitHub\circle-kikaku-tools`は`codex/react-migration-rc`上の既存作業場所。未コミット・未追跡変更85件をそのまま保持し、新しい作業の起点にしない。
- 既存の`public-current-parity` worktreeはAuth調査用のdirtyな別ブランチ。ここから公開版ソースを推測しない。
- 4184など、過去の誤ったローカルpreview portは再利用せず、現在のworktree・build・データ接続を照合してから新しい検証用portを選ぶ。
