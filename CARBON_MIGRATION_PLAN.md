# Carbon Design System 段階移行計画

更新日: 2026-08-01  
対象: フェーズ1「移行前の安全な土台づくり」

## 1. 結論とフェーズ1の境界

このリポジトリは、Carbon v11相当の色・直線形状・余白・フォーカスを独自CSSへ取り込んでいる一方、公式Carbon Web Components、Carbon Icons、実フォントとしてのIBM Plexはまだ導入していない。したがって、評価は次の2軸に分ける。

| 指標 | 現状 | 根拠 |
|---|---:|---|
| 公式Carbon実装率 | **0%** | 一般UI 9分類で公式Web Components 0件、Font Awesome 67種類中Carbon Icons 0件、IBM Plexの実ロード0件 |
| Carbon視覚契約への準拠度 | **約40%（定性的）** | White / Gray 100相当のsemantic token、4/8px系余白、角丸0、フォーカストークン、ライト／ダークテーマがある。ただし実コンポーネント、フォント、操作契約はBootstrapまたは独自実装 |

「Carbon風の見た目」は公式Carbon化率に算入しない。今後は、公式コンポーネント・公式アイコン・実際に読み込まれたPlexフォントだけを公式実装として数える。

フェーズ1ではUIソース、計算、保存形式、Firebase同期を変更していない。Bootstrap、Font Awesome、既存CSSも残した。変更はテスト基準、テストスクリプト、計画書だけである。

## 2. リポジトリの現状

### 実行構成

