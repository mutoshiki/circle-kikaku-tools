# サークル企画ツール

サークルの企画で使える、車割作成・発表・精算をまとめたWebツールです。
参加者登録、車割、共有、ガソリン代や部費負担を含む精算まで、スマホで扱いやすいようにしています。

## 前回版からの修正

前回版で一部UIが昔に戻ったり、ボタンが押せなくなった原因は主に以下です。

1. CSSを意味別に並べ替えたことで、元HTMLのカスケード順が変わった
2. JSを `type="module"` の外部ファイルにしたため、HTML内の `onclick` から一部関数を呼べなくなった

この安定版では、CSSは分割しつつ、**元HTMLと同じ読み込み順**を保っています。
JSは外部ファイル化していますが、既存の `onclick` 互換を保つため、まずは通常の `<script src>` として読み込んでいます。

## 構成

```text
index.html
firebase-config.js
assets/
  css/
    01-foundation-components-guide.css
    02-seisan.css
    03-app-layout-and-themes.css
    99-final-overrides.css
  js/
    app.js
    modules/
      README.md
```

## 確認方法

ローカルで `index.html` を直接開いても動きやすいようにしています。
より確実に確認する場合は、展開したフォルダで以下を実行してください。

```bash
python -m http.server 8000
```

その後、ブラウザで `http://localhost:8000` を開いてください。

## 次の本格JS分割について

現在のJSは `onclick`、`window`、グローバル状態、Firebase、ドラッグ処理が強く結びついています。
完全分割は、まず `onclick` を `addEventListener` に置き換えてから進めるのが安全です。


## 追加安定化パス

- 外部の性別判定APIを削除し、参加者名を外部へ送信しない形に変更しました。
- 削除・復元・再割り当ての確認を、ブラウザ標準confirmではなくサイト内モーダルへ寄せました。
- ヘッダーに保存状態バッジを追加しました。
- 履歴復元時に現在状態を一時バックアップし、短時間だけ「元に戻す」を表示します。
- ダークモードのモーダル、ドロップダウン、disabled入力欄を調整しました。
- `assets/js/modules/ui.js` に共通UI処理を分離しました。


## 追加ハードニング修正

今回追加した内容：

- 保存データに `schemaVersion = 2` を追加
- 古い保存データ用の `migrateAppData()` を追加
- `safeLocalGet()` / `safeLocalSet()` / `safeLocalRemove()` を追加
- ヘッダー、未割り当て欄など一部の `onclick` を `addEventListener` に移行
- モーダルに `aria-labelledby` / `aria-hidden` を追加
- 主要入力欄に `aria-label` を追加
- A整理後、未読込の `assets/js/modules/storage.js` / `schema.js` は削除済み。実行中の安全処理は `assets/js/core/storage.js` と `app.js` 側で管理
- `03-app-layout-and-themes.css` を順番維持で段階分割
- `99-final-overrides.css` の一部 `important` を削減
- Firebase同期競合の軽い保留判定を追加
- CDN読み込み失敗時の検知と警告クラスを追加

残っている課題：

- 生成HTMLの主要イベントは `assets/js/features/events.js` に集約済み
- CSSの `!important` は静的チェック上、ルートCSSから削減済み
- JS完全モジュール化は未完了。classic scriptを維持したまま段階分割中です。


## CSS段階分割

`03-app-layout-and-themes.css` は、カスケード順を変えないように以下へ分割しました。

- `03-app-layout-and-themes.css`
- `03b-guides-and-modals.css`
- `03c-mobile-polish.css`
- `03d-theme-picker.css`
- `03e-late-maintenance.css`

意味別に完全整理するより、まずは**元の順番を保って小さくする**方針です。


## 今回の追加修正

- `clientId` 未定義によって発表ビュー描画が止まる可能性があった箇所を修正
- `getData()` に `schemaVersion` を追加
- ビュー描画専用の `getData()` 呼び出しに不要な `stampSchemaVersion()` が混ざっていた箇所を修正
- `history.js`、`drag-cards.js`、`settlement.js` を classic-script 互換モジュールとして追加し、app.js から実際に利用
- 静的HTML上の inline event handler を追加で削減
- `99-final-overrides.css` の安全な範囲で `important` を削減
- Playwright の主要画面・ドラッグ確認テストを追加

