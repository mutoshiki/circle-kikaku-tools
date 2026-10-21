# 精算画面の細部・整列・表記改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 集金と各車への支払いを、金額の比較・操作・内訳確認がしやすい、一貫した文字・整列・余白・表記で表示する。

**Architecture:** 既存の `Settlement.jsx` と精算画面専用SCSSで完結させる。Carbon Button／Accordionと既存の `dl` による区分表示を利用し、計算・保存・同期のモデルを変更しない。共通契約と既存ブラウザーテストを更新し、今回決めた表示の役割を記録する。

**Tech Stack:** React 19.2.8、`@carbon/react` 1.115.0、`@carbon/icons-react` 11.87.0、SCSS／Carbon type・spacing tokens、既存Playwright環境。

**Spec:** 本書「評価結果と決定した仕様」および `docs/design/react-typography-spacing.md`。本書の具体的な数値・表記は、このサイトに対する設計判断であり、Carbonの必須値とは区別する。

## 現在の依頼と状態

- 2026-10-20の依頼：「まずは案だけ」「文字の揃い方、ボタン内の余白、区切り線、内訳の記号や表記まで」「見つけながら最終的には実装計画にそのまま落とし込んで」から、後続で計画全項目の実装が許可された。
- 2026-10-21の追加依頼により、車支払い見出し削除、費用編集の常時表示、部費0円時の簡略表示、集金記録後のトースト確認を範囲に追加した。
- Task 1〜4と追加仕様を実装。Chromium／WebKitの対象ブラウザテスト、画面一貫性テスト、build、preview照合、サイドブラウザの実表示確認を実施。push・本番公開はしていない。
- 対象の本番画面：`https://mutoshiki.github.io/circle-kikaku-tools/?room=2E20E7B1&view=seisan`。読み取りで評価し、企画の内容を変更しない。
- 実装開始時に再取得した公開manifest：source SHA `b05ebf7959a409f400d050aef19c032b7c6fd001`、asset digest `3c47c1886e8b9f528e6bb6f69e7b69bbc4df015554ec73a6511ac6ded54c6f8a`。
- 計画書の保存先：`C:/Users/toshi/.codex/worktrees/site-type-spacing/circle-kikaku-tools`。実装branch `codex/settlement-detail-refinement` は上記最新公開SHAから開始。PR #111の変更はフォームメーカーに限定され、精算対象ファイルに差分がないことを確認。
- このworktreeには既存の未追跡 `apps/react/dist-offline-test/` がある。元の `Documents/GitHub/circle-kikaku-tools` は別のdirtyなRC checkoutであり、起点にしない。
- 実装開始時は公開manifestと `origin/main` を取り直す。公開基準を含む適切な作業ブランチを使い、過去にmerge済みのPR #110へそのまま追加pushしない。基準が変わった場合は変更範囲を確認して本書の対応表を更新する。

## Global Constraints

- 「集金状況 → 各車への支払い → メモ」の順を維持する。
- 割勘と部費は別々に渡す用途を尊重し、部費がある場合は両区分を常時別表示する。部費の支払い額が0円の場合は「割勘から／部費から」と部費の0円を省き、割勘を合計額として一つだけ表示する。展開内訳は区分見出しを省き、実費・調整の明細を一続きで示す。
- 車ごとの一覧を説明する「各車への支払い」見出しは置かない。各車行の「費用を編集／費用を入力」は内訳を開かなくても見える位置に置く。
- 未回収者を集金済みにした時は「集金状況を更新しました。」のトーストを表示する。取り消し操作では成功トーストを出さない。人数だけの精算の集金者入力は保存後に通知する。
- 精算計算、丸め単位、集金差し引きの条件、参加者・車の状態、schema、保存・Firebase同期は変更しない。
- 集金モーダルの初期表示「すべて」、行全体の選択、人数だけの精算での集金者名入力、各車の運転手名編集を維持する。
- 画面見出し・車名・金額・補助文の役割を分け、Carbonのtype mixinを一式で使う。フォント・パッケージ追加や画面全体の縮小は行わない。
- 新しい `.cds--*` 内部クラスの上書きや疑似要素への依存を追加しない。app所有クラス、公開props、意味のあるARIA属性を優先する。
- 本番ルームを検証データとして書き換えない。実装後の確認はlocal-only previewと合成データを使う。
- 同じ問題で20分以上、調査結果・修正・検証結果に進捗がなければ停止し、原因・未完了Task・最後の成果を報告する。

