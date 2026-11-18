# 車割・班割・精算・モバイルタブ改善 実装計画

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal** — 未割り当ての人の配置をその場で決め、車への調整後支払額と財源を一覧で把握できるようにする。

**Architecture** — 既存のAllocation、SettlementPaymentRow、集金モーダル、TabListを拡張する。既存の配置command・定員判定・精算結果を表示と操作の根拠にする。表示のために計算式や永続データ形式を増やさない。

**Tech Stack** — React 19、@carbon/react 1.115.0、@carbon/icons-react 11.87.0、SCSS、既存Playwright／Node test。

**Spec** — 2026-11-18にユーザーが引用した改善案全文を本書の要件一覧R01〜R22に収録する。全項目を実装対象にする。本書作成時のHEADは `3482ab8450acef0d24634d183c20c6a2c74df911`。これはコード確認の基準であり、実装開始時はmainとの差分を確認する。

## 制約と実装時の判断

- 本計画はユーザーの実装依頼に基づいて実行中。チェック状態は実装・検証の証拠がそろった項目だけ更新する。
- 車割と班割を同じタスクで扱い、車は「車を選ぶ／A車に乗せる」、班は「班を選ぶ／A班に入れる」を使う。
- 既存の `getCapacitySummary` を使う。車の保存定員は運転手を除くが、表示は運転手込み。班長も表示人数に含む。
- 配置更新は `runtime.store.command('move', { id, type, groupId, order })`、定員更新は既存GroupEditorを使う。参加者IDで識別する。
- 精算の合計は `calc.adjustedTotalPay`、財源別は `calc.adjustedSplitPay` と `calc.adjustedClubPay`。符号・端数処理・運転手の集金差引を反映した既存結果を渡す。
- 既存の役割、固定、除外、配置独立性、再読み込み、URL、保存・同期・Firebase Rulesの契約を検証する。計算変更が必要と判明したら本UI計画の範囲を再評価する。
- 登録済みの氏名・学年を使う。候補の学年は `grade > 0` の場合だけ表示する。
- モバイルのメニュー操作領域は現行の最小2.75rem四方、参加者行は最小3remを維持する。新しい追加・選択ボタンもモバイルで44px以上の高さにする。
- 公式のButton強調、Accordion、Tabs、spacingのガイドを根拠にする。具体的な配置・余白値・状態別文言は本サイトの設計判断。
- 既存の `docs/design/react-typography-spacing.md` の「車名横の編集」「2列の財源表示」指定はTask 4で本書の配置へ更新する。本文と旧指定を併存させない。
- 計画作成時の未追跡 `apps/react/dist-offline-test/` は既存作業物として保持する。

## 全要件の対応表