## 重要

今回、カードドラッグ不可と発表ビューUI欠落の主原因になり得る `clientId` 未定義を修正しています。


## メニュー残り対策

カードの三点メニューが画面に残り続ける問題に対して、以下で閉じるようにしました。

- 外側タップ / クリック
- スクロール / ホイール
- ドラッグ開始
- ビュー切替
- Escキー
- 画面回転 / リサイズ


## カードメニュー表示修正

前回版で `document.dataset` を参照していたため、カードメニュー初期化が止まる問題を修正しました。
`setupCompactPersonMenu.bound` を使う形に変更し、念のため基本クリック用のフォールバックも追加しています。


## 待機タブのドラッグ挙動修正

- 未割り当てメンバー欄からカードを持ち上げたら、待機タブを自動で閉じるようにしました。
- 自動で開く条件を、画面下に近づいたときではなく、閉じたタブ本体にカードが触れたときだけに変更しました。
- 待機欄へのドロップ判定も、閉じたタブ本体か、開いている待機欄内に限定しました。


## 汎用化方針

- 「企画」「企画者」「部費」「部費負担」「車割」「車出し」「同乗者」「参加者」は、大学サークル向けの自然な用語として残しています。
- 特定サークル名や特定ジャンルに寄る文言を汎用化しました。
- localStorage などの内部キーは保存データ互換を優先し、基本的に既存データを壊さない方針にしています。


## CSS整理・ドラッグ微調整

今回の追加整理：

- `03d-theme-picker.css` をテーマ選択の現行CSSとして整理
- 旧スマホ/テーマ上書きは `03d-legacy-theme-mobile-overrides.css` に分離し、読み込み順は維持
- 現行テーマ選択の整理用として `03d-theme-picker-cleanup.css` を追加
- 待機メンバータブCSSを `04-waiting-tray.css` に分離
- `member-card` / `driver-seat` の共通CSSを `04-person-cards.css` に分離
- ドラッグ中の自動スクロール速度・反応範囲を少し自然に調整
- 発表ビュー周りの不要な `data-gender` 系CSSを削除
- `03d` 系CSSの `important` を段階的に削減

`03d` 系の `important`：
- 変更前：734
- legacy分離後のlegacy変更前：734
- legacy変更後：609


## ドラッグ中スクロールの復元

前回のCSS整理版でドラッグ中の自動スクロールを微調整しましたが、スクロールが発火しにくくなる場面があったため、以下の関数を前の安定挙動へ戻しました。

- `autoScrollEditingView`
- `autoScrollSheetQuickEdit`

CSS整理、待機タブ分離、カード共通CSS整理などは維持しています。


## コード整理の続き

- 古い性別背景CSS、未使用の gender-badge CSS、重複CSSを削除
- 03e / waiting tray 周りの `important` を追加削減
- JSに `byId()` / `bindClick()` を追加し、直近で触る箇所のDOM取得を少し整理
- ドラッグ中スクロールは前回復元した挙動を維持


## カードがロック状態に見える不具合の修正

前回のCSS整理で、古い `data-gender` セレクタが `data-locked="true"` の見た目指定と同じグループに残り、性別データを持つカードまでロック状態のように見える状態になっていました。

修正内容：

- `data-gender` セレクタをロック見た目指定から除外
- ロック状態の見た目は `.member-card[data-locked="true"]` のみに限定
- 通常カードが `data-gender` を持っていてもロック風にならない保険CSSを追加


## CSS整理の追加実行

今回の整理：

- 学年バッジの色分けを `data-gender` CSS依存から `grade-male` / `grade-female` / `grade-unknown` クラスへ移行
- 未使用の `gender-badge` CSSを削除
- ロック風見た目は `data-locked="true"` のカードだけに限定
- `03d-legacy-theme-mobile-overrides.css` から、現在のカードCSSと重複する安全なカード寸法ルールを削除
- ガイド/モーダル分離の受け皿として `03b-guide.css` / `03b-modals.css` を追加
- 既知の小さな入力に `aria-label` を追加

