# 各車への支払い画面改善 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. この計画は同じ画面内の小さな変更であり、サブエージェントへの分担を前提としない。

**Goal:** 各車へ別々に渡す「割勘」「部費」を常時確認でき、必要なときに内訳を開いて確かめられる画面にする。

**Architecture:** 既存の `Settlement.jsx` の車別表示と、その表示に対応する `styles.scss` を変更する。計算結果の `calc.adjustedSplitPay` と `calc.adjustedClubPay` はそのまま使い、Accordionの見出しから独立した金額欄へ移す。費用編集・集金・設定・同期の処理は既存の経路を使う。

**Tech Stack:** React 19.2.8、インストール済み `@carbon/react` 1.115.0、SCSS、Playwright 1.61.0。

**Spec:** 2026-10-16の画面評価とユーザーの修正「割勘と部費は別で渡すことが多いため、二つ表示したい」。以下の「確定仕様」に実装対象をまとめる。

## 基準と作業場所

- 2026-10-16に公開manifestとGitHub mainを照合し、両方が `c234929b4b0c4adffadf1134893042087bb4c6c7` で一致した。
- 公開asset digest: `329f9182e07ab6565f8c327f43c822d676ffc153c30539445cf38c17300ec570`。
- 公開URL: <https://mutoshiki.github.io/circle-kikaku-tools/>。
- 参考画像: `C:/Users/toshi/AppData/Local/Temp/codex-clipboard-f4765cd9-040c-4285-abc1-f2bae90bc91d.png`。
- 本計画の保存先worktreeは `C:/Users/toshi/.codex/worktrees/initial-empty-state-usability/circle-kikaku-tools`。現在のHEADは `139a09b2755fe9f53eadb82b090476208f7365cf` だが、`git diff c234929b4b0c4adffadf1134893042087bb4c6c7 -- apps/react` に追跡ファイルの差分はない。
- 元のチェックアウト `C:/Users/toshi/Documents/GitHub/circle-kikaku-tools` は `codex/react-migration-rc` に未コミット変更がある。新しい実装の起点にしない。「未コミット」は確認済みだが、その内容が未公開かどうかは未比較。
- `docs/development/current-workspace.md` 内の公開SHAは過去の記録。実装開始時に最新manifestから再確認・更新する。

## 確定仕様

1. 車名・既存の費用入力／編集操作の下に、「割勘」「部費」の金額欄を表示する。左右2列の同じ大きさ・強さで、ラベルの下に金額を置く。
2. 割勘と部費は0円でも両方表示する。合計支払額を追加せず、二つの受け渡しを別々に確認できるようにする。
3. 金額欄はAccordionの外に置き、内訳を閉じても見える状態にする。表示順は車名・編集操作 → 二つの金額 → 「支払い内訳」 → 展開した明細。
4. 内訳見出しは「支払い内訳」のみとし、金額を繰り返さない。読み上げ名は `「${carLabel}」支払い内訳` とする。
5. 展開内容では、既存の `hasSplitDetails` / `hasClubDetails` がtrueの区分だけ見出しと明細を表示する。両方falseなら「該当する費用なし」を一度だけ表示する。
6. 合計0円でも、正負の費用や調整が存在する区分は省略しない。最終金額のゼロ判定で区分を隠さない。
7. 「割勘」「部費」「支払い内訳」「切り上げ分」「集金分差し引き」「該当する費用なし」の文言は維持する。費用が未保存なら「費用を入力」、保存済みなら「費用を編集」という判定も維持する。
8. 明細は項目名が折り返せ、金額は右揃えで桁・符号が欠けない。費用行と切り上げ・差し引きの間は8px相当のトークンによる余白で区切る。
9. セクション見出しをh2、車名をh3、明細区分をh4にして、既存のidと `aria-labelledby` の対応を保つ。

表示イメージ（内訳を閉じた状態）:

```text
藤原 拓海車                       費用を編集

割勘                    部費
¥1,900                  ¥0

⌄ 支払い内訳
```

## Global Constraints

- 対象は「各車への支払い」の表示・配置・関連するアクセシビリティと既存ブラウザテストの追随。
- 計算式、丸め、負担区分、集金差し引き、車名生成、費用編集、集金記録、保存形式、同期、Firebase接続は変更しない。
- 通常精算と人数だけの精算に同じ表示を適用し、人数だけの運転手名編集メニューを残す。
- 既存のCarbon Accordion / Buttonを継続使用し、新しい依存パッケージやアイコンを追加しない。
- 既存のテーマ・Carbonの色／文字／余白トークンを使う。小画面の文字を小さくして収めない。
- 新しい `.cds--*` 内部セレクターを追加せず、公開APIとアプリ所有クラスで調整する。
- 公開ルーム `2E20E7B1` を変更しない。ブラウザ検証は明示したoffline環境と合成fixtureを使う。
- ユーザーが後続で本計画の全実装を明示的に依頼した。実装は許可済み。push・本番公開は今回の依頼に含まれない。