| ID | 必須の改修内容 | タスク | 合格条件 |
|---|---|---|---|
| R01 | 未割り当て1人・空きありを上部に氏名と選択ボタンで表示 | 1 | 一覧末尾／⋮を経由せず既存選択画面を開ける |
| R02 | 未割り当て複数を人数付きで案内 | 1 | 「未割り当ての○人を見る」で一覧へ移動しフォーカスも移る |
| R03 | 未割り当て一覧の各人から直接配置 | 1 | 「班を選ぶ／車を選ぶ」が行に見える |
| R04 | 選択した行き先に合わせた確定文言 | 1 | 「A班に入れる／A車に乗せる」と表示 |
| R05 | 班・車側から空き枠へ追加 | 1 | 「空き1人」「参加者を選ぶ／乗せる人を選ぶ」、候補に「追加」 |
| R06 | 複数候補の学年、長い氏名 | 1・4 | 学年を表示し、氏名・操作が欠けない |
| R07 | 全員配置済み、空き枠あり | 1 | 全員割り当て済み＋静的な空き人数。候補0件を開かせない |
| R08 | 未割り当てあり・全グループ満員 | 1 | 人数と空きなしを伝え、既存定員変更へ到達できる |
| R09 | ランダムの状態別強調と保護対象 | 1 | 初回一括はprimary、組み直しはghost。班長・運転手・固定の確認文を保持 |
| R10 | 車名の横に合計支払額 | 2 | ¥1,900＋¥1,000の車は¥2,900が開閉前に見える |
| R11 | 財源は合計直下で常時表示 | 2 | 「集金から」「部費から」を左ラベル・右金額で読める |
| R12 | 編集・内訳を財源の下へ配置 | 2 | 独立したボタンとして動作し、詳細は費目・調整だけを開閉 |
| R13 | 調整済み合計・負数・部費0円 | 2 | 符号を保持し、部費0円では合計と同額の行を重複表示しない |
| R14 | 途中／完了の集金表示 | 3 | 「集金済み 8 / 10人」「集金完了 10 / 10人」 |
| R15 | 完了後の集金状況再確認・訂正 | 3 | 入口が残り、チェックを戻すと途中表示に戻る |
| R16 | 未集金0人の案内・コピー出し分け | 3 | 空一覧に「未集金の人はいません」。コピーは対象がある時だけ |
| R17 | 全グループ共通の青い縦線を整理 | 4 | 淡い面と班名で区別。超過箇所には文字とアイコン |
| R18 | 班・車と参加者の⋮中心を揃える | 4 | 同一グループの上下の中心X座標の差が1CSS px以内 |
| R19 | 車名・財源・区切り線の左端、金額右端を統一 | 4 | 共通の左右線で読める。内訳の階層はインデントで示す |
| R20 | 関連の強さに合わせた余白 | 4 | 間隔4〜8px、車内12〜16px、車間24pxをトークンで構成 |
| R21 | タブの実在内容に沿った矢印と末尾停止 | 5 | 隠れた実タブがある方向だけ矢印。末尾余白への空送りなし |
| R22 | 押しやすさ、折返し、キーボード、実画面検証 | 1〜6 | 狭幅／デスクトップ、明暗、長い名前・金額で操作できる |

## 変更するファイル

| ファイル | 役割 |
|---|---|
| `apps/react/src/components/Allocation.jsx` | 上部1人表示、未配置行の選択操作、候補、空きなし案内、フォーカス |
| `apps/react/src/components/settlement/SettlementPaymentRow.jsx` | 車名・合計・財源・独立した編集／開閉の配置 |
| `apps/react/src/components/Settlement.jsx` | 調整後合計を渡す、集金状態、未集金0件とコピー |
| `apps/react/src/App.jsx` | 実タブの表示位置、末尾クランプ、矢印の表示条件 |
| `apps/react/src/styles.scss` | 変更した各コンポーネントの色、行・端揃え、余白、レスポンシブ |
| `apps/react/tests/browser/allocation.spec.js` | R01〜R09のシナリオ |
| `apps/react/tests/browser/settlement.spec.js` | R10〜R16、負数・調整・集金状態 |
| `apps/react/tests/browser/settlement-entry-mode.spec.js` | 人数だけの精算での支払表示・集金状態 |
| `apps/react/tests/browser/project-workspace.spec.js` | タブの末尾、可変タブ数、履歴・キーボード |
| `apps/react/tests/browser/modal-accessibility.spec.js` | 変更した配置先・集金モーダルの操作とフォーカス |
| `apps/react/tests/browser/visual-consistency.spec.js` | 明暗・幅・揃え位置・操作領域の実測 |
| `docs/design/react-typography-spacing.md` | 車支払行と余白の契約更新、モーダル確認記録 |
| `docs/design/ui-screen-matrix.md` | 改修した状態のowner・確認結果 |

新しい画面・独立した計算器・永続設定は追加しない。対象コードが実装開始時に移動していた場合は責務を持つ現行ownerへ読み替え、計画に記録する。

## Review Focus

1. 配置先選択中に最後の空きが埋まる。確定時の最新状態で拒否され、別の行き先を選べる — Task 1。
2. 追加直後に候補・上部の1人操作が消える。bodyへフォーカスが落ちず、結果と次の操作が分かる — Task 1。
3. 負数、端数処理、運転手の差引、複数運転手。財源の符号と調整後合計が一致する — Task 2。
4. 対象者0人、対象外の運転手、記録の取消、人数だけの精算。0/0を完了扱いしない — Task 3。
5. タブ数・幅が変わり矢印自体の幅も変わる。振動する表示や空白送り、履歴の増加が起きない — Task 5。

