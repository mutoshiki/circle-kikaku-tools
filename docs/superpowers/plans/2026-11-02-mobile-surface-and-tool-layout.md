# スマホの外側余白・各ツールの配置統一 実装計画

> 実装はユーザーの後続指示で承認済み。後続の「すべて完了させて」により標準リリースも対象。既存worktreeの変更を保護し、対象テストとサイドブラウザで確認する。

**Goal:** スマホでは本文の面を画面幅いっぱいに使い、その内側に読みやすい余白を確保する。応募フォーム、参加者、車割・班割、精算、登山計画書の配置と操作を整える。

**Architecture:** 現行Reactのshellと共通余白変数を再利用し、外側の幅はshell、本文の余白は共通パネル、フォーム内部の配置は組込packageが担当する。参加者の選択操作は既存のchoices・応募者確定処理を再利用し、保存形式や計算を変更しない。

**Tech Stack:** React 19 / @carbon/react 1.115.0 / SCSS / 組込Form Maker 1.0.12 / 組込Mountain Plan 1.0.13 / Playwright。

**Spec:** 本会話の5画面に対するUI調整案、本文が面の境界に接する問題、スマホの外側の黒い余白をなくしPCの中央寄せを保つ方針。前提となる開始画面の実装は `2026-11-02-project-start-and-mobile-usability.md`。

## 1. 調査した現状と保護対象

- Circle作業先: `C:/Users/toshi/.codex/worktrees/project-management-integration/circle-kikaku-tools`、branch `codex/project-start-mobile-usability`。この時点では開始画面改善などが未コミット。今回の計画に含まれない既存の文書・検証ファイルを変更・破棄しない。
- `apps/react/src/App.jsx` の `Grid → Column → .main-content → Tabs` が外側の幅を担当。Columnはlg以上で `span:12, start:3`。
- `apps/react/src/styles.scss` の `.app-tab-panel` はpadding 0。`.initial-empty-state`、精算の車ヘッダー、各メーカー内部が別々に余白を持つ。
- `apps/react/src/styles/_ui-foundations.scss` に既存のpage inset 16px、field gap 16px、group gap 24px、section gap 32pxがある。新しいデザイントークン体系は追加しない。
- Form Makerの編集元は `C:/Users/toshi/.codex/worktrees/inline-form-maker-workspace/packages/form-maker/`。`src/form-maker.scss` のembedded指定、内部Grid、date-gridの余白が対象。
- Mountain Planの組込package編集元は `C:/Users/toshi/.codex/worktrees/mountain-draft-recovery/`。`packages/mountain-plan/src/MountainPlanWorkspace.jsx`、`style.scss` と、そこから利用する `src/App.jsx`・`src/styles.scss` を対象にする。実装時にimport関係とsource/artifact一致を再確認する。通常main checkoutの旧画面を推測で変更しない。
- 参加者のチェックは `Participants.jsx` の「参加者に含める」操作。`choices` に変更を保持し、既存の更新操作で適用する。集金済みチェックとは異なる。
- 精算の `.settlement-car-amount-label` と `.settlement-car-amount-value` は同じcategory内だが、ラベルは左、値は右になっている。車名にはsemiboldのtype styleが当たる。
- 添付画像では保存通知の文字と背景の区別も弱く見える。色の不具合と断定せず、組込版の実DOM・適用トークンを確認する。

## 2. 共通制約

- 初期タブの優先順位・端末内履歴・共有タブ設定・非表示タブからの登録を維持する。
- フォームを使わない参加者登録、人数だけの精算、複数車の同時展開、常時使える「費用を編集」を維持する。
- 支払額・端数処理・集金・車割・班割・応募者確定の意味や保存データは変更しない。worker、Firebase Rules、DB migrationは対象外。
- タブを減らしたり新しいダッシュボードやカード群へ置き換えたりしない。見出し・説明・確認画面を増やして余白を埋めない。
- 「黒い余白をなくす」はスマホの外側gutterを解消する意味。背景色を黒やグレーへ固定せず、light/darkのCarbon layer tokenを使う。
- 組込packageのCSSはembedded rootへ限定する。単独メーカー、印刷/PDF、モーダルportal、公開済みフォームに影響させない。
- native date/timeの表示はブラウザーの言語設定にも依存する。placeholderやCSSだけで日本語形式を強制したと扱わず、見た目のためだけのpickerライブラリを追加しない。
- この計画では「フォームのタイトル」と「企画名」を別データにしない。先の実装の名前共有を継続する。

