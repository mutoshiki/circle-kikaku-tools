# タブ編集と全画面の表示・操作ルール統一 Implementation Plan

> **For agentic workers:** The user authorized full implementation on 2026-11-01. Use `superpowers:executing-plans`, proceed task-by-task, and check only completed items. The repository release instructions apply.

**Goal:** 正常時の同期表示と重複余白を削り、「タブを編集」の単一設定に整理し、全画面・モーダルの表示要素の有無と操作を目的に沿って統一する。

**Architecture:** Circleの共通shellと既存workspace保存処理を再利用する。タブ編集のUIは単一チェックにし、既存schemaVersion 1のenabled/pinnedを互換アダプターで扱う。メーカーは各ソースrepoで修正・packし、Circleのvendorとlockfileを更新する。DB migrationや計算ロジック変更は必要としない。

**Tech Stack:** React 19、Carbon React 1.115、Sass、既存Firebase workspace transaction、Playwright。

**Spec:** この計画の「確定仕様」と、ユーザーの2026-11-01の直近3メッセージ。過去計画の「利用／固定を別々に操作する」仕様は本計画で置き換える。`docs/design/ui-screen-matrix.md`と`react-typography-spacing.md`は調査範囲と既存契約の参照資料。

## 確定仕様

1. 通常の「同期完了」とその専用行を削除する。自動保存のたびの成功トーストも追加しない。未保存・通信失敗・復旧が必要な場合は、対象と必要な操作が分かる通知を残す。
2. スマホの画面端から本文までの余白は左右16pxを一回だけ確保する。タブと本文を共通の外枠に合わせる。デスクトップは既存の読みやすい最大幅を保つ。帳票/PDF用の余白は対象外。
3. system tabの表示名は「タブを編集」。既存URLの`view=tools`、内部ID`tools`は維持する。
4. 編集画面には全機能の一覧を置き、各行のチェックは一つだけ。見出し「表示するタブ」の下に機能名のチェックを並べ、checked＝タブに表示、unchecked＝タブから非表示。表示中の行だけ順番を変更できる。「利用する」と「タブに表示」の二段階操作、機能を開くボタン、保存・取消ボタンはなくす。
5. チェックや並び順の変更はその場で保存する。設定は企画全体で共有。非表示はデータ削除を意味せず、再表示で参加者・割当・精算・フォーム状態・登山下書きを復元する。少なくとも「タブを編集」は常時残る。
6. 旧`enabled:true,pinned:false`は表示チェックoffとして扱う。無操作で設定を書き換えない。利用者がその行を操作したときだけ両値をそろえる。従来の非固定ツール起動画面は編集画面に混在させない。
7. 非表示機能への既存リンクは、データを変更せず「タブを編集」の該当行を示す。自動で機能を表示設定に戻さない。新しい確認ダイアログや長文説明は加えない。
8. 文言だけでなく、見出し、冒頭説明、補足、必須・任意表示、入力例、件数、空状態、主操作、補助操作、保存、通知、戻る/閉じるの**有無・位置・発生条件**まで比較する。同じ目的と状態は同じルールにする。
9. 差をなくすために要素を一律追加しない。不要なものを削る方を先に検討する。業務上の差は理由付きで残す。実フォーム作成、集金の確定、PDF生成などの明示操作は、自動保存と同一扱いにしない。

## 現状の根拠・調査範囲

- `App.jsx:213–214`は`runtime.sync`のconnectedを「同期完了」としてタブ上に常時表示する。全メーカーの保存完了を示す値ではない。
- スマホ実画面でcontent grid幅378px、表示panel幅346px/x=16px、本文root幅314px/x=32px。`App.jsx`のGrid/Columnと`styles.scss`の`.app-tab-panel { padding:16px }`が重なる。
- `ProjectToolsWorkspace.jsx`の`ToolManager`はenabled/pinnedの二チェック、開く、上へ/下へ、保存/取消を表示する。draftを初回のsnapshotからのみ初期化する。
- 実画面で応募フォーム/登山計画書がタブに表示される一方、編集画面のチェックがoff、無操作でも保存が有効になる状態を確認した。遅延snapshotと初期draftの不一致がソース上の原因候補。Task 1で遅延ロードを再現して確定する。
- Form Makerは「企画名（必須）」等を表示し、Mountainは「任意以外必須」という冒頭説明を表示する。フォーム履歴には現在の企画以外の履歴と別企画へのリンクも現れる。
- 直近の新規ブラウザ確認は登山計画書・タブ設定・応募フォームの代表状態のみ。既存matrixの過去合格を今回の全画面調査済み扱いにしない。

