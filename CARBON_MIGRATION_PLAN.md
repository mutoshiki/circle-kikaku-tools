# Carbon Design System 完成状態（2026-08-03）

> この文書の後半は段階移行時の履歴です。現在の完成状態は `CARBON_COMPLETION_REPORT.md` を正とします。

- 汎用UIは公式Carbon Web Componentsへ移行済み。
- Bootstrap／Font Awesomeのruntime依存は削除済み。
- IBM Plex Sans／IBM Plex Sans JP、Carbon Iconsをself-host。
- Button、Icon Button、Content Switcher、Notification、Tag、Text Input、Number Input、Textarea、Select、Checkbox、Toggle、Modal、Overflow Menu／Menu、Popoverを公式部品で使用。
- ドメイン固有の車両・座席・参加者・精算・共有キャンバスはCarbon token／layer／type／spacing／focus／state契約で実装。
- 後付けoverrideファイルなし。owner制を維持。
- 静的契約、CSS、JavaScript、Chromium操作、4画面幅×2テーマの検証構成を復旧。

---

# Carbon Design System 段階移行計画

更新日: 2026-08-01  
対象: フェーズ1「移行前の安全な土台づくり」完了記録、およびフェーズ2A「公式Carbonの最小導入」完了記録

## 1. 結論とフェーズ2Aの境界

フェーズ1開始時、このリポジトリはCarbon v11相当の色・直線形状・余白・フォーカスを独自CSSへ取り込んでいる一方、公式Carbon Web Components、Carbon Icons、実フォントとしてのIBM Plexは未導入だった。フェーズ2Aで公式runtimeと最初の低リスク部品を導入したため、現在値は次のように再評価する。

| 指標 | フェーズ1開始時 | フェーズ2A完了時 | 根拠 |
|---|---:|---:|---|
| 公式Web Componentsの分類着手率 | **0 / 9分類（0%）** | **1 / 9分類（11%）** | Button / Icon Button分類に4 instanceを導入。9分類すべての完了率はまだ0% |
| Font Awesome参照の移行率 | **0 / 134参照（0%）** | **14 / 134参照（10.4%）** | 残存120参照。unique icon名は67種類から64種類へ減少 |
| 公式フォント導入率 | **0 / 2 family（0%）** | **2 / 2 family（100%）** | IBM Plex SansとIBM Plex Sans JPをself-hostし、browser runtimeで実ロードを確認 |
| 公式基盤の整備率 | **0 / 4項目（0%）** | **4 / 4項目（100%）** | module entry、Carbon Icons、Plex、再現可能なbuild / CI差分検査 |
| Carbon視覚契約への準拠度 | **約40%（定性的）** | **約45%（定性的）** | 既存semantic tokenに公式component用tokenを接続し、最小範囲だけ公式の操作・focus契約へ移行 |

「Carbon風の見た目」は公式Carbon化率に算入しない。公式コンポーネント・公式アイコン・実際に読み込まれたPlexフォントだけを公式実装として数える。分類着手率11%は一般UI全体の完了率を意味せず、Button分類も4 instanceだけの部分移行である。

フェーズ1ではUIソース、計算、保存形式、Firebase同期を変更していない。フェーズ2Aでも計算、保存形式、Firebase同期を変更せず、Bootstrap、Font Awesome、既存CSSを残したまま、公式資産と4つの低リスク操作だけを追加した。

## 2. リポジトリの現状

### 実行構成

- 単一の`index.html`とclassic script群で動く構成を維持し、Carbon vendor生成にだけ最小build工程を追加した。
- UI状態とDOM生成は`assets/js/core/`、`features/`、`templates/`へ分割されている。
- CSSはowner制で、`tokens` → `components` → 画面別ownerの順に読み込む。
- Bootstrap 5.3.0、Font Awesome 6.4.0、SortableJS 1.15.0をローカルvendorとdevDependenciesの両方で保持している。
- `@carbon/web-components`、`@carbon/icons`、IBM Plex各パッケージをexact pinし、生成済みlocal vendorから配信する。
- IBM Plex Sans / IBM Plex Sans JPは`@font-face`とlocal woff2で実ロードする。OSフォールバックはfont取得失敗時だけ使う。
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

- フェーズ2Aの公式資産は生成済みvendorを静的配信する。依存更新時にbundleとlicenseを再生成し忘れないCI gateが必要で、今回追加した。
- module entryは既存classic scriptと別の`type="module"`として後段に置く。今後のcomponent追加でもclassic scriptの評価順を変えない。
- Shadow DOMの内部は既存`.btn`, `.modal`, `.dropdown` selectorで上書きできない。Carbon component APIとCSS custom propertiesで調整する。
- Modal lifecycleに精算draft保存、prompt Promise、seat pickerのfocus復帰が結合している。
- generated HTML stringが多く、custom element upgrade timingとevent delegationを確認する必要がある。
- primary view navigationはaccessible nameを持つが、明示的なtablist / `aria-selected` / `aria-controls`契約がない。
- 既知の36～42px操作領域、精算focus喪失、layout regressionが残る。
- Windows baselineのみ追加できる。Linux CI baselineとFirefox / WebKitは未検証。
- ガイド11枚は現行UIと不一致。移行完了前に更新すると再度陳腐化する。
- Carbon packageのModal、Notification、Toggleなどにはversionによってfeature flagがあるため、各component採用時に2.60.0のStorybook/APIを固定する。

## 11. フェーズごとの完了ゲート

1. 対象機能の保存dataと計算結果が変更されていない。
2. Firebase同期のread/write payloadが変更されていない。
3. static suiteとCSS lintが成功する。
4. 対象interaction testが成功する。
5. 360 / 390 / 768 / 1280、light / darkの対象snapshotを目視承認する。
6. 横overflow、48px、新規ARIA、keyboard focusを確認する。
7. 既知失敗を増やしていない。
8. Bootstrap / Font Awesomeを削除するのはPhase 6だけ。

## 12. フェーズ2A完了記録: 公式Carbonの最小導入

### 採用方針とversion

- `@carbon/web-components` **2.60.0**、`@carbon/icons` **11.85.0**、`@ibm/plex-sans` **1.1.0**、`@ibm/plex-sans-jp` **3.0.0**をexact pinした。
- 公式componentはpackage rootを丸ごと読み込まず、ButtonとIcon Buttonの個別moduleだけを`assets/js/carbon-entry.js`からimportする。
- 既存GitHub Pagesの静的配信を維持するため、esbuild **0.28.1**で1本のES moduleへbundleし、`assets/vendor/carbon/`へ生成する。runtime CDN、import map、`node_modules`配信には依存しない。
- IBM PlexはRegular / SemiBoldのLatin・日本語woff2を`assets/vendor/ibm-plex/`へself-hostする。既存classic scriptの順序は変更しない。
- `npm run build:carbon`を再生成の正規入口とし、CIでは生成後にvendor差分がないことを検査する。package licenseもvendorに同梱する。