## 3. 採用する配置・文字のルール

| 項目 | 実装するルール |
|---|---|
| スマホ幅 | 671px以下。本文の背景面とタブをviewportの左右まで広げる。横スクロールで無理に広げず、Grid/Columnの外側gutterをこのshell内だけ調整する。bodyへのoverflow-x:hiddenで不具合を隠さない |
| スマホ本文 | 面の内側に左右16pxを一度だけ付ける。見出し、説明、入力ラベル、一覧の基準位置をそろえる。チェック列・役割・内訳など意味のある字下げは残す |
| PC・タブレット | 672px以上では現行Carbon Gridの中央寄せ・最大幅を維持。PCを全幅へ引き伸ばさない。パネル内の基本insetは16px |
| 本文上端 | タブの下から最初の内容まで24px。登山計画書では最初の内容はステップ表示。その後の見出しまで24px |
| フォーム | ラベル→入力は8pxを目安にCarbon標準構造を使用。通常入力は48pxの操作高さ。項目間24px、異なる節の間32px。入力値はスマホ16px以上 |
| 見出し・操作 | 使える幅では同じ行。足りなければ操作を下へ折り返す。操作名を途中で切らない |
| リスト | 上下padding12pxを基本に、内容で行高を決める。複数行の名前を固定高で切らない。モバイルの行末操作は48pxの操作領域を確保 |
| 文字の強弱 | 既存type scaleを維持。車名だけregularへ変更し、支払額20px/400/28px、1人あたりの集金額20px/600/28pxを維持。全面縮小しない |
| タブ | 自然なラベル幅と横スクロールを維持。選択中の全文を可視範囲へ入れる。非選択の隣接タブが端に少し見える状態は許容。focus枠は残す |

共通パネルを本文余白のownerにする。既存 `.app-tab-panel` を対象にし、内側の `.initial-empty-state` やpackage Gridが同じ16pxを重ねないよう調整する。タブ帯へ本文paddingを適用しない。縁まで伸びる区切り線と本文の字下げは区別する。

## 4. 画面別の到達形

### 応募フォーム

- 他のタブと同じ位置から入力を始める。内部Grid/Columnが追加する横余白をembedded版だけ整理する。
- メール欄の空の入力部分が過大に見えないよう、実際のcontrol高さと項目間の余白を分離する。
- 実施日と応募締切日はスマホで縦並び、広い幅では現行の2列を維持する。各列に同じlabel/control/gapを適用する。
- 企画名などの必須入力、名前共有、作成jobの復元は維持。
- ローカル専用sessionの `prepare()` に `previewOnly: true` を付け、packageはその明示値がある場合だけ短い案内「このプレビューではフォームを作成できません。」を表示する。待てば復旧する文言は出さない。sampleModeでは既存のローカル入力保存を使う。本番のpaused/通信エラーをpreviewと同一視しない。
- 通知と最初の入力の間に16pxを確保。警告を小さくするために文字サイズや閉じるボタンの操作領域を縮めない。

### 参加者・車割・班割

- 参加者数と追加操作、車/班の概要とランダム操作を共通の本文位置へそろえる。
- 車割・班割は概要→操作16px、操作→最初の車/班24pxを基本とする。実行回数は補足の文字役割に統一。
- 671px以下の人物行は「名前＋役割Tag」「学年などの補足」の2段を基本にする。役割は長い名前なら折り返す。PCは既存の学年列を維持する。
- 通常閲覧と参加者の選択状態を区別する。初回の応募者選択・選び直し中はチェックを表示し、確定後の通常一覧は隠す。手入力の参加者一覧には同じ「参加者を選び直す」を設ける。
- 既存 `editingSelection` と手入力用のローカルUI stateから `selectionEditing` を導出する。追加のDBフラグを設けない。既存 `choices`・`checked(row)`・`requestApply`・`apply` と除外確認を再利用する。
- 選択モードで「参加者を更新」「キャンセル」を使えるようにし、未適用の変更がある間だけ操作を下部のsticky領域へ表示する。キャンセルはUI draftだけ破棄する。キーボード、下書き通知、ブラウザー下部UIを覆わないよう確認する。
- 初回の「参加者を確定」は既存どおり、まだchoicesを変更していなくても操作可能にする。タブ移動自体を保存・確定の契機にしない。
- 選択状態に関する絞り込みは選択モードで扱い、通常一覧へ戻ったときに隠れた選択フィルターで人が消えないようにする。検索・学年など他の条件は勝手に破棄しない。