## Task 1 — 人と空き枠の両方から配置を完了できるようにする

**Files** — Allocation.jsx、styles.scss、allocation.spec.js、modal-accessibility.spec.js。

**Interfaces** — 既存 `openMoveEditor(id, fromWaiting = false)` を選択画面の共通入口とする。起点ボタンrefを受け取れるよう `openMoveEditor(id, fromWaiting = false, launcherRef = null)` に拡張し、モーダルのlauncherとして渡す。`getCapacitySummary(type, group.capacity, car.members.length)` から空きのある行き先を求める。表示用状態を永続化しない。

- [ ] allocation.spec.jsへ班・車の両方でR01〜R09を追加する。1人→行き先選択→確定→未割り当て0人、複数→一覧→個別選択、候補から追加、0候補、満員のケースを確認する。
- [ ] 対象specを実行し、新しい入口・文言が現在欠けているため失敗することを確認する。既存の定員・役割・固定・再読み込みケースを維持する。
- [ ] 上部に1人の氏名と「班を選ぶ／車を選ぶ」を表示する。空きありならprimary。複数なら「未割り当ての○人を見る」で展開後の一覧見出しへフォーカスを移す。待機行にも選択ボタンを表示し、重複する⋮の「割り当て先を選ぶ」はその行では外す。他の行操作は維持する。
- [ ] fromWaitingの選択画面を「○○の班を選ぶ／車を選ぶ」、選択欄を「班／車」、確定を選択先に応じて「A班に入れる／A車に乗せる」にする。配置済みの人の別グループ移動は既存の表現・役割確認を使う。
- [ ] 候補の見出しを「A班に追加する参加者」などとし、名前・登録済み学年・文字付き「追加」を表示する。ボタンのアクセシブル名には氏名と行き先を含める。班末尾は「空き○人」「参加者を選ぶ」、車末尾は「空き○人」「乗せる人を選ぶ」とする。
- [ ] 待機0人では空き人数を静的表示する。満員のグループは追加操作を出さない。待機あり・全グループ満員は「空きのある班がありません／空きのある車がありません」とし、「定員を変更」で既存グループから対象を選びGroupEditorを開く小さな選択導線を使う。グループ自体が0件なら既存の「班を追加／車を追加」へ案内する。
- [ ] 上部の初回ランダムをprimary、既存配置の組み直しをghostにする。1人の個別選択がprimaryになる状態では同じ領域のランダムはghostとする。既存確認画面に役割・固定の保持を明記する。
- [ ] 閉じる／キャンセルは起点へ復帰、成功して起点が消えた場合は追加先グループ見出しへ復帰する。候補からの追加は既存の次候補→空き枠操作→グループ見出しの順を適用する。空き枠が静的表示へ変わる時はその見出しを使う。
- [ ] モーダル表示中に最新snapshotから対象と定員を確認し、埋まった先は確定不可とする。commandが失敗・無効なら成功通知を出さず、選択をやり直せる。別画面で定員を変えたケースをlocal fixtureで検証する。
- [ ] テストで最終placement、人数、通知、フォーカス先を確認する。配置の二重登録、車割変更による班割の変更がないことも確認する。
- [ ] 対象specが成功したらこのタスクのファイルを明示してcommitする。

## Task 2 — 車名と調整後合計を先に読み、財源を続けて読めるようにする

**Files** — Settlement.jsx、SettlementPaymentRow.jsx、styles.scss、settlement.spec.js、settlement-entry-mode.spec.js。

**Interfaces** — SettlementPaymentRowへ `totalAmount={money(calc.adjustedTotalPay)}` を追加する。既存の `splitAmount`、`clubAmount`、`compactAmount`、`driverMenu`、`onEdit`、`details` を再利用する。合計の文字列を財源の表示文字列から再計算しない。

