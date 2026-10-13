# 任意の費用だけで精算する実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 費用の未入力で精算・集金を止めず、入力済みの費用だけで計算できるようにする。

**Architecture:** 既存の精算計算は、ガソリン代の計算条件が不足すると0円を返している。この挙動を使い、React画面の未確定表示と集金制限を解除する。保存・同期・schemaの新しい状態は追加せず、費用変更の通知は既存の保存成功通知に統合する。

**Tech Stack:** React 19.2.8、@carbon/react 1.115.0、既存settlement domain/store、Node test、Playwright。

**Spec:** 本会話の最新合意「もっとシンプルに保つ」。未入力は計算上0円、入力済み費用で精算・集金、未計算／金額未確定の表示と操作制限を除去、入力説明を追加、後から集金額が変わった場合に通知する。本書の「決定事項」を実装仕様とする。

## Global Constraints

- 作業元は `C:/Users/toshi/.codex/worktrees/production-baseline/circle-kikaku-tools`、branchは `codex/production-baseline-workspace`。既存の未コミット変更を保持する。
- 計画作成後にユーザーから実装依頼を受けたため、UI実装・検証・ローカルpreviewまで実施する。push・公開は今回の範囲外。
- generated domainとlegacyの計算式、切り上げ、運転手差し引き、人数だけで精算する設定を変更しない。
- 新しい「未確定」「暫定」「費用なし」選択、受領金額管理、schema変更を追加しない。
- 未入力と不正入力を区別する。負数・非数値は引き続き保存を止め、該当欄にエラーを示す。
- `paid`、`paidBy`、`driverPaid`は費用変更時に自動で消去・再設定しない。

## 決定事項

| 入力 | 計算と操作 |
|---|---|
| ガソリン代の条件が全部空欄 | ガソリン代0円。費用保存・集金可能 |
| 距離・燃費・単価の一部が空欄 | ガソリン代0円。入力値は保持。計算するには3項目必要と常時説明 |
| タイムズの距離が空欄 | 移動料金0円。時間料金・その他費用は計算に含める |
| 名目がある追加費用の金額が空欄 | その費用0円として保存可能 |
| 新しく追加した費用の名目・金額が両方空欄 | 新規の空行だけ保存前に除去。他の費用は保存可能 |
| 金額を入力した追加費用の名目が空欄 | 名目の入力を求める |
| 負数・非数値 | インラインエラー。保存不可 |
| 距離・単価が0 | 0円として有効 |
| 入力した燃費が0 | 割り算の条件として不正。燃費は正の数を求める |

費用一覧の移動費は `¥0` を表示する。支払い内訳では既存の0円行を省くルールを使い、全て0円なら「該当する費用なし」を表示する。各車の支払額と1人あたりの集金額は常に計算結果を表示する。

集金記録は現行の回収チェックのままとする。実際の受領金額を保存する機能ではないため、費用を変更した際に不足額・過払い額を自動計算するとは表示しない。

## Review Focus

- 一部の車だけ移動費が空でも、全員の集金操作と他の車の金額表示を維持する（Task 1）。
- 計算条件を途中まで入力して戻る・保存・再読み込みしても、値を勝手に0に書き換えない（Task 2）。
- 空欄を許可しても、負数・非数値・燃費0を受け入れない（Task 2）。
- 名目のみの費用と完全な空行を区別し、既存の固定費用・ユーザー入力を失わない（Task 2）。
- 回収済み記録がある状態で金額を変更しても記録を保持し、保存成功後だけ変更を通知する（Task 3）。

---

### Task 1: 未確定表示と集金制限を除去

**Files:**
- Modify: `apps/react/src/components/Settlement.jsx` — Settlementの金額表示・内訳・集金モーダル。
- Modify: `apps/react/tests/browser/settlement.spec.js` — 現行の未確定状態テスト。

**Interfaces:**
- Consumes: `settlement.calculateSettlement(data, state)` の `cars`、`perPerson`、`excludedNames`。
- Produces: 金額表示は既存の計算結果に統一。`setCollectionStatus(person, checked)` の保存先・挙動は維持。

