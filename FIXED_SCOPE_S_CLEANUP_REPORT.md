# Fixed-scope S cleanup report

今回のS対象は、作業中に新しく見つけた改善点をSへ追加せず、以下の範囲に固定して整理した。

## S-1 CSSの責務分離

実施内容:

- `assets/css/app-shell/` の複数ownerに散っていたヘッダー、タブ、ルーム入力、上部操作、スマホ調整を `assets/css/app-shell/01-app-shell-owner.css` に統合。
- `assets/css/01-app-shell.css` は単一owner importだけに変更。
- `assets/css/guides-modals/` の複数ownerに散っていたモーダル、ドロップダウン、ガイドカード、ガイド画面を `assets/css/guides-modals/01-guides-modals-owner.css` に統合。
- `assets/css/03-guides-modals.css` は単一owner importだけに変更。
- 旧分割CSSは `assets/css/_archived_before_fixed_s_scope/` に退避。
- `.guide-feature-card` が `02-theme-appearance.css` とガイドCSSの両方で所有されていた重複を解消。
- active CSS内の主要セレクタ重複を確認し、クロスファイル重複は0件。

追加テスト:

- `tests/css-fixed-scope-owner-check.js`

## S-2 JSのイベント登録整理

実施内容:

- `assets/js/features/events.js` をイベント全置き場から、起動だけを担当する薄いbootstrapに変更。
- イベント責務を以下へ分割。
  - `assets/js/features/events/00-event-utils.js`
  - `assets/js/features/events/01-core-startup-events.js`
  - `assets/js/features/events/02-static-header-events.js`
  - `assets/js/features/events/03-generated-action-events.js`
  - `assets/js/features/events/04-settlement-input-events.js`
  - `assets/js/features/events/05-view-feature-events.js`
- `index.html` の読み込み順を更新。
- 人物メニュー、generated HTML、精算入力、ヘッダー、タブ、ガイド操作のイベントownerを分離。

更新テスト:

- `tests/event-owner-check.js`
- `tests/person-menu-action-handler-check.js`
- `tests/person-menu-event-namespace-check.js`
- `tests/s-final-architecture-check.js`

## S-3 app.js周辺の責務整理

実施内容:

- Bootstrap Modalの初期化を `assets/js/core/modal-controller.js` に分離。
- `app.js` はライフサイクル起動の流れを読むファイルに寄せた。
- 保存、同期、描画、履歴、精算入力保護は既存のcore ownerに残した。

追加ファイル:

- `assets/js/core/modal-controller.js`

## S-4 HTML文字列テンプレートの危険箇所整理

実施内容:

- 精算画面の企画者select生成で、参加者名を `innerHTML` へ流し込む処理をやめた。
- `new Option()` と `replaceChildren()` でDOM安全寄りに変更。
- generated templateのdata-actionはSanpoApp action registry経由のまま維持。

追加テスト:

- `tests/settlement-render-safety-check.js`

## S-5 回帰テスト

実施内容:

- 静的テストを28本に拡張。
- JS構文チェックを全JSファイルに対して実施。
- Playwright UIテストは既存の4ケースを維持。

確認結果:

- `npm test` 成功。
- `node --check` 成功。
- `npm run test:ui -- --reporter=line` は、この実行環境で `net::ERR_BLOCKED_BY_ADMINISTRATOR` により `http://127.0.0.1:4173/index.html` への遷移がブロックされ、実ブラウザ確認は未完了。

## 次回候補

今回の固定Sには追加しなかった候補:

- `assets/css/00-base-tokens.css` と `assets/css/02-theme-appearance.css` はまだ大きいため、将来的には変数、フォーム、テーマカード、外観モーダルでさらに分けられる。
- `assets/css/settlement/01-layout-summary.css` はまだ大きいため、精算カード、サマリー、空状態、レスポンシブなどへ分割余地がある。
- `assets/js/features/sheet-view.js` と `assets/js/features/drag-edit-view.js` は大きいため、表示、ズーム、クイック編集、ドラッグ補助に分ける余地がある。