削除した legacy カードCSSルール数：6


## 構造整理

今回の整理：

- `04-header-tabs.css` を追加し、ヘッダー操作・ビュータブの現行CSSを集約
- `03d-legacy-theme-mobile-overrides.css` の header / view-tab 系 `important` を削減
- `03b-guides-and-modals.css` から guide / modal 系ルールを `03b-guide.css` / `03b-modals.css` に実際に分離
- `renderSettlementView()` を小関数へ分割
- `renderSheetView()` を小関数へ分割
- A整理で、読み込まれていない将来用JSモジュールを削除

legacy header/tab の `important` 削減数：80
分離した guide ルール数：89
分離した modal ルール数：9
A整理で削除した未使用JS：future/schema.js, future/state.js, future/storage.js, future/utils.js, modules/schema.js, modules/state.js, modules/storage.js, modules/utils.js


## ヘッダーツール左寄り修正

`04-header-tabs.css` に、ヘッダー直下の3要素（企画名、保存状態、操作ボタン）の grid 配置を明示しました。

- スマホ幅では、操作ボタンを企画名の下で横幅いっぱいの3分割グリッドにしました。
- PC幅では、企画名を左、保存状態と操作ボタンを右側に配置します。
- ドロップダウンの `header-more` もボタン幅に合わせて広がるようにしました。


## ヘッダー右寄せ・メニュー・CSS整理

今回の修正：

- スマホ幅のヘッダー操作ボタンを中央寄せから右寄せ寄りに変更
- 「その他」メニューのスマホ幅、最大高さ、角丸、項目高さを調整
- `03d-legacy-theme-mobile-overrides.css` から古い `header-more` / appearance modal 系ルールを整理
- `03b-modals.css` に現在のヘッダードロップダウン用CSSを追加
- `03b-guide.css` に guide 系ルールをさらに移動
- `renderSettlementView` / `renderSheetView` 分割後の静的チェック用 `tests/structural-check.js` を追加

legacyから削除・移動した長さ：約 1389 文字
legacyの `important` 削減数：1
追加で移動した guide ルール数：62


## ダークモードのハイライト修正

- `04-dark-highlight-fixes.css` を追加しました。
- ダークモード時の `車割メーカー / 車割発表ビュー / 精算ツール` の active 表示を、ライトモードと同じ丸みのあるタブ表示に戻しました。
- 古い `03e-late-maintenance.css` の下線型 active 指定が勝ちすぎないように調整しました。
- `+ 諸経費を追加` など精算系ボタンのダークモード時の角丸・背景・境界線を補正しました。


## ダークモード active CSS の統一

今回の整理：

- 古い `03b-guides-and-modals.css` の dark view-tab 指定を削除
- 古い `03d-legacy-theme-mobile-overrides.css` の underline / 四角型 active view-tab 指定を削除
- 古い `03e-late-maintenance.css` の dark underline active 指定を削除
- 現在の active 表示は `04-dark-highlight-fixes.css` を所有元に統一
- `CSS_OWNERSHIP.md` を追加し、今後どのCSSに追記するかを明記