- [ ] 部費ありの車で「車名／合計¥2,900」「集金から¥1,900」「部費から¥1,000」が開閉前に存在するテストを追加し、現行では合計表示がないことによる失敗を確認する。
- [ ] toplineを車名＋合計、次に左ラベル・右金額の財源2行、最後に「支払いの内訳⌄」「費用を編集／入力」を配置する。DOMの読み順もこの順にする。狭くて車名と合計が並ばないときは合計を次行の右端へ折り返す。
- [ ] 編集ボタンと開閉ボタンを独立させる。編集clickで内訳が開閉しない。既存のAccordionItemとrenderToggleを利用し、開閉可能な部分にだけaria-expanded／aria-controlsを付ける。driverMenuも独立した操作として置く。
- [ ] 部費0円は合計のそばに「集金から」を添え、同じ金額の財源行と部費0円行を省く。非0の部費がある時は符号を含めて2財源を表示する。両財源が非0で合計0円になるケースも2行を表示する。
- [ ] 複数運転手の名前と「車単位で一括支払い」を引き続き表示する。開閉前に合計と財源が車名に関連付くようにし、内訳ボタンのaria-describedbyにも関連する値を渡す。
- [ ] 調整あり・部費負数・合計負数・0円・大きい金額・長い車名・レンタカー・複数運転手を既存fixtureで検証する。数値はstoreの調整後結果に一致し、内訳のカテゴリ合計にも一致することを確認する。
- [ ] 部費0のflat明細と、部費ありの財源別明細、切り上げ・集金差引、費用編集後の再表示を確認する。
- [ ] 通常の企画と人数だけの精算で対象specを通し、タスク単位でcommitする。

## Task 3 — 集金の途中・完了・対象0件を表示する

**Files** — Settlement.jsx、settlement.spec.js、settlement-entry-mode.spec.js、modal-accessibility.spec.js。

**Interfaces** — `result.paidCount`、`result.payerCount`、`result.excludedNames`、`state.paid` を使う。未集金対象は既存copyUnpaidと一覧で同じ条件から導出する。表示のための保存フラグを追加しない。

- [ ] テストに途中8/10、完了10/10、取消9/10、対象外あり、対象0人、人数だけの精算を追加する。完了文言と0件案内がないことで失敗することを確認する。
- [ ] `payerCount > 0 && paidCount === payerCount` の場合だけ「集金完了 10 / 10人」、それ以外の対象ありは「集金済み 8 / 10人」とする。「1人あたりの集金額」と記録訂正の入口は同じ場所で使う。
- [ ] 対象0人は0/0の完了を出さず、既存の対象者設定に応じた案内を使う。完了表示は支払い処理の完了と結び付けない。
- [ ] 「未集金」に切り替えて0件なら「未集金の人はいません」を一覧の位置に表示する。「未集金の人をコピー」は未集金対象が1人以上の場合だけ表示する。
- [ ] モーダル内で最後の人を集金済みにしてその行とコピーが消える時、フォーカスを「未集金」切替に戻す。チェックを取消して対象が戻ると一覧とコピーも復帰する。コピー成功／権限エラーの既存通知を維持する。
- [ ] キーボードで切替→チェック→0件→閉じる→起点復帰を確認する。表示条件の更新でCarbon Modalのボタン構成が正しく変わることを確認し、対象spec成功後にcommitする。

## Task 4 — 色・列・余白の規則を揃える

**Files** — styles.scss、Allocation.jsx、visual-consistency.spec.js、react-typography-spacing.md、ui-screen-matrix.md。

**Interfaces** — Task 1〜3の既存classを局所的に調整する。全サイトの共通セレクタを変更する場合は参加者・フォーム・登山計画書も影響確認する。

