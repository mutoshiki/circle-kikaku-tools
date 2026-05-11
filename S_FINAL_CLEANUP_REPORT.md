# S最終整理レポート

## 実施内容

### 1. JSの中核名前空間を追加
- `assets/js/core/app-namespace.js` を追加しました。
- `SanpoApp.actions`、`SanpoApp.state`、`SanpoApp.templates`、`SanpoApp.renderers`、`SanpoApp.compat` を用意しました。
- 既存の `window.xxx` 互換は壊さず、今後は `SanpoApp` 経由に寄せられる構成にしました。

### 2. イベント処理を action map 化
- `assets/js/features/events.js` の generated HTML 用 `data-action` 処理を `generatedActionHandlers` に集約しました。
- 長い `if (action === ...)` チェーンを廃止し、`SanpoApp.registerActions()` と `SanpoApp.runAction()` で処理する形にしました。
- 人物メニューは `data-person-action` のまま分離し、既存の誤発火防止も維持しました。

### 3. 状態管理の中心を追加
- `getData()` が取得したスナップショットを `SanpoApp.state.snapshot` に反映するようにしました。
- `restore()` 時も `SanpoApp.state` に反映します。
- これにより、今後 DOM 依存の状態管理から `appState` 中心へ段階的に移行できます。

### 4. 生成HTMLをテンプレート層へ分離
- `assets/js/templates/settlement-templates.js` を追加しました。
- `assets/js/templates/sheet-templates.js` を追加しました。
- 精算画面、発表ビュー、空状態、距離計算補助、共有コピー失敗UIのHTML生成を整理しました。
- `features/settlement.js` と `features/sheet-view.js` は、計算・状態・操作を中心にし、HTML文字列をテンプレート側へ寄せました。

### 5. JS内の inline style を削減
- `share-actions.js` の `style.cssText` を削除し、CSS class 化しました。
- `lock-protection.js` の通知・合言葉パネルの `style.cssText` も削除し、CSS class 化しました。
- 発表ビューの一部 inline style をテンプレート class 化しました。

### 6. CSS owner ファイルをさらに分割
以下の巨大CSSを import aggregator 化し、責務ごとの小ファイルに分割しました。

- `01-app-shell.css`
  - `assets/css/app-shell/01-layout-core.css`
  - `assets/css/app-shell/02-edit-controls.css`
  - `assets/css/app-shell/03-header-room.css`
  - `assets/css/app-shell/04-mobile-header.css`

- `03-guides-modals.css`
  - `assets/css/guides-modals/01-modal-dropdown-base.css`
  - `assets/css/guides-modals/02-guide-cards.css`
  - `assets/css/guides-modals/03-guide-mockups.css`
  - `assets/css/guides-modals/04-modal-repairs.css`

- `04-cars-members-tray.css`
  - `assets/css/cars-members-tray/01-tray-base.css`
  - `assets/css/cars-members-tray/02-cards-cars.css`
  - `assets/css/cars-members-tray/03-compact-menus.css`
  - `assets/css/cars-members-tray/04-drag-drop-polish.css`

- `05-settlement.css`
  - `assets/css/settlement/01-layout-summary.css`
  - `assets/css/settlement/02-route-helper.css`
  - `assets/css/settlement/03-mobile-settlement.css`
  - `assets/css/settlement/04-settlement-polish.css`

`index.html` 側の読み込みは既存の8本を維持しているため、HTML側の読み込み順は大きく変えていません。

### 7. テスト環境を追加・更新
- `package.json` を追加しました。
- `playwright.config.js` を追加しました。
- `tests/run-static-tests.js` を追加しました。
- `tests/helpers/read-project.js` を追加し、CSS分割後もテストが再帰的にCSSを読めるようにしました。
- `tests/s-final-architecture-check.js` を追加しました。

## 確認結果

実行済みです。

```bash
node --check assets/js/**/*.js tests/**/*.js playwright.config.js
npm test
```

結果：静的テスト25件すべて成功。

## Playwrightについて

`@playwright/test` はこのZIP内に未インストールのため、実ブラウザテストは未実行です。
実行する場合は以下です。

```bash
npm install
npx playwright install
npm run test:ui
```

## 今後の編集ルール

- 新しいボタンは、直接 `document.addEventListener` を増やさず、まず `SanpoApp.registerActions()` に追加する。
- JS内に長いHTML文字列を追加せず、`assets/js/templates/` に置く。
- CSSは巨大ownerへ直接追記せず、owner配下の小ファイルへ追加する。
- 共有・通知・モーダルなどの見た目は JS の `style.cssText` ではなく CSS class で管理する。
- 保存・復元まわりを変えるときは、`SanpoApp.state.snapshot` との整合を確認する。