削除詳細：
```json
{
  "03b dark view-tab": {
    "rules": 4,
    "bytes": 560,
    "important": 9,
    "samples": [
      "[data-theme=\"dark\"] .view-tab { background: transparent important; color: #cbd5e1 important; border-color: transparent important; }",
      "[data-theme=\"dark\"] .view-tab:not(.active):hover { background: rgba(51, 65, 85, 0.75) important; color: #f8fafc important; }",
      "[data-theme=\"dark\"] .view-tab.active { background: var(--accent-color) important; color: #fff important; border-color: var(--accent-color) important; }",
      "[data-theme=\"dark\"] .view-tab i, [data-theme=\"dark\"] .sheet-summary-pill strong { color: inherit important; }"
    ]
  },
  "03d old active tabs": {
    "rules": 5,
    "bytes": 921,
    "important": 0,
    "samples": [
      ".view-tab.active { background: transparent; color: var(--accent-color); border-bottom-color: var(--accent-color); }",
      "[data-theme=\"dark\"] .view-tab.active { color: var(--accent-color); }",
      ".view-tab.active { background: transparent; color: var(--accent-color); border-bottom-color: var(--accent-color); }",
      "[data-theme=\"dark\"] .view-tab.active, [data-theme=\"dark\"] #tab-list.view-tab.active, [data-theme=\"dark\"] #tab-sheet.view-tab.active, [data-theme=\"dark\"] #tab-seisan.view-tab.active { background: var(--accent-color); border-color: var(--accent-color); color: #f",
      "[data-theme=\"dark\"] .view-tab.active i, [data-theme=\"dark\"] #tab-list.view-tab.active i, [data-theme=\"dark\"] #tab-sheet.view-tab.active i, [data-theme=\"dark\"] #tab-seisan.view-tab.active i { color: #ffffff; }"
    ]
  },
  "03e old dark active tabs": {
    "rules": 2,
    "bytes": 634,
    "important": 0,
    "samples": [
      "[data-theme=\"dark\"] #view-toggle-bar .view-tab.active, [data-theme=\"dark\"] #tab-list.view-tab.active, [data-theme=\"dark\"] #tab-sheet.view-tab.active, [data-theme=\"dark\"] #tab-seisan.view-tab.active { background: transparent ; border-color: transparent ; border",
      "[data-theme=\"dark\"] #view-toggle-bar .view-tab.active i, [data-theme=\"dark\"] #tab-list.view-tab.active i, [data-theme=\"dark\"] #tab-sheet.view-tab.active i, [data-theme=\"dark\"] #tab-seisan.view-tab.active i { color: var(--accent-color) ; }"
    ]
  }
}
```


## 保存状態バッジの右上固定

- `04-status-badge.css` を追加しました。
- `#syncStatusBadge` をヘッダー内のレイアウトから外し、サイト右上に固定表示するようにしました。
- スマホでは幅を抑え、ラベルが長い場合は省略表示します。
- 古い `04-header-tabs.css` 内の sync badge 配置指定を整理しました。

header CSS整理差分：約 316 文字


## 次の修正点の実行

今回の実行内容：

- 精算ツールの生成HTMLに残っていた `oninput` / `onchange` / `onclick` をイベント委譲へ移行
- ルート距離ヘルパーの生成HTMLに残っていた inline event もイベント委譲へ移行
- 車の定員編集ボタン、空状態の登録ボタン、発表ビュー空状態ボタンも `data-action` 化
- `document.getElementById(...)` を既存の `byId(...)` に整理
- `03d-legacy-theme-mobile-overrides.css` から、現在の専用CSSが所有している header / view-tab / modal 系の古いルールを削除
- guide-only CSSをさらに `03b-guide.css` に移動
- `tests/inline-event-check.js` を追加

削除した legacy ルール数：20
追加移動した guide-only ルール数：60

コード指標：

- `onclick=`: 11 → 0
- `onchange=`: 9 → 0
- `oninput=`: 6 → 0
- `document.getElementById`: 59 → 1


## 保存状態表示の統一と広めの整理

今回の変更：

- `updateStatus()` から `showMiniToast()` 呼び出しを削除し、保存状態は右上の `#syncStatusBadge` のみに統一
- `04-waiting-tray.css` に残っていた古い `.sync-status-*` CSSを削除
- 古いCSS内の header / view-tab 系ルールをさらに削除し、`04-header-tabs.css` を所有元に統一
- guide-only CSSをさらに `03b-guide.css` へ移動
- `tests/status-owner-check.js` を追加