- [ ] 班・車の見出しから全件共通の青い左線を外し、通常のlayer背景と控えめな境界を使う。hover状態用の背景を静的見出しの基本色として使わない。定員超過は既存文字にCarbonの検証済みwarningアイコンを添え、色以外でも伝える。
- [ ] グループ見出しの右パディングと名簿action領域を合わせ、⋮の中心線を揃える。氏名・役割・固定タグ・学年は可変内容に追従し、長文時に行を伸ばす。
- [ ] 車支払行は車名・財源ラベル・Accordion区切り線の左端と合計・財源金額の右端を揃える。内訳内の費目は16pxのインデントで階層を示す。区切り線を重ねない。
- [ ] spacing-02/03をラベル周辺の4/8px、spacing-04/05を車内の12/16px、spacing-06を車間24pxの基準にする。外側のモバイル余白は既存page insetに揃える。
- [ ] 合計はCarbon heading-03の20px／400／28px、財源ラベルと金額はbody-compact-01の14px／400／18pxを初期値とする。金額のtabular-numsを使用する。新しい構成の実画面で読みやすさを確認し、必要な調整値を設計文書に確定する。
- [ ] 旧設計文書の車支払3段構成と財源2列の指定を、Task 2の「車名＋合計→財源行→開閉・編集」に置き換える。対象モーダルの状態別確認記録とscreen matrixを更新する。
- [ ] visual specで左右の揃えと⋮中心差1px以内、computed typography、44px操作領域、長い氏名・6桁以上・負数の横overflowなしを確認する。light／dark・mobile／desktop両方を確認してcommitする。

## Task 5 — 実在するタブに合わせてスクロールを止める

**Files** — App.jsx、styles.scss、project-workspace.spec.js。

**Interfaces** — `scrollTabsToBoundary(event, direction)`、選択タブ表示のeffect、Carbon TabListの既存overflow制御を修正する。基準は実際の `[role=tab]` の矩形と、矢印の占有領域を除いた表示域とする。

- [ ] 最後まで送ったら右矢印が消える、最初なら左矢印が消える、全部収まるなら両方消えるテストを追加する。タブが1個・4個・追加ツールあり、320／390／1280px、幅変更、タブ追加・非表示に対応させる。
- [ ] 現行の末尾pseudo elementと `--tab-scroll-tail` の余白計算を外す。タブ境界への送りは残し、末端では実コンテンツの最大scroll位置へクランプする。送りでタブの選択・URL・履歴を変更しない。
- [ ] 選択変更時は選択中のタブ全文を実表示域内へ収める。最後のタブを左端へ寄せるための余白は作らない。手動で列を送っている時に選択タブへ強制的に戻さない。
- [ ] Carbonの実装・実DOMを確認し、標準のoverflow状態をまず利用する。追加の可視判定が必要な時だけ、実タブのleft/rightと矢印込み表示域を比較する。要素幅変化を再計測し、矢印表示の切替で振動しないよう端の判定に1CSS pxの許容差を使う。ネイティブclickと独自handlerの二重送りを防ぐ現在のcapture処理の意図を保持する。
- [ ] 既存の「見える全タブの両端が必ず揃う」assertionは、自然な末端停止と両立しない場合がある。仕様変更に合わせ「選択時の選択タブ全文」「途中送りのタブ境界」「末端の実scroll上限」「隠れた実タブと矢印の一致」をそれぞれassertし直す。前述の挙動を証明する条件は削らない。
- [ ] 矢印キー、Tab、Enter、直リンク、戻る／進む、タブ編集後の選択復帰を確認する。長すぎて幅全体に収まらないユーザー指定ラベルは、タブ自体が到達可能で全文を確認できる既存手段を維持し、通常の各ツール名の全文表示と区別して検証する。
- [ ] ChromiumとWebKitのmobileで対象ケースを通し、desktopで矢印不要の場合を確認してcommitする。

## Task 6 — 全項目の実画面確認と実装完了判定

- [ ] 実装開始時に `apps/react/migration/progress.json` とAGENTS、最新mainを確認する。Carbon Builder／MCPで変更対象のButton、Modal、TabList、AccordionItem、アイコンの実props・export・構造を確認する。既存packageの版を前提にして使う。
- [ ] 以下のoffline環境で各タスクの対象specを先に実行する。対象specの成功後、RCでは既存の要求するbrowser matrixを一度通す。新しい変更・失敗・未解決事項がなければ同じ検証を繰り返さない。

