# 文字・余白改善後のモーダル修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. 既存worktree内で順に実装し、サブエージェントへの分担を前提としない。

**Goal:** 文字・余白改善後の評価で見つかった6項目を直し、モーダルを含む確認結果を次の実装でも追跡できるようにする。

**Architecture:** 既存のReact表示ownerとSCSSを変更する。ヘッダー／本文／フッターの責務を維持し、独自フッターが必要な精算設定と、名前付けを明示する車両費用画面ではCarbonのComposedModalを使う。計算・保存・同期の既存ハンドラーはそのまま接続し、全モーダルを包む新しい共通コンポーネントは作らない。

**Tech Stack:** React 19.2.8、@carbon/react 1.115.0、@carbon/icons-react 11.87.0、SCSS、Playwright 1.61.0。

**Spec:** 2026-10-17の実表示・DOM/CSS評価。本書の「確定仕様」が実装仕様。[共通文字・余白ルール](../../design/react-typography-spacing.md)も参照する。

## 作業場所・公開境界

- worktree: `C:/Users/toshi/.codex/worktrees/site-type-spacing/circle-kikaku-tools`
- branch: `codex/site-typography-spacing`
- 開始HEAD: `6b24c165445f0131c526c4f2af26efe15efb675f`
- PR: <https://github.com/mutoshiki/circle-kikaku-tools/pull/110>。未マージ・自動マージ無効。
- preview: <http://127.0.0.1:4280/?room=TYPE-SPACING-20261017&view=seisan>。local-only、合成データ。
- 評価時の公開baseline: `851cb1a4c90fde012ad84eee47a3403689dac9ef`。実装時は公開manifestを再取得し、previewのbuild/checkをやり直す。
- 現在は計画のみ。実装依頼後もローカル実装・確認までとし、push・PR更新・merge・本番公開は再指示があるまで保留する。
- 元のdirtyなチェックアウトや他worktreeの変更を移動・破棄しない。

## 公式指針と採用判断

