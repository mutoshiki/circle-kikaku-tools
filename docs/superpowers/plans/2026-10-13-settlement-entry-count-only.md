# 精算の初期表示と人数だけ精算の整理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. この計画は本人による順次実装を前提とする。

**Goal:** サイトを精算画面から開始し、人数だけ精算では人数と費用の入力に集中できるようにする。

**Architecture:** 保存済みの `settlement.standalone.enabled` で画面構成を切り替える。精算設定モーダルは画面構成が変わっても維持できる共通の位置に置き、既存の編集セッションと同期処理を使う。運転手名は設定ウィザードから外して車ごとの任意操作へ移し、名前変更時は関連する精算記録も同じ編集で移す。

**Tech Stack:** React 19.2.8、@carbon/react 1.115.0、既存canonical store／settlement編集セッション、SCSS、Node test、Playwright。

**Spec:** 2026-10-13のユーザー要求と添付画像。本書の「決定した仕様」が実装仕様。

## 基準と今回の範囲

- 本計画に基づく実装を行う。公開は実装・検証・標準リリース手順の完了後に行う。
- 基準は実際の公開版。確認した公開SHAは `338737afcf47a43a4716b56a05cf49cecaf4c355`、asset digestは `dff109eb26e81e9cbf8dea37e46c16a37b2c62ac46d1a4e477f029ce767059c2`。
- 計画書の保存先は `C:\Users\toshi\.codex\worktrees\initial-empty-state-usability\circle-kikaku-tools`。このcheckoutのHEADも上記SHA。
- `docs/development/current-workspace.md`には前回の起点SHAが残っている。実装時に公開manifestを取り直し、作業元・preview・baselineの対応を明記して更新する。
- 4194の既存タブや元checkoutを作業元と推測しない。既存の未コミット・未追跡ファイルは保持する。

## 決定した仕様

| 対象 | 変更後 |
|---|---|
| サイトの通常入口 | `view`指定がないURLでは「精算」を表示する。共有リンクから開く場合も同じ。 |
| 明示された画面リンク | 通常モードでは `view=participants/car/team/seisan` を尊重する。フォーム連携の参加者リンクと既存の割当リンクを壊さない。 |
| 人数だけ精算中 | 参加者・車割・班割を含むタブバー全体を非表示にし、精算画面だけを表示する。「精算設定を編集」から通常精算へ戻れる。 |
| 切替のタイミング | 設定ウィザードで方法を選んだだけではタブを消さない。保存済みの方法を基準とする。キャンセルは変更しない。 |
| 初期画面の操作 | 上に「参加者を追加」の青いprimaryボタン、下に「人数だけで精算」のghostボタンを置く。フォーム連携中は上を既存どおり「参加者を確認」とする。 |
| 人数の初期値 | 新規・未入力の場合は運転手0人、同乗者0人。保存済みの人数は保持する。 |
| 名前の入力 | 精算設定の「運転手1の名前」等をすべて取り除く。名前未入力でも人数だけで開始できる。 |
| 任意の運転手名 | 人数だけ精算の各車に操作メニューを設け、「運転手の名前を編集」で1台分だけ入力できる。未入力は既存の「車出し1」等を使用する。 |
| 同乗者の集金 | 人数だけ精算で集金チェックを付ける際の名前入力、回収済み表示、解除、保存、再読込を維持する。 |
| 同期表示 | 「同期完了」は小さな補助情報として表示する。読み込み・同期エラーは引き続き確認できる。 |

画面文言は既存表記に合わせて「精算」で統一する。

## 公式指針とこのサイトの判断