### 精算

- 各支払区分のラベルを金額の直上、同じ右寄せのまとまりへ配置する。ラベルと金額の間は4px、区分間は24px。
- 部費0円なら単一区分の「割勘から」と金額を表示する。部費ありでは2区分を保つ。長い金額は既存の縦積みfallbackを使い、小さく縮めない。
- 車名は16px/400/22pxを基本とする。レンタカーなどの補足は小さく表示し、車名と編集操作が衝突しないよう折り返す。
- 「費用を編集」は車名の行、内訳toggleは金額の下という既存配置を維持する。開閉・編集・読み上げの関連付けを変更しない。

### 登山計画書

- embedded版でステップ表示、見出し、説明、入力ラベルの基準左端をそろえる。section-gridの外側とColumn内側の余白を両方足さない。
- 「入力内容はPDFに記載されます」はフォーム開始時の説明から削除する。両フォームとも必須欄は「項目名（必須）」、任意欄は「項目名（任意）」に統一し、「任意と書いていない項目は必須」という総論を削除する。native required・aria-required・エラー関連付けを維持する。
- 同期する実施日や自動保存に新しい反映ボタン・保存メニューを追加しない。
- 保存通知は既存のhost `onNotice` 接続と独自toastの関係を調べ、一度の通知にする。実DOMで文字色・背景色・重なりを確認し、Carbonのsemantic tokenか既存host通知へそろえる。毎入力の通知を増やさない。
- `YAMAP` のステップ名変更は今回採用しない。アップロード対象など実際の内容を変えず、位置・間隔・ラベル表記に絞る。

## 5. 実装順序

### Task 1: 外側と内側の余白を共通化

**Files:** `apps/react/src/App.jsx`、`src/styles.scss`、`src/styles/_ui-foundations.scss`、`src/components/InitialEmptyState.jsx`、必要時のみ `src/components/ProjectToolsWorkspace.jsx`。既存 `tests/browser/visual-consistency.spec.js` と `project-workspace.spec.js` を利用。

- [x] 各画面のroot、Grid/Column、paddingのownerを実DOMで記録。Carbon MCP code_searchでinstalled版のGrid/TabList構造を照合する。
- [x] 671px以下の外側gutterをshellの範囲で解消し、本文の左右16px・上24pxを共通パネルから適用する。
- [x] 初期空状態、参加者、車割、班割、精算、学務書類、タブ編集の二重insetを解消する。
- [x] タブのスクロールcontainerを実DOMで特定し、外側と内側の二重スクロールがあれば一つへ整理。選択タブを同じcontainer内で表示する。

**完了条件:** スマホの背景面は全幅、本文は16px内側。全タブの見出し・説明が面に接しない。PCの中央寄せと最大幅が保たれる。

### Task 2: 組込フォームと登山計画書へ共通配置を適用

**Files (Form Maker):** `packages/form-maker/src/FormMakerWorkspace.jsx`、`src/form-maker.scss`、必要時 `src/index.d.ts`。

**Files (Mountain Plan):** `packages/mountain-plan/src/style.scss`、`MountainPlanWorkspace.jsx`、import関係に応じて `src/App.jsx`・`src/styles.scss`。

**Files (Circle):** `apps/react/src/services/form-maker-workspace.js`、`src/services/mountain-plan-workspace.js`、`package.json`・`package-lock.json`、`vendor/`。

- [x] embedded rootに限定してGrid余白、label/control、日付・時刻、節間隔を整理し、単独版とのCSS境界を確認する。
- [x] previewOnlyのsession結果と短い案内を接続。本番受付停止/接続失敗の表示を維持する。
- [x] 登山計画書の説明・必須表記と保存通知を調整。PDF/print用CSSへ余白変更が漏れないようにする。
- [x] 両packageを正規build/packで更新し、hostの依存とvendorを更新する。dist/node_modules/tgzを直接編集しない。

**完了条件:** 両フォームの本文位置と入力間隔がそろい、名前共有・日付・下書き復元・単独版・PDFの機能を保つ。

