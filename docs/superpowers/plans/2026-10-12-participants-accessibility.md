# 参加者画面のアクセシビリティ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 同一エージェントで順に進める。

**Goal:** 参加者に含める操作、絞り込み条件、操作結果、モーダル終了後の行き先を明確にし、キーボードと読み上げでも迷わず操作できるようにする。

**Architecture:** Participantsの既存選択・絞り込み状態とstoreコマンドを維持し、表示とアクセシブル名を整える。フィルターの結果通知は画面内のstatus、保存・削除の通知は既存Carbon通知を使い、同じ結果を二重に読み上げない。Modalの標準フォーカス管理を利用し、起動元が消える場合だけ戻り先を補う。

**Tech Stack:** React 19.2.8、@carbon/react 1.115.0、Sass、既存Playwright環境。

**Spec:** 本書「採用する設計」。直前の提案にある選択ラベル、適用中フィルターと解除、結果通知、閉じるラベル、フォーカス復帰、見出し階層を対象にする。

## Global Constraints

- 作業元: `C:\Users\toshi\.codex\worktrees\production-baseline\circle-kikaku-tools`、branch: `codex/production-baseline-workspace`。Documents配下の旧checkoutを編集しない。
- 計画作成時HEAD: `a8531f1be1353a156be4d2ed1c71f80af9c3ff6b`。既存の未コミット変更を保全する。
- 本計画の実装はユーザーの2026-10-12の依頼で許可済み。ローカル検証まで行い、commit、push、公開はしない。以前の公開中止は継続する。
- 実装時も今回の完了範囲はローカル検証。公開再開は別の明示依頼で扱い、再開時は4194に対応する蓄積変更全体を公開対象として確認する。
- 登録機能、人数だけで精算への入口、応募者確定後の導線、既存のapplySelection/deleteParticipant/commitEdit、schema・同期・精算計算を維持する。
- 共通ヘッダー・企画名の既存改善を維持する。閲覧／選択モードの再設計、編集ボタンの追加、一覧全面改装は本書に含めない。
- Carbon MCPとインストール済みパッケージでprops・DOMを照合する。MCP監査の指摘はコードと照合し、誤検出を自動適用しない。
- CheckboxのTab/Space、ModalのフォーカストラップはCarbon標準を使う。独自onKeyDownを重ねない。
- 4194をブラウザで開く前は `docs/development/current-workspace.md` に従い、公開manifestを再取得してbuild/checkを行う。サンプルはlocal-onlyの検証roomで操作する。

## 現行コードで確認した点

- `Participants.jsx`: CheckboxのlabelTextとaria-labelは人名のみ。見出しはp/strong。filter-panelを閉じても条件は適用されるが、条件要約と解除操作がない。
- フィルターのdriverは、応募者では車出し可能、手入力参加者では現在の運転手割り当てを表す。同じ「車出し可」という表現では意味が一致しない。
- 選択解除・削除の確認ModalとParticipantEditorはcloseButtonLabel未指定。インストール済みModalの既定値は英語の「Close」。
- 成功通知はAppのToastNotificationが担当。新しいlive regionを追加する前に、既存通知のrole・読み上げを確認する必要がある。
- 参加者を削除すると元の行が消える。応募者の確定後には選択操作の起動元自体が消える場合がある。

## 公式指針と製品での判断

| 対象 | Carbon公式の指針 | 本書で採用する判断 |
|---|---|---|
| Checkbox | Tabで各Checkboxへ移動し、Spaceで個別に選択する | 読み上げ名を「岩城 清次を参加者に含める」の形式にする。操作を即時保存と誤解させない補助説明を選択領域に置く |
| Modal | フォーカスはダイアログ内で循環。Escで閉じ、破壊的操作の初期フォーカスはキャンセル | 閉じる名は「閉じる」。キャンセル後は起動元、起動元消失後は一覧見出しに戻す |
| Notification | 結果を伝える通知にtoast/inlineなどの種類がある | 保存・削除は既存通知、検索・絞り込み結果は控えめな画面内statusに分ける |
| 見出し・操作名 | 意味のあるラベルと論理的な構造を使う | 企画名h1の下に参加者h2。条件と解除を常時確認できる表示にする |

「人名＋操作」の日本語、条件要約の位置、通知タイミング、消失時の戻り先は製品での判断であり、Carbon指定の固定文言やレイアウトではない。

**参照（Carbon MCPで確認）:**