```powershell
$env:SANPO_TEST_FIREBASE_TARGET = 'offline'
$env:SANPO_TEST_FIREBASE_PROJECT_ID = 'demo-circle-kikaku-tools'
$env:SANPO_TEST_FIREBASE_DATABASE_URL = 'http://127.0.0.1:9000'
npm --prefix apps/react run test:browser -- allocation.spec.js settlement.spec.js settlement-entry-mode.spec.js project-workspace.spec.js modal-accessibility.spec.js visual-consistency.spec.js --project chromium-desktop --project chromium-mobile --project webkit-mobile --workers=2
```

- [ ] `node tools/classify-release-changes.mjs <base-sha> <head-sha>` でCI範囲を決める。本計画にはevent handlerとApp shellの変更があるため現行基準ではfullが見込まれる。JSON reportを `tools/assert-browser-clean.mjs` の既存利用方法で検査し、unexpected/flaky、0件、全skipを成功扱いしない。
- [ ] サイドブラウザー用は公開 `release-build.json` のsourceShaを取得し、`npm --prefix apps/react run build:preview -- --baseline-source-sha <published-sourceSha>` で生成する。freshなlocal originへ配信し、`check:preview` にurlと同SHAを渡して成功を確認してから開く。
- [ ] 320／390pxと1280px、light／darkでTask 1〜5の実操作を確認する。200%文字拡大、長い氏名・学年なし、役割／固定タグ、長い車名・レンタカー、大きい金額・負数でも読めることを確認する。
- [ ] ユーザーの2つの目的を独立して確認する。「伊藤さんの班を選ぶ→A班に入れる→未割り当て0人と追加結果が分かる」「内訳を開かず佐藤花子車の合計¥2,900、集金¥1,900、部費¥1,000が分かる」。車割でも同等の操作を通す。
- [ ] 開く／閉じる、選択・取消・成功・失敗・満員・対象0件を記録する。画面の見やすさはヒューリスティック評価として記録し、利用者テスト・実機・screen readerを実施した場合はその証拠も別途記す。未実施の確認を合格扱いしない。
- [ ] R01〜R22を一行ずつチェックし、実装箇所・自動検証・実画面証拠を対応させる。漏れや確認待ちは具体的に残す。

## 実装後の本番反映

リポジトリ標準の実装完了条件として以下を行う。本プロジェクトの完了条件として、全検証後にこの工程を実行する。

- [ ] 対象ファイルだけをcommit／pushし、PRに全要件の対応と検証結果を記載する。CIの失敗は今回とbaselineをテスト単位で切り分け、required checkを通す。
- [ ] merge後のmainの対象SHAで `Release / Readiness` が成功したことを確認する。PR headの結果で代用しない。
- [ ] 既存 `React Production Release` をmainからdispatchする。workflowが判定したcompatibility／root経路に従い、同じbuildの公開と両ブラウザーのroot smoke、指定smokeデータのcleanupを確認する。
- [ ] 公開manifestのsourceSha／asset digestと対象を照合する。公開後に通常企画への書き込みを伴わない実画面確認を行う。状態を変える検証はworkflowの専用smoke範囲または検証済みlocal previewで行う。
- [ ] 失敗時は既存の検証済みrollback経路を使う。成功済み同SHAのcheckは再利用する。最終報告にはPR・main SHA・release run・root smoke・cleanup・画面確認結果を記載する。

## 根拠

- Carbon公式のボタン強調 — https://www.carbondesignsystem.com/building-blocks/core/components/button/guidelines/#multiple-button-emphasis
- Carbon公式の詳細開閉 — https://www.carbondesignsystem.com/building-blocks/core/components/accordion/guidelines/#when-to-use
- Carbon公式の余白と関連性 — https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview#designing-with-space
- Carbon公式のスクロールタブ — https://www.carbondesignsystem.com/building-blocks/core/components/tabs/guidelines/#scrollable
- W3Cの操作対象サイズ — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- NN/gの状態表示と操作原則 — https://www.nngroup.com/articles/ten-usability-heuristics/

公式ガイドは2026-11-18の直前のUI監査で参照済み。数値・文言・状態分岐はユーザー提示案を現行コードへ落とし込んだ判断。実装時にはインストール済みCarbonのcontractを再確認する。