削除した sync-status 旧CSSルール数：7
header/view-tab 旧CSS削除：
```json
{
  "03-app-layout-and-themes.css": {
    "rules": 24,
    "bytes": 2342,
    "important": 8,
    "samples": [
      ".header-actions { display: grid; grid-template-columns: repeat(3, minmax(50px, auto)); gap: 5px; }",
      ".header-action { min-height: 36px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-card); color: var(--text-main); padding: 6px 9px; display: inline-flex; flex-direction: column; align-items: cen",
      ".header-action i { font-size: 0.92rem; }",
      ".header-action span { font-size: 0.62rem; white-space: nowrap; }",
      ".header-action:hover { background: var(--hover-bg); }"
    ]
  },
  "03b-guides-and-modals.css": {
    "rules": 29,
    "bytes": 2652,
    "important": 27,
    "samples": [
      ".header-actions { grid-template-columns: repeat(4, minmax(0, 1fr)) important; gap: 8px; }",
      ".header-action { min-width: 0; justify-content: center; padding: 8px 6px; }",
      ".header-action span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }",
      "#view-toggle-bar { align-items: stretch; }",
      ".view-tab { min-width: 0; min-height: 42px; white-space: nowrap; }"
    ]
  },
  "03c-mobile-polish.css": {
    "rules": 7,
    "bytes": 644,
    "important": 7,
    "samples": [
      "/* --- v37 smartphone UI polish --- */ .header-actions { grid-template-columns: repeat(3, minmax(0, 1fr)) important; gap: 8px important; }",
      ".header-actions { grid-template-columns: repeat(3, minmax(0, 1fr)) important; }",
      ".header-action { min-height: 44px important; flex-direction: row important; gap: 6px important; }",
      "/* よく使う操作を右側へ */ .header-actions .share-action { order: 3; }",
      ".header-actions #editLockBtn { order: 2; }"
    ]
  },
  "03d-theme-picker.css": {
    "rules": 7,
    "bytes": 859,
    "important": 0,
    "samples": [
      ".theme-preview-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; padding: 7px 9px; background: var(--bg-body); border-bottom: 1px solid var(--border-color); }",
      ".theme-preview-tab { padding: 6px 5px; border-radius: 7px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-sub); font-size: 0.62rem; font-weight: 850; text-align: center; }",
      ".theme-preview-tab.active { background: var(--accent-color); border-color: var(--accent-color); color: #fff; }",
      ".header-actions { gap: 6px; }",
      ".header-action { min-height: 44px; padding: 7px 9px; }"
    ]
  }
}
```
移動した guide-only ルール数：0

JS:
- updateStatus内の下部トースト表示：削除
- 保存状態の表示先：右上の固定バッジのみ


## Experimental full cleanup

This is an experimental one-shot cleanup branch.

Main changes:

- Removed all `important` from project CSS.
- Added `100-owner-overrides.css` as a final owner-safeguard layer.
- Kept legacy CSS files loaded, but marked them as compatibility layers.
- Added `tests/no-important-check.js`.

Removed `important` counts:
```json
{
  "01-foundation-components-guide.css": 58,
  "02-seisan.css": 2,
  "03-app-layout-and-themes.css": 7,
  "03b-guide.css": 8,
  "03b-guides-and-modals.css": 58,
  "03b-modals.css": 4,
  "03c-mobile-polish.css": 87,
  "03d-legacy-theme-mobile-overrides.css": 512,
  "03e-late-maintenance.css": 36,
  "04-waiting-tray.css": 3
}
```

Use the previous stable ZIP if this experimental branch visually regresses.


## Guide alignment and simplified theme preview

- Fixed guide modals leaning to the right by constraining guide panels/grids to full-width, centered layout.
- Rebuilt the appearance modal preview as a simpler mock UI.
- Removed the old complex preview block from the modal markup.
- Added `tests/guide-theme-preview-check.js`.

Manual checks:
- 全体の使い方ガイド
- 車割メーカーの使い方ガイド
- 精算ツールの使い方ガイド
- テーマ設定モーダルのプレビュー


## Appearance modal footer repair

- テーマ設定モーダルの `modal-content` を画面高に収めました。
- `modal-body` だけがスクロールするようにしました。
- `modal-footer` を下部に固定気味にし、「標準に戻す」「完了」が遠くに行きすぎないようにしました。
- テーマ候補ドロップダウンの最大高さも少し抑えました。
- `tests/appearance-footer-check.js` を追加しました。


## Appearance footer click repair

- テーマ設定モーダルのフッターから `position: sticky` を外しました。
- モーダルを flex 構造にし、本文だけをスクロールさせ、フッターは通常の下部領域として表示します。
- フッターとボタンに `pointer-events: auto` と `touch-action: manipulation` を明示しました。
- フッターボタンを押す前に開いているテーマ候補 `details` を閉じる安全処理 `setupAppearanceFooterSafety()` を追加しました。