- [x] 既存テスト `unrelated expenses save while movement cost is uncalculated and collection stays provisional` を新仕様へ置き換える。移動費空欄・追加費用ありで数値表示、未確定通知なし、checkbox有効、回収記録の再読み込み保持を確認する。
- [x] ガソリン代が空の車と計算済みの車を同時に置き、両方の支払額が計算結果と一致するケースを追加する。登録済み参加者と人数だけの精算で集金可能とする。
- [x] `hasUncalculatedMovement`、`hasIncompleteExpenses`、`hasUnconfirmedSettlementAmounts` による全体制限を除去する。対象行・checkboxのdisabledを外すが、集金不要の参加者の扱いは維持する。
- [x] 各車の「ガソリン代未計算」「費用未入力」「金額未確定」、集金画面の「未確定」通知を除去する。内訳の未計算置換を外し、0円行は既存フィルターで省く。
- [x] 「費用を入力／編集」の判定は、入力済みの計算条件・有意味な追加費用を使う。単に未確定フラグを削除して、全車を入力済みにしない。
- [x] 対象テストで行全体のタップ、checkboxクリック、Spaceキーがそれぞれ一度だけ切り替えることを確認する。

### Task 2: 空欄を許容し、費用入力を簡潔にする

**Files:**
- Modify: `apps/react/src/components/Settlement.jsx` — `movementFieldError`、`getMovementErrors`、`getExpenseFieldErrors`、CarEditor、MovementSettingsView。
- Modify: `apps/react/tests/browser/settlement.spec.js`。
- Modify: `apps/react/tests/browser/settlement-negative-validation.e2e.spec.js`。

**Interfaces:**
- Consumes: `movementFieldDefinitions(times)`、`getMovementErrors(car, domain)`、`getExpenseFieldErrors(row, domain)`、既存edit.state。
- Produces: 空欄はエラーなし、入力済みの不正値はエラー。保存形式とdomain入力は既存のまま。

- [x] `movementFieldError` を空欄許容へ変更し、距離・単価は0以上、入力された燃費は0より大きい値に限定する。非数値・負数の保存チェックをCarEditor.saveと適用ボタンの両方に使う。
- [x] 計算条件の「必須」表示・required属性を外す。「入力が必要です」の通知を除去する。プレビューは空欄の場合も `¥0` を表示する。
- [x] 費用一覧に「請求する費用だけ入力してください。未入力の費用は0円で計算します。」を常時表示する。
- [x] ガソリン代の条件欄に「計算する場合は、移動距離・燃費・ガソリン単価をすべて入力してください。」、タイムズでは「計算する場合は、移動距離を入力してください。」を表示する。入力途中で0円になる理由を説明する。
- [x] 追加費用の金額空欄を許可し、「未入力は0円で計算します。」を金額欄のhelperTextに表示する。費用一覧も空欄を `¥0` と表示する。
- [x] 新規の完全な空行は保存前に除去する。既存行・固定のタイムズ時間料金・車出し協力代を巻き込まない。金額だけ入力した行の名目チェックは維持する。
- [x] 空欄、部分入力、明示的0円、負数、非数値、燃費0、名目のみ、完全な空行のケースを確認する。入力途中で戻る・キャンセル時の保持／破棄は現行editの契約どおりにする。

### Task 3: 集金額の変更を保存通知で知らせる

**Files:**
- Modify: `apps/react/src/components/Settlement.jsx` — CarEditor.save、SettingsModalの保存成功通知。
- Modify: `apps/react/tests/browser/settlement.spec.js`。
- Reference: `apps/react/src/components/settlement/edit.js` — `commitSettlementEdit(runtime, edit)`。

**Interfaces:**
- Consumes: 保存直前・`commitSettlementEdit`成功直後のstore snapshotを `settlementInput` → `calculateSettlement` した `perPerson`、成功直後の `state.paid`。
- Produces: 既存 `onNotice(message)` を1回だけ呼ぶ。新しい通知基盤・金額履歴を作らない。

