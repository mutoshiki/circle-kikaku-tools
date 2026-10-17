# 作業元・プレビュー対応表

この文書は、このworktreeの基準を記録したものです。作業開始ごとに、公開manifestを取り直して更新してください。ポート番号や画面の見た目だけでソースの一致を判断しません。

## 公開基準

- 公開URL: <https://mutoshiki.github.io/circle-kikaku-tools/>
- 確認日時: 2026-10-17（PR #108のProduction Release完了後、公開manifestを確認）
- manifest: <https://mutoshiki.github.io/circle-kikaku-tools/release-build.json>
- 公開source SHA: `851cb1a4c90fde012ad84eee47a3403689dac9ef`
- 公開asset digest: `647a68524eebd8bf4fae02791a8617daf103bc5c3929bd4ff5cc6dd009a2d2de`
- 公開サイトはReactのルートビルド。CIで`apps/react/dist`からPagesルートを構成する。
- 公開manifestはPR #108のProduction Release後に再取得し、公開source SHA・asset digestとroot HTTP 200を確認済み。

## 作業元

- 専用worktree: `C:\Users\toshi\.codex\worktrees\site-type-spacing\circle-kikaku-tools`
- branch: `codex/site-typography-spacing`
- 起点SHA: `0f9af754f84081cdc5d50c38c0995181791e71e5`（公開manifest SHA `851cb1a4c90fde012ad84eee47a3403689dac9ef` を含む `origin/main` から開始）
- この作業の主なReact owner: `apps/react/src/styles.scss`、`apps/react/src/App.jsx`、`apps/react/src/components/SettlementSettingsModal.jsx`
- 文字・余白の共通契約: `docs/design/react-typography-spacing.md`

## ブラウザーの使い分け

| 目的 | URL / 配信元 | 扱い |
|---|---|---|
| 実際の公開版を見る | `https://mutoshiki.github.io/circle-kikaku-tools/` | 読み取り専用の見た目参照。ライブの企画データは変更しない。版は毎回公開manifestで確認する。 |
| 以前から開かれている参照タブ | `http://127.0.0.1:4194/?room=PREVIEW-ORIGIN-VERIFY-20261011&view=seisan` | ユーザー指定のタブとして維持する。配信プロセス・build SHAを特定できるまでは、公開版や今回のpreviewと同一とは扱わない。 |
| このworktreeの変更後preview | `http://127.0.0.1:4280/`（検証用port） | `apps/react/dist`をVite previewで配信。サンプル操作はローカル保存だけを使う。Firebase/Auth/本番ルームには接続しない。 |

## build・起動・照合

作業開始時に公開manifestを取得し、`sourceSha`を基準値にします。公開版が変わったらこの対応表を更新し、既存worktreeの基準を無言で入れ替えません。

```powershell
cd C:\Users\toshi\.codex\worktrees\site-type-spacing\circle-kikaku-tools\apps\react
npm ci
npm run build:preview -- --baseline-source-sha 851cb1a4c90fde012ad84eee47a3403689dac9ef
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4280 --strictPort
```

別のPowerShellで、ブラウザーで開く前に照合します。

```powershell
cd C:\Users\toshi\.codex\worktrees\site-type-spacing\circle-kikaku-tools\apps\react
npm run check:preview -- --url http://127.0.0.1:4280/ --expected-source-sha 851cb1a4c90fde012ad84eee47a3403689dac9ef
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
