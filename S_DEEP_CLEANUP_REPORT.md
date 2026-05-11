# S Deep Cleanup Report

## 実施範囲

- S-1: CSS構文修正・重複整理
- S-2: `cars-members-tray` CSSの責務分割
- S-3: `settlement.js` の責務分割
- S-4: `app.js` から保存・同期・状態管理・描画制御を分離
- S-5: Playwright実操作テストの強化

## 主な変更

### CSS

- `@keyframes sheetJiggle` と `@keyframes waitingCardNewPulse` の余分な `{}` を修正。
- `.guide-feature-card .theme-system-note` になっていた誤結合セレクタを、`.guide-feature-card, .theme-system-note` に修正。
- `assets/css/cars-members-tray/` を以下に再分割。
  - `01-shared-card-primitives.css`
  - `02-tray-shell.css`
  - `03-person-card.css`
  - `04-car-card.css`
  - `05-drag-drop.css`
- `assets/css/settlement/` を以下に再分割。
  - `01-layout-summary.css`
  - `02-common-controls.css`
  - `03-car-inputs.css`
  - `04-route-helper.css`
  - `05-checklists-share.css`
- `cars-members-tray` と `settlement` の現行owner配下では、同一セレクタが複数ファイルにまたがらない状態に整理。

### JavaScript

- `settlement.js` を facade 化し、実処理を以下へ分割。
  - `assets/js/features/settlement/01-state.js`
  - `assets/js/features/settlement/02-calculator.js`
  - `assets/js/features/settlement/03-render.js`
  - `assets/js/features/settlement/04-route-helper.js`
  - `assets/js/features/settlement/05-input-actions.js`
  - `assets/js/features/settlement/06-share-text.js`
- `app.js` を起動処理中心に縮小。
- app中核処理を以下へ分離。
  - `assets/js/core/app-status.js`
  - `assets/js/core/render-controller.js`
  - `assets/js/core/settlement-edit-guard.js`
  - `assets/js/core/sync-controller.js`
  - `assets/js/core/history-scheduler.js`

### テスト

- `tests/basic-ui.spec.js` を拡張。
  - 主要モーダルの表示・閉じる操作
  - テーマ設定の完了ボタン
  - 精算入力中のフォーカス保持
  - サンプルデータ投入後の基本画面
  - ドラッグ操作
- `tests/s-deep-refactor-check.js` を追加。
  - S分割後のファイル構成
  - `app.js` が保存・同期・描画を持たないこと
  - CSS構文修正
  - Playwright specの強化内容

## 確認結果

- `npm test`: 成功
- `node --check` によるJS構文確認: 成功
- `npm run test:ui`: この実行環境ではChromiumの管理制限によりページ遷移が `ERR_BLOCKED_BY_ADMINISTRATOR` で失敗。テストコード自体は追加済みで、`playwright.config.js` はローカルHTTPサーバー経由で実行する構成に変更済み。

## 自問チェック

残っていたS相当の問題として、以下を追加で潰しました。

- CSS owner配下で同一セレクタが複数ファイルに分散していた問題。
- `seisan-card` が `seisan-car` の前方一致に巻き込まれて car-inputs 側に入る分類ミス。
- Playwrightが `file://` でブロックされるため、ローカルHTTPサーバー経由で動く設定に変更。

