# 参加者登録の方法分離・確認改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 同一エージェントで順に進める。

**Goal:** どこに何を入力すれば誰が登録されるかを明確にし、名前入力と回答表取り込みを短い一つの登録操作に整える。参加者0人の画面から人数精算の設定へ直接進める。

**Architecture:** 既存Carbon Modalを維持し、登録方法で本文を切り替える。名前を登録対象の軸にし、手入力の学年・車出しは各人の任意属性として扱う。回答表は既存parser、確定は既存addParticipantsコマンドを利用し、登録前の操作でroomを書き換えない。

**Tech Stack:** React 19.2.8、@carbon/react 1.115.0、Sass、既存Node test／Playwright環境。依存パッケージは追加しない。

**Spec:** 本書「採用する設計」。2026-10-12の登録画面再評価と、参加者0人からの人数精算導線追加を対象とする。

## Global Constraints

- 作業元は `C:/Users/toshi/.codex/worktrees/production-baseline/circle-kikaku-tools`、作成時branchは `codex/production-baseline-workspace`。Documents配下の別checkoutや中止済みcarbon-redesignを起点にしない。
- 実装開始時にAGENTS.mdと `docs/development/current-workspace.md` を読み直す。既存の未コミット変更を保全し、reset／stash／一括取り込みをしない。
- プレビューは最新の公開release-build.jsonのsourceShaを基準としてbuild:preview／check:previewで照合する。ポート番号・見た目だけで版を判断しない。
- 検証はlocal保存または既存の安全なテスト環境のみ。本番企画148A7906やGoogleフォームの回答を検証用に書き換えない。
- 参加者ID、名前の照合、削除済みIDの扱い、割り当て、精算、同期、schema、既存参加者のmerge契約を変更しない。generated domainは編集しない。
- 自動連携済み企画の「応募者を選ぶ→参加者を確定」は維持する。フォームURLの読み取り、Google認証、連携設定変更、Form Makerの改修は含めない。
- 参加者が0人でフォーム連携もない場合、参加者画面の空状態に「人数だけで精算」への入口を追加する。押すと精算タブへ移動し、人数精算を選んだ精算設定の先頭画面を開く。設定は利用者が保存するまで反映しない。
- 新しく使うCarbonコンポーネントはCarbon MCPとインストール済みパッケージのexports／props／DOMで確認する。自動auditの誤検出をそのまま修正項目にしない。
- モーダル内の方法切り替えでは入力を保持する。閉じて再度開いた後のdraft永続化は追加しない。
- 実装後の公開はこの計画書だけでは許可しない。実行依頼の公開範囲とリポジトリのrelease手順を確認する。

## Review Focus

1. 方法を切り替えてもdraftが消えず、表示している方法の人だけが登録される。
2. 名前の変更・削除・並べ替えで学年や車出しが別人へ付かない。正規化で同じになる名前は既存契約どおりまとめる。
3. 既存参加者の再入力でID・メモ・固定・役割・割り当てを失わず、未設定の学年や車出し未選択で既存設定を解除しない。
4. 空入力・解析失敗・コマンド失敗では閉じず、修正対象にフォーカスし、入力を保持する。
5. 長い名前・50人の貼り付け・320px幅・200%拡大でも本文を操作でき、フッターやエラーが隠れない。

## 再評価の結論

前案の「方法を分ける」は維持する。ただし手入力を選んだ後に6つの名前欄を残すだけでは、名前の重複入力と登録範囲の曖昧さが残る。今回は名前の一覧を一つにし、属性をその人へ付ける。

現行の「車出し欄や学年欄だけに書いた名前も登録する」は複数の入力欄をunionするUI上の仕様である。新UIではそれらの名前欄を撤去するため、その暗黙ルールもなくす。既存データや保存ロジックを変更するものではない。

### 構造案の比較