- **公式:** Carbonの[Button／Multiple button emphasis](https://carbondesignsystem.com/building-blocks/core/components/button/guidelines/#multiple-button-emphasis)は、関連する操作に強弱を付け、同じグループに高強調ボタンを2つ置かないよう案内している。
  **サイトの判断:** ユーザーの指定に合わせ、参加者登録を上のprimary、人数だけ精算を下のghostにする。順番・色・DOM順を同時に変更する。
- **公式:** Carbonの[Typography code](https://carbondesignsystem.com/building-blocks/foundations/typography/code/)では、文字サイズだけでなくtype styleを適用する方式が推奨されている。`label-01`は基準12pxの補助的なスタイル。
  **サイトの判断:** 正常な同期状態には `label-01`、操作が必要な読み込み・エラー表示には `body-compact-01` を使う。これはCarbonが同期表示専用に規定したルールではなく、この画面の情報優先順位の判断。
- **公式部品の確認:** Carbon MCPでReact ButtonとTabsの構成を確認済み。通常モードではTab／TabPanelの対応を維持する。
  **サイトの判断:** 人数だけ精算中は単独の精算ページとして表示する。1項目だけのタブバーや、CSSで3つだけ隠して選択indexがずれる実装は採用しない。

### 「同期完了」が大きく見える理由

現行 `.sync-status` は `var(--cds-label-01-font-size)` と `var(--cds-label-01-line-height)` を参照しているが、現在の公開CSS `assets/index-SA9Y9W1J.css` には前者の定義がない。意図した小さい文字指定が成立せず、継承した文字サイズで表示される原因になる。

実機のcomputed styleは今回未測定。実装時はCarbon Sassの `type-style` を適用し、通常倍率・基準rootサイズで12px／行高約16pxになることをブラウザで確認する。ユーザーの文字拡大を打ち消す固定指定はしない。

## Global Constraints

- 計算式、切り上げ、費用負担、未計算費用があっても集金を記録できる挙動を維持する。
- 通常精算の参加者、車割、班割、フォーム連携情報を消さず、人数だけ精算から戻れるようにする。
- 保存済みの人数・運転手名・費用・回収記録を初期値で上書きしない。
- 初期0人／0人では設定画面を開けるが、そのまま「次へ」進めない。現在の「合計1人以上」の検証を維持する。
- 運転手0人・同乗者1人以上、および運転手1人以上・同乗者0人を扱えるようにする。
- `domain/generated/*`を直接編集しない。この計画の人数初期値はUI draft側で設定し、schema／Firebase Rulesを変更しない。
- 名前変更は費用・回収状況を保持する編集として行い、既存の別記録を上書きしない。集金時に入力された名前の値は変更しない。
- 同じ問題で20分以上進捗がなければ、原因・現在の状態・次の選択肢を示して停止する。

## Review Focus

1. フォーム連携の `view=participants` と旧割当リンクが、初期表示変更によって精算へ誤転送されないこと（Task 1）。
2. 0人／0人、運転手0人、保存済み人数、enabled=trueで人数未設定のroomを区別すること（Task 2・3）。
3. 通常の参加者・割当があるroomで方法を往復し、元の記録を保持すること（Task 2）。
4. 費用・回収・支払済み記録がある運転手の名前を変更しても金額と記録を失わないこと（Task 4）。
5. モード切替中の保存失敗や別端末更新で、モーダル・エラー・フォーカスを失わず、古いdraftで上書きしないこと（Task 2・4）。

## ファイルの責務

| ファイル | 責務 |
|---|---|
| `apps/react/src/services/url-compat.js` | 初期viewと旧URLの互換処理 |
| `apps/react/src/App.jsx` | 保存済みモードによるナビゲーション、共通の精算設定モーダル所有 |
| `apps/react/src/components/SettlementSettingsModal.jsx`（新規） | 現行SettingsModalを移し、人数と精算方法を編集する |
| `apps/react/src/components/Settlement.jsx` | 空画面の操作順、車ごとの名前メニュー、既存の費用・集金UI |
| `apps/react/src/components/StandaloneDriverNameModal.jsx`（新規） | 1台分の任意の運転手名を編集する小さなモーダル |
| `apps/react/src/components/settlement/edit.js` | draft初期値、名前変更の関連記録更新、既存保存処理 |
| `apps/react/src/styles.scss` | 同期type styleと車メニューの配置 |
| `apps/react/tests/phase6.test.mjs`、`settlement-edit.test.mjs` | URL互換、人数初期値、名前変更の保存契約 |
| `apps/react/tests/browser/initial-empty-state.spec.js`、`shell.spec.js` | 開始操作と同期表示の回帰確認 |
| `apps/react/tests/browser/settlement-entry-mode.spec.js`（新規） | モード往復、名前変更、集金の利用フロー |

## Task 1: 精算を初期表示にし、明示したリンクを保持する

**Interfaces:** `prepareCompatibleUrl({ location, history, storage, crypto })` の戻り値 `initialView` は参加者0／車割1／班割2／精算3。`App.changeView(selectedIndex)` は対応するviewをURLへ書く。

- [x] `phase6.test.mjs`で、viewなし・未知view→3、participants→0、car→1、team→2、seisan→3、既存sheet／allocationリンク→既存の割当画面、共有URLのroom保持を検証する。
- [x] `url-compat.js`の既定を3にし、明示viewを解決する。旧URLとhandoffの既存互換処理は維持する。
- [x] `App.jsx`のfallbackを3にし、車割／班割へ移動した際にも `view=car/team` を保存する。通常モードの再読込で明示viewが保持されるようにする。
- [x] browserで通常入口が精算、フォームの参加者リンクが参加者、車割／班割の再読込が各画面になることを確認する。既存の「viewなし＝車割」というテストだけを更新する。

## Task 2: 人数だけ精算を単独画面にする

**Interfaces:** `App`の `openSettlementSettings({ standalone = false, launcherButtonRef })` が `beginSettlementEdit` の戻り値を所有する。`Settlement`は `onOpenSettings` を呼び、`SettlementSettingsModal({ runtime, edit, launcherButtonRef, onNotice, onClose })` は既存の保存契約を維持する。

- [x] `settlement-entry-mode.spec.js`に、通常→人数だけ精算→通常の往復、設定キャンセル、人数だけroomへの参加者deep link、再読込、元の参加者・割当保持を検証するフローを追加する。
- [x] 現行 `SettingsModal` を `SettlementSettingsModal.jsx` へ移し、`App.jsx`の共通位置から表示する。設定保存と同期が完了する前に画面構成が変わっても、モーダルがunmountされないようにする。
- [x] `room.settlement.standalone.enabled === true` を人数だけ精算の基準にする。draft中のラジオ選択や `result.participants.length` をナビゲーション判定に使わない。
- [x] 通常は4タブ、人数だけ精算ではタブバーなしの精算ページを描画する。人数だけモード中の古いviewリンク・別端末からのモード変更でも精算へ揃える。
- [x] 「精算設定を編集」で通常精算へ戻すと4タブを復元し、精算を選択した状態にする。元データを削除しない。
- [x] enabled=true・人数未設定の保存データは通常参加者の計算結果を表示せず、「人数を設定してください」と「人数を設定」の操作を表示する。設定から通常に戻る操作も使えるようにする。
- [x] 保存失敗はモーダル内に残す。保存後は表示中の「精算設定を編集」、キャンセル時は表示中の起動ボタンへフォーカスを戻す。

## Task 3: 人数の初期値を0にし、設定から名前欄を外す

**Interfaces:** `initializeStandaloneCounts(standalone)` はblank／未指定の `driverCount`・`memberCount` だけを `'0'` にしたcopyを返す。保存済み値と `driverNames` は保持する。

- [x] `settlement-edit.test.mjs`に、空room→0／0、既存2／3の保持、既存運転手名の保持、既存人数を変えずに人数だけモードへ切り替えてもenabled=trueが保存されるケースを追加する。
- [x] `beginSettlementEdit`の `openingState` を、強制モード選択や初期値補完の**前**の保存済みstateから取る。現在の「補完後をopeningStateにする」順番では、人数を変えずに保存したときにモード選択が未変更として戻される可能性がある。
- [x] 初回の人数だけ起動とラジオで人数だけを選ぶときに `initializeStandaloneCounts` を使う。入力中にユーザーが欄を空にした状態を毎回0へ戻さない。
- [x] 設定ウィザードから運転手名のTextInput一覧を削除する。人数入力による既存の仮名生成を利用し、保存済み運転手名を消さない。
- [x] browserで0／0の次へ進む検証、0／3と1／0の開始、設定キャンセル、任意名を保存後に設定を開き直しても名前欄が出ないことを確認する。

## Task 4: 各車のメニューで任意の運転手名を変更する

**Interfaces:** `beginStandaloneDriverNameEdit(store, standaloneIndex)` は既存の精算編集と対象index／旧名を返す。`applyStandaloneDriverName(edit, settlement, name)` は正規化・衝突検査を行い、draftへ関連記録を移す。保存は既存の `commitSettlementEdit(runtime, edit)` を使う。

- [x] `settlement-edit.test.mjs`に、既存の費用・extra ID・paid・paidBy・driverPaidを持つ運転手の改名後も、金額と記録が保持されるテストを追加する。キャンセル、空欄、重複、別端末更新、他の車と同乗者の記録保持も確認する。
- [x] 人数だけ精算の車見出しに、Allocationで使用しているCarbon `OverflowMenu`／`OverflowMenuItem`を同じtheme／floating menu方針で設ける。メニュー項目は「運転手の名前を編集」。通常精算には追加しない。
- [x] `StandaloneDriverNameModal.jsx`を作り、タイトル「運転手の名前を編集」、欄「運転手の名前（任意）」、説明「空欄の場合は『車出しN』と表示します。」、保存／キャンセルを置く。
- [x] indexから現在の旧名を取得し、既存domainと同じ空白正規化・仮名を使う。別の運転手、仮の同乗者、既存の通常参加者や別の精算記録との名前衝突は欄のエラーにし、上書きしない。
- [x] `standalone.driverNames[index]`と、旧名をキーにする `cars`／`paid`／`paidBy`／`driverPaid` を同じ編集で新名へ移す。`routePlanner.targetCarName`が旧名を参照している場合だけ更新する。`paidBy`の**値**や他の人のデータは変更しない。
- [x] 行のReact keyとメニューのフォーカス管理には人数だけ車の `standaloneIndex` を使い、改名によってフォーカス先を失わないようにする。対象が別端末でなくなった場合は保存を止める。
- [x] browserで名前未入力の費用入力、改名後の再読込、保存失敗、キャンセルを確認する。同乗者の行をタップ→既存の名前入力→保存→回収済み→解除のフローも確認し、名前入力の対象と保存値を維持する。

## Task 5: 精算の開始操作の順番と見た目を入れ替える

**Interfaces:** `InitialEmptyState({ primaryAction, alternateAction, ... })` の既存APIを利用し、Settlement側で2つのactionを交換する。

- [x] `Settlement.jsx`で上のprimaryを「参加者を追加」（フォーム連携時は「参加者を確認」）、下のghostを「人数だけで精算」にする。
- [x] 説明を「参加者を追加するか、人数だけで精算を始められます。」とし、DOM順と画面順を一致させる。
- [x] 人数だけ起動ボタンのrefを下のghostに付け直す。`initial-empty-state.spec.js`で上下位置・強調・各遷移・キャンセル後のフォーカスを確認する。
- [x] 参加者タブ側の開始操作、フォーム連携の応募者確認、読み込み／読み込み失敗時の案内は既存契約を維持する。

## Task 6: 同期表示の文字サイズを確実に適用する

**Interfaces:** `.sync-status--compact`はCarbon `label-01`、`.sync-status--prominent`は `body-compact-01`。状態判定と `role="status"` は現在のまま。

- [x] `styles.scss`で `@carbon/type` のSass moduleを読み、対象classに `type-style` mixinを使う。未定義のfont-size／line-height変数参照を置き換える。日本語font stackは維持する。
- [x] `shell.spec.js`の同期状態fixtureで、正常表示は基準12px／行高約16px、読み込み・エラーは14px／行高約18pxとなること、名前・操作との折返し、読み上げを確認する。
- [x] desktopと375～390px、light／dark、文字拡大時の読める配置を確認する。他の部品のtype styleは今回変更しない。

## 実装時の検証と完了条件

実装前に公開manifestと作業HEADを確認する。必要なら既存worktreeを再利用し、実装用branchは `codex/` prefixにする。

対象テストを先に実行する際の例（`apps/react`内のPowerShell）：

```powershell
$env:SANPO_TEST_FIREBASE_TARGET='offline'
$env:SANPO_TEST_FIREBASE_PROJECT_ID='demo-circle-kikaku'
$env:SANPO_TEST_FIREBASE_DATABASE_URL='http://127.0.0.1:9000'
node --test tests/phase6.test.mjs tests/settlement-edit.test.mjs
npm.cmd run test:browser -- tests/browser/settlement-entry-mode.spec.js tests/browser/initial-empty-state.spec.js tests/browser/shell.spec.js --project=chromium-mobile
```

- [x] 対象unit／browserを通し、desktop・WebKitで影響する入口・モード往復・改名・集金・フォーカスを確認する。
- [x] 保存済み通常room、人数だけroom、空room、フォーム連携roomで確認する。light／dark、375px／390px、横はみ出しなしを確認する。
- [x] 現在のsourceからpreviewをbuildし、`check:preview`でsource fingerprintと配信assetを照合してから提示する。
- [ ] PR→CI→main同一SHAのReadiness→既存Release→専用room smoke／cleanupの標準経路を完了する。

**計画の自己確認:** ユーザーの要求7項目（初期精算、不要タブ、設定の名前欄削除、車メニューの任意名、同乗者集金入力保持、人数0、開始操作交換）と同期文字サイズをTask 1～6へ割り当てた。名前が費用記録のキーになる点、モード保存でモーダルが消える点、openingStateの初期化順も実装対象に含めている。