## Carbon公式指針と今回の判断

| 公式指針・根拠 | 今回の判断 |
| --- | --- |
| [Typography](https://carbondesignsystem.com/building-blocks/foundations/typography/overview/#productive-and-expressive-type-sets): 製品内の作業を支える情報階層を作る。 | 二つの金額を同じ優先度で強調する。合計を主役にする案は、別々に渡す実際の使い方と合わないため不採用。 |
| [Accordion](https://carbondesignsystem.com/building-blocks/core/components/accordion/guidelines/#when-to-use): 必須でない詳細を必要に応じて開く。 | 割勘・部費の金額は常時表示し、計算内訳だけを折りたたむ。全明細の常時展開はスクロールが増えるため不採用。 |
| [Accordion alignment](https://carbondesignsystem.com/building-blocks/core/components/accordion/guidelines/#flush-alignment): 狭い領域ではflush配置により周囲と整列できる。 | 公開API `isFlush` を使い、スマホの深い字下げを減らす。MCPで取得したAPIと、インストール済み1.115.0の型定義の両方で存在を確認済み。 |
| [Spacing](https://carbondesignsystem.com/building-blocks/foundations/spacing/overview/#creating-hierarchy): 余白で情報の関係と階層を示す。 | 二つの支払額を一組としてまとめ、調整額と通常費用を小さな余白で分ける。費用小計などの追加行は情報が増えるため不採用。 |
| [Accordion accessibility](https://carbondesignsystem.com/building-blocks/core/components/accordion/accessibility/#keyboard-interactions): Tab移動、Enter／Spaceによる開閉と開閉状態の通知を備える。 | Carbon標準操作を使い、車名による読み上げの識別を維持する。独自のクリック用divへ置き換えない。 |

## Review Focus

- 両方0円でも二つの金額を常時確認できること → Task 1の既存ゼロ金額ケース。
- 0円になる正負の費用がある区分を省略しないこと → Task 1の相殺ケース。
- 長い車名・費用名・大きい金額・負数でも狭い画面からはみ出さないこと → Task 2のレスポンシブ確認。
- 車を取り違えず編集でき、Accordion開閉が保存データを変えないこと → Task 1の車別操作とTask 3の既存キャンセル検証。
- 金額の表示移動後も、キーボード・読み上げ・ライト／ダークの可読性が成立すること → Task 2の操作／配色確認。

## Task 0: 実装開始時の公開基準を確定する

**Files:** `docs/development/current-workspace.md`（実装時に作業元を記録）。

- [x] 公開 `release-build.json` を再取得し、`git ls-remote origin refs/heads/main` と比較する。公開とmainが違う場合はどちらの差分かを確認し、本計画の対象を移植する起点を記録する。
- [x] `superpowers:using-git-worktrees` に従い、公開基準から実装用の作業場所を確保する。既存の変更をreset・stash・削除しない。
- [x] 作業先のAGENTS.mdを読み、workspace対応表を最新のSHA・ブランチ・配信元・localデータ接続に更新する。古い4194のタブを今回の変更版とみなさない。

## Task 1: 二つの金額を独立表示し、内訳を整理する

**Files:**
- Modify: `apps/react/src/components/Settlement.jsx`（車別描画、現在429–464行付近）。
- Modify: `apps/react/tests/browser/settlement.spec.js`（内訳操作・ゼロ金額・既存のAccordion参照）。
- Review: `apps/react/tests/browser/settlement-negative-validation.e2e.spec.js`（入力拒否／キャンセル前後の明細不変チェック）。

**Interfaces:** `calc.adjustedSplitPay` / `calc.adjustedClubPay` / `money()`、既存の区分明細と調整額の描画を利用する。新しい計算関数や保存フィールドは作らない。

- [x] 既存の `vehicle settlement presents expense and breakdown with an accessible Carbon accordion` を更新し、折りたたみ中にも割勘 `¥2,200` と部費 `¥-100` が別々に見えること、金額が開閉ボタンの子ではないことを検証する。
- [x] 既存のゼロ金額ケースを更新し、二つの `¥0` が閉じた状態で見えること、開くと「該当する費用なし」が一度だけ出ることを確認する。片方だけ明細がある場合と、正負の費用が相殺して0円になる場合も同じspecで確認する。
- [x] 金額欄を `settlement-car-amounts` というアプリ所有クラスの領域へ移し、`dl` の二組の `dt` / `dd` で「割勘」「部費」を対応付ける。既存の整形関数と金額値を変更しない。
- [x] Accordionのvisible titleを「支払い内訳」、読み上げ名を `「${carLabel}」支払い内訳` に変更する。金額付きのボタン名を参照する既存テストを、車のarticle内の「支払い内訳」ボタン参照へ更新する。
- [x] 詳細区分の有無は既存の `hasSplitDetails` / `hasClubDetails` で判定する。ラベル・金額の組、切り上げ・差し引きは既存値のまま表示する。
- [x] 車名h3／区分h4へ見出しレベルを整え、関連するCSSと見出しテストを対応させる。
- [x] 対象テストで、編集対象が正しいことと、開閉前後のcanonical roomに差分が生じないことも確認する。小さな表示変更を検証するための新しい単体テストファイルは作らない。

## Task 2: 配置・余白・アクセシビリティを整える

**Files:** `apps/react/src/styles.scss`、`apps/react/src/components/Settlement.jsx`、`apps/react/tests/browser/settlement.spec.js`。

**Interfaces:** Task 1の `settlement-car-amounts` と、既存の `settlement-car-*` / `settlement-cost-*` を使う。

- [x] 金額欄は等幅2列とし、ラベルと金額の左右の組を維持する。金額はCarbonのproductiveな見出しトークンと `tabular-nums`、ラベルは本文トークンを使い、スマホでは既存の16px以上の文字ルールを守る。
- [x] Accordionに公開API `isFlush` を適用する。不要になった内訳見出しの横並び金額用スタイルは削除する。既存の内部クラス依存の2ルールは、公開APIと所有クラスの余白・車別区切りへ整理し、新たな内部上書きを増やさない。車ごとの区切りは一本にする。
- [x] 通常費用と調整額を所有クラスのグループに分け、間に `spacing-03` 相当の余白を設ける。区分間は `spacing-05` 相当、車間は `spacing-05` 相当を起点に確認する。
- [x] 320／375／390pxとデスクトップ1280pxで、長いレンタカー車名、長い費用名、`¥12,345,678`、負数を確認する。金額の切り捨て・省略記号・横スクロールを認めず、必要ならラベルや領域を折り返す。
- [x] Tabで内訳へ到達し、EnterとSpaceで開閉でき、フォーカス表示と `aria-expanded` が変化することを確認する。「費用を入力／編集」の既存の車名付き読み上げ名も確認する。
- [x] ライト／ダーク双方で実際の前景・背景色から文字コントラストを測る。本文は4.5:1以上を基準にし、色だけで増減を伝えない。金額欄や開閉行の文字を薄くして階層を作らない。

## Task 3: 必要な検証と変更内容をまとめる

**Files:** 上記の変更ファイル、`docs/development/current-workspace.md`、本計画書の進捗。

- [x] 次のoffline環境を明示して、まず変更した表示・ゼロ金額・相殺ケースをChromium mobile／WebKit mobileで実行する。テスト用4176が使用中なら既存プロセスを停止せず、所有者とビルドを確認して専用portを確保する。

```powershell
$env:SANPO_TEST_FIREBASE_TARGET='offline'
$env:SANPO_TEST_FIREBASE_PROJECT_ID='demo-circle-kikaku-tools'
$env:SANPO_TEST_FIREBASE_DATABASE_URL='http://127.0.0.1:9000'
cd <実装worktree>/apps/react
npm.cmd run test:browser -- tests/browser/settlement.spec.js --project=chromium-mobile --project=webkit-mobile --grep 'vehicle settlement presents|settlement rows wrap|zero net payment'
```

- [x] 対象確認が通ったら、既存の `settlement.spec.js`、`settlement-negative-validation.e2e.spec.js`、`settlement-entry-mode.spec.js` を実行し、費用編集の保存／キャンセル／再読込、集金、通常精算、人数だけの精算を確認する。同じ成功ケースの反復は新しい根拠がある場合だけ行う。
- [x] `npm.cmd run build` と `git diff --check` を実行する。対象ファイルに変更を絞り、domain／sync／Firebase／保存schemaの変更がないことを確認する。
- [x] 人が見るpreviewは `build:preview` と `check:preview` のSHA・fingerprint照合後に開く。合成データだけで変更前後を比較し、320px・390px・デスクトップと両テーマの結果を残す。
- [x] 実装後の差分・画面・検証結果を報告する。将来push・本番公開が指示された場合は、その時点のmainを基準に既存のCI／Readiness／Production Release／公開スモークとcleanupを使う。

## 完了条件

- 割勘と部費が同じ優先度で常時表示され、0円も消えない。
- 内訳を閉じても金額が分かり、開くと該当する費用と調整を確認できる。
- 合計支払額・追加の小計・支払い記録操作を今回追加しない。
- 見た目と読み上げの両方で車と二つの金額の対応が分かる。
- 狭い画面と両テーマで可読性・操作性が成立し、既存の計算・編集・集金・保存が保持される。

## 計画作成時の確認結果

- 公開manifestとremote mainのSHA一致、作業用worktreeの追跡Reactコードと公開SHAの差分なしを確認した。
- MCPのAccordion例とインストール済み1.115.0の型定義で `isFlush`、title、aria-labelを確認した。
- 既存テストは金額付きの開閉ボタン名、h3の区分見出し、空区分二件を前提にしているため、変更に対応する箇所を特定した。
- この段階では計画書のみを追加した。製品コードの変更、テスト実行、push・公開は行っていない。