| 公式資料・指針 | このサイトでの採用判断 |
| --- | --- |
| [Typography](https://www.carbondesignsystem.com/building-blocks/foundations/typography/style-strategies): タスクや領域の中で文字階層を一貫させる | 基本の20/16/14/12pxの役割を維持。説明見出しを縮めて収めない |
| [Modal](https://www.carbondesignsystem.com/building-blocks/core/components/modal/guidelines): 内容量に適したサイズ、本文スクロール、固定ヘッダー／フッター | 移動料金の544px固定を外す。精算設定は中サイズにする |
| 同資料のProgress modal: 左にghostのキャンセル、右に戻る／次へ | 精算設定に採用。第1ステップの戻るは無効化して位置を保つ |
| [Modal accessibility](https://www.carbondesignsystem.com/building-blocks/core/components/modal/accessibility): 操作内容に対応する名前、フォーカス管理 | 車名と現在のタスク名をダイアログ名に含め、終了後は起動元へ戻す |
| [Color](https://www.carbondesignsystem.com/building-blocks/foundations/color/guidelines): 色の階層差に意味を持たせる | 移動料金の本文全体を別レイヤー色で塗る指定を解消。入力欄・要約の階層は維持 |
| [Checkbox accessibility](https://www.carbondesignsystem.com/building-blocks/core/components/checkbox/accessibility): Tabで移動、Spaceで選択 | 集金の1人につきフォーカス対象を1個にし、行全体のタップを維持 |

## 確定仕様

1. 「使い方」は見出しと説明を項目ごとに縦配置する。見出しの途中折り返しを防ぐために本文を小さくしない。手順の順番ではないため、番号を前提としない意味のあるリストを使う。
2. 車両費用ダイアログ名は `藤原 拓海車：費用を編集` のように対象と現在のタスクを含める。費用追加／編集、移動料金、距離計算への遷移時も名前を更新する。車名だけをダイアログ名にしない。
3. 車両費用をEsc、×、キャンセル、保存のどの経路で閉じても、起動した車の費用ボタンへフォーカスを戻す。編集途中の画面内の「戻る」は既存の内部起動元へ戻す。
4. アプリ内のモーダルの閉じるボタンは「閉じる」、NumberInputは「人数を増やす／人数を減らす」または「定員を増やす／定員を減らす」とする。入力ラベル自体も維持する。
5. 移動料金のモバイル表示は内容に応じた高さ、上限100dvhとする。短い内容は下寄せのまま、収まる内容に不要な本文スクロールを作らない。長い内容では本文だけがスクロールする。
6. 移動料金の本文全体への背景色上書きを外し、ヘッダーと本文の土台を揃える。入力欄と金額要約のCarbonレイヤーは残す。
7. 精算設定は全ステップで中サイズを維持。キャンセルは左ghost、戻る／次へ・保存は右。第1ステップの戻るはdisabled。最終ステップは「保存」。既存の3ステップ、入力保持、検証、保存通知は維持する。
8. 短いタイトルのヘッダーには独立したスクロールバーを出さない。長い日本語タイトルは自然に折り返し、×と重ならない。overflowを一律hiddenにして文字を切る修正は採用しない。
9. 集金行は1個のネイティブcheckboxを操作の本体とし、名前・状態・金額を含む行全体を関連labelのタップ領域にする。同じ操作をする別のbuttonを併設しない。
10. 今後の完了報告では、画面／モーダル／状態／幅／テーマ／結果／証跡／未確認理由を記録する。未確認を合格と扱わない。

## Global Constraints

- 公開保留を優先する。今回の計画・後続の実装依頼だけでは公開を再開しない。
- 計算式、丸め、割勘と部費の別表示、費用の未入力0円扱い、集金差し引き、定員の定義、保存形式、同期、Firebase、schemaは変更しない。
- 人数だけの精算の運転手名編集、車出し以外の集金担当者名入力、担当者名の保存と再表示を維持する。
- 入力方法の分離、入力途中の保持、エラーの該当欄表示、スマホの入力値16px、固定フッターを維持する。
- 新規依存追加・Carbon更新・全体リデザインを行わない。必要なCarbonのimports/propsはMCPとインストール済み1.115.0の実装で再確認する。
- 合成データとoffline/local-only環境を使う。通常の本番ルームへ書き込まない。
- 同じ問題で20分以上、原因の絞り込みも修正も進まない場合に停止し、証拠と次の選択肢を報告する。単発の失敗だけで停止しない。

## Review Focus

| 見落としやすい条件 | 担当タスク・確認 |
| --- | --- |
| 393pxの説明見出し、長い車名／費用名 | Task 1/2/5: 折り返しと重なり、完全な読み上げ名 |
| 393pxから400pxへ進捗表示が変わる境界 | Task 4: 両幅で全操作が見え、内容を保持する |
| 移動料金→距離計算からEscで終了、起動元が再描画された場合 | Task 2: 起動した車へ復帰。削除済みなら支払い見出しへ復帰 |
| 667px高・文字拡大／ズーム・日本語フォント読込後 | Task 3/5: 本文だけスクロールし、タイトルとフッターを切らない |
| 人数だけ精算の集金名入力と「未回収」フィルター | Task 6: 一度だけ更新、担当者入力、閉じる／再表示後のフォーカス |

## Files

| 対象 | 責務 |
| --- | --- |
| `apps/react/src/App.jsx` | 使い方の意味構造と表示 |
| `apps/react/src/components/Settlement.jsx` | CarEditorの名前・起動元管理、集金行、CollectionPrompt |
| `apps/react/src/components/SettlementSettingsModal.jsx` | 進捗モーダルの構成と操作、日本語の人数増減ラベル |
| `apps/react/src/components/Allocation.jsx` | 定員変更・追加・移動・確認の日本語閉じるラベル |
| `apps/react/src/components/Participants.jsx` | 確認モーダルの共通クラス整合が必要な場合のみ |
| `apps/react/src/components/ProjectTools.jsx` | 既存モーダルの日本語閉じるラベル |
| `apps/react/src/styles.scss` | 使い方、移動料金、設定フッター、ヘッダーの限定的調整 |
| `apps/react/tests/browser/modal-accessibility.spec.js`（新規） | タスク名、復帰、Tab順、英語ラベル残存の回帰確認 |
| `apps/react/tests/browser/modal-layout.spec.js` / `modal-scroll.spec.js` | 既存の枠・スクロール検証の更新と追加 |
| `apps/react/tests/browser/visual-consistency.spec.js` / `settlement.spec.js` / `settlement-entry-mode.spec.js` | 変更したrole/name/操作に対する既存シナリオの追随 |
| `docs/design/react-typography-spacing.md` / `apps/react/AGENTS.md` | 状態別確認と記録要件 |
| `docs/design/reviews/2026-10-17-modal-usability.md`（新規） | 実装後の確認結果と未確認範囲 |

### Task 1: 使い方の折り返しを修正

- [x] `App.jsx`のリストを番号に依存しない構造へ揃え、`styles.scss`の`.user-guide li`を見出し→説明の縦配置にする。現在の横flexによる見出しの縮小を外す。
- [x] `modal-layout.spec.js`に、393pxで「参加者」「共有」「精算」の各見出しが1行に収まり、説明と重ならず、ページ／本文の横はみ出しがない確認を追加する。
- [x] 1280pxでも文章の順番と見出しの意味が保たれることを実表示で確認する。

### Task 2: 車両費用の名前とフォーカス、共通ラベルを修正

**Interfaces:** `openCar(car, launcherElement)`が起動ボタンを保持し、`CarEditor`へ安定した`launcherButtonRef`を渡す。内部viewと保存セッションの形式は変えない。

- [x] `openCar`の各起動箇所から`event.currentTarget`を渡す。×／Esc／キャンセル／保存後は同じ車のボタンへ戻す。起動元が存在しない場合だけ、フォーカス可能な「各車への支払い」見出しへ戻す。
- [x] CarEditorの外枠を`ComposedModal`、`ModalHeader`、`ModalBody`、`ModalFooter`に置き換える。表示中のタスク名と車名を結び付け、dialogとスクロールregionの実際のアクセシブル名を明示する。既存のonScrollCapture、スクロール終端fade、初期フォーカス、内部戻る、適用／保存／キャンセルのハンドラーを保持する。
- [x] `modalLabel`文字列が`modalAriaLabel`より優先されるインストール済みModalの挙動を、別の文字列propの追加だけで修正済みと扱わない。
- [x] `Allocation.jsx`、`ProjectTools.jsx`、`CollectionPrompt`の未指定の閉じるラベルを日本語へ揃える。NumberInputの増減ラベルは対応する入力の意味で指定する。
- [x] `modal-accessibility.spec.js`に、費用一覧→個別費用→移動料金→距離計算での名前、Esc／×／キャンセル／保存後の復帰、消えた起動元のフォールバックを追加する。fixtureは既存`legacy-v4.json`を複製して使う。
- [x] `modal-layout.spec.js`等の「車名だけ」のdialog selectorを、新しい対象＋タスク名へ更新する。assertionを緩めて旧名も許容しない。

### Task 3: 移動料金の高さ・背景を修正

- [x] モバイルの`.settlement-movement-modal`にある`block-size: min(34rem, 100dvh)`を外し、内容に応じた高さと100dvh上限にする。Bodyは`min-block-size: 0`を保ち、必要な場合だけ縦にスクロールさせる。
- [x] ヘッダー／本文全体に重ねた背景指定を整理し、Modalの土台を一貫させる。入力欄と`.settlement-movement-preview`の背景は保持する。
- [x] `modal-scroll.spec.js`に、自家用車の3入力が852px高で収まるケース、667px高／長文エラーで本文がスクロールするケース、タイムズの短いケースを追加する。固定された544pxを期待値にしない。
- [x] 両テーマでヘッダーと本文の土台色が揃い、入力欄・要約が区別できることを実表示とcomputed styleで確認する。本文スクロール後も金額要約へ到達でき、フッターが見えることを確認する。

### Task 4: 精算設定をProgress modalに整える

- [x] `SettlementSettingsModal.jsx`をComposedModal構成にし、全ステップで`size="md"`を使う。既存`update`、`go`、`save`、入力セッション、検証と保存通知を引き継ぐ。
- [x] Footer内の左端へghostの「キャンセル」、右側へsecondaryの「戻る」とprimaryの「次へ／保存」を配置する。戻るは第1ステップと保存中にdisabled。保存中は二重送信・ステップ変更を防ぐ。
- [x] 393pxのコンパクト進捗表示と400px以上のProgressIndicatorを維持する。ステップ移動後は現在の入力／見出しへフォーカスを案内し、Tab/Shift+Tabがダイアログ内で循環することを確認する。
- [x] `modal-layout.spec.js`に、393px／400pxでの操作順・配置、第1ステップのdisabled、戻った後の入力保持、最終「保存」を追加する。通常精算と人数だけ精算の両方を確認する。

### Task 5: ヘッダーだけのスクロールを解消

- [x] フォント読込完了後のヘッダーを測り、44px表示／45px内容となる原因を切り分ける。設定・登録・参加者編集・サンプル・使い方・定員変更を対象にする。
- [x] 未付与のアプリ所有モーダルへ共通`app-modal`クラスを付け、調整をこの範囲へ限定する。ヘッダーの高さ／flex収縮／overflowを必要な範囲で修正し、本文のoverflowは維持する。
- [x] `modal-layout.spec.js`で、短いタイトルのヘッダーにスクロール余地がなく、長い日本語車名・80文字程度のタイトルでも×との重なりと切れがないことを確認する。既存`font-readiness.js`のフォント待機方法を使用する。
- [x] 393×667と1280×900、ブラウザー100%／125%相当の実表示を確認する。ズーム確認をviewport変更だけで代用しない。実施できない環境は記録する。

### Task 6: 集金行の操作を1個にする

**Interfaces:** `setCollectionStatus(person, checked)`、`collectionChange`、`markCollected`の意味と保存内容を維持する。

- [x] `ContainedListItem`の行onClickを外し、非対話の行コンテナにCarbon Checkboxの関連labelで名前・状態・金額を表示する。checkboxの`onChange`だけが`setCollectionStatus`を呼ぶようにする。関連labelに別のbutton／リンクを入れない。
- [x] 名前・状態・金額・余白・checkbox本体のどこをタップしても1回だけ切り替わるようにする。読み上げ名は`${label}の集金を記録`とし、回収済み状態はcheckboxのcheckedと関連する状態表示で伝える。
- [x] `modal-accessibility.spec.js`に、行1人につきTab停止1回、Spaceで1回切り替え、次のTabで次の人へ進む確認を追加する。
- [x] `settlement-entry-mode.spec.js`／`settlement.spec.js`で、人数だけ精算の担当者名入力、保存／キャンセル後の集金モーダル再表示、担当者名保持、集金不要行が非操作であることを確認する。「未回収」から行が消えた場合は次の対象、なければ表示切替へフォーカスを戻す。

### Task 7: 確認漏れ防止を具体化し、結果を記録

- [x] `react-typography-spacing.md`にモーダル一覧と確認表のテンプレートを追加する。列は「画面／モーダル、状態、幅×高さ、テーマ、キーボード、結果、証跡、未確認理由」。単なるチェック済み宣言を完了証拠にしない。
- [x] 一覧には、使い方・サンプル、登録・参加者編集・除外／削除確認、車／班の追加・定員変更・移動・ランダム確認、精算設定3ステップ、費用4view、集金・担当者入力、運転手名編集、ProjectTools各画面を含める。UIから未露出の項目はその理由を記録し、この修正で導線を新設しない。
- [x] `apps/react/AGENTS.md`から確認表とレビュー記録を参照し、UI変更の完了報告に対象・合格・未確認を明記する要件を追加する。
- [x] `docs/design/reviews/2026-10-17-modal-usability.md`に実測結果を残す。今回変更した全モーダルは少なくとも393pxで確認し、設定・移動料金・登録・使い方・集金は1280pxと両テーマも確認する。全項目の総当たりを機械的に増やさず、変更した状態と境界条件を優先する。
- [x] 共通ルール表と実際の空状態見出しの役割も照合し、初期導入見出し`heading-03`と通常の空状態`heading-02`を文書で区別する。

## 実装時の検証・完了条件

以下のコマンドは`apps/react`で実行した。実装完了後は関連回帰とpreview照合を追加で実施した。

```powershell
$env:SANPO_TEST_FIREBASE_TARGET = 'offline'
$env:SANPO_TEST_FIREBASE_PROJECT_ID = 'demo-circle-kikaku-tools'
$env:SANPO_TEST_FIREBASE_DATABASE_URL = 'http://127.0.0.1:9000'
$env:VITE_REACT_SYNC_MODE = 'local'
npm.cmd run test:browser -- tests/browser/modal-accessibility.spec.js tests/browser/modal-layout.spec.js tests/browser/modal-scroll.spec.js --project=chromium-mobile
```

- [x] まず変更に対応するケースを実行し、原因と修正の対応を確認する。新しい失敗はテスト名単位で切り分ける。
- [x] 同じ対象をChromium desktop・WebKit mobile/desktopでも確認し、変更に関連するregistration／participants-accessibility／settlement／settlement-entry-mode／visual-consistencyの既存シナリオを実行する。成功済みの同一条件を理由なく再実行しない。
- [x] `git diff --check`、preview build、source fingerprintと配信資産のcheckを成功させる。確認後にユーザーのpreviewを更新する。
- [x] フォント読込後の文字階層、guideの折り返し、dialogの名前、フォーカス復帰、1人1Tab、固定フッター、本文スクロール、横はみ出しなしの証跡を記録する。
- [x] 既存の計算結果、割勘／部費、人数だけの集金名入力を既存fixtureの期待値と照合する。UI変更を理由に期待金額を変えない。
- [x] 6項目と確認表の全項目を照合し、残りがあれば未完了として報告する。実機Safari／VoiceOverを実施できない場合は明記する。
- [x] 公開保留の状態を維持して、差分・確認結果・ローカルpreviewを提示する。公開再開の指示後にだけ既存PR／CI／Readiness／Production Releaseへ進む。

## 計画の自己確認

- [x] 評価で挙げた6項目をTask 1〜6へ対応付けた。
- [x] 確認漏れ防止をTask 7で一覧・状態・証跡へ具体化した。
- [x] 公式指針と、このサイトのサイズ／文言／操作の判断を分けた。
- [x] 保持する計算・保存・同期・人数だけ精算の挙動を明記した。
- [x] 実装と公開再開を分け、現在の公開保留を維持した。