- [x] 各保存の直前の `perPerson` と、commit成功後の最新snapshotの `perPerson` を比較する。編集開始時点だけの値や未保存draftは比較元にしない。
- [x] 金額が同じなら現行の保存成功文言を使う。変わった場合は「費用を保存しました。1人あたりの集金額が¥○○に変更されました。」と表示する。設定保存は冒頭を「精算設定を保存しました。」にする。
- [x] `state.paid` に回収済みの対象者がいれば「記録済みの集金状況を確認してください。」を追記する。チェック状態・集金した人・車への支払い済み状態は保持する。
- [x] キャンセル、保存失敗、同額の変更、集金チェック操作では金額変更通知を出さない。今回の通知範囲はこの画面からの費用・設定保存とし、他端末の全変更監視は追加しない。
- [x] ガソリン代0円で回収を記録した後にガソリン代を保存し、通知・回収チェック・再読み込み保持を確認する。部費だけ変更して `perPerson` が変わらないケースも確認する。

### Task 4: 変更範囲を検証し、現在のpreviewへ反映

**Files:**
- Reference: `docs/development/current-workspace.md`。
- Reference: `apps/react/tests/domain.test.mjs`、`apps/react/tests/settlement-edit.test.mjs`。
- Modify: 本計画のチェック欄・実施結果。

- [x] 対象ブラウザテストをChromium desktop／390pxで実行する。新しい挙動を固定した後、負数入力・回収者入力・キャンセル・保存・再読み込みの既存回帰テストを確認する。
- [x] domain計算・edit保存の既存テストを実行し、計算式・保存patchが変わっていないことを確認する。generated domainやlegacyを変更する必要が判明したら、UIだけの計画として進めず変更範囲と互換チェックを見直す。
- [x] 公開 `release-build.json` を取り直して `sourceSha` を確認する。`docs/development/current-workspace.md` の手順で `build:preview` と4194の `check:preview` を実行する。
- [x] 照合成功後にローカル検証roomで空欄の車・入力済みの車・集金記録を確認する。スマホ幅で折り返し、横はみ出し、ダークモード、キーボード操作を確認する。ユーザーのサンプルをリセットしない。
- [x] 今回の差分と既存の未コミット変更を区別して完了報告する。公開依頼がある場合は、公開対象を記録し既存release/readiness経路へ進む。

## 完了条件

- 未入力の費用があっても数値の精算額を表示し、集金を記録できる。
- 不正入力の検証と、集金不要の対象者の扱いを維持する。
- 未計算／金額未確定の重複表示がなく、入力欄の説明から0円扱いを理解できる。
- 費用変更で集金額が変わったときだけ通知し、既存の集金記録を保持する。
- 現在のworktreeから作ったpreviewで対象シナリオを確認できる。

## 計画作成時の確認

- 2026-10-13 JST：ソース・既存テスト・作業元を読み取り確認済み。実装、テスト実行、build、公開は未実施。
- `calculateSettlement` はガソリンの距離・燃費・単価が揃わない場合に0円を返す。主な阻害箇所はSettlement.jsxの表示・集金disabled・入力検証。
- 既存の作業元対応表には `apps/react/src/domain/settlement.js` とあるが、このworktreeで実在する計算実装は `apps/react/src/domain/generated/settlement.js`。生成ファイルを直接編集しない。

## 実施結果

- `apps/react/src/components/Settlement.jsx` と関連ブラウザテストのみ変更。計算式、generated domain、legacy、schemaは変更していない。
- offline unit suite: 96/96 passed。
- Chromium mobile (390px) と desktop で、空欄／部分入力／0円／負数／非数値／燃費0、追加費用、集金操作、件数だけの精算、集金額変更通知と再読み込み保持を確認。関連回帰テスト passed。
- 公開 `release-build.json` の source SHA は `a8531f1be1353a156be4d2ed1c71f80af9c3ff6b`。同SHAを基準にローカルpreviewをbuildし、4194でHTMLと3 assetsのsource fingerprint一致を確認。
- push・本番公開は未実施。