## 公式の指針と本サイトの判断

Carbon MCP / carbon-builderで公式契約とインストール済みパッケージを照合してから変更する。[公式Notification指針](https://carbondesignsystem.com/building-blocks/core/components/notification/guidelines/#when-to-use)は、状態変化の通知と利用者へのfeedbackを重視しつつ通知を控えめに使うよう示している。正常時非表示・左右16px一回・単一チェック・日本語ラベルは本サイトの判断でありCarbonの強制規則ではない。

## Global Constraints

- 実装はユーザーから依頼済み。作業先と公開版を照合し、release instructionsに従って実装・検証・公開する。無関係な未追跡作業物は変更・追加しない。
- 実装時は各repoのAGENTSを読み、未コミット変更・作業artifactを保持する。既存worktree名・portを最新ソースの根拠にしない。
- sync/persistence、worker/queue、権限、フォームの送信契約、割当・精算計算、共有日付の自動反映、Mountainの下書き保存とPDFは保持する。不要な手動同期・日付反映・下書き管理操作を追加しない。
- schemaVersion 1とrevision付きtransactionを維持し、DBの一括書換えはしない。非表示操作で業務データを削除しない。
- 機能確認はall-tools架空サンプルまたはoffline/emulatorで行う。通常企画に書き込まない。本番smokeはP9A93LMQのみ。
- 各タスクの対象テストを先に実行し、最終候補で既存全matrixを一度実行。追加/再実行は新しい変更や失敗に必要なものに限る。テスト削除・skip・assertion緩和で失敗を隠さない。
- 同じ問題で20分以上進捗がなければ、原因と未完了範囲を報告して停止する。

## Review Focus

1. 読込前の仮snapshotやキャッシュが、利用者の操作として保存されないこと（Task 1）。
2. 連打・別端末の同時編集・通信失敗で設定が黙って巻き戻ったり、他人の順番を上書きしないこと（Task 1）。
3. タブの非表示と再表示、タブ遷移で未確定入力・自動保存下書きを失わないこと（Task 1/4）。
4. 同期の成功表示を消しても、実際の未保存・保存失敗を見落とさないこと（Task 2）。
5. 余白修正と文言削減で狭幅の操作対象や必須情報が失われず、PDFやstandalone側へ意図せず波及しないこと（Task 3/4）。

## Task 0: 全画面・全モーダルを「ある／ない」まで比較する

**Files:** 更新 `docs/design/ui-screen-matrix.md`、`ui-consistency.md`、`react-typography-spacing.md`。新しい重複した規約ファイルは作らない。

- [x] 企画一覧、作成/テンプレート、参加者、車割、班割、精算、タブ編集、応募フォーム、学務CSV、登山計画書の全stepと、既存modal inventoryにある全ダイアログ/メニューを列挙する。
- [x] 各画面・主要状態の要素有無、表示条件、コンテンツ余白を記録する。modal状態は既存inventoryを参照し、未確認と自動テストのみの証拠を手動合格と区別する。
- [x] 表示差とワークフロー差を根拠・owner・検証方法とともに整理し、業務上必要な違いを維持する。
- [x] 共通ルールを確定する：任意入力には「（任意）」、必須はrequired/validationと一貫させる。自明な「入力してください」は削除。共有先のメールアドレス、権限不足時の次の操作など意思決定に必要な説明は残す。primaryは同一操作領域で一つ。戻るは工程移動、閉じるはoverlay終了に使う。
- [x] 実在の全画面・modal inventoryの各行にownerと既存の状態別テストを割り当て、未到達や未確認を手動pass扱いしない。

**完了条件:** 共通化の単位が「単語」だけでなく要素の存在・配置・動作として定義され、Task 4の変更対象が漏れなく列挙されている。

## Task 1: 単一チェックの「タブを編集」と即時保存

**Files:** `apps/react/src/components/ProjectToolsWorkspace.jsx`、`src/App.jsx`、`src/services/project-workspace-actions.js`、`project-workspace.js`、必要なら`src/services/project-tab-editor.js`を追加。既存テスト `tests/project-workspace-actions.test.mjs`、`project-workspace.test.mjs`、`tests/browser/project-workspace.spec.js`、`project-navigation.spec.js`。

**Interfaces:** `setToolTabVisibility(workspace, toolId, visible)`は対象行のenabled/pinnedをvisibleにそろえ、表示なら未登録の末尾へ追加、非表示ならtabOrderから除外したworkspaceを返す。他行・業務データは変更しない。既存の`createWorkspaceSync().save(candidate, expectedRevision)`を利用する。

- [x] 遅延remote snapshotの再現ケースを追加する。loading中の編集を無効化し、readyになるとタブと同じ状態を表示、無操作ではsave呼び出し0回となることを確認する。
- [x] 登録名を「タブを編集」に変更。checkbox一つ、表示行の上へ/下へだけを残し、重複見出し・長文説明・開く・保存/取消を削除。ラベル、読み上げ、旧URL、ガイド、新規企画作成側の説明も照合する。
- [x] 保存は一件ずつ処理。保存中は設定操作を無効化し、短時間の保存で専用通知行を出さない。初期ロード・描画だけでは保存しない。
- [x] 競合時は既存transactionの拒否を維持し、競合と通信失敗は内容に応じたpersistent errorを表示する。通信失敗では保存済み状態を成功扱いしない。
- [ ] 旧のenabled/pinned各組合せ、全off、非表示のdeep link、表示中タブの非表示、順番の先頭/末尾を確認する。非表示後の遷移先は表示タブの既存初期選択、なければタブ編集。入力復元は既存tool状態の保持/復元機構で行う。
- [ ] 対象unitとworkspace/navigation browser specを実行。slow load、別端末更新、保存失敗、二重操作防止、非表示→再表示で全ツールのサンプル入力が維持されることを確認する。

**完了条件:** 二つのチェック状態を理解する必要がなく、設定値がタブと一致し、失敗・競合を隠さずデータを保持する。

## Task 2: 同期・保存feedbackの表示条件を統一

**Files:** Circle `src/App.jsx`、`src/styles.scss`、`tests/browser/shell.spec.js`。Task 0で差を確認したメーカーの通知ownerもTask 4で対応。

- [x] connectedの「同期完了」と専用行を描画しない。親の接続状況を各メーカーの保存成功として表示しない。
- [x] runtimeの通常/失敗表示を確認し、通常状態では行を作らず、永続エラーは既存表示に残す。
- [x] 自動保存の通常成功は静かにし、利用者の確定操作は必要な既存toastを保つ。保存できなかった状態は永続表示にする。
- [x] shell specと既存browser testsで通常status帯の不在、集金記録成功toast、フォームのローカルsample動作を確認する。

**完了条件:** 通常状態の不要な一行が消え、対象ごとの保存/作成状態を誤解させない。

## Task 3: 左右余白を一度だけ適用する

**Files:** Circle `src/App.jsx`、`src/styles.scss`、`src/styles/_ui-foundations.scss`、`tests/browser/visual-consistency.spec.js`。必要なembedded側だけTask 4のソースSCSSで対応。

- [x] Grid/Columnとpanelの重複gutterを解消し、対象コンテンツに一度だけ余白を適用。内部・popover/modal余白は維持する。
- [x] タブ外枠とパネル外枠をそろえ、メーカー側に二重gutterを加えない。
- [x] browser matrixでlight/dark・320/390/desktop・長い内容/横overflow・フォーカス系の既存確認を実行。PDF用`.doc-page`/印刷CSSへの変更は差分なし。

**完了条件:** スマホの利用幅を確保し、各機能で左端が不規則に変わらない。

## Task 4: 全ownerで表示要素・文言・操作のルールを適用

**Circle owners:** `ProjectEntry.jsx`、`Participants.jsx`、`RegistrationModal.jsx`、`ParticipantEditor.jsx`、`Allocation.jsx`、`Settlement.jsx`とその子コンポーネント、`ProjectTools.jsx`、`ProjectToolsWorkspace.jsx`、`AppHeader.jsx`。Task 0の表で差がないファイルは編集しない。

**Form Maker source reference:** `C:/Users/toshi/.codex/worktrees/inline-form-maker-workspace` の `packages/form-maker/src/FormMakerWorkspace.jsx`、`form-maker.scss`、履歴/job処理。実装時はこのcheckoutの未公開差分とmainを照合して作業先を決める。

**Mountain source reference:** `C:/Users/toshi/.codex/worktrees/mountain-draft-recovery` の `src/App.jsx`、`src/styles.scss`、`packages/mountain-plan/src/MountainPlanWorkspace.jsx`と`style.scss`。同様に現在のsource SHA/差分を照合する。古い通常checkoutにembedded packageがない場合がある。

- [ ] Task 0の全差分をownerで消化。見出しを一律追加しない。「基本情報」等の工程見出しは意味があるので保持。フォームの「フォーム作成」は「応募フォーム」に合わせ、企画連携を繰り返す冒頭文は削る。
- [ ] 必須・任意表記を実際のvalidationに合わせる。長い一般説明を消し、入力例/権限/共有先など必要な補足は項目の近くへ置く。単語を置換するために必須条件や実際の業務処理を変えない。
- [ ] Form Maker embeddedでは現在のroom/jobに確実に関連する結果だけを表示し、他企画の履歴一覧と別企画へ飛ぶ「企画ツールを開く」を表示しない。関連付けが確定できない履歴を名前の一致だけで結び付けない。standaloneの全履歴は維持。既存の予約job/不明状態の復旧・二重送信防止を壊さない。
- [ ] empty/未取得/取得失敗の表示を区別する。同じ状態で説明や再試行操作が出たり消えたりしないよう統一する。正常な空状態をエラー通知にしない。
- [ ] 全ダイアログの見出し、閉じる、主/補助操作、フッター、スクロール、戻る/取消とフォーカス復帰を表に沿って確認・修正する。学務CSVの権限要件やWindowsアプリとの境界は正確に表示する。
- [ ] Circle各画面specとsource makerの既存テストで、入力・validation・autosave/restore・job復旧・PDFの対象を確認。必要なsource packageだけversion更新・build/packし、Circleのvendor/依存/lockfileを一致させる。node_modulesや生成済minifiedコードを直接修正しない。

**完了条件:** 表の全行に修正済/理由付き維持/未確認が付く。機能上の差と意図しない不統一が区別でき、存在・配置・動作まで検証されている。

## Task 5: 最終確認・再発防止・実装後の公開

- [x] `ui-consistency.md`に目的・状態ごとの表示要素有無チェックを追記し、既存`apps/react/AGENTS.md`から参照する。
- [ ] 全ツールの架空データで全画面・modal inventoryの全到達可能状態を手動確認。自動テスト/代表状態の確認は記録するが未確認を手動pass扱いしない。実機・screen readerは未検証。
- [x] unitテスト182/182、全browser matrix532件中530件成功・2件skip・失敗0件を確認。初回のWebKitモバイルsample-flow timeoutは60秒へ修正し、全matrix再実行で通過。
- [x] 公開manifestを基準に`build:preview`と`check:preview`を実行し、サイドブラウザでlight/dark、各タブと代表modalを確認。サイドブラウザは今回viewport固定のためdesktop実画面手動確認は未実施。
- [ ] 実装の依頼を受けた後の通常公開はAGENTSどおり、source repoのPR/CI、Circle PR/CI/merge、mainの対象SHAのReadiness、既存React Production Release、root両ブラウザsmoke/P9A93LMQ cleanup/rollback artifactの順に進める。依存・workspace保存処理の変更はUI-only扱いを強制しない。
- [ ] 実装PRの計画書には「公開時に確認する項目」として記載し、実績SHA/run/cleanup結果は完了報告と既存の公開記録に記す。チェックを埋めるためだけの追加PR・再公開を繰り返さない。

## 実装順と終了条件

Task 0（有無まで調査）→ Task 1（タブ編集・初期状態不整合）→ Task 2（通知）→ Task 3（余白）→ Task 4（全画面・メーカー）→ Task 5（確認・公開）。

実装状況は各Taskのチェックと `docs/design/ui-screen-matrix.md` の差分表に記録する。完了は、差分表を消化し、保存・連携・計算・PDFの必要な検証と本番smoke/cleanupに成功した時点とする。未確認の手動状態は未確認のまま報告する。