| 案 | 利点 | 弱点 | 判断 |
|---|---|---|---|
| 方法選択＋同じModal内で必要な入力を表示 | 現在の追加導線を保ち、入力から登録まで一度の確定で済む | 任意属性を全員編集すると長くなる | **採用**。属性は必要なときだけ展開し、表の取り込みと使い分ける |
| 追加ボタンを「手入力」「回答表取り込み」に分ける | 入口から方法が分かる | 通常の参加者一覧に低頻度の操作が増える | **不採用**。Modal内の登録方法で十分 |
| 専用ページ＋入力／確認の2段階 | 大量の全員分編集に向く | 名前だけの追加にも遷移・確認が増える | **今回は不採用**。実ブラウザで大量編集が主要用途と判明した場合のみ再検討 |
| 方法だけ分け、手入力6欄を残す | 現在の学年別コピペを維持しやすい | 同じ名前の再入力と属性の対応ミスが残る | **不採用** |
| 名前だけ登録し、学年・車出しは保存後のみ編集 | 登録Modalが最短 | 既存の一括登録で指定できた属性が後回しになり、往復が増える | **不採用**。任意属性は登録前にも設定できる |
| 参加者なしの空状態から精算タブへ移るだけ | 入口が増える | 人数精算を選ぶ場所が分からず、設定を探す必要がある | **不採用**。人数精算を選択済みにして設定を開く |

## 公式指針と製品判断