## Modal alignment repair

- 参加者登録、移動距離計算、編集、履歴、サンプルデータ系ポップアップが右寄りにならないように中央寄せを補正しました。
- PCでは `920px` を上限に中央配置、スマホでは横幅100%または `100vw - 20px` にしています。
- モーダル本文、row、col、入力欄の横はみ出しを防ぐ指定を追加しました。
- `tests/modal-alignment-check.js` を追加しました。


## Dark room name input repair

- ダークモード時の企画名入力欄まわりに出る余計な背景・枠・影を削除しました。
- `.app-room-field` と `.app-room-input` を透明背景、枠なし、影なしに補正しました。
- `tests/dark-room-input-check.js` を追加しました。


## Owner override CSS split

`100-owner-overrides.css` に集まっていた補正を、機能別に分割しました。

- `100-owner-safety.css`
- `101-guide-fixes.css`
- `102-appearance-modal.css`
- `103-modal-fixes.css`
- `104-room-input.css`

読み込み順は元の効き方を保つため、`99-final-overrides.css` の後にこの順番で読み込みます。
`100-owner-overrides.css` は移行メモとして残し、HTMLからは読み込まないようにしました。
`tests/css-split-check.js` を追加しました。


## Dark badge/check frame repair

- ダークモード時に、車カードの定員表示（3/3など）へ二重の枠・背景が出る問題を修正しました。
- `.capacity-badge.capacity-edit-btn` と `.capacity-count` をダークモードのみ透明背景・枠なしに戻しました。
- チェックマーク系アイコンやガイド内のチェックモックで、背景や影が二重に見えないように補正しました。
- `105-dark-badge-fixes.css` を追加し、`104-room-input.css` の後に読み込むようにしました。
- `tests/dark-badge-frame-check.js` を追加しました。


## Appearance Done button restoration and CSS cleanup

- テーマ設定モーダルの「完了」ボタンが消えないよう、フッターを `modal-content` 内の absolute bottom bar に変更しました。
- 本文側には下余白を追加し、フッターに内容が隠れないようにしました。
- テーマ候補リストの z-index をフッターより低くし、ボタンを覆わないようにしました。
- `103-modal-fixes.css` から `#appearanceModal` の所有を外し、テーマ設定モーダルは `102-appearance-modal.css` に集約しました。
- `tests/appearance-done-visible-check.js` を追加しました。


## Major CSS cleanup

大幅整理として、旧CSSから重複していたテーマ設定・ヘッダー入力・定員バッジまわりのルールを削りました。

主な内容：

- 古い複雑なテーマプレビューCSSを削除
- `#appearanceModal` / `theme-picker` / `theme-choice-scroller` の古い上書きを旧ファイルから削除
- テーマ設定のドロップダウンCSSを `102-appearance-modal.css` に集約
- 企画名入力欄の古い余白調整を旧ファイルから削除
- 定員バッジの古い重複指定を削除
- `tests/major-css-cleanup-check.js` を追加