## Review Focus

1. 320px幅・大きな金額・200%ズームで金額自体が分断・欠落せず、部費がある場合は両区分を確認でき、部費0円時は一つの合計として読めること → Task 1／4。
2. 正・負・0・負のゼロ近傍で `¥-100`、`−−¥100`、`¥-0` の混在が発生しないこと → Task 3。
3. 長い車名・複数運転手・レンタカー補足が編集操作を押し出したり、名前を省略したりしないこと → Task 2／4。
4. 内訳の開閉と集金モーダルの起動・終了で、キーボード操作、フォーカス復帰、保存データが変わらないこと → Task 2／4。
5. 合計0円になる相殺明細・片方の区分だけに費用がある状態で、表示すべき明細を消さないこと → Task 3／4。

## 公式資料と評価方法

Carbon MCPの `code_audit`、`code_search`、`docs_search` と、インストール済みパッケージの実装・型を照合した。MCPの自動監査は正規表現による指摘を含むため、検出件数をそのまま確定不具合と扱わない。既存のSwitchの親子関係やModalのハンドラーに対する誤検出は改善項目に採用しない。

| 公式資料 | 本計画で根拠にする内容 |
| --- | --- |
| [Typography](https://www.carbondesignsystem.com/building-blocks/foundations/typography/overview) | 製品の作業を支えるproductiveな階層。具体的な役割割当は本サイトの判断。 |
| [Spacing](https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview#creating-relationships) | 距離と反復で関連・階層を表す。2／4／8px系のspacing tokensを使う。 |
| [Accordion guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/accordion/guidelines#alignment) | 詳細を段階的に表示する。文字とchevronの配置を一貫させる。 |
| [Accordion specifications](https://www.carbondesignsystem.com/building-blocks/core/components/accordion/specifications#flush-alignment) | 本文下の標準余白24pxなど、component内の余白と周囲の余白を区別する。 |
| [Accordion accessibility](https://www.carbondesignsystem.com/building-blocks/core/components/accordion/accessibility#keyboard-interactions) | Tabの移動順、Enter／Spaceによる開閉、展開状態の提供。 |
| [Button hierarchy](https://www.carbondesignsystem.com/building-blocks/core/components/button/guidelines#multiple-button-emphasis) | 主操作と繰り返す補助操作の強調を分ける。 |
| [Button sizes](https://www.carbondesignsystem.com/building-blocks/core/components/button/specifications#size) | smallは32px、mediumは40px。独立した主操作にmediumを選ぶのは本サイトの判断。 |

画面は393×852のダーク表示でDOM・computed styleを確認した。実測ではsection見出し20px／400／28px、車名16px／600／22px、主要金額20px／600／28px、内訳14px／400／18px、同期完了12px／400／16px。字形は `IBM Plex Sans JP` を先頭とする既存font stack。内訳のEnter／Space開閉は前段の評価で確認した。ライト・デスクトップ・ズーム・実機の読み上げは本計画作成時には未検証。

## 評価結果と決定した仕様

| ID／優先度 | 発見・根拠 | 採用する仕様／維持する理由 |
| --- | --- | --- |
| F01／高 | 支払額は桁の左から配置され、同じ区分でも右端が揃わない。 | 部費の支払いが0円以外なら割勘・部費を同じ幅で並べて右揃え。部費が0円なら単独の合計額を表示し、部費の0円と区分ラベルを省く。0円の区分を強調しない。 |
| F02／高 | 現状のラベルと金額の横並びは、桁数が増えると片方だけ折り返す可能性がある。 | 375px以上は等幅2列で各列を「ラベル上／金額下」に固定し、ラベルと金額の右端を揃える。列内の間隔4px、列間16px。374px以下は区分を2行にし、各行でラベル左・金額右。部費が0円なら1つの金額行にする。金額単位の途中折り返しや省略はしない。この境界は内容に基づく局所的なもの。ページのCarbon Gridのbreakpointは変えない。 |
| F03／高 | 集金ボタンは「見出し＋金額」の全体に対して中央配置され、見出し行から浮いて見える。 | 集金カードのheaderを「h2＋ボタン」の1行にし、1人あたり金額をその下の独立した行へ出す。headerはbaselineで揃える。 |
| F04／高 | 上部の1人あたり金額は14pxの補助文、各車への支払額は20pxの主要値。 | 「1人あたり」のラベルは14px／secondary、金額だけ20px／600／28px／primary・等幅数字にする。ラベルと値のbaselineを揃え、間隔8px。追加の集金人数・進捗・説明は増やさない。 |
| F05／中 | 集金・設定・各車編集がすべて青文字のGhostで、操作の差が弱い。 | 集金を記録だけPrimary／medium（40px）。精算設定・各車の費用編集はGhost／small（32px）を維持。独立した主操作と補助操作の役割差として扱い、同じbutton groupを異なるサイズで混在させない。 |
| F06／高 | 負の金額はmainの `money` が `¥-100`、明細は手動の符号で `−¥100`。既存テストにも前者の期待値がある。 | 表示を `−¥100` に統一。通常の正額は `¥1,900`、切り上げなど正の調整だけ `+¥67`、0は `¥0`。符号＋通貨記号＋数字を一つの折り返さない単位にする。負値に赤・緑などの意味付けを加えない。 |
| F07／中 | `集金分差し引き` は助詞がなく詰まって見える。 | 見出しを「集金分の差し引き」にする。「割勘」「部費」「切り上げ分」「支払い内訳」は維持。ユーザーが登録した費用名は変更しない。 |
| F08／高 | 展開本文の下余白24px＋車articleの下16px＋次車の上16pxが重なり、次車名まで約60pxになる。 | Carbon本文の24pxは維持し、展開中だけapp所有articleの下paddingを16px→0にする。閉じている車は上下16pxを維持。通常の1行明細で本文末尾から次車名まで40〜48pxを目安とし、nativeの余白をさらに重ねない。 |
| F09／維持 | 本文は16px字下げされ、アコーディオン見出しと本文の左端は同じ。 | これは詳細階層として維持。すべての文字をsection見出しと同じx座標へ強制しない。`isFlush`は指定済みで、追加するだけで直る問題ではない。要約の列と詳細の列は、それぞれの範囲で整列させる。 |
| F10／中 | 長い名前と（レンタカー）が同じ見出し内にあり、末尾だけ分離する可能性がある。 | 車名16px／600、レンタカー補足14px／400／secondaryを維持。補足の括弧を含む単位は途中で割らず、必要なら補足全体を次行へ送る。名前本体は折り返し、省略しない。編集ボタンの専用列を維持する。 |
| F11／維持 | Ghostボタンの箱と可視文字では、左右paddingの分だけ端が違う。 | nativeの約16pxの左右paddingを維持。右寄せするのは操作の箱。文字を数値列へ合わせるためにpaddingを0にしない。すべての編集操作で同じサイズ・余白を使う。 |
| F12／維持 | 区切り線は次の車article上に1本あり、アコーディオンの重複線は抑制済み。 | 現在の1本を維持。線を増やさず、太さ1pxの意味・Carbon border token・明暗テーマ連動を維持。最後の車からメモまでに追加の線は入れない。 |
| F13／中 | 調整額と通常費用が近く、少額の切り上げと差し引きを見分けにくい。 | 通常費用内はgap4pxを維持し、調整ブロックの上だけ8pxにする。調整のラベル・値は同じ14px／400／18px・secondary。小計や総額を重複追加しない。 |
| F14／維持 | 金額は既に `tabular-nums`、フォントと基本のtype rolesも揃っている。同期完了は12px。 | これらを維持。文字間を独自に詰める、¥だけを縮小する、太字を全体へ増やす、同期完了をさらに縮小する変更は行わない。 |
| F15／維持 | アコーディオンのchevronは16pxでend側に統一され、車名入りの読み上げ名もある。 | 既存のend配置とnative focus表示を維持。操作行全体を押せる状態、Enter／Space、開閉状態の通知、車を特定できるaccessible nameを維持する。 |

### 不採用の案

- 割勘・部費の合計額だけを表示し、両区分の支払いが発生する場合に内訳を隠す：別々に渡す用途に合わない。部費が0円のケースは追加依頼により例外とし、単独の合計額にまとめる。
- 全文字を小さくする、金額に独自の字間・¥だけの縮小を加える：桁の比較と既存の役割分担を損なう。
- すべての内訳を常時展開、すべての操作を塗りボタン化、費用編集をアイコンだけへ変更：情報量・操作の強さを増やす。
- 立体的カード・影・角丸・別の濃い背景を各車へ追加：整列と余白で解決できる範囲に装飾を増やす。
- 標準ボタンのpadding削除、chevronの独自移動、Accordion内部のpadding一律上書き：操作領域やCarbonの状態表示を崩す。
- DataTableへの全面置換、精算コンポーネントの大規模分割、別の配色・フォント導入：今回の細部改善に不要。

## 対象ファイルと責務

| ファイル | 今回の役割 |
| --- | --- |
| `apps/react/src/components/Settlement.jsx` | 集金headerの構造、要約の役割クラス、負額の表示、差し引き文言、レンタカー補足。 |
| `apps/react/src/styles.scss` | 精算専用の等幅金額列、金額の右揃え、374px以下の配置、展開時余白、調整ブロックの間隔。 |
| `apps/react/tests/browser/settlement.spec.js` | 既存の正負・0・明細・狭幅・開閉・編集のテストを必要な部分だけ拡張。 |
| `apps/react/tests/browser/visual-consistency.spec.js` | 隣接画面との役割、主操作変更後の起動・フォーカス確認。 |
| `docs/design/react-typography-spacing.md` | 1人あたり金額の役割、列の配置・余白・表記、レビュー記録を追加。 |
| `docs/development/current-workspace.md` | 実装開始時の公開SHA・worktree・データ接続・preview対応を最新化。 |

新しいproduction source file、依存パッケージ、全サイト共通money formatterは作らない。

## Task 1: 集金headerと支払額の役割・列を整える

**Files:** Modify `Settlement.jsx` の集金card／`settlement-car-amounts`、`styles.scss` の対応owner。Test：既存 `settlement.spec.js` の `payment amounts fit narrow screens in both themes` と `visual-consistency.spec.js`。

**Interfaces:** 既存の `result.perPerson`、`calc.adjustedSplitPay`、`calc.adjustedClubPay` を読み取り、既存の起動refとhandlerを使う。計算結果の変更はしない。

- [x] 実装前にAGENTS・公開manifest・branch・差分を確認する。対象ソースの基準一致を確認し、`current-workspace.md` を更新する。
- [x] 集金headerを「h2＋集金を記録」に分ける。補助行をheaderの外へ出し、labelとamountのapp所有クラスを付ける。既存の `collectionTriggerRef`、`aria-controls`、`aria-expanded` を維持する。
- [x] F03〜F05の文字役割・baseline・Primary mediumを適用する。見出しと操作の間隔は8px、headerと金額行の間隔は8px。buttonの標準paddingと既存のクリックhandlerを保持する。header変更のSCSSは `.settlement-collection-card` に限定し、メモや各車への支払いのheaderを巻き込まない。
- [x] F01〜F02の要約列をapp所有SCSSで適用する。375px以上は区分ラベル14pxの下に20px金額、等幅2列、右揃え。374px以下は各区分を横1行の全幅にし、2区分を縦に並べる。全額を表示し、合算しない。
- [x] 既存の狭幅テストで「割勘／部費の2区分が見える」「各ddの右端が区分の列の右端と1CSS px以内」「ラベルや金額と他列の矩形が交差しない」を確認する。375px以上では列幅の差1px以内、374px以下では2行で両方を確認する。旧配置を固定したassertだけを置き換える。
- [x] Task 4のコマンドで対象テストを実行し、結果を記録してからこのTaskを完了にする（Chromium desktop／mobile、WebKit mobileで27件通過）。

## Task 2: 車名・内訳・余白・操作の細部を整える

**Files:** Modify `Settlement.jsx` のレンタカー補足、`styles.scss` の `settlement-car`／`settlement-cost-adjustments`。Test：`settlement.spec.js` の accessible accordion／long car names／ghost expense action の既存テスト。

**Interfaces:** `Accordion`／`AccordionItem` の公開APIと `aria-expanded` を使う。車のキー、通常・人数だけ精算のメニュー、既存のlauncher refは保持する。

- [x] app所有 `.settlement-car` の展開時だけ下paddingを調整する。選択は `.settlement-car:has(.settlement-car-breakdown [aria-expanded="true"])` のように、app所有クラスと意味のあるARIA属性で閉じる。Carbon内部クラスの新しい上書きは追加しない。
- [x] 調整ブロックの上を8pxにする。通常明細内4px、区分間16px、Carbon本文末尾24px、次車の上16pxを維持し、同じ隙間へmarginを重複追加しない。
- [x] レンタカー補足を括弧ごと折り返さない単位にする。長い名前は既存 `overflow-wrap:anywhere` を維持。操作列の幅、Ghost small、可視文言「費用を編集／費用を入力」、車名入りaccessible nameを維持する。追加依頼により費用編集操作は閉じた内訳行の横にも常時表示し、開閉後も維持する。
- [x] 区切り線・chevron・本文の字下げはF09／F11／F12／F15どおり維持する。線や背景の追加で余白を補わない。
- [x] 通常1行明細を展開し、本文末尾〜次車見出しの距離40〜50px（WebKitのフォントメトリクス差を含む）、閉じた各車の間隔の反復、内訳の左端と金額列の右端が同種の車間で揃うことを確認する。3台それぞれを単独・複数展開して確認する。
- [x] Tab→Enter→Space、編集の起動→キャンセル→元のボタンへの復帰、開閉前後の保存データ不変を既存テストで確認する。長い名前・複数運転手・レンタカー補足とボタンの交差がないことも確認する。

## Task 3: 通貨・符号・差し引き表記を統一する

**Files:** Modify `Settlement.jsx` のローカル `money`、差し引きラベル。Test：`settlement.spec.js` の accessible accordion／one payment category／zero net payment。

**Interfaces:** `money(value)` は既存と同じく数値へ変換し、`Math.round` した表示用整数を使う。丸め後の絶対値に `ja-JP` の桁区切りを適用し、負の場合だけ `−` を通貨記号の前へ付ける。表示専用であり、精算計算の丸め規則は変更しない。

- [x] `money` の負額を `−¥100`、0と丸め後の負のゼロを `¥0` にする。通常正額は `¥100`。既存の調整用 `adjustmentAmount` は絶対値へmoneyを適用し、`+／−` を1個だけ付ける。
- [x] `renderItems`、差し引き、主要金額、既存の費用editorなど、同じmoneyを使う箇所で二重符号・意図しない空白が発生しないことを確認する。金額要素はtabular-numsとnowrapを維持する。
- [x] 可視文言を「集金分の差し引き」にし、該当する既存テストのラベルだけを更新する。任意費用名やユーザーデータは変更しない。
- [x] 既存の `['¥2,200', '¥-100']` の期待値を `['¥2,200', '−¥100']` にする。`not.toContainText` だけでなく、summary・正負の明細・正負の調整に実際の期待額が表示されることを検証する。
- [x] 自動テストで0円、正負の相殺、片区分のみ、`−¥100`、丸め後の `¥0`、表示前後の保存値不変を確認する。`+¥67`と`−¥1,000`は通常サンプルのside-browser実表示で確認した。数値表示に合わせてfixtureの計算値は変更しない。

## Task 4: 実表示で確認し、契約と証拠を残す

**Files:** 既存 `settlement.spec.js`／`visual-consistency.spec.js` の必要な検証、`react-typography-spacing.md`、本計画の進捗欄。

- [x] 既存のbrowser testを拡張し、同じ表示を検証する重複suiteは作らない。class文字列だけを正解にせず、可読な全額、非重複、配置、操作、保存データを確認する。
- [x] 下記の対象テストをChromium desktop／mobileとWebKit mobileで実行する。対象で失敗があれば原因を特定して修正する。全browser suiteの再実行は追加のrelease依頼が来た時点のゲートとする。
- [x] 最新sourceをbuildし、preview照合が成功してからサイドブラウザで同じ合成roomを見る。local-only設定で通常サンプルと境界値fixtureを使い、本番ルームは使わない。
- [x] 393×852と1280×900、light／dark、3台の内訳すべて閉じる／1台開く／複数開くを実際に見る。320・375pxは境界確認も行う。fontが読み込まれた状態で文字・余白・太さ・button padding・線・記号の並びを確認する。
- [x] 境界値：自動テストで長い日本語車名、レンタカー、長い費用名、内訳 `¥23,456,789`、負額、両方0円、正負相殺を確認。side-browserではsummary `¥1,234,567`、内訳 `¥14,803,013`を表示し、金額・編集操作・chevronが隠れず、横スクロールもないことを確認。複数運転手のside-browser実表示は未検証として記録。
- [x] 200%ズーム相当の実表示とkeyboard focusを確認し、できない項目は未検証と記録する。実機・読み上げを実施していない場合は合格と書かない。（200%ズーム相当、実機、読み上げは未検証として記録。）
- [x] 集金モーダルの起動・「すべて」初期選択・閉じる・focus復帰をChromium mobileの自動テストで回帰確認する。モーダル内部レイアウトは変更範囲に追加せず、問題が見つかった場合は別の発見として記録する。
- [x] 共通契約に「1人あたりの金額も主要金額」「区分ごとの金額右揃え」「狭幅配置」「標準button padding」「負号は通貨記号の前」「展開時の外側余白」を追記する。既存の20px／600／28px役割を置き換えない。
- [x] 実際に見たviewport・theme・状態・keyboard結果・スクリーンショットの保存先を記録する。最終diffを確認し、source・CSS・関連テスト・docsの7ファイルだけをstageした。generated distと既存の未追跡 `apps/react/dist-offline-test/` は含めていない。（CUA screenshotはサイドブラウザで確認したがローカル保存していない。）
- [x] 変更内容・対象テスト結果・未検証事項・照合済みpreview URLを報告する。本書の実装許可だけではpush／本番公開へ進まない。

### 実装時に使う対象確認コマンド

PowerShell、repo rootから実行する。以下は計画であり、計画書作成時には実行していない。

```powershell
$env:SANPO_TEST_FIREBASE_TARGET = 'offline'
$env:SANPO_TEST_FIREBASE_PROJECT_ID = 'demo-circle-react'
$env:SANPO_TEST_FIREBASE_DATABASE_URL = 'http://127.0.0.1:9008'
npm.cmd --prefix apps/react run test:browser -- tests/browser/settlement.spec.js --grep 'vehicle settlement presents|settlement rows wrap|one payment category|zero net payment|payment amounts fit|vehicle rows omit|settlement WebKit text and control size audit|expanded vehicle details|rounded negative zero' --project=chromium-desktop --project=chromium-mobile --project=webkit-mobile
npm.cmd --prefix apps/react run test:browser -- tests/browser/visual-consistency.spec.js --project=chromium-mobile
npm.cmd --prefix apps/react run build:preview -- --baseline-source-sha b05ebf7959a409f400d050aef19c032b7c6fd001
```

previewの候補は4281とし、使用中なら既存プロセスを止めず、未使用portを選び対応表と下記コマンドを一緒に更新する。4280の参照画面を奪わない。専用terminalで `apps/react` をcwdにして次のコマンドを実行する。実行者がbackground helperとして起動する場合は、既存の非表示起動方式を使う。

```powershell
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4281 --strictPort
```

別terminalのrepo rootから、ブラウザで開く前に次の照合を行う。成功後の確認URLは `http://127.0.0.1:4281/?room=SETTLEMENT-DETAIL-20261020&view=seisan`。公開SHAが変わっていた場合は本書と対応表の基準を更新し、過去の値で通過扱いにしない。

```powershell
npm.cmd --prefix apps/react run check:preview -- --url http://127.0.0.1:4281/ --expected-source-sha b05ebf7959a409f400d050aef19c032b7c6fd001
git diff --check
```

## 完了判定と計画の進捗

Taskのチェックは実装・必要な確認が完了した項目だけに付ける。計画を書いたことと実装完了を混同しない。

- [x] Task 1：集金header・主要金額・等幅列。
- [x] Task 2：名前・余白・区切り・keyboard／focus。
- [x] Task 3：通貨・符号・差し引き文言。
- [x] Task 4：対象テスト・build／照合・実表示・契約／証拠。

### 2026-10-21 追加実装と確認

- [x] 「各車への支払い」見出しを削除し、車一覧を集金・メモと同じ精算カードの流れに置いた。
- [x] 費用編集操作を開閉ボタンの外側に常時表示。キーボードと視覚の対象テストを更新した。
- [x] 部費が0円の時、summaryを単一金額にし、「割勘から／部費から」と部費0円を隠した。内訳は「割勘／部費」の見出しなしで非0費用と調整行を維持する。割勘支払い自体が0円で相殺明細がある場合も明細を保持する。
- [x] 未回収者の集金を記録した時の「集金状況を更新しました。」トーストを確認。テストは初期状態で既に回収済みの人を誤って選ばないよう、未回収者を明示して操作する。
- [x] 対象Playwright確認：32件のうちsettlement関連28件通過。画面一貫性テストは旧仕様の見出し期待値を更新後、4 browser projectsすべて通過。
- [x] `build:preview` 成功。`check:preview` で `http://127.0.0.1:4283/` のmanifest・index・3 assetを現在のdirty worktreeと照合。サイドブラウザで約390px/light表示、車名・支払額・常時表示の費用編集を確認。
- [ ] 暗色表示でのサイドブラウザ実表示、実機、読み上げは今回未実施。push・本番公開は未実施。

計画作成時点の未検証：変更後の全表示、light／desktop、境界値の実表示、200%ズーム、実機、screen reader。本番公開は実装後の別依頼で扱う。