公式が案内する個別component module importに沿い、旧`carbon-web-components`は採用していない。参照: [Carbon Web Components package](https://github.com/carbon-design-system/carbon/tree/main/packages/web-components)、[Carbon Icons / Carbon repository](https://github.com/carbon-design-system/carbon)、[IBM Plex](https://github.com/IBM/plex)。

### 移行した部品

公式Carbon Web Componentsへ移行した4 instance:

1. `shareLinkBtn`: headerの共有リンクIcon Button。
2. `overviewMenuBtn`: 概要drawerを開くIcon Button。
3. `overviewDrawerCloseBtn`: 概要drawerを閉じるIcon Button。
4. `overviewTimetableAddBtn`: タイムテーブル行を追加するButton。

既存id、event delegation、`aria-expanded`、`aria-controls`を維持したため、公開APIと操作結果は変更していない。Shadow DOMへ既存Bootstrap selectorを当てず、hostの寸法、semantic color、focus ringだけをowner CSSで接続した。

Carbon Iconsは11種類、14参照に導入した。

- header / navigation: `overflow-menu-horizontal`, `link`, `menu`, `edit`, `table`, `receipt`
- drawer: `close`, `add`
- 空状態: `user-multiple`, `car`, `calculator`
- 動的template: 共有画面と精算cardの`edit`

`data-carbon-icon` placeholderを公式icon definitionのSVGへ置き換える小さなrendererをmodule entryに置き、MutationObserverで既存の動的HTML生成にも追従させた。装飾iconは`aria-hidden="true"`、`focusable="false"`とし、accessible nameは操作部品側に残した。

### 意図した見た目の差分

- IBM Plex Sans / IBM Plex Sans JPの実適用による字幅、行高、折り返し位置の差。
- header / main navigation / 空状態 / 一部編集操作のglyphがFont AwesomeからCarbon Iconsへ変わった差。
- 公式Icon Buttonのhover / focusと20px icon、48px host touch targetの差。

Phase 1の80枚と従来Modal 6枚を再比較し、2%の既存許容差を超えた次の8枚だけを更新した。

- 精算: 360px light / dark、390px light / darkの4枚。
- 主要Modal: participant import 390px light / dark、user guide 390px light / darkの4枚。

それ以外の78枚は既存baselineのまま成功した。card構造、入力値、金額、保存data、Firebase処理を意図差分に含めていない。

### Browser監査

390×844と1280×720のlight / darkで、共有空状態、sample車割、sample精算を監査した。自動化Chromeでは12状態の全組み合わせ、Codexアプリ内サイドブラウザでは要件を覆う代表7状態を実表示した。

| 契約 | 結果 |
|---|---:|
| console warning / error | 0 |
| document横overflow | 0 / 12 |
| 見出し・名称の非意図的clip検出 | 0 / 12 |
| Carbon host touch target | 最小48px |
| Carbon icon描画 | 各状態12個以上 |
| IBM Plex Latin / Japanese runtime load | 12 / 12成功 |
| drawer open、行追加、drawer close | 自動化4 / 4条件＋サイドブラウザ実操作で成功、行数8→9 |
| 共有リンクIcon Button | サイドブラウザ実操作で成功noticeを確認 |

Codexのアプリ内サイドブラウザは、初回client初期化時に保護された`process` bindingと競合した。clientのprocess shimをsession内だけで局所的に適用して接続し、確認後にplugin fileを元へ戻した。repository外の恒久変更は残していない。

### テスト結果

| 実行 | 結果 |
|---|---:|
| `npm run build:carbon` | 成功 |
| CSS lint | 成功、error 0 |
| 静的suite | **83 / 83成功** |
| Carbon runtime専用test | **1 / 1成功** |
| Phase 1 visual / quality | **16 / 16成功** |
| 既存Modal Visual Regression | **6 / 6成功** |
| 全Playwright | **56成功 / 10失敗、全66件** |

全体の失敗数はフェーズ1完了時の10件を超えていない。Carbon導入直後に増えたheader Icon Buttonのfocus観測と`<i>`前提のtestは、Shadow DOM対応の可視focus ringとSVG / Web Component対応の意味ある契約へ修正し、どちらも成功した。

残る10失敗は、精算note位置1件、Modal走査timeout 1件、既存36～40px touch target 1件、参加者表1件、driver card 1件、精算compact typography 5件である。いずれもフェーズ1から記録済みの領域で、今回の対象外として大規模修正していない。

### 残存依存の再集計

`index.html`と`assets/js/**/*.js`を再集計した。

| 依存 | フェーズ1 | フェーズ2A後 | 差分 |
|---|---:|---:|---:|
| Font Awesome unique icon名 | 67 | **64** | -3 |
| Font Awesome参照 | 134 | **120** | -14 |
| Font Awesome参照ファイル | 22 | **21** | -1 |
| `data-bs-toggle` | 2 | **2** | 0 |
| `data-bs-dismiss` | 15 | **15** | 0 |
| `bootstrap.Modal`参照 | 12 | **12** | 0 |
| `hide.bs.modal` / `hidden.bs.modal`参照 | 10 | **10** | 0 |

Bootstrap 5.3.0とFont Awesome 6.4.0のvendor / devDependency / stylesheetは残している。削除ゲートにはまだ到達していない。

### 次の低リスク移行順

1. static Font Awesomeの続き: main menu、history、theme、deleteなど、単一状態で装飾用途のicon。
2. 単純Button / Icon Buttonの続き: form submit、drag、Modal lifecycleを持たない「開く」「コピー」「補助」操作。
3. 車割／班割Content Switcher: 既存`role=tablist`、`aria-selected`、左右key、active plan保存を固定してから公式componentへ移行。
4. Status / ToastをNotification adapterへ移行し、`AppUI.showStatus`の公開APIを維持。
5. 単純Tagと共通編集のText Input / Select。

Modal、Dropdown、Toggle、精算入力、参加者importはBootstrap lifecycle、value timing、保存境界との結合が強いため、上記より後に扱う。

### フェーズ2A完了時のリスク

- 公式Web ComponentsのShadow DOMと既存light DOM testではfocus targetが異なる。今後もhostと内部controlを両方検査する。
- generated bundleとfontをrepositoryへ保持するため、依存更新時は`npm run build:carbon`とlicense差分の確認が必要。
- IBM Plex JPのRegular / SemiBoldだけで約4.7MBある。GitHub Pagesの転送量と初回表示を測り、必要ならunicode-rangeやsubsetを検討する。
- Chromium / WindowsとCodexアプリ内サイドブラウザで確認済み。Linux CI baseline、Firefox、WebKitは未確認。
- 既知の10失敗と36～40px操作が残る。対象componentを移行する時にallowlistを縮小する。
- ユーザーガイド11枚は現行UIと不一致のまま。画面の公式Carbon移行が安定した後に再生成する。

## 13. フェーズ2B事前選定: 低リスクな静的iconと単純Button

実装前の再集計はFont Awesome **64種類・120参照・20 icon-bearing files**、公式Carbon Button / Icon Button **4 instance**。`assets/js/core/dependency-status.js`の`fa-solid`検出文字列は実iconではないため、参照数から除外する。Bootstrapの基準値は`data-bs-toggle` 2、`data-bs-dismiss` 15、`bootstrap.Modal` 12、`hide.bs.modal` / `hidden.bs.modal` 10である。

### 今回移行する静的icon

| 機能 | Font Awesome | Carbon Icons | 低リスクと判断した理由 |
|---|---|---|---|
| header「使い方」 | `circle-question` | `help` | 装飾専用で`aria-hidden`。click、id、Modal制御は親Buttonが所有し、icon selectorはない |
| header「この端末の履歴」 | `clock-rotate-left` | `recently-viewed` | 装飾専用で状態を持たず、lock判定や履歴表示関数から独立 |
| header「企画チェック」 | `list-check` | `task` | 件数・状態は別spanが所有し、icon自体は固定かつ装飾専用 |
| header「サンプルデータ」 | `wand-magic-sparkles` | `magic-wand` | 固定の装飾iconで、Modal lifecycleやsample投入処理から独立 |
| header「全てリセット」 | `trash-can` | `trash-can` | 固定の装飾iconで、確認・削除処理は既存Button handlerが所有 |
| overview「予定をコピー」 | `copy` | `copy` | clipboard用Button内の固定装飾で、値・保存・submit状態を持たない |
| 共有画面title | `table-list` | `table` | 表題の装飾専用で操作対象ではない |
| 共有画面touch案内 | `hand-pointer` | `touch--1` | gesture説明の装飾専用で、pointer / drag handlerから独立 |

### 今回移行する公式Button

| 機能 | 既存契約 | 低リスクと判断した理由 |
|---|---|---|
| `overviewTimetableCopyBtn` | 同じid、`type=button`、表示名「予定をコピー」、既存`bind` | `copyTextWithFallback`を呼ぶだけで、form submit、保存、Modal、dragを持たない |
| 共有空状態`data-action="switch-list"` | 同じ`data-action`、`type=button`、表示名「車割・班割を開く」 | 既存delegationで`switchView('list')`を呼ぶだけ。計算、保存、Modal、dragを持たない |

対象外はtheme / lockの状態icon、overview行削除、参加者登録、精算card、未割当tray、車card、座席、form submit、Bootstrap Modal内とその開閉・保存Buttonである。これらは状態変更、動的保存、drag、Modal lifecycle、または独自component境界と結合しているため後続phaseへ残す。

### フェーズ2B完了記録

事前選定どおり8 Font Awesome参照をCarbon Iconsへ、2 Button instanceを公式Carbon Web Componentsへ移行した。`overviewTimetableCopyBtn`は既存idと`bind`、共有空状態は既存`data-action="switch-list"`を維持した。どちらも`type="button"`、表示text由来のaccessible name、Shadow DOM内のnative Buttonによるkeyboard操作を保持している。

共有空状態は共有canvasの初期scaleによりCarbon `lg` 48pxが実寸42.24pxになることをruntime testで検出した。この1 instanceだけ`xl`へ上げ、実表示のhost touch targetを48px以上にした。`overviewTimetableCopyBtn`はhost 48px、内部Button約45px。keyboard focus時はCarbonのinset focus ringを確認し、`disabled`をhostへ設定するとShadow DOM内のnative Buttonへ伝播することも検査した。

#### Visual Regression

snapshotを更新せずにPhase 1全16 testを先に実行し、失敗した次の2枚だけactual / expected / diffを目視確認して個別更新した。

- `empty-sheet-390-light-win32.png`
- `empty-sheet-390-dark-win32.png`

差分は公式Carbon Buttonの高さ・幅・右側icon配置と、それに伴う共有空状態card内の再配置だけだった。1280px empty state、主要画面、主要Modalを含む他snapshotは更新していない。更新後はPhase 1 Visual / quality **16 / 16成功**、既存Modal Visual **6 / 6成功**。

#### Side Browser監査

Codexアプリ内サイドブラウザで、390×844 / 1280×720、light / dark、車割 / 班割 / 共有 / 精算の**16画面条件**を実表示した。

| 契約 | 結果 |
|---|---:|
| document横overflow | 0 / 16 |
| 対象見出し・Buttonの文字clip | 0 / 16 |
| console warning / error | 0 |
| 未描画`data-carbon-icon` | 0 / 16 |
| visible Carbon host touch target | 最小48px |
| 共有空状態「車割・班割を開く」 | clickで`view-mode-list`へ遷移 |
| overview「予定をコピー」 | clickで「予定をコピーしました」statusを確認 |
| copy Button keyboard focus | Shadow DOM内ButtonへfocusしCarbon focus ringを確認 |
| header静的icon | 5 / 5 SVG描画、`aria-hidden=true`、accessible nameと文字表示を維持 |

サイドブラウザclientの保護済み`process` binding競合は、フェーズ2Aと同じsession限定shimで接続した。検証後にviewportをresetし、検証tabをcloseし、repository外client fileも元へ戻した。

#### テスト結果

| 実行 | 結果 |
|---|---:|
| Carbon assets build | 成功 |
| CSS lint | 成功、error 0 |
| 静的suite | **84 / 84成功** |
| Carbon runtime | **1 / 1成功** |
| Phase 1 Visual / quality | **16 / 16成功** |
| 既存Modal Visual | **6 / 6成功** |
| 全Playwright | **57成功 / 9失敗、全66件** |

全Playwrightの失敗はフェーズ2Aの既知10件を超えていない。今回はWi-Fi復帰後、既知のModal走査timeout 1件が成功したため9件となった。残る内訳は精算note位置1件、既存36〜40px touch target 1件、参加者表1件、driver card 1件、精算compact typography 5件で、今回の対象外として修正していない。

#### 残存依存の再集計

| 依存 | フェーズ2A後 | フェーズ2B後 | 差分 |
|---|---:|---:|---:|
| Font Awesome unique icon名 | 64 | **61** | -3 |
| Font Awesome参照 | 120 | **112** | -8 |
| Font Awesome icon-bearing files | 20 | **20** | 0 |
| 公式Carbon Button / Icon Button | 4 | **6** | +2 |
| Carbon Icons参照 | 14 | **22** | +8 |
| `data-bs-toggle` | 2 | **2** | 0 |
| `data-bs-dismiss` | 15 | **15** | 0 |
| `bootstrap.Modal`参照 | 12 | **12** | 0 |
| `hide.bs.modal` / `hidden.bs.modal`参照 | 10 | **10** | 0 |

Bootstrap / Font Awesomeのpackage、vendor、stylesheetは残している。計算、保存形式、Firebase同期、独自component、IBM Plex種類・weight、ユーザーガイド画像は変更していない。

#### 次のphase候補とリスク

1. Bootstrap Modal本体は維持したまま、Modal titleやhelper内で状態を持たない装飾iconをCarbon Iconsへ移す。
2. theme / lock / trayの状態iconは、class差し替えをCarbon icon rendererの状態adapterへ分離してから移す。

## 14. フェーズ2C完了記録: 残存icon整理と状態icon adapter

フェーズ2B後の基準値（Font Awesome 61種類・112参照・20 icon-bearing files、Carbon Icons 22参照、公式Carbon Button / Icon Button 6 instance）から開始した。Modal本体、Bootstrap lifecycle、既存Carbon Button、計算・保存・Firebase同期、独自component構造は変更していない。

### 移行対象と除外対象

Modal内は個別に小分けせず、title / heading / helperで状態を持たない装飾iconを1グループとして移行した。

| 機能 | Font Awesome | Carbon Icons | 選定理由 |
|---|---|---|---|
| 参加者登録helper title | `table` | `table` | 説明見出しの装飾専用 |
| 参加者登録helper notice | `circle-info` | `information` | 説明文の装飾専用 |
| 使い方Modal title | `circle-question` | `help` | titleの装飾専用 |
| 精算設定Modal title | `sliders` | `settings--adjust` | titleの装飾専用 |
| 車別費用Modal title | `car-side` | `car-small` | titleの装飾専用。初期markupと名称変更を含む2つの再描画経路を同時移行 |
| 距離計算Modal title | `route` | `roadmap` | titleの装飾専用 |
| 距離計算helper title | `lightbulb` | `idea` | 候補見出しの装飾専用 |
| 履歴Modal title | `history` | `recently-viewed` | titleの装飾専用 |
| 企画チェックModal title | `list-check` | `task` | titleの装飾専用。status iconは別管理のため対象外 |
| サンプルデータModal title | `wand-magic-sparkles` | `magic-wand` | titleの装飾専用 |

次は今回の対象外とした。

- 距離計算Modalの「場所を追加」「Google Map」内iconは、親Buttonの実寸がそれぞれ38px / 42pxで48px契約を満たしていない。Button寸法まで変えるとicon以外のVisual差分になるため、関連する操作部品の移行時へ残した。
- seat picker empty、車card、座席、未割当トレイの構造、精算card内iconは独自component境界なので維持した。
- member lock / unlock、person menuのlock / return、quick editのpen / checkは、card状態・保存・menu actionと結合しているため関連機能と一緒に移行する。
- planning assurance、batch importのsuccess / warning / error、auto assign statusはNotification / input状態と結合しているため、各機能の公式化時へ残した。
- route rowの削除・drag handle・候補追加、form submit、Modal close / saveは操作またはlifecycleと結合しているため対象外とした。

### 状態icon adapter

`assets/js/core/icon-adapter.js`は新しい状態管理基盤ではなく、既存の3つのcontrollerが持っていた「現在状態からicon名を選ぶ処理」だけを集約する小さなadapterである。storage、event、業務状態、表示label、ARIA更新は既存controllerが引き続き所有する。

| 既存状態 | adapter state | Carbon Icon | accessible nameのowner |
|---|---|---|---|
| light theme | `theme.light` | `moon` | `theme-controller.js`の「ダークモードに切り替え」 |
| dark theme | `theme.dark` | `sun` | `theme-controller.js`の「ライトモードに切り替え」 |
| edit lockなし | `editLock.unlocked` | `unlocked` | `lock-protection.js`のロック範囲選択label |
| edit lockあり | `editLock.locked` | `locked` | `lock-protection.js`の解除label |
| 未割当tray closed | `waitingTray.closed` | `chevron--up` | 既存`#tray-handle`の「未割り当てメンバーを開閉」 |
| 未割当tray open | `waitingTray.open` | `chevron--down` | 同上 |

adapterの責務は、対応表からicon名を選ぶこと、同じstate groupの既存SVGを1つだけ残すこと、`aria-hidden="true"`とadapter metadataを新しいSVGへ渡すことだけである。`assets/js/carbon-entry.js`のlight-DOM rendererは`data-state-icon` / `data-icon-state`をSVGへ引き継ぐ。theme / lock / trayの各経路を繰り返し実行してもCarbon SVGは各1個で、placeholder残存は0だった。

### テストの追加・修正

フェーズ専用test fileは追加せず、既存の`tests/carbon-phase2a-contract-check.js`と`tests/carbon-phase2a.spec.js`へPhase 2C契約を統合した。

- static contract: 3 mapping、controllerからの直接Font Awesome mapping除去、Modal / helper icon、`aria-hidden`、Bootstrap残存数、公式Carbon Button 6個、除外対象を検査。
- runtime: light / dark、lock / unlock、tray open / closed、accessible name、`aria-pressed`、SVG重複0、未描画placeholder 0、48px touch target、keyboard focus、trayのEnter / Space操作を検査。
- 既存Phase 2B contractのFont Awesome 112は「上限」とし、後続phaseで減らせる契約へ変更した。

#### Visual Regression

最初のPhase 1実行は13 / 16成功で、次の4画像だけをexpected / actual / diffで確認して個別更新した。

- `team-360-light-win32.png`: header lockと未割当trayの状態icon差分。文字・配置の意図的変更なし。
- `unassigned-tray-360-light-win32.png`: `chevron--up`への意図した差分のみ。
- `modal-route-helper-390-light-win32.png`
- `modal-route-helper-390-dark-win32.png`: title `roadmap`とhelper `idea`への意図した差分のみ。操作Button iconはFont Awesomeのまま。

更新後はPhase 1 Visual / quality **16 / 16成功**、既存Modal Visual **6 / 6成功**。他snapshotは更新していない。

#### Side Browser監査

Codexアプリ内サイドブラウザで、sample dataを使い、390×844 / 1280×720、light / dark、車割 / 班割 / 共有 / 精算の**16画面条件**を確認した。主要Modalは390px lightでサンプル、精算設定、使い方、車別費用、距離計算、1280px lightで企画チェック、1280px darkで履歴を開いた。

| 契約 | 結果 |
|---|---:|
| document横overflow | 0 / 16 |
| 主要見出し・tab・titleの文字clip | 0 / 16 |
| console warning / error | 0 |
| 未描画`data-carbon-icon` | 0 / 16 |
| state icon欠落 / 重複 | 0 / 16（各group 1 SVG） |
| theme | light=`moon` / dark=`sun`、labelと`aria-pressed`更新 |
| edit lock | unlocked=`unlocked` / locked=`locked`、解除後も1 SVG |
| 未割当tray | closed=`chevron--up` / open=`chevron--down`、Enterで開閉 |
| state操作領域 | theme 218×48、edit lock 48×48、tray 390×48 |
| Modal title / helper | `aria-hidden=true`、placeholder 0、title clip 0 |

サイドブラウザclientの保護済み`process` binding競合には検証中だけ互換shimを使い、viewport reset、検証tab close後にrepository外clientを元へ戻した。

### テスト結果

| 実行 | 結果 |
|---|---:|
| Carbon assets build | 成功 |
| CSS lint | 成功、error 0 |
| 静的suite | **84 / 84成功** |
| Carbon runtime | **2 / 2成功** |
| Phase 1 Visual / quality | **16 / 16成功** |
| 既存Modal Visual | **6 / 6成功** |
| 全Playwright | **58成功 / 9失敗、全67件** |

全Playwrightは新しいadapter runtime test 1件が増えたため、フェーズ2Bの57成功 / 9失敗から58成功 / 9失敗になった。失敗数は既知上限10件を超えていない。残る9件は精算note位置1件、既存36〜40px touch target 1件、参加者表1件、driver card 1件、精算compact typography / layout 5件で、今回の対象外として修正していない。

既存overview Carbon Buttonのfocus indicator検査が対象testの初回だけ失敗したが、再実行と最終全Playwrightでは成功した。今回未変更のButtonであり、継続再現しなかったため実行揺れとして記録する。`git diff --check`は生成済みCarbon bundle内のupstream template literal 2行のtrailing whitespaceを引き続き報告する。

### 残存依存の再集計

| 依存 | フェーズ2B後 | フェーズ2C後 | 差分 |
|---|---:|---:|---:|
| Font Awesome unique icon名 | 61 | **51** | -10 |
| Font Awesome参照 | 112 | **89** | -23 |
| Font Awesome icon-bearing files | 20 | **17** | -3 |
| Carbon Icons参照 | 22 | **37** | +15 |
| 公式Carbon Button / Icon Button | 6 | **6** | 0 |
| `data-bs-toggle` | 2 | **2** | 0 |
| `data-bs-dismiss` | 15 | **15** | 0 |
| `bootstrap.Modal`参照 | 12 | **12** | 0 |
| `hide.bs.modal` / `hidden.bs.modal`参照 | 10 | **10** | 0 |

Bootstrap / Font Awesomeのpackage、vendor、stylesheetは残している。既存Carbon Button、IBM Plex種類・weight、ユーザーガイド画像、計算、保存形式、Firebase同期は変更していない。

### 次のphase

アイコン専用phaseはここで終了する。次は**車割 / 班割Content Switcherの公式Carbon Web Components化**を行う。選択状態、`role=tablist` / `tab`、arrow key、focus、mobile幅、車割 / 班割の既存切替関数を先にcontract化し、低リスクな切替shellから移行する。残るFont Awesome iconは、各機能を公式化または独自componentとして整える時に関連部品と一緒に置き換える。

残るリスクは、Shadow DOM内部controlをlight DOM selectorだけでは監査できないこと、共有canvasのscaleが今後のButtonにもtouch target縮小を起こし得ること、既知9失敗、Linux / Firefox / WebKit未確認、ユーザーガイド11枚の不一致である。また生成済みCarbon bundleにはupstream template literal由来の行末空白が含まれ、`git diff --check`ではvendor bundleだけが警告対象になる。生成物を手編集せず、公式build出力として保持する。

## 15. フェーズ3A完了記録: 車割 / 班割Content Switcher

車割画面内の2択だけを、独自`button[role=tab]`から公式Carbon Web Componentsの`cds-content-switcher` / `cds-content-switcher-item`へ移行した。上部の「車割・班割 / 共有画面 / 精算」ナビゲーション、車card、座席、未割当tray、業務ロジック、保存形式、Firebase同期は変更していない。

### 移行前後の構造と維持契約

| 項目 | 移行前 | フェーズ3A後 |
|---|---|---|
| switcher host | `div.car-plan-template-tabs[role=tablist]` | `cds-content-switcher.car-plan-template-tabs[role=tablist]` |
| 2つの選択肢 | 独自`button.car-plan-template-chip[role=tab]` | 公式`cds-content-switcher-item` 2個 |
| 選択値 | `data-car-plan-template`と`aria-selected` | `value` / `selected-index`と公式itemのselected状態。既存`data-car-plan-template`も維持 |
| クリック入力 | light DOM click handler | 公式`cds-content-switcher-selected` eventから既存`updateActiveCarPlanTemplate()`を呼ぶ |
| ArrowLeft / ArrowRight | 独自keydown handler | 公式Carbonのkeyboard実装 |
| Home / End | 独自keydown handler | 既存handlerを維持 |
| 画面描画 | `switchCarPlan()` | 変更なし。Carbon内部へ業務状態を移していない |
| 保存 / 復元 | `activeCarPlanType`を既存data stateへ保存 | 変更なし。reload後に既存経路からselected itemを復元 |

`aria-label="車割と班割を切り替え"`、item ID、`aria-controls="cars-container"`、`data-car-plan-template`を維持した。公式item内部controlのrole、accessible name、`aria-selected`、Shadow DOM focus indicatorもruntimeで検証した。

公式itemの`target`属性は使用していない。車割と班割は別々の静的panelではなく、同じ`#cars-container`を既存関数が再描画する構造である。両itemに同じ`target`を指定するとCarbon自身のpanel表示管理が競合し、業務領域が`hidden`になるため、表示管理は従来どおり`switchCarPlan()`に限定し、アクセシビリティ上の関連だけをhostの`aria-controls`で維持した。

touch targetは390pxでhost / item内部controlとも各109.5×48px、1280pxで各514.5×48pxだった。参加者登録Buttonは48pxを維持し、switcherとの重なりはなかった。CSSはlight DOM hostの幅・flex・最小高だけを指定し、CarbonのShadow DOM内部class、`::part`、内部DOM構造には依存していない。

### 実装とtest

- `assets/js/carbon-entry.js`: 公式Content Switcher moduleをbundle entryへ追加。
- `assets/js/core/data-state.js`: 公式markup、selected event bridge、既存Home / End補助、rerender後のfocus復元を実装。
- `assets/css/cars-members-tray/car-card/04-group-mode.css`: 独自chipのCarbon風CSSを削除し、公式hostの配置・48px最小高だけを保持。
- `assets/css/tokens/01-color-scheme.css` / `assets/css/tokens/01-theme-modes.css`: 公式selected labelに必要な`--cds-layer-selected-inverse`をlight / darkで定義。
- `assets/vendor/carbon/carbon-entry.min.js`: assets buildで公式Content Switcherを追加。
- `index.html`: data-state asset versionをPhase 3Aへ更新。
- 既存`tests/carbon-content-switcher-seat-picker-check.js`、`tests/carbon-phase2a-contract-check.js`、`tests/carbon-phase2a.spec.js`、`tests/carbon-switcher-seat-picker.spec.js`へcontract / runtime / interactionを統合。フェーズ専用test fileは追加していない。
- 旧chip CSSを前提にしていた`tests/final-ui-polish-check.js`、`tests/settlement-followup-compact-check.js`、`tests/ui-followup-visual-repair-check.js`は、公式host契約を検査するよう更新。

Content Switcher対象Playwrightは、360 / 390 / 430 / 768 / 1280px、通常sample / 空状態の**6 / 6成功**。click往復、ArrowLeft / ArrowRight、Home / End、Tab / Shadow focus、reload後のactive plan復元、未割当trayを開いたままの切替、参加者登録Buttonとの配置、横overflowを検証した。上部main navigationが従来の`#main-nav[role=tablist]`のままであることもstatic contractに含めた。

### Visual Regression

最初のPhase 1実行でContent Switcherを含む画面だけを抽出し、expected / actual / diffを確認した。次の**16枚だけ**を個別scenario単位で更新した。

- `car-*` / `team-*`の360px、390px、768px、1280px × light / dark

差分は公式Content Switcherの矩形、selected色、文字位置、focus可能領域だけだった。共有画面、精算、未割当tray、空状態、主要Modalのsnapshotは更新していない。更新後はPhase 1 Visual / quality **16 / 16成功**、既存Modal Visual **6 / 6成功**。

### Side Browser監査

Codexアプリ内サイドブラウザで通常sampleと空状態を用い、390×844 / 1280×720、light / dark、車割 / 班割を実表示した。

| 契約 | 結果 |
|---|---:|
| Carbon component未upgrade | 0 |
| console warning / error | 0 |
| document横overflow | 0 |
| switcher / 参加者登録Button文字clip | 0 |
| click 車割→班割→車割 | 成功 |
| ArrowLeft / ArrowRight、Home / End | 成功、selectedとfocusが同期 |
| Tab / focus ring | hostとShadow内部controlで確認 |
| reload後のactive plan | main navで車割画面を再表示すると班割を復元 |
| 空状態 | 両方向へ切替、空状態表示を維持 |
| 未割当tray | Enterで開閉し、開いたまま両方向へ切替 |
| selected contrast | lightは黒地 / 白字、darkは白地 / 黒字 |

既存契約ではreload時のmain view自体は共有画面へ戻るが、`activeCarPlanType`は保存される。reload後に上部main navigationで車割画面へ戻した時点で班割が復元することを確認し、新しいmain view保存は追加していない。

### テスト結果

| 実行 | 結果 |
|---|---:|
| Carbon assets build | 成功 |
| CSS lint | 成功、error 0 |
| 静的suite | **84 / 84成功** |
| Carbon runtime | **2 / 2成功** |
| Content Switcher対象 | **6 / 6成功** |
| Phase 1 Visual / quality | **16 / 16成功** |
| 既存Modal Visual | **6 / 6成功** |
| 全Playwright初回 | **58成功 / 11失敗、全69件** |
| 初回失敗だけの再実行 | **1成功 / 10失敗、全11件** |

全Playwright初回では、フェーズ2Cの既知9件に既知の実行揺れ2件が加わり11件だった。失敗11件だけの再実行で精算入力focusの1件が成功し、残りは既知上限の10件になった。残存内訳は精算note位置1件、Modal viewport走査1件、既存36px touch target 1件、参加者表1件、driver card / compact typography・layout 6件で、Content Switcher対象6件、Carbon runtime、Visualには失敗がない。今回の実装による新規失敗は確認されなかった。

最終一括実行の前に、未変更のoverview Carbon ButtonでShadow focus indicatorの取得が1回だけ先行したため、既存runtime testを即時1回の検査から`expect.poll`による実際の表示待ちへ修正した。production Buttonや判定内容は変更せず、再実行と全Playwrightでは成功した。

### 発生した問題、次のphase、残存リスク

実装時には、同じdynamic regionへ公式`target`を指定するとCarbonの表示管理で領域が隠れる問題と、dark themeでselected label用semantic tokenが未定義のため文字が見えない問題が見つかった。前者は`target`を外して既存表示関数を唯一のownerとし、後者はlight / darkの`--cds-layer-selected-inverse`を追加して解消した。Carbon内部構造へ依存するCSSは追加していない。

次の低リスク候補は、既存`AppUI.showStatus()`を業務側の唯一の入口として維持したまま、Notification / Toastの表示shellを公式Carbonへ移行すること。その次に、静的status labelからTagを機能単位で移行する。残るiconは各機能の移行と同時に扱い、icon専用phaseは追加しない。

残るリスクは、動的に再描画する共通領域のため`aria-controls`がCarbon itemのShadow内部buttonではなくitem hostにあること、reload後のmain view復元は従来どおり対象外であること、既知Playwright失敗10件、Windows Chromium以外の未確認、Bootstrap / Font Awesome残存、ユーザーガイド画像11枚の既知不一致である。生成済みCarbon bundleのupstream template literal 2行には既知の行末空白があり、`git diff --check`ではvendor bundleだけが警告対象になる。

## 16. フェーズ3B完了記録: Notification / Toast

既存の`window.AppUI.showStatus(message, options = {})`と、その互換入口である`showAppNotice()` / `showMiniToast()`を変更せず、表示shellだけを公式Carbon Web Componentsの`cds-toast-notification`へ移行した。通知に業務状態、保存、copy、Firebase同期を持たせず、呼び出し元も変更していない。

### 既存通知契約とCarbon対応

| 契約 | 移行前 | フェーズ3B後 |
|---|---|---|
| 公開API | `AppUI.showStatus(message, options)` | 変更なし |
| empty message | 表示しない | 変更なし |
| kind | `error` / `success`、その他はneutral表示 | `success` / `error` / `warning` / `info`を一元mapping、既存`neutral`は`info`へfallback |
| default duration | 2200ms | 変更なし |
| custom duration | finite値を800ms以上へclamp | 変更なし |
| 連続呼び出し | 先行timerをclearし、最新1件だけ表示 | 先行ToastをDOMごと除去し、timerをclearして最新1件だけ表示 |
| 自動消去 | visible classを外す。固定hostはDOMに残る | open / visibleを閉じ、公式hostとtimer参照をDOMから除去 |
| 手動dismiss | なし | 公式close controlを追加。`cds-notification-closed`で同じcleanupを実行 |
| live region | error=`alert` / assertive、その他=`status` / polite、atomic | 変更なし |
| accessible name | messageがlive regionの内容 | messageをsubtitle slotへ保持し、closeは「通知を閉じる」 |
| 表示位置 | desktopは画面下中央、mobileはbottom navigationの上 | 変更なし |

kind対応は`assets/js/modules/ui.js`の小さな定数表だけに集約した。

| App tone | Carbon `kind` | `role` / `aria-live` | status icon description |
|---|---|---|---|
| `success` | `success` | `status` / `polite` | 成功 |
| `error` | `error` | `alert` / `assertive` | エラー |
| `warning` | `warning` | `status` / `polite` | 警告 |
| `info` | `info` | `status` / `polite` | 情報 |
| `neutral` / unknown | `info` | `status` / `polite` | 情報 |

Carbon自身の`timeout`は設定せず、従来の外部timerを唯一の時間ownerとして保持した。先行Toastのclose eventやtimerが後続Toastを消さないよう、現在のhost参照と一致する場合だけstateをclearする。dismiss後と自動消去後はhost、event対象、timer参照とも残らない。

### 実装とtest

- `assets/js/carbon-entry.js` / `assets/vendor/carbon/carbon-entry.min.js`: 公式Toast Notification moduleをentryへ追加し、assets buildを更新。
- `assets/js/modules/ui.js`: kind mapping、公式host生成、単一timer、公式close eventを実装。公開APIとaliasは維持。
- `assets/css/guides-modals/notices/01-copy-lock.css`: 独自Toast内部構造のCSSを公式hostの配置・responsive幅・transitionへ置換。Shadow DOM内部selectorは追加していない。
- `assets/css/tokens/01-color-scheme.css` / `assets/css/tokens/01-theme-modes.css`: inverse Toastのclose icon / focus tokenをlight / darkで明示。
- `index.html`: Carbon bundleとUI moduleのcache versionをPhase 3Bへ更新。
- 既存`tests/carbon-phase2a-contract-check.js`、`tests/carbon-phase2a.spec.js`、`tests/carbon-phase1-visual.spec.js`へcontract / runtime / Visualを統合。フェーズ専用test fileは追加していない。

runtimeでは4 kind、role / live / atomic、長い日本語、custom durationの800ms clamp、最新1件への置換、先行timer非干渉、自動消去、Enterによるdismiss、DOM / timer残留0、hostとShadow内部close、focus ring、48px領域、未upgrade / console error 0を検査した。

初回のToast runtimeは既存appのroot font-sizeがdesktop 14px / mobile 15pxである影響を受け、Shadow内部closeが42px / 45pxとなり2 / 3成功だった。既存全体のfont-sizeやCarbon内部CSSは変更せず、Toast hostだけを16px基準へ戻し、host全体のscaleと外幅補正でvisual widthを維持した。再実行ではcloseが390px / 1280pxとも約48.00px、focus ring 2pxとなり3 / 3成功した。この補正は公式内部class、`::part`、Shadow DOM構造に依存しない。

### Visual Regression

通知専用の次の4基準だけを追加した。snapshotの一括更新、通知と無関係な主要画面snapshotの更新はしていない。

- `toast-390-light-win32.png`
- `toast-390-dark-win32.png`
- `toast-1280-light-win32.png`
- `toast-1280-dark-win32.png`

warningの長い日本語messageを使い、light / darkのinverse surface、折返し、close位置、viewport内配置を確認した。4画像を個別に目視確認した後、Phase 1 Visual / qualityは既存16条件と合わせて**20 / 20成功**、既存Modal Visualは**6 / 6成功**。意図したToast以外の差分はない。

### Side Browser監査

Codexアプリ内サイドブラウザで通常sampleを読み込み、390×844 / 1280×720、light / dark、車割 / 班割 / 共有 / 精算の**16画面条件**を確認した。実際のUI操作でsample data通知、共有link copy、精算memo copyを表示し、編集lockへ安全なlocal合言葉を設定して誤入力errorも再現した。

| 契約 | 結果 |
|---|---:|
| Carbon component未upgrade | 0 / 16 |
| console warning / error | 0 |
| document横overflow | 0 / 16 |
| Toast / 主要文字clip | 0 / 16 |
| success / error / warning / info | runtime 4種成功、side browserでinfo / errorを実操作確認 |
| copy / sample通知 | 実操作で表示、kind / message / live regionを確認 |
| safe error | 誤ったlock合言葉でerror / alert / assertiveを確認後、正しい合言葉で解除 |
| 連続copy | 最新1件だけ、重複0 |
| 自動消去 | 2500ms後にhost 0 |
| manual dismiss | mouse / Shadow内部closeへのEnterの両方でhost 0 |
| keyboard focus | Shadow内部closeへfocus、2px focus ring |
| close touch target | 390px / 1280pxとも約48.00×48.00px |
| 長い日本語 | 390pxで折返し、overflow / clip 0 |
| 最終残留 | Toast 0、未upgrade 0、timerによる後続消去なし |

検証後はviewportをresetし、専用検証tabをcloseした。repository外のscreenshot以外に状態を残していない。

### テスト結果

| 実行 | 初回 | 有効な再実行 / 最終 |
|---|---:|---:|
| Carbon assets build | Node未検出で起動不能 | 成功 |
| CSS lint | Node未検出で起動不能 | 成功、error 0 |
| 静的suite | Node未検出で起動不能 | **84 / 84成功** |
| Carbon runtime | Playwright 1.61用browser未配置で起動不能 | **3 / 3成功** |
| Phase 1 Visual / quality | 同上 | **20 / 20成功** |
| 既存Modal Visual | 同上 | **6 / 6成功** |
| 全Playwright | 同上（74件すべてbrowser launch前に失敗） | **65成功 / 9失敗、全74件** |
| 失敗9件だけの再実行 | - | **0成功 / 9失敗** |

初回の失敗はコード実行前の環境問題で、同梱NodeをPATHへ追加し、Playwright configが既に対応している`PLAYWRIGHT_CHROMIUM_EXECUTABLE`へsystem Chromeを指定して再実行した。最終の9失敗は再実行でも同じで、精算note位置1件、既存36〜40px touch target 1件、参加者表1件、driver card 1件、精算compact typography / layout 5件。既知上限10件以内で、今回追加したToast runtime / Visualには失敗がないため、対象外の大規模修正は行っていない。

### 依存、次のphase、残存リスク

フェーズ3BはFont Awesome、Bootstrap、公式Carbon Buttonを変更していない。残存値はFont Awesome 51種類 / 89参照 / 17 files、Carbon Icons 37参照、公式Carbon Button 6個、`data-bs-toggle` 2、`data-bs-dismiss` 15、`bootstrap.Modal` 12、Modal hide / hidden event 10のままである。Notificationだけが公式Carbon Toast 1系統へ増えた。

次の低リスク候補は、業務状態を持たない静的status labelから公式Carbon Tagへ移行すること。その後、既存validation / 保存契約を先に固定してInput / Select / Toggle / Dropdownを機能単位で進める。上部navigation、Modal lifecycle、独自card / tray構造、残存iconは各関連機能のphaseまで維持する。

残るリスクは、Toastの48px補正が現在のapp root 14px / 15px typographyを前提とするため将来root font-size変更時に再監査が必要なこと、互換入口が通常はneutral / errorしか渡さないためwarning / infoの本番flowが少ないこと、最新1件だけを残してstackしない従来契約、既知Playwright失敗9件、Windows system Chrome以外の未確認、Bootstrap / Font Awesome残存、ユーザーガイド画像11枚の既知不一致である。生成済みCarbon bundleのupstream template literal 2行には既知の行末空白が残る。

## 17. フェーズ4A完了記録: 共通編集 / debugのText Input・Select

共通編集の単純な文字列value carrier 1件と、debugの車数selector 1件だけを公式Carbon Web Componentsへ移行した。Modal本体、保存callback、sample生成、計算、保存形式、Firebase同期は変更していない。

### 棚卸しと対象境界

| 機能 | 対象 | 判断 |
|---|---|---|
| 共通編集 | `#editModalInput` | 対象。文字列の初期値設定と読み取りだけを担い、`input` / `change` / `blur`自体は保存を開始しない。保存Button / Enterの既存`saveCb`をownerとして維持する |
| debug | `#debugCarCount` | 対象。2 / 3 / 4 / 5台の単純選択だけを担い、選択時は保存・sample生成を開始しない。既存実行Buttonがvalueを読む |
| lock合言葉 | 動的password / text | 除外。native form submit、trim、focus管理、lock lifecycleと結合 |
| 自動割当条件 | `#optFemale` / `#optMale` / `#optGrade` | 除外。今回はText Input / Selectだけが範囲。次候補の同一契約Checkbox群 |
| 企画名 / 概要memo / timetable | Textarea / time / text | 除外。debounce保存、動的行、共有表示への反映契約がある |
| 参加者import | spreadsheet / member / driver / grade Textarea | 除外。parser、import確定、Modal lifecycleと結合 |
| 精算設定 | rounding / organizer Select、Number、Checkbox | 除外。計算、validation、動的選択肢、保存と結合 |
| 車費用 / route helper | 動的Text / Number / Select | 除外。距離計算、Google Maps、動的行、validationと結合 |

`querySelector('input')` / `querySelector('select')`、`querySelectorAll`、`instanceof`、`form.elements`、`FormData`、native validity、type selector、event delegationを検索した。対象2件には`instanceof`、form、FormData、native validity依存がなく、既存公開IDからの`.value`設定 / 読み取りだけだった。drag除外selectorはShadow eventのhost retarget後も`.modal`で保護される。

### 維持したvalue / event / accessibility契約

- IDは`editModalInput` / `debugCarCount`、nameなし、disabled / readonly / required=falseを維持。
- Text Inputは`type=text`、`autocomplete=off`、placeholderなし、maxlengthなし、初期値のprogrammatic設定、select-all、日本語入力、`event.target.value`を維持。
- Selectはdefault=`3`、選択肢`2 / 3 / 4 / 5`と表示文言、programmatic value同期、選択だけでは保存しない契約を維持。
- `input`と`keydown`はCarbon hostへcomposed eventが届く。native `change`だけがShadow boundaryを越えないため、対象2hostに限定して同型`change`を再dispatchする最小bridgeを追加した。bridgeはsave、localStorage、Firebaseを参照しない。
- Bootstrap focus trapがShadow内部controlをtabbableとして認識しないため、共通編集はclose ← Text Input → Save、debugはclose ← Select → ExecuteのTab / Shift+Tabだけを既存startup eventsで補完した。
- hostとShadow内部controlのaccessible nameを実ブラウザで検証。共通編集は通常`編集内容`、`appPrompt()`利用時は既存messageへ動的更新し、debugは`サンプルデータの車の数`を維持。
- host / Shadow内部controlはいずれも48px、focus ringあり、横overflowなし。Carbon内部class、`::part`、Shadow内部構造へ依存するapplication CSSは追加していない。

### Visual / side browser / test結果

Visual RegressionはPhase 4A対象だけを360 / 390 / 768 / 1280px × light / darkで追加した。既存390 / 1280pxのcommon edit基準は変更せず、common editの360 / 768px 4枚とdebugの全幅8枚、合計12枚だけを目視確認して追加した。主要画面、Toast、他Modal snapshotは更新していない。

サイドブラウザは重複を抑えて390pxスマホと1280px PCの代表条件だけを目視した。light / darkの共通編集とdebugで、日本語入力、Tab、blur、保存、reload復元、4台選択と実行、reload後のdefault 3台、label / accessible name、48px、未upgrade 0、横overflow 0、console warning / error 0を確認した。

| 実行 | 初回 | 最終 |
|---|---:|---:|
| Carbon assets build | - | 成功 |
| CSS lint | - | 成功、error 0 |
| 静的suite | - | **84 / 84成功** |
| Carbon runtime | 開発中にchange / reload harness / Tab bridgeの対象失敗を検出 | **5 / 5成功**（Phase 4Aは1 / 1） |
| Phase 4A対象Visual | accessible name期待値と新規基準未作成で失敗 | **8 / 8成功** |
| Phase 1 Visual / quality | - | **28 / 28成功** |
| 既存Modal Visual | - | **6 / 6成功** |
| 全Playwright | **73成功 / 11失敗、全84件** | 失敗11件だけ再実行して**2成功 / 9失敗**。有効結果は**75成功 / 9失敗** |

全Playwright初回の追加2件は、7並列時のToast timer境界とModal全件走査timeoutで、失敗限定再実行では成功した。残る9件は既知の精算note位置1、既存36〜40px touch target 1、参加者table 1、driver card typography / layout 6で、既知上限10件以内。Phase 4A runtime / Visualに失敗はない。

移行数は公式Carbon Text Input **1件**、Select **1件**、Select Item **4件**。Bootstrap残存contractは`data-bs-toggle` 2、`data-bs-dismiss` 15、`bootstrap.Modal` 12、`hide.bs.modal` 2、`hidden.bs.modal` 8で変更していない。

次の低リスク候補は、同一value契約を持ち、選択だけでは計算や保存を開始しない自動割当条件3件（`optFemale` / `optMale` / `optGrade`）を公式Carbon Checkboxとして機能単位でまとめること。その後は企画名 / 概要memoのTextareaをdebounce保存契約ごと、精算設定のSelect / Checkbox / Toggleを計算境界ごとに扱う。参加者import、動的費用行、Google Maps / 距離計算、Modal本体は引き続き後段とする。

### 今後のフェーズの効率化方針

安全性と既存機能維持の検査密度は下げず、手動と自動の重複だけを次の運用で減らす。

1. フェーズ開始時に同梱Node、system Chrome、必要なPATH / executable設定を一度だけ固定し、途中で再探索しない。
2. 棚卸し、依存検索、既存value / event / persistence / ARIA契約の固定を実装前に完了する。
3. 実装後は同じ契約を持つ対象テストを既存contract / runtimeへ統合し、まとめて実行する。
4. サイドブラウザは390pxスマホと1280px PCの代表画面だけを目視し、Playwright全条件を重複再現しない。
5. viewport全幅、light / dark、保存復元、keyboard、ARIAの網羅確認はPlaywrightを主とする。
6. 全Visual Regressionと全Playwrightは、フェーズ完了前に原則1回だけ実行する。
7. 失敗時は失敗したtestだけを再実行し、全体を反復しない。
8. 小さな部品単位の専用phaseを増やさず、同じ契約を持つ低リスク部品を機能単位でまとめて移行する。

残るリスクは、Carbon Web Components 2.60.0ではnative `change`のcomposed=falseを小さなbridgeで補っていること、Bootstrap focus trapがShadow controlを認識しないため対象別Tab bridgeがModal移行まで必要なこと、既知Playwright失敗9件、Windows Chromium以外の未確認、Bootstrap / Font Awesome残存、ユーザーガイド画像の既知不一致である。

## 18. 継続移行メモ: 自動割当条件Checkboxとmenu開閉契約

自動割当条件の`optFemale` / `optMale` / `optGrade`は、同一のchecked value carrier契約を持つ3件として公式Carbon Checkboxへまとめて移行した。自動割当の計算は従来どおり実行Button側が現在のchecked値を読むため、Checkbox hostには計算、保存、Firebase同期を持たせていない。

menuの正しい開閉契約は「複数条件を連続選択できる」と決定した。根拠は、移行前の3件がBootstrap dropdown内のnative `input[type=checkbox]`であり、Bootstrap 5の既定処理はmenu内のinput clickでは閉じないこと、既存rendererが3条件を独立して同時保持し、`条件：女子・男子`のように複数値を結合表示すること、実行時に3件すべてのchecked値を一括取得することにある。選択ごとに閉じるという資料、コード、テスト上の契約は見つからなかった。

公式Carbon v12 Overflow Menu / Menuへの移行時に、暫定`data-bs-auto-close="outside"`、`data-bs-toggle`、Bootstrap Dropdown依存を削除した。最終DOMの`data-bs-*`は0件。Carbon MenuのE2Eへ「menuを1回開き、複数Checkboxをpointer / Spaceで連続選択できる」契約を移管し、1件目と2件目の選択後もmenu open、checked、summary、accessible name、48px、保存0回を確認する。

Carbon CheckboxがSpace更新時にShadow内部inputを再描画してfocusを失う差だけは、既存event owner内の最小bridgeで補った。Spaceはhostの`checked`を反転し、従来と同型のcomposed `change`を1回発火して更新完了後に内部inputへfocusを戻す。Tab / Shift+Tabは同じ3Checkbox内だけを移動する。計算、保存、Firebase、menu状態をbridgeへ持たせていない。Bootstrap暫定設定は残っておらず、最終Carbon Menu E2Eは成功している。

## 19. フェーズ4B〜6 最終完了記録

一般UI、form、menu、navigation、Modal、iconの移行を完了した。実行時のBootstrap / Font Awesome / native form要素は0で、一般UIのCarbon化率は**100%**。車card、座席、班card、未割当tray、精算card、共有画面、動的費用行は業務構造を変えず、Carbon token / spacing / typography / state / focus / ARIAへ準拠する独自componentとして維持した。

### 最終component inventory

| 公式Carbon host | instance |
|---|---:|
| Button | 40 |
| Icon Button | 13 |
| Text Input | 9 |
| Textarea | 8 |
| Number Input | 7 |
| Select / Select Item | 4 / 12 |
| Checkbox / Toggle | 10 / 1 |
| Content Switcher / Item | 4 / 9 |
| Tag | 7 |
| Toast Notification | 1系統（動的host） |
| Overflow Menu / Menu / Menu Item | 2 / 2 / 7 |
| Modal / Modal Close Button | 10 / 12 |

静的source上の公式hostは157 instance。Carbon Iconsは、動的な状態・選択肢iconも含めてbundleへ**58種類**を限定importし、source上の描画参照は90件。`index.html` / `assets/js`のnative `<button>` / `<input>` / `<select>` / `<textarea>`、`<i>` icon wrapperはいずれも0件。

### 残存依存と削除結果

| 指標 | 移行前 | 最終 |
|---|---:|---:|
| Font Awesome参照 | 134 | **0** |
| `data-bs-toggle` | 2 | **0** |
| `data-bs-dismiss` | 15 | **0** |
| `bootstrap.Modal` | 12 | **0** |
| `hide.bs.modal` / `hidden.bs.modal` | 10 | **0** |
| Bootstrap vendor file | 2 | **0 existing** |
| Font Awesome vendor file | 9 | **0 existing** |
| Bootstrap / Font Awesome package / lockfile参照 | 有 | **0** |

Bootstrap 2 fileとFont Awesome 9 fileはworktreeで削除済み。stylesheet、JavaScript、package、vendor、test fallback、`data-bs-*`、lifecycle eventを残していない。移行履歴内の説明文字列だけは残す。

### 維持した業務契約

- 計算式、端数処理、ガソリン代、レンタカー代、部費 / 支払い分類、同一fixtureの精算結果を変更していない。
- 保存object、参加者 / 車 / 班 / 精算data構造、localStorage keyと意味、共有URL形式を変更していない。
- Firebase data構造、同期の意味、呼び出しtimingを変更していない。
- form hostは既存ID、value、checked、input / change / blur、IME composition、debounce、focus、save回数を維持。必要な箇所だけ最小event / value bridgeを使用する。
- `AppModalAdapter`はopen / close、Promise、Esc、backdrop、scroll lock、focus trap / restore、validation、save timingを所有する最小adapter。Bootstrap lifecycle依存は0。
- header Menu itemは選択後に閉じる。自動割当条件Menuだけは複数Checkboxを連続選択できる契約を維持する。closed Carbon Menu hostの2px hit areaは`pointer-events:none`として隣接Buttonを遮らない。

### 独自component最終監査

360 / 390 / 768 / 1280px、light / darkで車割、班割、共有、精算、未割当tray、空状態を検査した。document横overflow 0、主要操作48px以上、visible focus、keyboard、accessible name / ARIA、色だけに依存しない状態表現を確認した。mobileの氏名はellipsisをやめて折り返し、精算空状態CTAは430px以下で縦積み、中央Modalのclose Buttonはheader内へ固定した。

### IBM Plex / asset最適化

IBM Plex Sans / IBM Plex Sans JPはRegular / SemiBoldだけを維持。Latin 2 fileをpreloadし、日本語2 weightは公式unicode-rangeに沿う124 fileずつのsplit WOFF2へ変更した。初期画面の実測font loadは55 request、encoded **1,786,376 bytes（約1.70 MiB）**で、従来約4.7MB一括loadから約62%削減。日本語fallbackとglyph範囲は削っていない。

Carbon bundleは使用component / iconだけをimportして再生成し、Web Components 2.60.0、Icons 11.85.0、Plex Sans 1.1.0 / Sans JP 3.0.0、Apache-2.0 / OFL licenseを維持した。

### Visual / guide / test結果

- Windows snapshotだけを名前付きscenario単位で確認・更新。Linux snapshot、Toastの無関係基準、一括updateは未変更。
- Phase 1 Visual / quality: **28 / 28成功**。車割、班割、共有、精算、tray、空状態、form、主要Modal、Toastを360 / 390 / 768 / 1280px、light / darkで確認。
- 既存Modal Visual: **6 / 6成功**。
- ユーザーガイド`01-navigation.webp`〜`11-settlement-checks.webp`の11枚を、個人情報を含まない390px lightの現行Carbon UIへ更新。
- Carbon assets build成功、CSS lint error 0、静的suite **84 / 84成功**、Carbon runtimeは初回成功6 + 失敗1の失敗限定再実行成功で有効 **7 / 7成功**。
- 全Playwright初回は**71成功 / 15失敗（全86件）**。失敗は曖昧なtab locator 6、Shadow dialog配下scope 5、header Menu closed hostのpointer遮断2、coach key誤値1、mobile氏名clip1へ整理。各失敗testだけを修正・再実行し**15 / 15成功**、有効最終結果は**86 / 86成功**。全suiteの重複再実行はしていない。

### ブラウザ確認と残存リスク

Windows system Chromeでruntime、Visual、keyboard、focus、ARIA、48px、console warning / error、overflowを確認した。Playwright Chromium binaryも存在する。Firefox / WebKit binaryは環境に存在せず未確認。Linux ChromiumはWindows hostのため未確認。side browser integrationは最終確認時にautomation sessionへ所属するtabを取得できず、同じ390 / 1280px代表画面をWindows ChromeのPlaywright screenshotで目視した。

残存リスクは、Carbon Web Components 2.60.0でnative eventがcomposedされない箇所の最小bridge、未確認のFirefox / WebKit / Linux Chromium、生成Carbon bundle内upstream template literal由来の既知行末空白だけ。計算、保存形式、Firebase同期、URL、独自component業務構造に既知差分はない。commit、push、PRは行っていない。