削除集計：
```json
[
  {
    "label": "old complex theme preview",
    "file": "03d-theme-picker.css",
    "rules": 14,
    "bytes": 2350,
    "important": 0,
    "samples": [
      ".theme-preview-toolbar { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 6px; align-items: center; padding: 9px; background: var(--app-surface); border-bottom: 1px solid var(--border-color); }",
      ".theme-preview-title { min-width: 0; color: var(--text-main); font-size: 0.78rem; font-weight: 900; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
      ".theme-preview-btn { min-height: 32px; padding: 6px 9px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-main); font-size: 0.68rem; font-weight: 850; }",
      ".theme-preview-btn.primary { background: var(--accent-color); border-color: var(--accent-color); color: #fff; }",
      ".theme-preview-content { display: grid; grid-template-columns: 1fr 0.95fr; gap: 8px; padding: 10px; }",
      ".theme-preview-car, .theme-preview-seisan { border: 1px solid var(--border-color); border-radius: 10px; background: var(--bg-card); padding: 9px; min-width: 0; }",
      ".theme-preview-car-head { display: flex; justify-content: space-between; gap: 6px; padding-bottom: 6px; margin-bottom: 7px; border-bottom: 1px solid var(--border-color); font-size: 0.72rem; font-weight: 900; color: var(--text-main); }",
      ".theme-preview-seat { padding: 7px 8px; border-radius: 8px; background: var(--accent-soft); color: var(--text-main); border: 1px solid var(--border-color); font-size: 0.7rem; font-weight: 850; margin-bottom: 6px; }"
    ]
  },
  {
    "label": "old complex theme preview",
    "file": "03d-theme-picker-cleanup.css",
    "rules": 1,
    "bytes": 311,
    "important": 0,
    "samples": [
      ".theme-preview, .theme-preview-card, .appearance-preview { border: 1px solid var(--border-color); background: radial-gradient(circle at top left, color-mix(in srgb, var(--accent-color) 13%, transparent), transparent 34%), var(--bg-card); border-radius: 18px; o"
    ]
  },
  {
    "label": "old complex theme preview",
    "file": "03d-legacy-theme-mobile-overrides.css",
    "rules": 0,
    "bytes": 0,
    "important": 0,
    "samples": []
  },
  {
    "label": "old appearance modal/dropdown overrides",
    "file": "03e-late-maintenance.css",
    "rules": 43,
    "bytes": 6346,
    "important": 0,
    "samples": [
      "/* --- v48: theme picker dropdown clarity --- */ #appearanceModal .modal-content, #appearanceModal .modal-body, #appearanceModal .theme-settings-wrap-v44, #appearanceModal .theme-picker-grid { overflow: visible ; }",
      "#appearanceModal .theme-picker-grid { position: relative; z-index: 50; }",
      "#appearanceModal .theme-picker { position: relative; overflow: visible ; }",
      "#appearanceModal .theme-picker[open] { z-index: 120; }",
      "#appearanceModal .theme-picker summary { grid-template-columns: auto minmax(0, 1fr) auto ; grid-template-areas: \"icon label arrow\" \"icon value arrow\"; align-items: center; padding-right: 10px ; border-bottom: 0; }",
      "#appearanceModal .theme-picker summary::after { content: \"\\f078\"; grid-area: arrow; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; border: 1px solid var(--border-color); background: var(--bg",
      "#appearanceModal .theme-picker[open] summary { background: var(--hover-bg); }",
      "#appearanceModal .theme-picker[open] summary::after { transform: rotate(180deg); background: var(--accent-soft); border-color: var(--accent-color); }"
    ]
  },
  {
    "label": "old project title input spacing",
    "file": "03e-late-maintenance.css",
    "rules": 9,
    "bytes": 626,
    "important": 0,
    "samples": [
      "/* --- v46: project title field spacing fix --- */ .app-room-control { padding-left: 0 ; }",
      ".app-room-field { padding-left: 12px ; padding-right: 10px ; }",
      ".app-room-field label, .app-room-input { padding-left: 0 ; }",
      ".app-room-input { padding-right: 2px ; }",
      ".app-room-field { padding-left: 13px ; padding-right: 9px ; }",
      ".app-room-field { padding-left: 18px ; padding-right: 12px ; }",
      ".app-room-field label, .app-room-input { padding-left: 2px ; }",
      ".app-room-input { padding-right: 4px ; }"
    ]
  },
  {
    "label": "old project title input spacing",
    "file": "03d-theme-picker.css",
    "rules": 2,
    "bytes": 135,
    "important": 0,
    "samples": [
      ".app-room-field { padding: 8px 9px; }",
      ".app-room-input { min-height: 38px; padding-inline: 2px; }"
    ]
  },
  {
    "label": "old capacity badge duplicates",
    "file": "03b-guides-and-modals.css",
    "rules": 1,
    "bytes": 180,
    "important": 0,
    "samples": [
      ".capacity-badge { min-height: 28px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 5px 8px; font-size: 0.7rem; }"
    ]
  },
  {
    "label": "old capacity badge duplicates",
    "file": "03c-mobile-polish.css",
    "rules": 11,
    "bytes": 1479,
    "important": 0,
    "samples": [
      ".capacity-badge.capacity-edit-btn { min-height: 38px; padding: 7px 10px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-card); color: var(--text-main); display: inline-flex; align-items: center; gap: 7px; font-size",
      ".capacity-badge.capacity-edit-btn .capacity-count { padding: 2px 6px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-color); }",
      ".capacity-badge.capacity-edit-btn.is-full { border-color: rgba(15,118,110,0.55); }",
      ".capacity-badge.capacity-edit-btn.is-over { border-color: #ef4444; color: #b91c1c; }",
      ".capacity-badge.capacity-edit-btn.is-over .capacity-count { background: rgba(239,68,68,0.12); color: #b91c1c; }",
      ".capacity-badge.capacity-edit-btn { min-height: 42px; font-size: 0.8rem; }",
      ".capacity-badge.capacity-edit-btn { width: 100%; justify-content: center; }",
      ".member-action-btn, .delete-btn-overlay, .capacity-badge.capacity-edit-btn, .seisan-icon-btn, .route-stop-delete-btn { min-height: 42px; }"
    ]
  },
  {
    "label": "old capacity badge duplicates",
    "file": "03d-legacy-theme-mobile-overrides.css",
    "rules": 19,
    "bytes": 3024,
    "important": 0,
    "samples": [
      ".capacity-badge.capacity-edit-btn { width: 100% ; min-width: 0 ; min-height: var(--mobile-touch) ; padding: 8px 10px ; border-radius: var(--radius-sm) ; gap: 8px ; font-size: 0.9rem ; }",
      ".capacity-badge.capacity-edit-btn .capacity-count { padding: 4px 9px ; border-radius: 999px ; background: var(--accent-soft); color: var(--accent-color); font-weight: 900 ; }",
      ".capacity-badge.capacity-edit-btn .capacity-label { font-size: 0.82rem ; font-weight: 900 ; }",
      "[data-theme=\"dark\"] .member-action-btn, [data-theme=\"dark\"] .delete-btn-overlay, [data-theme=\"dark\"] .car-header .delete-btn, [data-theme=\"dark\"] .capacity-badge.capacity-edit-btn, [data-theme=\"dark\"] #waiting-list:empty::before { background: rgba(15, 23, 42, ",
      "[data-theme=\"dark\"] .capacity-badge.capacity-edit-btn .capacity-count { background: rgba(52, 211, 153, 0.14); }",
      ".capacity-badge.capacity-edit-btn { min-height: 34px; padding: 6px 8px; gap: 6px; font-size: 0.78rem; box-shadow: none; }",
      ".capacity-badge.capacity-edit-btn > i { font-size: 0.78rem; }",
      ".capacity-badge.capacity-edit-btn .capacity-count { padding: 2px 6px; border-radius: var(--radius-sm); font-size: 0.78rem; }"
    ]
  }
]
```