- 単一の`index.html`とclassic script群で動く、ビルド工程のない構成。
- UI状態とDOM生成は`assets/js/core/`、`features/`、`templates/`へ分割されている。
- CSSはowner制で、`tokens` → `components` → 画面別ownerの順に読み込む。
- Bootstrap 5.3.0、Font Awesome 6.4.0、SortableJS 1.15.0をローカルvendorとdevDependenciesの両方で保持している。
- `@carbon/web-components`、`@carbon/icons`、IBM Plex各パッケージは未導入。
- `font-family`には`"IBM Plex Sans"`が書かれているが、`@font-face`、外部stylesheet、ローカルフォントファイルのいずれもなく、実際にはOSフォールバックで表示される。
- 公式の現行パッケージは`@carbon/web-components`で、個別component moduleをimportする方式が案内されている。旧`carbon-web-components`を新規採用しない。[公式npm](https://www.npmjs.com/package/@carbon/web-components) / [Carbonリポジトリ](https://github.com/carbon-design-system/carbon)
- 日本語を含むPlexは、IBM公式が配布する`@ibm/plex-sans-jp`を候補にする。[IBM Plex公式](https://github.com/IBM/plex)

### 既存設計資料から維持する原則

- `CSS_ARCHITECTURE.md`と`CSS_OWNER_MAP.md`のowner制を維持する。
- 画面全体へ後付けするoverride / skinを作らない。
- テーマ差はsemantic tokenを介す。
- モバイルの可視操作は原則48px以上。
- 車カード、座席、未割当トレイ、精算カード、共有画面はドメイン固有部品として残す。

## 3. Bootstrap依存の棚卸し

### 機能別一覧

| 機能 | 現在のBootstrap依存 | 主な場所 | 移行分類 |
|---|---|---|---|
| ヘッダー「その他」 | Dropdown、`data-bs-toggle="dropdown"`、menu/item/divider/end、`show` | `index.html`, `guides-modals/modal/02-dropdowns.css` | 公式Carbon Web ComponentsのOverflow menu / Menu系へ置換 |
| 自動割当の条件メニュー | Dropdown / Dropup、Button、`data-bs-toggle="dropdown"` | `index.html`, `waiting-tray.js`, tray CSS | 公式Carbon Web ComponentsのMenu / Dropdown系へ置換 |
| 主要10モーダル | Modal shell、dialog/content/header/body/footer、size/scroll/fullscreen、backdrop、`data-bs-dismiss` | `index.html`, `modal-controller.js`, 画面別modal CSS | 公式Carbon Web ComponentsのModalへ段階置換 |
| 動的確認・通知ダイアログ | 動的にModal DOMを2個生成、Button、`hidden.bs.modal` | `assets/js/modules/ui.js` | 公式Modal / Notificationへ置換。Promise API互換adapterを維持 |
| モーダルの保存境界 | `hide.bs.modal` / `hidden.bs.modal`で精算draft保存・破棄・フォーカス復帰 | `modal-controller.js`, `runtime.js`, `seat-member-picker.js` | Modal移行時にCarbon eventへadapterを用意。業務処理は変更しない |
| 参加者登録 | Modal、Grid、Button、form control/label、spacing utilities | `index.html`, import-guide CSS, `batch-import.js` | 入力・Button・Modalは公式WC、登録表レイアウトはCarbon準拠の独自CSS |
| 共通編集・サンプル | Modal、Button、Input / Select、Grid | `index.html`, `runtime.js`, `sample-data-history.js` | 公式Text Input / Select / Button / Modal |
| 精算設定 | Modal、Button、Checkbox / Select | `index.html`, settlement controls | 公式Toggle / Checkbox / Select / Button / Modal |
| 車ごとの精算編集・経路補助 | Modal、Button、フォームutilities | `index.html`, settlement templates/features | 一般操作は公式WC。費用行・候補・経路順序は独自コンポーネント |
| 履歴 | Modal、List group、Badge、flex/spacing utilities | `index.html`, `sample-data-history.js` | Modal / Tag / Buttonは公式WC、履歴行の構造は独自list |
| 車・班カードのグリッド | `row`, `g-3`, `col-12`, `col-md-6`, `col-lg-4`, padding utilities | `index.html`, `person-cards.js`, car-card CSS | Carbon準拠の独自CSS Gridへ置換 |
| 画面内Button | `btn`, variants、size、close、width utilities | `index.html`, `ui.js` | 一般Button / Icon Buttonは公式WC。カード内部の配置wrapperは独自維持 |
| フォーム | `form-control`, `form-select`, `form-check-*`, labels | `index.html`, token/component CSS | 公式Text Input / Textarea / Select / Checkbox / Toggle |
| タグ・状態 | `badge`, `bg-primary`, `rounded-pill`と多数の独自badge | historyと各画面 | 汎用Tagは公式WC。学年・費用区分などドメイン固有tagは公式Tag適用可否を個別判定 |
| レイアウトutilities | margin/padding/gap/display/text/shadow/width utilities | `index.html`, `sample-data-history.js` | Carbon spacing tokenを使う独自utilityまたはowner CSSへ移す |

### 使用クラス

コンポーネント／状態:

- Button: `btn`, `btn-sm`, `btn-primary`, `btn-secondary`, `btn-outline-primary`, `btn-outline-secondary`, `btn-close`, `disabled`, `active`
- Modal: `modal`, `fade`, `show`, `modal-dialog`, `modal-dialog-centered`, `modal-dialog-scrollable`, `modal-fullscreen-sm-down`, `modal-sm`, `modal-lg`, `modal-content`, `modal-header`, `modal-title`, `modal-body`, `modal-footer`, `modal-backdrop`, `modal-open`
- Dropdown: `dropdown`, `dropup`, `dropdown-toggle`, `dropdown-menu`, `dropdown-menu-end`, `dropdown-item`, `dropdown-item-text`, `dropdown-header`, `dropdown-divider`, `show`
- Form: `form-control`, `form-select`, `form-select-sm`, `form-label`, `form-check`, `form-check-input`, `form-check-label`
- List / tag: `list-group`, `list-group-flush`, `list-group-item`, `list-group-item-action`, `badge`, `bg-primary`, `rounded-pill`

Grid／utility:

- `row`, `g-3`, `col-12`, `col-6`, `col-md-3`, `col-md-6`, `col-lg-4`
- `d-flex`, `d-grid`, `align-items-center`, `justify-content-between`, `gap-2`
- `m-0`, `mb-0`, `mb-1`, `mb-2`, `mb-3`, `mt-2`, `me-1`, `me-2`, `p-0`, `p-3`, `pb-5`, `py-1`, `py-2`
- `w-100`, `small`, `text-center`, `text-danger`, `text-muted`, `shadow`

`.btn-accent-solid`や`.modal-title--standard`など、Bootstrap名を含む独自modifierは公式クラスではないが、Bootstrap classに結合しているため同じ移行単位で扱う。

### JavaScript APIとdata属性

- `data-bs-toggle`: 2件（ヘッダーmenu、自動割当条件menu）。
- `data-bs-dismiss`: 15件（close、cancel、confirm）。
- `bootstrap.Modal`インスタンス: core controller 8件、debug 1件、planning check 1件、動的confirm/alert 2件。
- Bootstrap lifecycle event: `hide.bs.modal`, `hidden.bs.modal`。
- Bootstrap state DOM: `.show`, `.modal-backdrop`, `body.modal-open`, `aria-modal`, `aria-hidden`。
- テストにはBootstrap unavailable時のfallbackが重複実装されている。公式Modal移行が完了するまで削除しない。

### Bootstrap削除ゲート

次がすべて0件になった後にのみ、vendor、devDependency、CSS owner、テストfallbackを削除する。

1. `data-bs-*`
2. `bootstrap.*`と`*.bs.modal`
3. 上記Bootstrap classのmarkup生成
4. Bootstrap classを対象にした独自CSS selector
5. テストのBootstrap route / fallback

## 4. Font Awesome依存の棚卸し

`index.html`と`assets/js/**/*.js`で、**67種類・134参照・22ファイル**を確認した。CSS pseudo-elementにFont Awesome glyphを直書きした箇所はない。

| 機能 | Font Awesome | Carbon移行 |
|---|---|---|
| ヘッダー・主要ナビ | `ellipsis`, `circle-question`, `clock-rotate-left`, `list-check`, `wand-magic-sparkles`, `moon`, `sun`, `trash-can`, `lock`, `unlock`, `link`, `bars`, `pen-to-square`, `table-list`, `receipt` | Carbon Iconsへ置換 |
| 概要・タイムテーブル | `xmark`, `plus`, `copy`, `times` | Carbon Iconsへ置換 |
| 車割・班割toolbar / 未割当 | `plus`, `fill-drip`, `dice`, `sliders`, `chevron-up`, `chevron-down`, `broom` | Carbon Iconsへ置換 |
| 車・座席・参加者 | `car`, `car-side`, `user-group`, `reply`, `pen`, `ellipsis-vertical`, `flag`, `lock-open`, `ban`, `minus`, `trash-alt`, `trash-can`, `circle`, `circle-question` | 残す独自カード内でも描画はCarbon Iconsへ置換 |
| 学年・性別・属性menu | `1`, `2`, `3`, `4`, `graduation-cap`, `mars`, `venus`, `venus-mars`, `sticky-note` | Carbon Icons、または意味が明確な文字labelへ置換。Font Awesomeは残さない |
| 共有画面 | `table`, `table-list`, `hand-pointer`, `pen`, `check`, `lock`, `xmark`, `plus`, `car`, `user-group` | Carbon Iconsへ置換 |
| 精算summary / check | `calculator`, `wallet`, `users`, `car-side`, `square-check`, `clipboard-check`, `lightbulb`, `circle-info` | Carbon Iconsへ置換 |
| 経路補助 | `route`, `google`, `grip-vertical`, `up-right-from-square`, `plus`, `times` | Carbon Iconsへ置換。GoogleブランドmarkはCarbon公式資産の有無を確認し、なければ文字labelを優先 |
| Import / feedback / assurance | `arrow-down`, `arrow-right`, `circle-check`, `circle-exclamation`, `triangle-exclamation`, `circle-info` | Carbon Iconsへ置換 |
| 共有・追加操作 | `copy`, `user-plus`, `history` | Carbon Iconsへ置換 |

全unique名:

`fa-1`, `fa-2`, `fa-3`, `fa-4`, `fa-arrow-down`, `fa-arrow-right`, `fa-ban`, `fa-bars`, `fa-broom`, `fa-calculator`, `fa-car`, `fa-car-side`, `fa-check`, `fa-chevron-down`, `fa-chevron-up`, `fa-circle`, `fa-circle-check`, `fa-circle-exclamation`, `fa-circle-info`, `fa-circle-question`, `fa-clipboard-check`, `fa-clock-rotate-left`, `fa-copy`, `fa-dice`, `fa-ellipsis`, `fa-ellipsis-vertical`, `fa-fill-drip`, `fa-flag`, `fa-google`, `fa-graduation-cap`, `fa-grip-vertical`, `fa-hand-pointer`, `fa-history`, `fa-lightbulb`, `fa-link`, `fa-list-check`, `fa-lock`, `fa-lock-open`, `fa-mars`, `fa-minus`, `fa-moon`, `fa-pen`, `fa-pen-to-square`, `fa-plus`, `fa-receipt`, `fa-reply`, `fa-route`, `fa-sliders`, `fa-square-check`, `fa-sticky-note`, `fa-sun`, `fa-table`, `fa-table-list`, `fa-times`, `fa-trash-alt`, `fa-trash-can`, `fa-triangle-exclamation`, `fa-unlock`, `fa-up-right-from-square`, `fa-user-group`, `fa-user-plus`, `fa-users`, `fa-venus`, `fa-venus-mars`, `fa-wallet`, `fa-wand-magic-sparkles`, `fa-xmark`。

Font Awesome削除ゲートは、`fa*` class、`<i>` icon wrapper、theme controllerのclass差し替え、テストfixture、vendor routeがすべてCarbon iconまたは意味の明確なtextへ移ったこと。

## 5. 部品の最終分類

Carbonの公式component catalogにはButton、Checkbox、Content switcher、Dropdown、Modal、Notification、Select、Tag、Text input、Toggleなどが含まれる。[公式component一覧](https://carbondesignsystem.com/components/overview/components/)

### 公式Carbon Web Componentsへ置換

- Button、Icon Button、close action
- Text Input、Textarea、Number Input
- Select、Dropdown、Overflow menu / Menu
- Checkbox、Toggle
- Content Switcher（車割／班割）
- Tag（汎用status、履歴復元、単純なcount）
- Inline / Toast Notification
- Modal（静的10個、動的confirm/alert）
- Accordion / disclosure（参加者登録helpで適合する箇所）

### Carbon Iconsへ置換

- 上記67種類のFont Awesome。
- 独自カードを残す場合も、カード内iconだけはCarbon Iconsへ置換する。
- icon-only操作には`aria-label`を必須とし、装飾iconは`aria-hidden="true"`を維持する。

### Carbon準拠の独自コンポーネントとして維持

- 車カード、班カード
- 運転者／班長、座席、参加者カード
- 未割当トレイとdrag/drop状態
- 車／班のresponsive grid
- 共有画面の車割・班割表、pan / pinch、quick edit
- 精算の全体費用、車別費用、支払い、集金、部費収支カード
- 経路stop並び替えと候補表示
- 概要drawerとタイムテーブル行
- planning coach mark（Carbon Toggletipで要件を満たせるかは後続で再評価）
- Firebase同期状態とlock scopeなど、アプリ固有の複合状態表示

独自コンポーネント内のButton、Input、Select、Toggle、Tag、Notification、Menuは、DOM境界とdrag/dropを壊さない範囲で公式WCを組み込む。

## 6. 開始時点のテスト結果

変更前の大量の未コミット変更をそのまま開始状態として記録した。今回その内容は上書きしていない。

| 実行 | 結果 | 備考 |
|---|---:|---|
| CSS lint | 成功 | error 0 |
| 静的suite | **82 / 82成功** | `tests/run-static-tests.js` |
| 全Playwright（初回） | **0 / 49、起動前失敗** | Playwright Chromium未配置 |
| 全Playwright（system Chrome、7 workers） | **31成功 / 18失敗** | アプリを実行できる環境での開始基準 |

18失敗の内訳:

- 既存Modal snapshot差分: 6件（360 / 390 / 430 / 768 / 1280 / 1440）。現在UIと既存snapshotが一致していない。
- 48px touch target: 1件。`capacity-edit-btn`は64×40px、driver/member menuは36×36px。
- focus保持: 1件。精算距離inputへ入力後にfocusが外れる。
- layout契約: 1件。精算の補足noteがdriver名の左側へ回り込む。
- settlement compact/list切替・整列: 5件。
- 参加者登録／driver card layout: 2件。
- refinementの横overflow、全Modal検査: 2件。並列時30秒timeout。

開始時点の失敗はフェーズ1で大規模修正しない。個別再実行で再現性を分離し、フェーズ2前の既知負債として扱う。

環境メモ:

- `pnpm install --frozen-lockfile`は依存展開後、Font Awesomeのbuild scriptが許可されていないというローカルpolicyでexit 1になった。
- アプリ内Browser接続は実行環境のprocess binding競合で初期化できなかったため、既存Playwrightをsystem Chromeで実行した。

## 7. 追加したVisual Regression基準

`tests/carbon-phase1-visual.spec.js`に16 scenario、80枚のsnapshot基準を追加した。

### 主要画面

360×800、390×844、768×1024、1280×720の各幅、light / darkの両方で次をfull-page比較する。

- 車割
- 班割
- 共有画面
- 精算
- 未割当トレイ（班割とは別にelement snapshot）

### 主要モーダル

390pxと1280px、light / darkで、背景を含むviewport snapshotを比較する。

- 共通編集
- 参加者登録
- ユーザーガイド
- 精算設定
- 車ごとの費用編集
- 移動距離計算
- 空席メンバー選択

### 空状態

390pxと1280px、light / darkで次をfull-page比較する。

- 車割／班割の参加者未登録
- 共有画面のデータなし
- 精算データなし

### 同時に監視する品質契約

- document横overflowがない。
- visibleなbutton / summary / `role=button`にaccessible nameがある。
- Font Awesomeの装飾iconに`aria-hidden="true"`がある。
- 主要Modalが`aria-labelledby`とopen中の`aria-modal="true"`を持つ。
- Tab移動先にvisible focus outlineがある。
- 360 / 390 / 768pxでは48px未満の新しい操作を失敗にする。

現在すでに48px未満の`.capacity-edit-btn`, `.driver-menu-btn`, `.member-menu-btn`, `.seisan-edit-btn`, 空状態primary actionはannotation付き既知負債として許容し、新しい違反だけを検出する。修正されれば例外から自然に消え、テストは失敗しない。

snapshotは現環境のWindows / Chromium基準。既存の精算Modalについても、開始時点で差分になっていたWindows基準6枚を現行UIへ更新した。Linux baselineはCIと同じfont/runtimeで別途生成し、同じ画面を目視承認する必要がある。

### フェーズ1完了時の実行結果

| 実行 | 結果 | 備考 |
|---|---:|---|
| CSS lint | 成功 | error 0 |
| 静的suite | **82 / 82成功** | 開始時点から不変 |
| 追加したPhase 1 visual / quality suite | **16 / 16成功** | 80 snapshot、overflow、touch、focus、ARIA契約 |
| 既存Modal Visual Regression | **6 / 6成功** | Windows基準6枚を現行UIへrebaseline |
| 全Playwright（system Chrome、7 workers） | **55成功 / 10失敗、全65件** | 16件追加後。新規suiteとvisual基準は成功 |

完了時に残った10失敗は、開始時点でも失敗していた既知領域である。内訳はlayout note位置1件、refinementの横overflow／Modal走査timeout 2件、参加者表／driver card 2件、精算compact layout 5件。開始時点で失敗したfocus保持と48pxの既存testは最終全実行では再現しなかったが、実装上の既知負債とPhase 1 auditのallowlistは残している。テストを通すためのUI修正や固定値は追加していない。

## 8. ユーザーガイド画像監査

`assets/images/user-guide/`の11枚を、現行390px UIの実キャプチャと比較した。**11枚すべてに不一致がある**。ガイド画像は旧い角丸、余白、sample data、control配置を示し、現行UIは直線形状、異なるsample data、異なる情報階層になっている。

| 画像 | 判定 | 主な不一致 |
|---|---|---|
| `01-navigation.webp` | 不一致 | 旧企画名、旧角丸header controls、「企画チェック」がmenuにない、現行headerの文字階層と異なる |
| `02-participant-import.webp` | 不一致 | 旧rounded bottom sheet、旧button/accordion、現行の直線Modalとhelp構造に不一致 |
| `03-car-allocation.webp` | 不一致 | 旧sample名、旧rounded cards / chips、現行のsquare card・選択面・toolbarに不一致 |
| `04-team-allocation.webp` | 不一致 | 旧sample名、旧cards、未割当trayと自動割当controlsの現行形状に不一致 |
| `05-shared-screen.webp` | 不一致 | 旧summary/card/table形状と現行Carbon token版の表、更新表示、余白に不一致 |
| `06-overview.webp` | 不一致 | 旧rounded drawer fields / rowsと現行drawer ownerの直線surfaceに不一致 |
| `07-settlement-settings.webp` | 不一致 | 旧toggle / checkbox / select、旧集金文言、現行設定layoutに不一致 |
| `08-car-cost.webp` | 不一致 | 旧費用editor、旧Times toggle / extras / footer形状と現行compact editorに不一致 |
| `09-route-helper.webp` | 不一致 | 旧rounded stop rows / candidates / footerと現行route helperに不一致 |
| `10-settlement-summary.webp` | 不一致 | 旧sample計算・3カード・driver detail、現行金額・tag・surface hierarchyに不一致 |
| `11-settlement-checks.webp` | 不一致 | 旧集金checkとshare text、現行の支払い／部費／collection表現に不一致 |

画像は今回更新しない。公式Carbon移行中に何度も陳腐化するため、各画面の最終移行とVisual Regression承認が終わった時点で、390px lightの実画面から再生成する。

## 9. 今後の移行順序

各段階で、対象を1機能群に限定し、静的suite、対象Playwright、全Visual Regressionを通してから次へ進む。

### Phase 2A: foundationを公式資産へ接続

1. `@carbon/web-components`の個別importが動く最小module entryを追加する。既存classic scriptの読み込み順を変えない。
2. `@carbon/icons`と`@ibm/plex-sans-jp`を導入し、self-hostする。
3. Plex導入による全画面の文字幅差をVisual Regressionで承認する。
4. Carbon theme/tokenと既存semantic tokenの対応表を確定する。

### Phase 2B: 低リスク部品

優先順:

1. staticなCarbon Icons（header navigation、概要、空状態）。
2. 単純なButton / Icon Button（保存・閉じる・追加など、drag/dropとform submitを持たないもの）。
3. 車割／班割Content Switcher。既存`role=tablist`、`aria-selected`、左右key操作を保持する。
4. Toast / Inline Notification。`AppUI.showStatus`の公開APIはadapterで維持する。
5. 履歴Tagと単純なstatus Tag。
6. 共通編集／debugのText InputとSelect。

### Phase 3: form controls

1. 参加者登録のText Area / Input / disclosure。
2. 精算設定のSelect / Checkbox / Toggle。
3. 車費用editorのNumber Input / Select / Button。
4. native value、change/input timing、focus、保存debounceを既存形式のままadapterする。

### Phase 4: menuとModal

1. header Overflow menu。
2. 自動割当条件menu。
3. 共通編集、history、debugの単純Modal。
4. user guide / participant importの長尺Modal。
5. settlement settings / car edit / route helper。
6. `hide.bs.modal` / `hidden.bs.modal`依存をCarbon event adapterへ移し、draft保存、cancel、focus復帰を検証する。

### Phase 5: 独自コンポーネントのCarbon準拠仕上げ

- 車・班・座席・未割当・共有・精算カードのtoken、状態、keyboard操作、ARIAを公式基準へ合わせる。
- 内部の一般controlだけ公式WCへ置換する。
- drag/drop、保存形式、計算、Firebase同期は境界testで固定する。

### Phase 6: legacy削除

- Bootstrap class/API/data属性とtest fallbackが0件であることを機械確認する。
- Font Awesome class/vendor/test routeが0件であることを機械確認する。
- `assets/vendor/bootstrap`, `assets/vendor/fontawesome`とdevDependenciesを最後に削除する。
- 全snapshotとユーザーガイド画像を最終更新する。

## 10. 残るリスク

- 現在の作業ツリーはフェーズ1開始前から多数の未コミット変更を含み、既存visual snapshotともずれている。
- 公式Web ComponentsはES moduleで、現状はbuildなしclassic script構成。module entryとGitHub Pages配信方法を先に決める必要がある。
- Shadow DOMの内部は既存`.btn`, `.modal`, `.dropdown` selectorで上書きできない。Carbon component APIとCSS custom propertiesで調整する。
- Modal lifecycleに精算draft保存、prompt Promise、seat pickerのfocus復帰が結合している。
- generated HTML stringが多く、custom element upgrade timingとevent delegationを確認する必要がある。
- primary view navigationはaccessible nameを持つが、明示的なtablist / `aria-selected` / `aria-controls`契約がない。
- 既知の36～42px操作領域、精算focus喪失、layout regressionが残る。
- Windows baselineのみ追加できる。Linux CI baselineとFirefox / WebKitは未検証。
- ガイド11枚は現行UIと不一致。移行完了前に更新すると再度陳腐化する。
- Carbon packageのModal、Notification、Toggleなどにはversionによってfeature flagがあるため、Phase 2開始時に採用versionのStorybook/APIを固定する。

## 11. フェーズごとの完了ゲート

1. 対象機能の保存dataと計算結果が変更されていない。
2. Firebase同期のread/write payloadが変更されていない。
3. static suiteとCSS lintが成功する。
4. 対象interaction testが成功する。
5. 360 / 390 / 768 / 1280、light / darkの対象snapshotを目視承認する。
6. 横overflow、48px、新規ARIA、keyboard focusを確認する。
7. 既知失敗を増やしていない。
8. Bootstrap / Font Awesomeを削除するのはPhase 6だけ。