### Task 3: 精算と人物行の整列・強弱を調整

**Files:** `apps/react/src/styles.scss`、必要時 `src/components/Settlement.jsx`・`Allocation.jsx`・`Participants.jsx`。既存 `tests/browser/visual-consistency.spec.js`、`settlement.spec.js`、`allocation.spec.js` を利用。

- [x] 精算のラベルと金額を同じ右端にそろえ、車名をregularにする。金額計算・既存の大型金額fallbackを維持する。
- [x] モバイルの人物行で学年・役割の配置をそろえ、長い名前と複数Tagで折り返しを確認する。
- [x] 車割/班割の概要、実行回数、操作、最初のグループの間隔を整理する。

**完了条件:** 支払区分が追いやすく、人物情報や行末操作が衝突しない。編集と内訳開閉を常に操作できる。

### Task 4: 参加者チェックを選択モードに限定

**Files:** `apps/react/src/components/Participants.jsx`、必要時 `src/styles.scss`。既存 `tests/browser/participants.spec.js`、`participants-accessibility.spec.js`、`initial-empty-state.spec.js` の意味のある操作ケースを更新する。

- [x] 応募回答あり/なしの両方で通常閲覧と選択モードを接続する。初回の応募者選択を余計な開始クリックで阻害しない。
- [x] 表示条件・pending choices・更新/キャンセル・除外確認を既存処理へ接続し、新しい保存経路を作らない。
- [x] チェック非表示でも名前の位置が不自然に空かないようにし、選び直しの開始/終了とfocus復帰を確認する。

**完了条件:** 通常一覧でチェックの意味に迷わず、選び直し時の結果は従来どおり。キャンセルやタブ移動で意図しない除外が保存されない。

### Task 5: 必要な検証・サイドブラウザ確認・公開準備

**Files:** 上記の既存テスト、`docs/design/react-typography-spacing.md`、`ui-screen-matrix.md`、`docs/development/current-workspace.md`。公開時は既存workflowを利用。

- [x] 下記の対象境界だけを検証し、成功した集合を理由なく再実行しない。CSSの値そのものを写すだけのunit testを増やさない。
- [x] 現在の公開manifestを取得し、`build:preview` と `check:preview` を通したローカル専用originをサイドブラウザで開く。十分なデータ入りの全ツールサンプルと空企画を使う。
- [x] light/darkで実際のcomputed typography、inset、各ツールの空/入力済み/errorを確認し、相違と未確認事項を記録する。
- [x] 見た目の契約、画面一覧、今回の計画を更新。無関係な未コミット変更を含めず、source/package/hostの変更をレビュー可能なcommitへ整理する。
- [ ] PR CI→merge→main対象SHAのRelease / Readiness→既存React Production Release→両ブラウザroot smoke→P9A93LMQ cleanupの標準経路を使う。手動の本番フォーム作成や別の公開経路を追加しない。

**完了条件:** ソースと一致するサイドブラウザで確認し、検証範囲と未確認事項が明確。本番反映する段階ではworkflowのsmoke/cleanup/必要時rollbackまで確認する。

## 6. 検証を絞るための対応表

| 変更の境界 | 確認するもの | 実行範囲 |
|---|---|---|
| 共通余白 | 面の左右端、本文16px、上端24px、page横はみ出し、最初/中央/最後の選択タブ | 390pxと1280px、light/dark、Chromium/WebKit。320pxと671/672pxはChromiumのgeometry境界だけ追加 |
| 組込メーカー | 空/入力済みの日付、長い企画名、メールエラー、次へ・戻る・名前共有、保存復元、standalone/printへの漏れ | 変更に関連する既存package/hostのケースを一度。見た目目的で実workerへ送信しない |
| 精算 | 部費0/あり、負数・大きい金額、長い車名、常時編集、展開/閉じる、読み上げの区分 | 既存の対象テスト名を絞る。計算コード未変更なら計算全件をローカルで反復しない |
| 参加者モード | 応募回答あり/なし、初回/確定後、選び直し、キャンセル、除外確認、focus、非表示タブからの操作 | 既存ケースを新UIに合わせる。結果の保存とキャンセルの違いを確認 |
| モーダル隣接 | 参加者登録、精算設定、費用編集がshellのpadding変更で狭まらない | 代表モーダルをmobile/desktopで一巡。全モーダルの手動再監査は追加しない |
| 公開 | package変更・前回の開始ロジック変更を含めて実際の分類器に従う | 軽微UI経路になると決めつけずrequired CIを一度。合格済みSHAの再実行をしない |

