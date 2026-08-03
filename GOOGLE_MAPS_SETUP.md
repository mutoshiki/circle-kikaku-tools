# Google Maps 設定・配布手順

更新日: 2026-08-03

## 使用API

Google Cloud側で次のAPIを有効にする。

- Maps JavaScript API
- Places API (New)
- Routes API

旧Places API、Directions API Legacy、Distance Matrix API Legacyは使用しない。

## APIキーの管理

アプリは`window.SANPO_GOOGLE_MAPS_CONFIG`だけを参照する。キーをソースの複数箇所へ記述しない。

- 実行時生成物: `maps-config.js`
- 雛形: `maps-config.example.js`
- 生成ツール: `tools/write-maps-config.mjs`
- 環境変数: `SANPO_GOOGLE_MAPS_API_KEY`

```bash
SANPO_GOOGLE_MAPS_API_KEY='制限済みブラウザキー' npm run build:maps-config
```

任意設定:

```bash
SANPO_GOOGLE_MAPS_LANGUAGE=ja
SANPO_GOOGLE_MAPS_REGION=JP
SANPO_GOOGLE_MAPS_VERSION=weekly
```

`maps-config.js`はブラウザへ配信されるため、ブラウザキー自体は利用者から参照できる。保護はHTTPリファラー制限とAPI制限で行う。リポジトリ履歴へ不要に残さないため、同ファイルは`.gitignore`対象としている。

## 静的配信

配信物には、生成済みの次を含める。

- `index.html`
- `maps-config.js`
- `assets/`
- その他既存の静的アプリファイル

GitHub PagesをActionsから配信する場合は、artifact作成前に`npm run build:maps-config`を実行する。ブランチをそのままPagesへ公開する方式では、生成済み`maps-config.js`も配信対象へ明示的に含める必要がある。

## ローカル確認

APIキーのHTTPリファラー制限に、利用するローカルoriginを許可している場合だけ実APIを確認できる。通常は許可済みHTTPS本番originで確認する。

```bash
npm ci
npm run build:carbon
npm run lint:css
npm test
npm run typecheck:maps
npm run test:maps
```

許可済み本番originに対するライブ確認:

```bash
MAPS_LIVE_TEST=1 \
MAPS_LIVE_BASE_URL=https://許可済みの配信先/ \
npm run test:maps:live
```

## GitHub Actions

`.github/workflows/quality-guard.yml`には以下を含む。

- static契約、CSS lint、型チェック
- Carbon UI回帰
- Google Mapsモック回帰
- 手動起動のGoogle Mapsライブsmoke

ライブsmokeはRepository Variable `MAPS_LIVE_BASE_URL`が設定されている場合だけ実行する。配信先には有効な`maps-config.js`が必要。

## APIキー更新

1. Google Cloudで新しい制限済みブラウザキーを用意する。
2. `SANPO_GOOGLE_MAPS_API_KEY`を更新する。
3. `npm run build:maps-config`を実行する。
4. 配信artifactを更新する。
5. 許可済みoriginで`npm run test:maps:live`を実行する。

キーを`index.html`、feature JavaScript、テストへ複製しない。