- **公式:** [Forms](https://www.carbondesignsystem.com/building-blocks/core/patterns/forms) は必要な情報に絞ること、関連入力のグループ化、論理的な順序、関連する追加入力の段階的な表示を示す。基本は1列とする。
- **公式:** [Radio button](https://www.carbondesignsystem.com/building-blocks/core/components/radio-button/guidelines) は相互排他的な選択肢に用いる。
- **公式:** [Modal](https://www.carbondesignsystem.com/building-blocks/core/components/modal/guidelines) は一つの作業への集中、内容に合ったサイズ、本文のみの縦スクロール、ヘッダー・フッターの固定を示す。
- **公式:** [Text input](https://www.carbondesignsystem.com/building-blocks/core/components/text-input/guidelines) のラベル・補助説明・エラーの役割を適用する。TextAreaの実際のinvalid／invalidText等は実パッケージで確認する。
- **製品判断:** RadioButtonGroupによる方法選択、名前一覧＋任意属性、別確認ステップを設けないこと、取り込み明細を初期は閉じることは、この用途での判断。Carbonがこの構造を必須にしているわけではない。
- ContentSwitcherは関連ビューの切り替えにも使えるが、ここは入力方法を一つ選ぶためradioを採用する。複数の手入力欄をそれぞれAccordionに隠す、独自フッター、確認一覧の内側にもスクロールを作る案は採用しない。

## 採用する設計

### 1. 共通

- タイトル・確定ボタンは「参加者を登録」、副ボタンは「キャンセル」、閉じるボタンの読み上げ名は「閉じる」。
- 冒頭は「登録方法」のRadioButtonGroup。「名前を入力」「回答表を貼り付ける」の2択。通常の追加からは「名前を入力」を初期選択。
- 選択した方法だけを表示する。別の方法の入力をdisabled状態で残さない。
- 初期フォーカスは登録方法の選択済みradio。方法変更で入力へ強制移動せず、次のTabで表示中の入力へ進める。
- draftは方法ごとに保持する。非表示側の解析エラー・警告・人数は表示・登録を妨げない。
- 有効な対象があるときだけ確認要約を表示。空でも登録ボタンは押せ、押したら該当欄のエラーを示す。入力中から空欄をエラー扱いしない。
- 入力や確認を更新してもroomへコマンドを送らない。確定時だけaddParticipantsを一度呼ぶ。キャンセル／閉じる／Escapeは登録しない。
- 成功通知は「参加者を登録しました」。ローカルコマンド受付をサーバー同期完了と表現しない。
- TextAreaでEnterを押しても登録されない。日本語変換中のEnter／Escapeで確定・キャンセルを起こさない。現行Modalのキー処理も確認する。

### 2. 名前を入力

- TextArea一つ。ラベル「参加者の名前」、補助説明「1行に1人ずつ入力してください。」。
- 名前を既存formParser.normalizeNameForCompareで正規化し、空行は除外、重複は初出の表示名でまとめる。
- 各人の属性draftは正規化した名前をkeyに保持する。行番号をkeyにしない。名前を変えた場合は別対象として未設定から始める。同じ正規化keyへ戻した場合はこのModal内のdraftを復元してよい。
- 名前がある場合だけ「学年・車出しを設定（任意）」の開閉操作を表示する。初期は閉じる。Carbonの単一AccordionItemを使い、複数の名前入力を隠す構造にはしない。
- 展開すると名前ごとの行に「学年」のSelect（未設定、1年、2年、3年、4年）と「車出し」のCheckboxを表示する。名前・属性・操作の対応が分かる1列構成。各コントロールの読み上げ名に本人名を含める。
- 学年の未設定は0、車出し未選択はfalseとして既存入力契約を使用する。既存参加者の学年や運転手設定を解除する操作にはしない。解除・名前変更は既存参加者編集で行う。
- 常時の補助説明は「車出しに指定すると、車割にも反映されます。」。該当する既存参加者がいるときは「既存参加者の未設定項目を解除する操作ではありません。」も表示する。
- 名前だけなら属性展開・確認画面への遷移を必須にせず、そのまま登録できる。大量の学年属性を入力する用途は回答表取り込みを使える。全員選択用Checkboxや一括編集toolbarは今回は増やさない。

### 3. 回答表を貼り付ける

- TextAreaのラベル「回答データ」。
- 常時見える補助説明「回答用スプレッドシートから、見出し行と回答行を一緒にコピーしてください。」。
- 「貼り付け方を見る」はCarbon Accordionで維持。コピー条件はここへ隠さない。
- 解析は既存parseSpreadsheetImportを利用する。列順・学籍番号からの学年推定・重複統合・競合時の優先ルールを変更しない。
- フォームURLを貼った場合は、表として読み取れない理由と「回答用スプレッドシートの表をコピーしてください。」を該当欄に示す。URLの取得処理は作らない。
- 正常解析時は「登録対象13人・車出し3人・学年未設定2人」のように表示する。元の回答行数や新規人数と混同しない。
- 「読み取り結果を確認」を開くと名前・学年・車出しの読み取り専用一覧を表示する。最初から全員分の編集欄を並べない。修正が必要なら貼り付けデータを直して再解析する。
- 重複統合・学年や車出し回答の競合等のparser警告は、明細を閉じていても確認できる位置に出す。通常の人数要約と分ける。警告は登録を禁止せず、解析エラーは登録を禁止する。
- 確認一覧はModal本文と一緒にスクロール。内部の固定高スクロール、ページ送り、別確認Modalは作らない。

### 4. 既存参加者と自動連携

- 登録対象内の名前重複と、room内の既存参加者への統合は区別する。既存照合にはcanonical.findParticipantIdByNameを使い、独自の別ルールを作らない。
- 既存一致があれば「同じ名前の参加者は既存情報に統合されます。」を表示し、確認一覧で「登録済み」を示す。新規と判断できない対象を「新規N人」と断定しない。
- 学年の非ゼロ指定は既存学年の更新になりうる。車出しtrueは既存車割にも反映される。単に無変更・スキップされると説明しない。
- 属性draftから送る人の形は既存の{name, grade, driver}。capacity、memo、locked、flag、応募者IDは新たに送らない。
- 自動連携済み企画は既存の応募者一覧・確定フローを使用する。Participants.jsxの連携判定や追加ボタンの表示条件を変えない。「登録方法」の第3選択肢として自動連携を追加しない。
- 参加者0人かつ自動連携なしのParticipants空状態にghostボタン「人数だけで精算」を出す。Appで精算tabへ切替後、Settlementへ一回限りのopen-settings requestを渡す。Settlementは既存beginSettlementEdit(runtime.store, { standalone: true })でdraftを開く。既存の人数精算選択・入力・保存操作を再利用し、ボタンを押しただけではroomを書き換えない。

### 5. エラー・サイズ・アクセシビリティ

- 空の手入力は名前欄、空／不正な回答表は回答データ欄にinvalidとinvalidTextを付ける。登録押下後に対象欄へfocus＋必要ならscrollIntoViewする。
- コマンド失敗は全体InlineNotificationで表示し、通知にフォーカスできるようにする。draftとModalを保持する。全体エラーと欄エラーを同じ文言で二重表示しない。
- 入力変更でその欄の古い送信エラーを解除。解析結果の警告は現在の入力に合わせて更新する。毎打鍵で全文を読み上げず、要約のaria-live通知は入力更新が落ち着いてから行う。
- Carbon標準のModalヘッダー・本文・フッター、フォーカストラップ、Esc、トリガーへのフォーカス復帰を活用する。
- サイズはmdを起点に実ブラウザ確認。長い名前や属性行が実際に収まらなければlgを選ぶ。空のModalを任意のmin-heightで伸ばさない。
- 狭い幅は1列。Carbon spacing／type／text-secondary／layerのトークンを使用。registration-modal配下に必要なCSSだけ加え、全サイトのModal overrideはこの作業で変更しない。
- 長文時は本文だけ縦スクロールし、保存・キャンセルに到達できることを実測する。画像やhasScrollingContent指定だけではスクロール欠陥と判定しない。

## 変更するファイルと責務

| ファイル | 責務 |
|---|---|
| apps/react/src/components/RegistrationModal.jsx | 方法選択、draft、欄検証、確定、エラーfocus |
| apps/react/src/App.jsx | 空状態CTAから精算tab・設定画面への一回限りrequestを渡す |
| apps/react/src/components/Participants.jsx、Settlement.jsx | 空状態CTAと人数方式を選択済みにした設定表示 |
| apps/react/src/components/RegistrationPeoplePreview.jsx（新規） | 要約と開閉できる読み取り一覧。必要な場合の登録済み表示 |
| apps/react/src/components/registration-input.js（新規） | 手入力の名前整理、属性付与、要約。React／store依存を持たない |
| apps/react/src/styles.scss | registration-modal内の属性行・要約・長い名前の折り返しのみ |
| apps/react/tests/registration-input.test.mjs（新規） | 名前整理・属性対応・人数要約 |
| apps/react/tests/browser/registration.spec.js（新規） | 2方法、登録／キャンセル、エラー、モバイル／keyboard |
| apps/react/tests/browser/{participants,allocation,carbon-remediation,visual-consistency}.spec.js | 旧ラベル・旧手入力方法への依存を新仕様へ更新。元のassertionは保持 |
| apps/react/tests/{store,domain}.test.mjs | 既存merge・車割・削除済みIDの契約の既存caseを確認し、不足がある場合だけ追加 |

Participants.jsx、store、generated domainは原則変更しない。先に既存テストを確認し、表示変更だけのためにdomain再生成や同期改修を行わない。

## Task 1: 手入力と確認の入力モデルを分離

**Interfaces:**
- `parseManualNames(text) -> Array<{key, name}>`：既存parser正規化を利用。初出順・初出表示名。
- `buildManualPeople(names, attributesByKey) -> Array<{name, grade, driver}>`：現在の名前だけを対象にする。未設定はgrade=0／driver=false。
- `summarizePeople(people) -> {total, drivers, unknownGrades}`：重複整理後のpeopleから計算。

- [ ] 上記インターフェースをregistration-input.jsに作り、空行、全半角／空白等の既存正規化、重複、CRLF、並べ替え、名前削除、属性draftの対応を固定する。
- [ ] registration-input.test.mjsに具体ケースを追加する：名前A／Bの並べ替え後もBの学年3・driver=trueがBに付く、B削除後にBがpeopleへ残らない、空文字は0人、同じ正規化keyは1人。
- [ ] store／domainの既存caseを確認する。再登録でID・メモ・固定・割り当てが保持、grade=0で既存学年が消えない、driver=falseで運転手が解除されない、trueで車割に反映、削除済みIDが復活しないことを不足分だけ検証する。
- [ ] apps/reactのテスト専用PowerShellで下記のoffline環境を設定し、`node tools/assert-test-target.mjs offline` が成功した場合だけ `node --test tests/registration-input.test.mjs` を実行する。期待値は全case PASS。ガードが本番設定を検出したら停止し、ガードを削除・迂回しない。

```powershell
$env:SANPO_TEST_FIREBASE_TARGET = 'offline'
$env:SANPO_TEST_FIREBASE_PROJECT_ID = 'demo-registration-review'
$env:SANPO_TEST_FIREBASE_DATABASE_URL = 'http://127.0.0.1:9000'
$env:VITE_REACT_SYNC_MODE = 'local'
```

以後のnpm test／test:browserもこの専用shellとガードを使用する。
- [ ] 純粋入力処理のみでroomの変更が発生しないことを確認する。

## Task 2: 方法選択と任意属性を実装

**Interfaces:** RegistrationModal({runtime, onClose, onNotice})は維持。modeはmanual／spreadsheet。各modeのdraftを独立して保持し、submitはactive modeのpeopleだけを送る。

- [ ] Carbon MCPと実パッケージでRadioButtonGroup／RadioButton、Select／SelectItem、Checkbox、TextArea、Accordion、Modalの必要なpropsを確認する。
- [ ] browser/registration.spec.jsに方法別のvisible入力、切替後draft保持、非表示側の不正入力で登録が妨げられないcaseを追加する。
- [ ] 既存のdrivers／gradesの名前TextAreaを撤去し、名前TextArea＋単一の任意属性展開へ置き換える。
- [ ] 手入力でA／Bを貼り付け、Bだけ3年・車出しを設定して登録し、保存結果・車割への反映を検証する。属性展開なしでも登録できることを確認する。
- [ ] タイトル・確定・閉じるのラベルを変更し、Participantsの入口や自動連携条件は維持する。
- [ ] 旧手入力を使う関連テストの操作を更新する。参加者・車割・精算の期待値やassertionは削除・弱化しない。

## Task 3: 読み取り結果と既存一致を伝える

**Interfaces:** RegistrationPeoplePreview({people, existingParticipants, canonical, warnings})。canonical.findParticipantIdByNameで現在のroomと照合し、要約・登録済み・読み取り一覧を表示する。roomを書き換えない。

- [ ] 回答表の成功、名前列なし、見出しのみ、URLだけ、重複回答、学年競合、車出し競合をbrowser検証に追加する。既存parserの結果に合わせる。
- [ ] 名前・学年・車出しと登録済み表示を確認一覧に実装する。warningsは閉じていても見える位置に置く。
- [ ] 正規化後人数を要約に使い、回答行数を「登録対象人数」と表示しない。
- [ ] 同じ名前の既存参加者を再登録し、既存学年の更新とメモ・ID・割り当て保持を確認する。driver=trueの効果も画面説明と一致させる。
- [ ] 別ステップへ遷移せず、通常は入力→登録で終了できることを確認する。

## Task 4: エラー、キー操作、Modalレイアウトを仕上げる

**Interfaces:** 欄エラーはmodeに対応するfield、全体コマンドエラーはnotificationをfocus対象とする。成功時のみonNotice＋onClose、未成功時はdraftを保持する。

- [ ] browser検証に空入力のinvalid／focus、解析失敗、コマンド失敗、キャンセル、二重送信防止を追加する。送信中を設ける場合もtextareaの更新で誤登録しない。
- [ ] TextAreaの改行、IME中Enter／Escape、Tab／Shift+Tab、方法選択radioの矢印キー、閉じる後のフォーカス復帰を確認する。
- [ ] 標準footerを維持し、registration-modal内だけで余白と属性行の折り返しを調整する。
- [ ] 50人・長い日本語名、320px／390px／1280px、200%拡大で横はみ出しがなく、本文scrollTopが変わり、ヘッダー・フッターが操作できることを実測する。
- [ ] 意図的な長文で2つ目の縦スクロール領域が生まれないことを確認する。現行全体のModal問題が再現した場合は原因箇所を報告し、無関係な全サイト再設計へ広げない。

## Task 5: 実ブラウザ検証・完了報告

- [ ] 公開manifestを読み取り専用で再取得し、sourceShaを記録する。基準が変わっていれば対応表との相違を確認してから進める。
- [ ] `npm.cmd run build:preview -- --baseline-source-sha <published-sourceSha>`、`npm.cmd run check:preview -- --url <verified-preview-url> --expected-source-sha <published-sourceSha>` を実施。照合失敗時はプレビューの評価を停止し、原因を直す。
- [ ] offlineテスト環境で `npm.cmd run test:browser -- tests/browser/registration.spec.js tests/browser/participants.spec.js tests/browser/allocation.spec.js tests/browser/carbon-remediation.spec.js tests/browser/visual-consistency.spec.js` を実行する。
- [ ] 照合済みpreviewのサンプルroomで、名前追加、任意属性、回答表取込、再登録、キャンセル、再読込をデスクトップと約390pxの実ブラウザで操作する。自動連携の回帰は既存fixtureによる応募者選択・確定テストで確認し、本番回答は変更しない。
- [ ] 操作数を記録する：名前だけは追加→名前入力→登録。属性なしでも強制確認はない。取込は追加→方法選択→貼り付け→登録。明細確認は任意。
- [ ] 見た目、scroll、focus、エラーの関連付け、保存後データを確認し、画面・操作結果・未確認事項を報告する。DOM属性だけでスクリーンリーダー検証済みとしない。

## Task 6: 参加者0人画面から人数精算へ進む

**Files:** `apps/react/src/App.jsx`、`apps/react/src/components/Participants.jsx`、`apps/react/src/components/Settlement.jsx`、`apps/react/tests/browser/registration.spec.js`。

**Interfaces:** Participantsへ `onOpenCountOnlySettlement()` を渡す。Appは精算tabへ切替後、単調増加するrequest idをSettlementへ渡す。Settlementは処理後にrequestを消費したとAppへ通知し、同じrequestではModalを再表示しない。

- [ ] 0人・未連携roomで「参加者がいません」と参加者登録入口、空状態の「人数だけで精算」ボタンがあることをbrowser testに追加する。押すと精算tabと設定dialogが開き、「人数だけで精算」と運転手・同乗者入力が現れることを確認する。開始時にroom.settlementが変化しないこともassertする。
- [ ] 人数精算を設定・既存設定Modalの手順で保存した後、画面と再読込後の精算結果が人数精算を示すことを検証する。
- [ ] フォーム連携済みの未確定roomには空状態CTAを出さず、既存の応募者選択・確定導線を維持するcaseを追加する。
- [ ] Appにrequest idと消費callbackを実装し、タブ切替に伴う再描画でModalを二度開かないことを確認する。
- [ ] CTAはghostの補助操作として空状態の参加者追加案内に配置する。ボタン名は「人数だけで精算」とし、既存追加操作も引き続き利用できる。
- [ ] registration.spec.jsとparticipants.spec.jsの該当caseをoffline browser環境で実行し、Tab／Enterで入口を使えることを確認する。

## 完了条件

- [ ] 7つの名前入力が同時表示されず、選んだ方法だけが登録対象になる。
- [ ] 名前を繰り返し入力せず、学年・車出しを本人に設定できる。
- [ ] 取り込み対象・警告・既存一致・車割への影響が登録前に分かる。
- [ ] 確認ステップを強制せず、キャンセルでroomを変更しない。
- [ ] 既存ID、属性merge、運転手／車割、精算、応募者確定の契約が保たれる。
- [ ] mobile／desktopで本文の縦スクロール、footer、keyboard、エラーfocusが検証済み。
- [ ] 参加者0人のとき、名前登録をせず人数精算の設定へ直接移動できる。

## 本書作成時の確認範囲

RegistrationModal.jsx、Participants.jsx、room-store.js、parser、canonical、関連テスト、Modal実パッケージ、Carbon MCP・公式ガイドを確認した。4194の表示中Modalは旧7欄・旧タイトルをDOMで確認したが、本書作成で画面を更新していない。指紋照合・実機スクロール・読み上げ・新仕様の操作検証は実装後に行う。現在のdirty変更は本書以外に触れていない。