iOS実機の日付picker・横スワイプ・実IME、画面読み上げ、200%ズームは、実施できた範囲だけ報告する。WebKitをiPhone実機確認と呼ばない。ブラウザー接続に失敗した場合は利用可能なブラウザーsurfaceを一度再取得し、同じ探索を反復せず未確認範囲を明記する。

## 7. 実装前に固定する判断と注意点

- スマホでは外側余白0px＋本文内側16px。黒い余白を消す代わりに文章まで画面端へ寄せない。
- Gridのmargin、Columnのgutter、packageのpaddingのうち、どのownerを変えるかは実DOMで決める。全体への負marginやoverflow隠しで合わせない。
- 新しいモーダルやデータモデルは不要。参加者モードはUI状態、previewOnlyはローカルsessionの表示情報として扱う。
- 前回実装のForm Maker 1.0.11 sourceが未コミットのため、その変更を保護した上で次版を作る。Mountain Planもsourceの状態を確認してからpackする。
- `apps/react/integrated-tools.lock.json` は現行package.jsonと版が一致していない既存状態がある。配布packageはpackage-lock/vendorのハッシュで検証し、provenanceを更新する場合は実際のsource commitとartifact hashを記録する。dirty sourceをcleanなcommit由来と偽って記録しない。
- 元の計画作成時は実装しない指定だったが、後続指示「この計画を実装」で実装が承認された。作業記録は以下の実装台帳を参照。

## 8. Carbonの指針と本サイトの判断

- Carbon公式: Gridは整列のための仕組み、spacingはスケールで関係と階層を作る。スクロール可能なTabsのラベルは自然な幅で扱う。
  - https://carbondesignsystem.com/building-blocks/foundations/2x-grid/code/
  - https://carbondesignsystem.com/building-blocks/foundations/spacing/overview/#stacking
  - https://carbondesignsystem.com/building-blocks/core/components/tabs/guidelines/#overflow-content
- 本サイトの判断: mobileの外側0/内側16px、本文上端24px、支払ラベルの右寄せ、車名regular、参加者チェックの選択モード化。Carbonの必須仕様と混同しない。
- 実装時はCarbon BuilderとMCPで変更するcomponentの現行props/DOM/型を確認する。既存のproduction UIを基準に調整し、過去の中止されたCarbon redesignを再開しない。

## 実装結果（2026-11-02）

- Task 1: モバイル本文面を全幅にし、タブパネルの本文insetを共通化。対象幅のgeometry回帰はChromium mobileで合格。
- Task 2: 組込Form Maker 1.0.12、Mountain Plan 1.0.13をsourceからbuild/packし、hostの依存・lockfile・vendorを更新。ローカルpreview専用状態を明示し、Mountain Planの必須/任意表記・余白・自動保存通知を整えた。
- Task 3: 精算の車名をregularへ変更し、割勘/部費金額のラベル・値の右端と間隔を統一。人物行と割当ツールバーのモバイル間隔を整理。
- Task 4: 通常閲覧では参加者チェックを隠し、選択中だけ表示。手入力参加者にも選び直しを用意し、キャンセルがdraftのみを破棄することを確認。
- Task 5: Chromium mobileの対象browser cases、組込package tests/buildを実行。Form Maker preview role assertion、Mountain Plan inset geometry、settlement typography/spacing、participant cancel/no-writeは合格。サイドブラウザーでは全ツールの架空データを用い、Form Maker、参加者、Mountain Planを確認。公開source SHAを祖先に持つローカル専用buildとして`check:preview`を実施。
- 実画面確認で見つかったMountain PlanのCarbon narrow Grid負マージンが共通insetを相殺する不具合を、embedded package限定のmargin resetで修正。見出し・必須ラベル・日付入力の境界を390pxの自動テストで固定。
- Firebase、認証、worker、DB、計算、実フォーム作成、応募回答送信、PDF出力は変更・実行していない。本番公開・commit・pushも行っていない。
- 未確認: iOS実機のdate/time pickerとIME、スクリーンリーダー、ズーム、全ダイアログの手動操作。サイドブラウザーは1280×720のダーク表示で、モバイル幅はChromium mobile自動検証を使用。
