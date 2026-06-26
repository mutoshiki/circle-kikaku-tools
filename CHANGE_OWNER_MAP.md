# 変更内容と正規 owner 対応表

作業日: 2026-06-21

## 方針

- 機能、情報構造、画面構成、要素配置、操作方法は変更していない。
- アプリ本体の JavaScript は変更していない。HTML の変更は正規トークン CSS の読み込み追加のみ。
- 全画面上書き層、後勝ちの調整用 CSS、`!important`、不要な詳細度の引き上げは追加していない。
- 共通値は token/component owner、画面固有値は該当画面 owner に直接統合した。

## 対応表

| 改善内容 | 実際に変更した正規 owner | 変更内容 |
|---|---|---|
| 共通色の責務分離 | `assets/css/tokens/01-color-scheme.css` / `assets/css/tokens/01-component-palette.css` | 意味を持つ色・表面トークンと、既存コンポーネントが参照する低レベルパレットを分離。重複していた表面・境界エイリアスを整理し、淡い補助面を同一階層へ統一。 |
| 角丸・余白・文字・フォーカス | `assets/css/tokens/02-radius-spacing-type.css` | 4/6/8/10/12px の角丸、4px 系余白、役割別文字サイズ・ウェイト、2px 輪郭＋2px オフセットのキーボードフォーカスを正規化。旧コンポーネント定義・アニメーション等を本来の owner へ移動。 |
| Bootstrap 制御との境界 | `assets/css/tokens/03-bootstrap-controls.css` | Bootstrap 由来の制御寸法・文字位置を bridge owner に限定。日本語ボタン・入力の字間を `0` に統一。 |
| フォーム共通状態 | `assets/css/tokens/04-forms-inputs.css` | 入力欄の hover/focus/disabled と補助面を共通化。各画面でのフォーカス打ち消しを削除。 |
| 共通コントロール・表面トークン | `assets/css/tokens/05-control-surface-tokens.css` | 重複していた影・支払系トークンと、汎用ピル角丸トークンを整理。既存値に近い新規値の乱立を抑制。 |
| 共通コンポーネント契約 | `assets/css/components/00-component-contracts.css` | 重複していた余白・z-index・文字・金額エイリアスを削除し、タグの角丸を共通 token へ接続。 |
| ボタンの主・補助・無効状態 | `assets/css/components/buttons/02-action-buttons.css` | Bootstrap 既定値に負けていた disabled の不透明度・ポインター・カーソルを正規 button owner で統一。主操作の強度は維持。 |
| 全体レイヤー | `assets/css/app-shell/layout/04-layering.css` | z-index の正規 owner を一本化。モーダル、メニュー、ドラッグ状態の前後関係を既存階層内で整理。 |
| ドラッグ表現 | `assets/css/07-drag-interactions.css` | ドラッグ用 token と keyframes をドラッグ owner へ移動。操作中クラスと実ドラッグを Playwright で確認。 |
| ヘッダーの企画名・同期状態 | `assets/css/app-shell/header/02-room-status.css` | 入力フォーカスを消していた局所指定を削除し、共通フォーカス規則へ接続。 |
| 人物カードの構造と密度 | `assets/css/cars-members-tray/person-card/01-person-card-shell.css` / `02-person-name-grade.css` / `04-person-mobile.css` | 同一セレクタの分散定義を役割別に整理。カード、氏名、属性、補足、モバイル密度を各 owner 内で統一し、負の日本語字間と過剰なカプセル形状を除去。 |
| 人物メニュー | `assets/css/cars-members-tray/person-card/03-person-menu.css` | 三点メニューの実操作領域を 32px（モバイル 34px）へ拡大。トリガー、ポップオーバー、項目の高さ・角丸・状態を同一 owner へ集約。 |
| 車カード・座席・空状態 | `assets/css/cars-members-tray/car-card/02-card-header.css` / `03-seat-grid.css` / `04-group-mode.css` / `05-empty-controls.css` | 局所の完全ピル角丸と近似値を既存 token に接続。ヘッダー操作、座席、班割、空状態の境界と操作寸法を揃えた。 |
| 待機トレイのモバイル状態 | `assets/css/cars-members-tray/waiting-tray/04-tray-mobile.css` | モバイルの角丸・余白を正規 token に接続し、人物カードとの連続性を維持。 |
| 閉じたドロワーの操作遮断 | `assets/css/guides-modals/overview/01-overview-drawer.css` | 閉状態を `visibility: hidden`・`pointer-events: none` とし、画面外の要素へフォーカス・クリックが残らないよう修正。開状態でのみ復帰。 |
| 一括登録ガイドのモバイル到達性 | `assets/css/guides-modals/import-guide/01-import-shell.css` | 画面外余白を考慮して `100dvh - 20px` に調整し、下部操作が 390px 画面内に収まるよう修正。 |
| 一括登録表・モバイル表示 | `assets/css/guides-modals/import-guide/02-import-table.css` / `04-import-mobile.css` | 表・選択状態・モバイルの境界、角丸、フォーカスを既存 token に接続。 |
| ガイドモックとドロップダウン | `assets/css/guides-modals/guide/03-mockup-base.css` / `assets/css/guides-modals/modal/02-dropdowns.css` | ガイド用 caret をガイド owner へ移動し、旧来の丸み・境界を既存規則へ統合。 |
| 精算ガイドのモバイル到達性 | `assets/css/settlement/page-shell/03-car-summary-base.css` | 一括登録と同じく外側余白を差し引き、モーダル下端の 10px はみ出しを解消。 |
| 精算画面のフォーム・タグ・集計 | `assets/css/settlement/car-inputs/`、`checklists/05-driver-payment-detail.css`、`controls/03-settings.css`、`cost-tags/`、`payment-chip/01-payment-tokens.css`、`summary/05-summary-surfaces.css` | フォーカス打ち消し、完全ピル角丸、近似境界値を除去。費用区分・支払区分・集計面の優先順位は変えず、同じ役割を同じ規則へ統一。 |
| 精算画面の密度・表面 | `assets/css/settlement/page-shell/06-density.css` / `07-payment-tag-surfaces.css` | 高密度な業務画面の方向性を維持しながら、余白・タグ面・境界の局所差を整理。 |
| 経路補助 | `assets/css/settlement/route-helper/02-route-stops.css` / `03-route-candidates.css` | 入力・候補・停留点のフォーカス、角丸、境界を共通規則へ接続。 |
| 発表ビュー・クイック編集 | `assets/css/sheet-view/edit/01-quick-edit.css`、`layout/02-sheet-car-table.css`、`layout/03-sheet-summary.css`、`timetable/01-timetable-base.css`、`02-timetable-edit.css`、`gestures/01-touch-navigation.css` | 表、集計、時間表、編集欄に残っていた局所角丸・フォーカス差を owner 内で整理。配置・列構造・操作は維持。 |
| CSS 読み込み | `index.html` | `01-component-palette.css` を token 群の所定位置に追加。アプリ DOM・機能・操作は変更なし。 |
| 監査・回帰テスト | `tests/refinement-audit.spec.js` / `package.json` | 6幅、長文・長金額、フォーカス・disabled・selected、閉ドロワー、全10モーダルの到達性を検査する `test:refinement` を追加。 |
| 撮影監査 | `tools/capture-saas-audit.js` / `tools/capture-interaction-audit.js` | モーダル終了処理を安定化し、hover/focus/active/disabled/selected、人物メニュー、実ドラッグ、長文、長金額、主要モーダルを390/1280pxで撮影する監査を追加。 |

## 意図的に残した完全円形・トラック形状

`999px` は意味のある円・スイッチ・インジケータにのみ残している。

- `assets/css/tokens/01-color-scheme.css`: 円形ハンドル
- `assets/css/guides-modals/import-guide/01-import-shell.css`: ガイドの円形アイコン
- `assets/css/guides-modals/guide/05-mockup-mobile.css`: モック内の円形要素
- `assets/css/settlement/car-inputs/06-times-rental.css`: トグルトラック

## 変更していないもの

- アプリ本体の JavaScript ロジック
- 情報構造、画面順序、主要配置、タブ構成
- 保存、共有、割当、精算、発表、編集、ドラッグの操作方法
- 画像回帰の正解画像（更新なし）