- [Checkbox: Keyboard interactions](https://carbondesignsystem.com/building-blocks/core/components/checkbox/accessibility/#keyboard-interactions)
- [Checkbox: Anatomy](https://carbondesignsystem.com/building-blocks/core/components/checkbox/guidelines/#anatomy)
- [Modal: Keyboard interactions](https://carbondesignsystem.com/building-blocks/core/components/modal/accessibility/#keyboard-interactions)
- [Modal: Focus handling](https://carbondesignsystem.com/building-blocks/core/components/modal/accessibility/#focus-handling)
- [Notification](https://carbondesignsystem.com/building-blocks/core/components/notification/guidelines/#notification)

## Review Focus

1. 絞り込みで選択した行が非表示になっても、未確定選択は保持されること（Task 2）。
2. 車出し可能と実際の運転手を同義にしないこと（Task 2）。
3. モーダル起動元が消えてもフォーカスがbodyへ落ちないこと（Task 4）。
4. 日本語変換中と連続入力で結果通知が読み上げを妨げないこと（Task 3）。
5. コマンド失敗時に成功通知や画面終了が発生せず、現在の選択・入力が残ること（Task 3/4）。

## Task 1: 選択の意味と見出しを整える

**Files:** `apps/react/src/components/Participants.jsx`、`apps/react/src/styles.scss`、`apps/react/tests/browser/participants.spec.js`。

**Interfaces:** Participantsのprops、checked(row)、choices、requestApplyを維持。操作名の変更に合わせ、既存テストのCheckbox locatorを更新する。

- [x] 人名だけの旧accessible nameを検出する回帰テストを追加し、「仮参加者Gを参加者に含める」で取得できることを期待する。
- [x] labelTextを「`${row.person.name}を参加者に含める`」に統一し、重複するaria-labelの必要性を実DOMで確認する。Checkboxのidと行キーを維持する。
- [x] 選択領域に「参加者に含める人を選んでください。」を一度表示する。選択数は「選択中：N人」、通常の反映操作は「参加者を更新」とし、応募者の初回確定は既存どおり「参加者を確定」とする。各行に同じ説明を繰り返さない。
- [x] 人数見出しをh2に変更。応募者がある場合は「応募者 N人・参加者 M人」、通常は「参加者 N人」。表示サイズはCarbonトークンで既存の階層に合わせる。
- [x] Tab/Spaceを実際に押し、選択状態だけが変わり、確定前の保存データは不変であることを確認する。検索・フィルター・メニューの順序とフォーカス枠も確認する。

## Task 2: 適用中の条件と解除を見せる

**Files:** `apps/react/src/components/Participants.jsx`、`apps/react/src/styles.scss`、`apps/react/tests/browser/participants-accessibility.spec.js`（新規）。

**Interfaces:** search/filter/visibleは既存状態を利用。解除操作はsearchとfilterだけを初期値へ戻し、choicesと保存データは変えない。

- [x] 検索＋学年＋選択状態の複合条件を設定し、パネルを閉じても条件要約と「条件をクリア」が残るテストを追加する。
- [x] ツールバー直下に適用中の条件を短いテキストで表示。「検索: 岩城」「学年: 4年」「選択状態: 未選択」の形式。条件がない時は要約と解除ボタンを出さない。
- [x] Ghost「条件をクリア」を設ける。検索のみのクリアには既存Searchの「検索をクリア」を使い、その操作で他の条件を消さない。
- [x] フィルターボタンにaria-controlsを追加し、パネルのidと接続。aria-expandedを維持し、パネル開閉で条件をリセットしない。
- [x] 車出しフィルターは判定ロジックを変えず、通常一覧ではラベル「運転手」、選択肢「運転手／運転手以外」。応募者を含む一覧ではラベル「車出し」、選択肢「あり／なし」とし、補助説明「応募者は車出しの回答、手入力の参加者は運転手設定で絞り込みます。」を表示する。可能・割り当ての統一は別のデータ設計として扱う。車出し可能でも未割り当ての応募者を使って確認する。
- [x] 条件解除で全行が戻り、未確定選択が残ること、0件状態でも解除できることを確認する。

## Task 3: 結果通知を整理する

**Files:** `apps/react/src/components/Participants.jsx`、`apps/react/tests/browser/participants-accessibility.spec.js`。`apps/react/src/App.jsx`は既存通知の検証対象とし、修正が必要な場合だけ変更する。

**Interfaces:** onNotice(message)は既存契約を維持。検索結果用statusは保存・削除通知を複製しない。

- [x] 既存ToastNotificationのroleと読み上げを確認する。既に通知される成功・失敗は、新規live regionに追加しない。
- [x] 検索・絞り込みの結果件数を「表示 N人／全 M人」で表示。画面内に一つのrole=status、aria-live=polite、aria-atomic=trueを設ける。
- [x] 検索結果の通知は入力停止から350ms後。IME変換中は通知を保留し、compositionend後に最終条件の件数を通知する。初期表示とチェック操作ごとの読み上げは行わない。
- [x] 同じ条件と件数が連続する場合の通知を抑える。条件が違えば人数が同じでも更新として扱い、条件要約と件数が分かる通知にする。
- [ ] applySelection/deleteParticipant失敗をテストで再現し、成功通知が出ず、未確定選択または確認画面が残ることを確認する。失敗をロールバック済みと表示しない。
- [ ] 連続入力・0件・同じ人数の別条件・条件解除について最終状態と件数が一致するテストを追加する。

## Task 4: 閉じるラベルとフォーカス復帰を整える

**Files:** `apps/react/src/components/Participants.jsx`、`apps/react/src/components/ParticipantEditor.jsx`、`apps/react/tests/browser/participants-accessibility.spec.js`。RegistrationModalは既存日本語ラベルと復帰動作を検証する。

**Interfaces:** onRequestClose/onRequestSubmitを維持。Carbon ModalのlauncherButtonRefと実装を確認し、必要な起動元refを渡す。見出しのidは `participants-heading`、プログラム的な復帰用にtabIndex=-1を付ける。

- [x] 選択解除確認、参加者削除確認、参加者編集のcloseButtonLabelを「閉じる」に統一する。
- [x] 削除確認を開いた時はキャンセルが初期フォーカス。Tab/Shift+TabがModal外へ出ず、Escと閉じるがキャンセルとして動作することをテストする。
- [x] 編集・削除確認のキャンセル後は、その人のOverflowMenu起動ボタンへ戻す。削除確定後に起動元行が消えた場合はparticipants-headingへ戻す。
- [x] フィルター解除で解除ボタンが消える場合も行き先を確保する。検索を含んでいた場合はSearch、それ以外はフィルターボタンへ戻す。
- [x] Carbon標準で復帰するケースに独自focus呼び出しを重ねない。非表示・切断済み要素へのfocusや遅延復帰による別操作のフォーカス奪取を防ぐ。
- [ ] 保存失敗時はモーダル内に留まり、エラーと入力が確認できることを検証する。保存・削除・キャンセルの既存データ結果を合わせて検証する。

## Task 5: 実ブラウザとプレビューを確認する

**Files:** `apps/react/tests/browser/participants-accessibility.spec.js`、必要な既存locatorを使う `participants.spec.js`。証跡は既存artifact運用に従い、公開資産に含めない。

- [x] 対象テストをChromium mobile/desktopで先に実行し、次にWebKit mobile/desktopを実行する。既存participants/registration/shellの変更に関係するケースも確認する。
- [ ] 375px・390px・1280px、長い日本語名、200%拡大、light/darkで条件要約・操作・sticky確定ボタンが読め、横スクロールや重なりがないことを確認する。Playwrightの既定390pxと1280px、長い企画名・テーマ切替の共通シェル回帰は確認済み。375px・200%実拡大と参加者画面固有の長名折り返しは未確認。
- [x] Chromium/WebKitのブラウザキーボード操作でSpace選択、条件解除、確認キャンセル、削除確定を通す。forceクリックやDOM clickを操作性の証拠にしない。
- [x] Chromeのアクセシビリティツリーで選択名・チェック状態・条件パネルの表示を確認。実スクリーンリーダー環境がないため読み上げ音声、エラー音声は未検証としてDOM/キーボード検証と区別して報告する。
- [x] 4194の配信元をbuild/checkで照合後、検証roomでサイドブラウザ表示を確認。計画書追加後もsource fingerprintが変わるため、古いcheck成功を流用しない。
- [x] 変更内容、操作結果、テスト結果、実読み上げの確認範囲を簡潔に報告する。未依頼のpush・公開へ進まない。

### 検証コマンド（実装時に実行）

作業ディレクトリは本worktreeの `apps/react`。テストtarget guardを維持する。

```powershell
$env:SANPO_TEST_FIREBASE_TARGET='offline'
$env:SANPO_TEST_FIREBASE_PROJECT_ID='demo-circle-react'
$env:SANPO_TEST_FIREBASE_DATABASE_URL='http://127.0.0.1:9000/'
npm.cmd run test:browser -- tests/browser/participants-accessibility.spec.js tests/browser/participants.spec.js --project=chromium-mobile --project=chromium-desktop
npm.cmd run test:browser -- tests/browser/participants-accessibility.spec.js --project=webkit-mobile --project=webkit-desktop
```

プレビューは取得した公開manifestのsourceShaを指定する。

```powershell
npm.cmd run build:preview -- --baseline-source-sha <published-sourceSha>
npm.cmd run check:preview -- --url http://127.0.0.1:4194/ --expected-source-sha <published-sourceSha>
```

**完了条件:** 選択の意味・適用中条件・解除・結果が確認できる。Tab/Spaceとモーダルの初期／終了フォーカスが適切。確定前の選択と失敗時の入力が保持され、既存保存・削除結果が変わらない。モバイル／デスクトップ検証済みで、読み上げ検証の実施範囲が明記されている。