## Mobile UI polish

スクリーンショット確認後の微調整として `106-mobile-ui-polish.css` を追加しました。

- スマホ幅でヘッダー、タブ、カード、モーダル、下部トレイの余白と角丸を微調整
- ダークモードの黒さとカード境界を少し弱める
- 車カード・精算カード・待機タブの面を少し柔らかくする
- テーマ設定の完了ボタンまわりを少し見やすくする
- ライトモードは既存の枠なし感を保ちつつ、薄いカード境界だけ整える
- `tests/mobile-ui-polish-check.js` を追加


## Badge/check light-mode repair and local gender heuristic refinement

- ライトモードでも、定員表示（3/3など）とチェックマーク周辺に二重の枠・背景が出ないようにしました。
- `107-badge-check-gender-fixes.css` を追加し、ライト/ダーク共通で定員バッジとチェックアイコンを整理しました。
- 名前からの性別判定を、単純な末尾1文字だけではなく、姓名の分離、よくある名の末尾、2文字名、単漢字名、明示的な「男/女」表記を使うローカル推定に改善しました。
- 外部API送信は引き続き行いません。
- 推定結果は、性別が `unknown` の人だけに反映し、手動変更済みの性別は上書きしません。
- `tests/badge-check-light-check.js` と `tests/gender-heuristic-check.js` を追加しました。
