# 企画管理サイトへの統合・拡張 実装計画

> 実行記録: 2026-10-30、ユーザーの「すべて実行」によりPhase 0〜5を実装対象として開始。Phase 6は「将来対応」とユーザー確定事項（アカウント・非公開は後から）に従い、本依頼では実装しない。各Phaseは完了証拠が揃ったものだけチェックする。

> 進捗更新: Phase 0〜2、3（既存連携の回帰確認）、4、5はローカル実装・検証済み。Phase 3bもアプリ・ポータル・worker候補とEmulator/単体テストまで実装したが、対象roomへの新しいworker書込を本番有効化する最終確認は未実施のため、Phase 3bは未完了。Phase 6は合意どおり将来対応。検証値と残件は `.superpowers/sdd/2026-10-30-project-management-integration/progress.md` を参照。

**Goal:** 既存企画のID・データ・4画面を保ちながら、企画一覧、テンプレート、任意のツール構成とメーカー連携を追加する。

**Architecture:** 現在のReactアプリに一覧・作成・ツール管理の薄い層を追加し、既存4画面とruntimeを再利用する。共有するツール設定だけを既存roomとは別ノードへ保存する案を採る。外部アプリはまず既存の入口・連携を再利用し、同一企画への接続契約を確認できたものから拡張する。

**Tech Stack:** 現行React 19.2.8 / Vite 8.2.2 / Carbon React 1.115.0 / Firebase SDK 12.17.1 / Firebase Realtime Database / Playwright。初期段階でSQL DBや全アプリのmonorepo化は導入しない。

**Spec:** 2026-10-30の本チャット「サークル企画管理サイトの統合・拡張に向けた実装計画の策定」。優先順位は既存機能・データ保護、使いやすさ、任意性、自然な連携、拡張性、保守性、大改修回避。

## 確定仕様（ユーザー決定・2026-10-30追記）

以下の5点は選択待ちの事項ではなく、初期実装の前提とする。

| 決定 | 初期実装への反映 | 将来対応 |
|---|---|---|
| 企画一覧はブラウザ内の履歴 | 既存localStorage履歴を再利用。全room検索・アカウント必須化を行わない | アカウント連携による端末間共有 |
| 個人利用はテンプレート分類のみ | ツール構成の初期値だけを変える。非公開を意味する表示・保存属性を追加しない | 非公開設定と企画別アクセス制御 |
| 固定タブ設定は企画全体で共有 | enabled/pinned/tabOrderをworkspaceに保存し、同じ企画を開く利用者に同期する | 個人別の固定設定は今回の対象外 |
| 応募回答の扱いは現行のまま維持（追記で修正） | 応募者一覧から参加する人にチェックし、「参加者を確定／更新」で反映する既存UI・処理を再利用。登録済み参加者の情報同期も現行仕様を維持 | 項目別の差分確認画面・自動同期停止・連携方式の切替は今回追加しない |
| 学務書類はWindowsアプリを維持 | Web側は起動/ダウンロード案内と引き継ぎを担当する | Webでの書類生成は別計画 |

最後に見たツール・タブ列のスクロール位置は端末内の閲覧状態とし、共有する固定設定と区別する。未決定の詳細には本書の推奨初期値を使い、上記5点を再度選び直す前提にはしない。

**応募回答に関する訂正:** ユーザーが示した現在の参加者選択画面を維持する。前版で追加した「氏名・学年等の項目ごとの変更前後を選択する新画面」は、要望を広げたため撤回する。現行の参加者選択は参加する人を決める操作であり、登録済み参加者の属性変更をすべて手動承認する機能ではない。この違いを理由に既存同期を改修しない。

## 計画全体の再レビュー（2026-10-30）

一般的な統合案を既存仕様として扱っていた箇所を修正した。ユーザー確定の5点と元の要求は維持するが、実装手段・追加UIを既定事項として増やさない。

| 前版の問題 | コード上の根拠 | 修正後の方針 |
|---|---|---|
| 応募者選択から項目別差分承認へ拡張した | Participants.requestApply/apply、store.applySelection、applicant-syncは既に役割分担している | 既存画面・同期を維持。追加の差分UIなし |
| 旧clientが未知設定を必ず消すと断定した | canonical.migrateToCanonicalRoomはrawをspreadして保持。一方sync.ROOM_META_FIELDSにはmetaがなく、追加するだけでは普通のcommandで同期されない | 別ノードは必然ではなく同期所有範囲を小さくする設計判断。初期はツール設定だけを分離 |
| 日付等を新workspace.basicの正本へ移した | project-domain.projectName/sourceEventDateはapplicationSync優先、OverviewModalは既存の下書き/共有保存を持つ | 既存の参照優先順位・編集画面を維持。基本情報の再編は外部連携で必要になった範囲だけ |
| 新toolパラメーター・一時タブ・defaultToolIdを一緒に追加した | 現行viewルーティングとTabsで足りる | viewを拡張し、未固定toolはツールタブ内で開く。新しい一時タブ・初期画面設定UIは作らない |
| 全テンプレート作成後に精算へ進む案が、精算を外したcustomと矛盾する | templateで任意toolを選ぶ要件 | 精算があれば精算、なければ最初の固定tool、0個ならツール。旧room直リンクは従来互換 |
| 設定変更に独自outbox/常時競合再確認まで要求した | 既存room-sync自体が複雑で、設定編集は低頻度 | 設定は短い編集draftをまとめて保存。初期はoffline設定編集を追加せず、既存業務データの同期を再実装しない |
| 学務handoffを全企画で再利用可能と読める | ExportModal.blockedはapplicationSyncとruntime.handoffTokenを要求する | フォーム連携企画の既存CSVだけ確実に再利用。非連携企画はアプリ側の既存ファイル入力を案内 |
| 外部ツールを追加すればデータも共有済みになるような段取り | portalのcanonicalInputはtargetProjectIdを受け取らず、登山はclassic runtime、学務はローカルアプリ | ツールの追加と外部連携の成立を区別。未連携・連携済み・準備できない理由を正しく表示 |
| 一覧索引から消すだけで非表示にできるとした | portalHistory.readProjectIndexはroom cacheやlegacy履歴からも再構成する | 一覧から外す時はlocalの非表示ID集合を使い、業務データは削除しない |
| worker調査や将来認可を全体の開始条件にした | 一覧/既存4画面/タブ管理はworker改修から独立 | worker正本確認はフォーム接続の開始条件だけにする。初期版にアカウント・非公開を持ち込まない |

**境界:** ツールの独立性は「別ツールの使用を強制しない」という意味。内部の共通参加者データや、学務アプリが必要とする名簿・Office等まで不要になる意味ではない。UI上のツール取り外しは既存データ/連携の削除ではない。

## 調査条件・証拠の範囲

- 調査日: 2026-10-30 JST。コード・DBの変更、マイグレーション、フォーム作成、書類生成、公開は実施していない。本計画書だけを追加する。
- 調査checkout: `C:/Users/toshi/.codex/worktrees/site-copy-improvements/circle-kikaku-tools`、HEAD `d22c1d43c7a70959cc87798869d60daa8e9373a3`。取得済みorigin/mainと公開manifestは `bfe71a382deb8e4b5fb5ee091a3d2a0949e13cb1`。前者は後者にmergeされたPR headであり、実装開始時は最新mainから開始する。
- 公開manifestのassetDigest: `a7ec5be547d1e391daa0082785dc47fd561660fa8d7dabf97e5bb9b433fdd733`。
- 公開中の既存企画の参加者・車割・班割・精算をブラウザで閲覧。デスクトップと390px幅を確認し、390pxの班割でdocument scrollWidth=375px、innerWidth=390px。データ編集操作は実行していない。既存のローカルpreviewを公開版の証拠として流用していない。
- 関連repoのローカル調査: `C:/Users/toshi/Documents/GitHub/sanpokai-kikaku-portal` (fd4e83e)、`sanpokai-form-builder` (02c30f1)、`tozan-keikaku-syo-maker` (6514b22)。これらのローカルHEADと各本番配信物の一致は未検証。
- `sampokai-submission-builder` のローカルフォルダは.gitだけでHEADなし。GitHub APIからmainのREADME、`src/types.ts`、`src/lib/projects.ts`、`handoff.ts`、`handoffValidation.ts`、`projectEntry.ts`を読み取り調査した。配布済みWindowsアプリの動作は未検証。
- Firebaseはrepo内Rules・transport・worker連携コードを調査。ライブDB全件、実運用の所有者、Apps Scriptの現行デプロイ・trigger・受付状態・quotaは調査していない。過去のrelease記録を現状の稼働証拠にしない。

## A. 既存システムの分析

### A1. 構成・画面・ルーティング

| 実装箇所 | 確認した役割・再利用方針 |
|---|---|
| `apps/react/src/main.jsx` | 起動時に直ちにcreateRuntime/start。先に一覧ルートを判定する境界を追加する必要がある |
| `apps/react/src/runtime.js` | room単位のstore、sync、履歴、外部handoffを組み立てる。roomを切り替える時はdisposeして購読・timer・outboxを混線させない |
| `apps/react/src/services/url-compat.js` | prepareCompatibleUrlがroom未指定時にIDを生成。viewはparticipants/car/team/seisan、旧sheet/allocationも変換。handoff tokenを端末保存後URLから除去 |
| `apps/react/src/App.jsx` | 固定配列destinations、数値selectedIndex、changeViewのreplaceState。実際のブラウザ戻る/進むと動的tool IDを扱う設計に変更する |
| `components/Participants.jsx` | 手動追加・検索・選択・応募者確定、参加者発表・学務handoff。基本機能を移植せず再利用 |
| `components/Allocation.jsx` | type=car/teamで共用、定員・役割・移動・ランダム・固定。共通参加者IDを再利用 |
| `components/Settlement.jsx`、`SettlementSettingsModal.jsx` | 車費用・割勘/部費・集金・人数だけの精算。計算と保存を変更せず既存画面をホスト |
| `components/ProjectIdentity.jsx`、`AppHeader.jsx`、`ProjectTools.jsx` | 企画名・同期状態・関連ツール・履歴・概要・handoff。新シェルとの重複だけ整理する |

現在、トップURLは一覧ではなく新しいroomを用意して精算を開く。既存リンク `?room=ID` は精算へ直行する。別ポータルの `src/App.jsx` と `src/portalHistory.js` が企画履歴一覧を持つが、サークル全企画のDB検索ではない。

### A2. データと処理の流れ

- `rooms/{roomId}` がFirebase RTDB上の企画。SQLのテーブルは存在しない。
- `domain/generated/canonical.js` のCANONICAL_SCHEMA_VERSION=6。`participants/{participantId}` はname/memo/gender/grade/locked/flag/updatedAt。削除はparticipantTombstones、resetGenerationで古い書き込みの復活を防ぐ。
- `allocations/car|team` はgroupsとplacementsに分離。groupsのownerId/capacity/order等と、placementsのgroupId/kind/driver/order等が参加者を参照する。車割と班割は別配置である。
- settlementはcarsByParticipantId、paidByParticipantId等と名前fallbackを持つ。参加者名を変更してもID参照を保つ設計を維持する。参加者管理を外しただけでこれらを消してはいけない。
- `store/room-store.js` のcommand/publish/edit sessionと `sync/room-sync.js` が差分patch、transaction、競合merge、再送、reset世代を扱う。新しい企画設定を既存room rootへの全量setに混ぜない。
- `store/local-storage.js` は `sanpo-react:v1:<encodedRoomId>:`。room/base/outbox等を保存。企画一覧は `services/portal-history.js` の `sanpokai_portal_project_history_v1` と既存キーを利用する。
- `meta/applicationSync` は外部応募データの流れ。`sync/applicant-sync.js` が購読し、`applySelection`で確定参加者を選び、`syncApplicantDetails`が登録済み参加者の名前・学年・車出し情報を更新する。新しい応募者全員を自動確定する仕様ではない。
- フォーム回答変更により、現在は車出し不可への変更が車グループ削除・未割り当てへの移動を起こし得る。統合時にこの挙動を無検討で拡張しない。
- 企画名はroomName、日付・名称はapplicationSyncやoverview/draftにも存在。共通基本情報を作る時に、参照優先順位を統一する必要がある。

### A3. 認証・権限の実態

`sync/firebase-transport.js` は匿名Firebase認証。`firebase/database.rules.json` のroomsルールは、認証済みかつ形式に合うIDに対するread/writeを許可し、企画別owner/memberのACLを持たない。room IDを知っていることをサーバーがcapabilityとして検証する仕組みでもない。編集ロックのUIはDBのアクセス権と同一ではない。

したがって「個人利用テンプレート」を選んでも非公開になるわけではない。確定仕様に従い、初期版は既存の共有方式を明記して維持し、住所・緊急連絡先・全体名簿を共通roomへ追加しない。アカウント連携・非公開設定は将来フェーズとし、初期実装の開始条件にはしない。

### A4. 関連ツールの実態と統合上の注意

1. **ポータル:** React/Carbon。GitHub Pages同一originのlocalStorageから履歴を集約。履歴parserと表示パターンは再利用できるが、API認証・権限付き一覧にはなっていない。
2. **フォーム:** 現行ポータルに `src/features/form-maker/App.jsx`、`services/form-maker-session.js` がある。formMakerV1のjobs/admission/status、handoffTokenHashを使う。別repoのauto-sync.jsはgenerateManagedProjectId_でroomを発行しinitializeManagedProjectRoom_でroom rootをPUTする。既存企画への接続に流用すると上書き・二重企画の危険がある。現行workerの実体を確認してから別のattach-existing契約を追加する。
3. **登山計画書:** React shell + `src/LegacyRuntime.jsx` がapp-core/app-flow/app-view/app-shareを一つのclassic scopeとして実行。状態はuploads/metrics/itinerary等とDOMに分散し、contactsだけlocalStorage保存を確認。PDFはhtml2canvas/jsPDF、画像解析はCloudflare worker。安定したproject読み込み・保存APIは確認できず、React componentをimportするだけでは統合できない。
4. **学務書類:** Tauri 2/Rust/React/TypeScript、ローカル名簿照合、Windows Word/WPS COMによるDOCX/PDF生成。最新mainのProjectSnapshotはschema v3、organizer/leaderロールとローカル企画保存を持つ。`handoff.ts`は選択参加者のstudentId/nameだけを引き継ぐ意図。企画・登山情報をこのCSVへ勝手に追加せず、別のversion付き任意情報として設計する。

## B. 推奨アーキテクチャ

### B1. 既存roomと企画シェルを分離する

企画ID=既存roomIdとし、同じ企画の別IDを新設しない。初期の共有保存は `projectWorkspacesV1/{roomId}` のツール設定だけとする。既存room schema v6、参加者・配置・精算・企画情報の保存先は維持する。

別ノード採用は、既存canonicalが未知キーを必ず破棄するからではない。現行syncのROOM_META_FIELDSにmetaが含まれず、metaへ足すだけでは通常のcommandで新設定が同期されないため、既存syncへの改修を避けて設定の所有範囲を限定する判断である。room内に保存する方式も可能だが、patch生成と旧client/resetの互換変更を要する。Phase 0でこの比較を記録し、別ノードを無条件に安全とみなさない。

ツール管理画面ではdraftを編集し「設定を保存」でまとめてtransactionする。保存時はrevisionを比較し、競合時だけ最新値を読み直して利用者へ示す。初期版は設定用の独自outboxやoffline編集を作らない。通信不可時は取得済み設定でツールを利用できるが、設定保存は不可としてdraftを保つ。取得失敗を設定未作成とみなして上書きしない。既存roomのoffline保存/同期はそのまま維持する。

### B2. registry、template、企画設定の契約

新規ファイル案:

- `apps/react/src/project-workspace/tool-registry.js`: 安定ID、label、renderer/launcher、必要能力、入力契約version、単独利用可否。実行可能コードのURLをDBから受け取らない。
- `template-registry.js`: ID/version/label/toolIds/defaultPinnedIds。テンプレート追加は定義追加で行う。
- `workspace-schema.js`: normalize/validate/旧企画fallback。未知tool IDはデータを保持し、利用不可と表示する。
- `workspace-settings.js`: enabled/pinned/orderの検証、設定draft、cache、transaction。低頻度の設定保存に絞り、業務用store/sync/outboxを複製しない。
- `routing.js`: root一覧、create、room/tool、legacy view alias、popstate、未保存離脱を扱う。
- `ProjectList.jsx` / `ProjectCreate.jsx` / `ToolManager.jsx` と必要最小限のtool host。既存App/ProjectIdentity/OverviewModalを再利用し、ProjectShell等への分割は実際の複雑さに応じて行う。新しい基本情報画面を先に増やさない。

tool ID案: `participants`, `car`, `team`, `settlement`, `application-form`, `submission-documents`, `mountain-plan`。既存view値のseisanはsettlementへ対応付ける。内部IDの統一を理由に既存URLを変更しない。`tools`は削除不可のシステムタブでregistryの任意ツール数に含めない。

| テンプレートID | enabledと初期pinned（左から順） |
|---|---|
| personal@1 | participants, car, settlement |
| circle-mountain@1 | application-form, submission-documents, mountain-plan, participants, car, team, settlement |
| circle-event@1 | application-form, participants, car, team, settlement |
| custom@1 | 作成画面で選択した任意ツール。0個でもツール管理へ入れる |

テンプレートは作成時にsnapshotを展開するだけ。後日のtemplate定義変更を既存企画へ自動適用しない。作成後にテンプレートを再適用してデータを作り直す機能は初期版に入れない。

状態は**追加済み(enabled)、固定(pinned)、順序(tabOrder)、データ有無(hasData)**を別にする。hasDataは既存データから導出する。pinnedならenabledが必要。固定解除はenabledとデータに影響しない。取り外しはenabled/pinnedだけを変更し、再追加で同じデータを表示する。データ削除は取り外しに含めない。

### B3. 独立性とデータ連携

- 参加者ツールはフォームなしで使える。フォームは確定参加者なしで作成できる。
- 車割・班割で参加者データが必要な時は既存の参加者追加UIを再利用する。未固定ならツールタブ内の参加者画面を一時的な作業先として開き、共有の固定設定を勝手に変えない。未追加なら追加する操作を利用者に示す。別の参加者管理を車割/班割内に作らない。共通参加者データは内部依存として残す。
- 精算は既存の人数だけモードを維持。車割が非表示でも保存済み車情報は保持し、必要時は精算内で人数・車を設定する。タブの表示をstandalone.enabledだけで強制する現行App分岐をシェルから外すが、精算内部の計算モードは保つ。
- ツール取り外しは関連データ破棄・集金記録破棄・worker停止・既存フォーム連携の解除を意味しない。フォームを取り外す際は受付/回答取得/既存の登録済み参加者情報の同期は続く旨を説明する。ツールの表示設定だけを変え、再追加で現在の応募者一覧と選択UIへ戻れるようにする。連携停止そのものは別操作・別仕様として扱う。
- 応募者のresponseKeyとparticipantIdの対応を維持。氏名だけで同一人物を自動結合しない。追加・削除・同名回答・回答編集・再取り込みをidempotentにする。
- 応募回答は現行の「応募者を取得→参加する人をチェック→参加者を確定／更新」を維持。`Participants.jsx` の選び直し・既存確認処理と `room-store.js` のapplySelectionを再利用する。新しい応募者を全員自動確定しない。
- 登録済み参加者の氏名・学年・車出し情報は、現行のapplicant-sync/syncApplicantDetailsの挙動を維持する。参加者の選択確認と、属性情報の同期は別処理であることを設計上明記し、「すべての属性変更を差分承認する」とは案内しない。統合を理由とした同期停止・旧clientからの方式切替は追加しない。
- 既存企画の保存データ・responseKey→participantId対応・tombstone・配置/精算との既存連動を保持する。統合前後で同じ入力と操作の結果が一致することを確認する。外部ツールの新しいsnapshot取込や企画基本情報の競合確認は、応募者選択UIの改修とは分ける。
- roomName、applicationSyncのtitle/eventDate、overviewと端末下書きの既存役割・参照優先順位を維持する。新workspace.basicへの正本移動や案内文の出力変更を初期作業に含めない。外部連携で基本情報を渡す時にadapterで既存値を読み出す。
- 新しい書類連携契約が必要になった場合だけ、sourceProjectId/sourceRevision/exportedAt等を持つsnapshotを設計する。現行CSVへ未対応項目を追加しない。差分ビューや逆同期を最初から作る前提にしない。

## C. 画面と操作フロー

### C1. URLと初期表示

GitHub Pagesで直リンク404を避けるため、初期はquery routingを継続する。

- `/circle-kikaku-tools/`: 企画一覧。ここではroom生成・Firebase room購読を始めない。
- `?screen=create`: 作成画面。
- `?room=ID&view=car` 等: 既存viewを拡張する。新しいtoolパラメーターとの二重管理をしない。追加viewの文字列はregistryの固定mappingで定義する。
- `?room=ID` は精算が追加済みなら従来どおり精算、なければ最初の固定tool、固定0個ならtoolsへfallback。defaultToolIdの保存や選択UIは初期版に追加しない。旧roomで設定がなければ既存4toolを仮想設定するため旧リンクはそのまま精算へ進む。外したtoolへのリンクは「この企画では取り外されています」と追加操作を示す。
- room/tool/一覧の遷移はpushStateとpopstateに対応。古いURL正規化・無効値補正だけreplaceState。
- 追加済み・未固定toolは「ツール」タブ内で開き、上部にツール名と「ツール一覧へ」を表示する。選択タブは「ツール」のまま。URLで現在toolへ戻れるようにするが、一時タブや自動固定は追加しない。

### C2. 各画面

**企画一覧:** Header、見出し「企画」、主操作「新しい企画を作成」、検索、最近開いた順のContainedList。行には企画名・既存情報から分かる日付・最終閲覧日時・開く。全roomの一覧readは要求しない。初期版は「このブラウザの企画」と明示する。削除機能は必須ではない。設ける場合は「一覧から外す」とし、ローカルの非表示ID集合でcacheからの再出現を防ぐ。DB/cache/outboxは削除せず、URLから明示的に再訪した場合だけ非表示を解除する。非表示はこの一覧にだけ適用し、別ポータルにも効くとは表示しない。履歴なし・破損・storage不可を分ける。

**新規作成:** テンプレート選択と企画名を一画面にする。4選択肢、利用ツールの短い一覧、企画名入力、「企画を作成」。customはチェックリストを展開。複雑なwizardを作らない。初期推奨選択はpersonal。作成後はC1のfallback規則に従う。空フォームの作成を自動実行しない。name未入力は既存の「企画名未設定」を許す初期案とし、フォーム必須項目は既存フォーム画面で確認する。選択変更時に手修正したcustom構成を黙って破棄しない。

**企画詳細:** 別の概要ページを必須経路にせず、既存ProjectIdentity＋タブ＋各ツールを企画詳細とする。上部に「企画一覧へ」、企画名・同期状態を置く。既存の企画情報編集・4画面・モーダル・toastを再利用し、同じ情報の新しい編集画面を重複させない。

**ツール管理:** 常設「ツール」タブ内で「追加済み」「追加できるツール」を表示。追加済み行は開く、タブに固定/解除、順序を上/下へ、取り外す。追加すると使用可能になり、固定は別操作。テンプレート適用時だけ指定toolを全て初期固定する。取り外し時は「データは残ります」、既存データの有無、同期の扱いを示す。現在表示中を取り外したらtoolsへ移動し、フォーカスを移す。順序変更はボタンで完結し、ドラッグは任意の後続改善とする。

**外部ツール画面:** 初期は企画名と必要な操作だけの入口とする。既存フォームの入口、登山計画書へのリンク、Windowsアプリのダウンロード案内、利用可能な場合の既存CSVを提示する。tool追加だけではフォームや書類を作成しない。「未連携/連携済み/利用条件不足」は確認できた状態だけ表示する。共通情報を渡せない段階で「この企画を引き継いで開く」と表示しない。アプリ起動protocolが未確認なら「アプリで開く」ボタンを約束しない。

### C3. モバイルとCarbon

Carbon公式のTabs指針は水平スクロールを許容する。参照: https://carbondesignsystem.com/building-blocks/core/components/tabs/guidelines/#overflow-content 。「固定数無制限」「ツール管理」「常設ツールの末尾固定」は本サイトの設計判断であり公式の必須仕様ではない。

- 390px/320pxで固定タブは横スクロール、2段折返し・無理な文字縮小はしない。上限はアプリで設けない。
- 現行AppのTabListはfullWidthを使う。7tool以上への拡張時は均等縮小をそのまま適用せず、内容に必要なタブ幅とスクロールを確保する。インストール済みTabsの実装を確認して、既存4tabの見た目への影響を限定する。
- 「ツール」はタブ列の末尾で常に視認できる配置を目標とする。単一tablistの末尾stickyとCarbonスクロール操作が共存するか、インストール済みTabListの実DOM/propsで先に試作・確認する。未検証のpropを計画で確定しない。
- スワイプ、Carbonのスクロール操作、矢印/Home/End、Tabフォーカスを両立。active tabを可視領域へ収め、順序変更後もtool IDでフォーカスを保持。
- ツール行のメニューは44px程度の操作領域を確保。順序は「上へ/下へ」でキーボード・タッチ両方に対応。status変更は読み上げ通知。
- 未保存モーダルやdraftをタブ再構成で消さない。別利用者が現在のtoolを取り外した場合は編集中draftを保持して通知し、キャンセル/保存/閉じるの後にツール一覧へ戻す。強制unmountしない。現行Tabsのmount挙動を確認し、必要な範囲だけ保持する。全toolのkeep-aliveや新しいdraft基盤を先に作らない。
- ライト/ダーク、長い企画名、全tool固定、tool追加後のoverflow、ソフトキーボード、200%ズーム、実機Safari/VoiceOverを実装時の確認対象にする。

## D. データベース設計と移行

### D1. RTDBの追加ノード案（物理テーブルの追加ではない）

| パス | フィールド・参照・制約 |
|---|---|
| `rooms/{roomId}` | 既存v6を保持。participants/allocations/settlementのID・計算・tombstoneを変更しない |
| `projectWorkspacesV1/{roomId}` | schemaVersion=1, template{id,version}, tools/{toolId}{enabled,pinned}, tabOrder（重複なし配列）, revision, createdAt, updatedAt。基本情報の複製やdefaultToolIdは初期不要。tool IDは許可list、pinned⊆enabled、orderは固定toolの順列。toolsはシステムtabで保存対象外 |
| 外部連携の参照（保存先は連携フェーズで決定） | まずapplicationSyncと既存form履歴を調査し再利用。追加属性が必要になった時だけprojectToolLinks等を検討。全tool分の新ノードを先に作らず、token・名簿を一般共有設定へ置かない |
| ローカル `sanpo-workspace:v1:{roomId}:...` | 最後に取得した設定cache・未保存draft等。独自outboxは作らない。取得失敗と未作成を区別 |
| ローカル既存portal history | roomIdをキーとしてmerge。新しい全件room scanや全データコピーはしない |
| 将来 `userProjectIndexV1/{uid}/{roomId}` | 端末横断一覧が必要な時だけ。lastOpenedAt等。登録しただけではroomアクセス権を付与しない |
| 将来 `projectMembersV1/{roomId}/{uid}` | owner/editor/viewer。rooms/workspace/links全てのRulesとworker権限を同時に整備した後だけ認可に使用 |

初期workspaceもrootデフォルトdenyのため明示Rulesが必要。room存在確認と設定schema/revisionを検証し、roomId形式が合うだけの設定孤立ノードを作らない。初期の共同編集範囲は現行roomと同じ匿名認証ベースとし、企画別ACLが追加されたと誤認させない。ルール上の上限はtool数のUI制限ではなく、許可registry ID・文字列長・payloadサイズで制約する。ツール設定ノードからworkerの権限やhandoff capabilityを発行しない。

**認可を強化する場合:** ownerUIDを最初にURLを開いた人から自動推定しない。旧企画の所有権は証明不能なためlegacy accessを維持し、本人による明示的移管を別設計する。匿名UIDの消失・端末変更を考慮し、永続アカウントへのlinkと招待方式、workerの専用service権限を設計する。新しいindexやmembersだけを作って既存roomsの広いwrite権限を残したまま「非公開」と表示しない。

### D2. 既存企画の非破壊移行

1. workspaceが無い既存roomは、読み取り時の仮想設定で既存4toolをenabled/pinned、従来順にする。初回閲覧でDB一括書換えをしない。
2. 正常にworkspaceの未作成を確認できた時だけ、利用者の設定保存でcreate-if-absent transaction。timeout/permission deniedを未作成と見なさない。
3. フォーム連携企画はapplicationSyncからリンク候補を提示。既存トークンを別ノードへ移さない。日付/名称競合は手動採用。
4. 作成は生成したroomIDを保持し再試行可能にする。新規roomはcreate-if-absentで予約し、既存IDとの衝突を検出する。room作成済み・workspace失敗なら未完了を修復して同じ企画へ戻る。既存room rootをPUTし直さない。最初に確保したroomは未完了状態でも履歴/再開導線に残し、空の別企画を生成し直さない。設定保存完了後に作成完了と表示する。
5. workspaceの消失/未対応clientでもroomは開ける。feature flagを戻せば旧4タブUIへ戻せる。rollbackで新データを削除しない。
6. 旧clientのroom編集、フォームworkerの更新、新clientのworkspace編集を同時に行い、双方の更新が消えないことを検証する。未知field保持とsync ownershipは契約テストで固定。

## E. ツール統合方式の比較と採用

| 方式 | 既存資産/保守 | 初期コスト | 整合性・拡張性 | 判断 |
|---|---|---|---|---|
| 全機能を単一アプリへ即移植 | 既存classic DOM/COMを作り直す範囲大 | 大 | 完成後は揃うが移行中の二重実装が大きい | 初期不採用 |
| 別アプリ維持＋共通企画ID/契約 | 既存機能を最大限利用、アダプター保守 | 小〜中 | version付きsnapshot、差分取込で管理可能 | 初期推奨 |
| 共通component/library化 | parser/DTOは有効、業務store丸ごと共有は結合大 | 中 | 安定した契約を抽出後に有効 | 後続で必要部分だけ |
| ツールごと段階的画面統合 | 作業単位を小さく戻せる | 中 | 同じtool IDを保ちlauncherからembeddedへ差替え可能 | 推奨ロードマップ |

**参加者/車割/班割/精算:** 同repo既存componentをToolHostに接続。domain/generatedを手編集しない。必要なshared変更は `assets/js/core/entity-state-v5.js` 等の抽出元と `tools/extract-domain.mjs` に従う。

**フォーム:** 構成管理と、同じ企画への実接続を別の完了条件にする。既存ポータルのcanonicalInputはtargetProjectIdを受け取らないため、URLにroomを足すだけで同一企画接続できるとは扱わない。現行worker正本を確認して、新契約をjob入力・hash・Rules・worker・結果検証へ一貫して追加し、既存roomのroot初期化PUTを禁止する。現行roomsには企画別owner権限がないので「所有者確認済み」とは扱わない。job利用者、対象room、フォーム生成結果、handoff capabilityをどう結びつけるかをこのフェーズの契約に明記し、他企画の権限トークンや非公開回答を取得可能にしない。対象roomを変えて再試行しても結果/権限が流用されないことを検証する。

既存フォームを任意の企画へ後付けする汎用機能は初期必須にしない。まず、従来フォームが作った既存roomをそのまま開く経路を維持し、新しく管理サイトで作ったroomへ新規フォームを接続する経路を完成させる。未対応期間に新規フォーム作成を案内する場合は、別企画を作る現行動作を明記し、統合済みと表示しない。

**登山計画書:** 初期launcher→明示的なsnapshot読込/書出し→DOM非依存のimport/export adapter→必要なら画面統合。Classic runtimeのnew Functionとglobal stateをそのまま共通アプリに読み込まない。画像/OCR/PDF処理を全ユーザーの初回bundleへ含めない。大きな画像をRTDBへbase64保存しない。画像の長期保存はlocal IndexedDBまたは認可済みobject storageを別検討。既存workerへの送信項目・CORS・課金/サイズ制限を維持。

**学務書類:** Windowsアプリと既存handoffを維持する。ExportModalはapplicationSyncとruntime.handoffTokenを要求するため、単なる共有リンクを開いた端末やフォーム未連携企画で同じCSVが必ず作れるわけではない。フォーム連携かつcapabilityを持つ端末では既存の作成操作を再利用し、条件不足は現在の理由を表示する。Windowsアプリには元々の回答ファイル入力/名簿照合の経路があるため、フォーム未連携でもその経路で独立利用できる。

追加の名前だけCSVや企画情報JSONは、既存import契約で必要性・対応を確認してから別タスク化する。初期版にローカルUUIDとのmapping DB、snapshot差分画面、Webからの自動起動を一式追加しない。個人情報とCOM生成はローカル所有を維持する。

## F. 段階的な実装手順

各フェーズは独立したPRとする。未承認の後続フェーズを先取りしない。実装時は現在のAGENTSに従い、shared/schema/Firebase変更は互換check、正確なmain SHAのRelease / Readiness、既存React Production Release、専用smoke room P9A93LMQのcleanupを必須とする。変更のrollbackは成功済みartifactで行い、DB破棄で戻さない。

### Phase 0 — 契約と保護範囲の確定

- [x] 目的: 二重企画・誤った所有権・worker上書きを実装前に防ぐ。
- 対象: 現行4repo、学務GitHub main、`docs/development/current-workspace.md`、新integration契約文書。
- 作業: 最新main/公開SHAの関係、4画面の既存挙動、一覧parser、共有設定の保存先比較、設定保存競合、人数だけモードとツールtabの共存を確認する。小さいサンプルでタブ構成を検討し、既存store/domainに触れず実現する境界を記録する。フォームworkerの実デプロイ調査は外部連携フェーズの着手条件として分離する。
- 完了条件: 5つの確定仕様、応募回答維持、取り外しの意味、設定保存先/復旧、直リンク/人数だけモードの方針に実装者が使える契約がある。個人データを含まないfixtureがある。
- テスト: 読取調査・契約レビュー。現行不具合を仕様変更で隠さずbaselineに記録。
- リスク: unrelatedなworker調査・将来認可で一覧/タブ実装まで止めない。worker正本が不明なら同一企画フォーム接続だけを保留する。

### Phase 1 — 一覧と新規作成（既存4画面を保つ入口）

- [x] 対象: `main.jsx`、`runtime.js`、`services/url-compat.js`、`services/portal-history.js`、新routing/ProjectList/ProjectCreate/template-registry。
- 作業: roomなし=ブラウザ内履歴一覧、createのみでID発行。ポータル履歴parserの必要範囲を移植し旧namespaceを維持。4templateの構成選択と企画名を同一画面にする。旧room直リンク/旧viewは維持。個人利用は構成分類として扱い、非公開機能やアカウント登録は追加しない。
- 完了条件: 一覧→作成→企画、一覧→既存企画の両経路が動き、既存企画でtemplate再選択を要求しない。作成二度押し・再読込で重複しない。
- 公開境界: 一覧だけは単独公開可能。テンプレート選択を伴う作成はPhase 2の設定保存・表示と合わせて有効化する。選べても構成が反映されない中間状態は公開しない。
- テスト: URLなしでroom生成なし、旧sheet/allocation/handoff、storage不可/破損、戻る進む、二重送信/部分保存。既存url-compat/portal-history/runtime suiteと新project-entry browser test。
- 影響/リスク: 起動境界の変更で旧リンクを壊し得る。feature flagで従来起動へ戻せるようにする。

### Phase 2 — workspace保存・動的タブ・ツール管理

- [x] 対象: tool-registry/template-registry/workspace-settings、ToolManagerと必要なtool host、App.jsx、styles.scss、firebase/database.rules.json。
- 作業: ツール設定だけのsidecar、仮想legacy fallback、enabled/pinned/orderの分離、追加/解除/取り外し/再追加、保存/キャンセル、現在toolのfallback、未保存draft保護。tool設定は企画全体で共有し、最後に見たtoolとタブscroll位置は端末localに分離する。外部3toolは実装済みの入口/案内を提供し、連携済みと偽らない。
- 完了条件: 7tool固定とさらにregistryを増やしたfixtureでも上限なし、ツールtab常設、参加者/車割を外しても精算と保存データが動く。取り外し/復帰でID・費用・集金記録が一致。
- テスト: workspace normalize/constraints、RTDB emulator Rules、2ブラウザ間の追加/固定/解除/順序変更の同期、同時保存競合、通信失敗時のdraft保持と再保存、旧client同時編集、320/390/1280px・両テーマ・keyboard。既存roomのoffline再送は回帰対象。閲覧位置を他端末へ強制反映せず、人数だけ精算中でもtoolsへアクセス可能。編集中のtoolが他端末で外されてもdraftを失わない。
- 影響/リスク: 数値selectedIndexの取り違え、非固定toolの直リンク、旧resetによる設定消失。ID選択と別ノード所有で防ぐ。

### Phase 3 — 既存データ連携の再利用

- [x] 対象: runtimeのtool host接続、既存Participants/Allocation/Settlement/ProjectTools、portal form-maker UI/sessionと実workerの契約。project-domain/applicant-sync/storeは既存仕様を原則維持する。
- 作業: 応募者一覧・選び直し・確定/更新・情報同期・handoffを新シェル上でも同じ条件で利用できることを確認する。新しい基本情報storeを作らず、必要な外部入力初期値だけadapterで既存値から読む。フォームの同一企画接続は次の詳細タスクとして扱い、worker調査に入る前でも既存連携の再利用確認は完了できる。
- 完了条件: フォームなし参加者、車割なし精算、参加者tab非表示でも共通参加者を扱える。登録済みデータをtool取り外しで消さない。応募者の追加/選び直し/確定/更新と登録済み参加者の同期結果が統合前と一致する。
- テスト: 同名、改名、応募取消、車出し変更、削除tombstone、確定後追加、既存集金と配置への連動、選び直し/キャンセル、回答更新/他端末編集、handoff capabilityあり/なし。新しい挙動を期待値にせず、現行仕様の回帰確認とする。
- 影響/リスク: 共通domain変更はlegacy/計算にも影響。抽出元のprovenance確認とshared互換checkが必要。

### Phase 3b — フォームの既存企画接続（Phase 3内の独立PR）

- [ ] 対象: circle側launcher/integration adapter、portalのform-maker UI/session、実際のworker owner、formMakerV1 Rules/入力hash/workerテスト。
- 作業: 実デプロイworkerの正本と入力契約を確認し、targetProjectIdを持つ新規フォーム作成契約、対象roomとjob/capabilityの結び付け、既存room rootの非上書き、二重実行防止、partial/unknown復旧、既存応募者一覧への接続を追加する。汎用的な既存フォーム付け替えは対象外。
- 完了条件: サイトで作成済みの同じroomにフォームが付き、参加者/費用を保ったまま回答が届く。応募者から参加する人を選び、確定/更新する現行UIと登録済み参加者の同期が動く。単体フォーム作成も従来どおり動く。
- テスト: stub→emulator→専用検証フォームの実連携。無権限room拒否、worker中断/応答消失、再試行、重複回答、取り外し中の回答、再接続、quota/trigger遅延表示。通常企画で試験しない。
- 影響/リスク: root PUT、admission枠、Apps Script quota、workerとclientのversion差。既存contractを置き換えず新versionを並存させる。

**現在地:** React/portal/Apps Script workerの候補コード、Rules、単体テスト、Emulator契約テストは揃った。workerの既存room書込みを実サービスで有効化する変更であるため、デプロイ・本番フォーム作成・既存企画への書込みを行う前に、対象アカウントとデータ影響を示して利用者の最終確認を得る。承認前はPhase 3bを完了扱いにしない。

### Phase 4 — 学務書類の既存Windows経路を企画から利用

- [x] 対象: submission-documentsの入口、既存ProjectTools.ExportModal、Windowsアプリの既存import契約確認。
- 作業: 既存CSV作成を新タブから利用できるようにし、capability不足/フォーム未連携/非Windowsを正しく案内。企画名・日付の追加引き継ぎはWindows側の対応を確認してから、既存CSVとは別の小タスクとして計画する。
- 完了条件: 現在CSVを作れる条件では同じCSVを作れ、条件不足を隠さず案内する。Windowsアプリ単体の既存ファイル入力/名簿照合/生成は維持。Webで生成できるとは表示しない。
- テスト: フォーム連携/非連携、tokenあり/なし、重複氏名、手動追加参加者、スマホの案内、既存CSV import。Windows側を変更した場合のみ、該当Word/WPS生成・旧ファイル互換を検証する。
- 影響/リスク: capabilityは通常の共有リンクには入らない。企画を開けることとCSV生成権限があることを混同しない。

### Phase 5 — 登山計画書の必要なデータ引き継ぎ

- [x] 対象: mountain-plan入口、登山メーカーのimport/export境界。解析/画像/PDF生成の既存処理は維持。
- 作業: まず既存アプリへの入口を提供し、次に企画名・日付・参加者等、実際に入力へ使う最小項目を確定する。既存手入力を上書きせず、利用者が読み込むadapterを追加する。安定した保存APIが無い部分は調査対象とし、画像のcloud保存や全画面移植を同時に始めない。
- 完了条件: 元の登山メーカーを単体利用でき、新しい引き継ぎは対応済み項目だけに適用される。企画との関連付け方法と、未保存内容を残して戻る操作が説明できる。
- テスト: 契約version、欠損/不正データ、企画変更、既存編集の保持、OCR/画像/PDF/Safari共有の影響範囲。
- 影響/リスク: classic global runtimeはそのまま共通Appへ読み込まない。必要なadapterより先に共通library/大きな再実装を作らない。

### Phase 6 — 将来対応：アカウント連携・非公開設定・追加の画面統合

- [ ] 対象: auth/session、userProjectIndex、projectMembers、全関連Rules、worker authorization、migration/import、必要な共通DTO library。
- 作業: 永続アカウント/匿名link、owner/editor/viewerと招待、旧企画の明示移管、index更新の整合性、権限取消。安定後、登山などtool単位で画面を同一shellへ移す。
- 完了条件: 別端末で認可済み企画だけ一覧表示、index登録で権限昇格不可、取消後の旧outbox拒否、旧リンクへの説明/復旧がある。owner不明の旧企画を勝手に所有しない。
- テスト: 全role/非member/匿名のRules matrix、招待再利用/失効、offline取消、複数アカウント、worker権限、旧client互換、アカウント復旧。UI統合は既存出力golden fixtureも確認。
- 影響/リスク: 最大の互換変更。確定仕様に従い初期版から分離し、前倒ししない。アカウント連携と非公開化は別の機能として設計し、一覧同期の導入だけで既存企画を自動非公開化・自動移管しない。

## G. 残る詳細事項・推奨初期値

一覧の端末間共有、個人利用の非公開、固定タブ共有、応募回答の現行挙動維持、Windows生成の5点は冒頭の確定仕様へ移した。以下だけを残る詳細として扱う。

| 事項 | 推奨案 | 代替・実装への影響 |
|---|---|---|
| 作成直後の画面 | 精算があれば精算、なければ最初の固定tool、0個ならツール | 初期画面の設定UIは追加しない。自動フォーム生成はしない |
| 企画基本情報の初期値 | 取得可能な企画名・開催日を候補にし、既存値との競合時だけ採用値を確認 | 項目追加はフォームとの対応を調査してから。応募者選択/属性同期の改修は今回行わない |
| 取り外し中のフォーム | 外部受付と既存情報同期を維持。ツールの取り外しは連携解除ではないと説明 | 連携自体を停止する機能が必要なら別途設計する |
| 複数フォーム/複数書類 | 新規接続は初期1企画1フォーム。書類の保存/版は既存アプリの仕組みを維持 | 複数募集回や新しいsnapshot保存が必要な時だけsource namespace等を追加 |
| Windowsアプリへの渡し方 | 既存handoffファイルとダウンロード/アプリ案内 | 自動起動は配布済みアプリの対応protocolを確認できてから追加 |
| 登山画像の保存 | 初期は登山メーカーの現行処理を維持。新しいdraft保存をできる前提にしない | 保存/復元が必要と確認されたら端末内保存を検討。端末横断は別途認可/容量等の設計が必要 |
| 現行workerの正本 | 実デプロイ元を調査し特定してから接続契約を追加 | 特定前はlauncher/既存ファイル連携までに留め、二重企画を生成しない |

## レビュー重点・実装開始前の判定

- [ ] rootアクセスでroomが勝手に作られない。旧直リンクでtemplate選択を要求しない。
- [ ] 取り外し/固定解除/再追加/旧client編集で参加者・配置・費用・集金・tokenが失われない。
- [ ] 未固定toolの直リンク、最後の固定tool削除、全tool未選択、未知tool ID、template追加後も安全に開ける。
- [ ] 同時作成・同時設定保存・既存roomのoffline再送/resetで古いデータを復活させない。将来認可の権限取消テストは初期版の完了条件に混ぜない。
- [ ] existing-room接続でworkerがrootを初期化しない。応募者からの参加者選択・確定/更新と属性同期の既存挙動を保つ。
- [ ] 項目別差分確認UI・既存自動同期の停止・旧連携の方式切替を追加していない。選び直し/更新の操作と既存確認処理が再利用されている。
- [ ] 固定状態とタブ順は同じ企画の2ブラウザで一致する。一覧履歴と閲覧位置はブラウザ内に留まり、個人利用を非公開と表示しない。
- [ ] 同名参加者と既存handoffを誤結合しない。外部project UUID/snapshotの新連携を実装する場合だけ、その契約の検証を追加する。
- [ ] スクロールtabs/常設tools/未固定toolの表示/keyboard/focusが両ブラウザ・狭幅で成立。

### 公開単位と「統合」の完成度

- **構成管理版（Phase 1・2＋3の回帰確認）:** 一覧・テンプレート・共有する固定タブ・ツール管理と既存4画面が動く。外部ツールの入口は用意するが、未連携部分はその旨を表示する。この段階を「すべてのツールが共通データで連携済み」と呼ばない。
- **連携拡張版（Phase 3b・4・5）:** 同一roomへの新規フォーム接続、権限がある既存handoff、必要な登山情報の引き継ぎを順次完成させる。Windows単体利用を維持する。
- **将来版（Phase 6）:** アカウント連携・非公開・必要な画面統合。初期版のために先取りしない。

**実装順序:** Phase 0で既存仕様と最小追加範囲を確認→1・2で一覧/テンプレート/共有タブ→3で既存連携の再利用を確認→3bでフォームの同一企画接続→4で既存Windows経路を整理→5で必要な登山情報の引き継ぎ。4の既存CSV案内は3bの完了を待たず進められる。確定した5点を再確認することを実装開始条件にしない。Phase 6は本依頼の確定仕様に反する先取りを避け、別途明示された場合に着手する。

### 実行結果（2026-10-30・継続）

- Phase 1/2: browser-local企画一覧、同一画面の名前・テンプレート選択、共有workspace設定、任意ツール管理、常設Toolsタブを実装。既存room直リンクと人数だけ精算を維持。
- Phase 3: 応募者の選び直し・既存参加者フローを回帰確認。応募回答差分適用UIや既存同期方式の変更は追加していない。
- Phase 3b: ローカル候補は実装。Reactで一回限りのroom-link予約を取り、portalがprotocol v2 jobを作成、workerが既存roomと予約の一致を検証してETag付きで`meta/applicationSync`のみを書き込む。room rootの初期化・全体上書き、参加者・割当・費用・精算のコピーはしない。実workerのアカウント／正本はユーザーが示したブラウザーで確認。実サービスへのdeploy・実フォーム・専用roomでのend-to-end smokeはデプロイ時の明示確認待ちで未実施。
- Phase 4: 既存の権限付きWindows提出書類経路と条件不足時の案内を企画ツール入口から再利用。Windowsアプリと生成処理の変更なし。
- Phase 5: 許可を得た分離worktree `codex/mountain-project-import` で登山メーカーの取込UIを追加。渡す値はroom ID・企画名・開催日だけとし、参加者情報は渡さない。開催日は利用者が適用を選び、既入力欄は上書きしない。
- 検証（前回分）: React unit 164/164、Firebase emulator 4/4、React browser 486 passed・2 skipped (488 total)。登山メーカー unit 10/10、build成功、既存を含むE2E 42/42。React preview buildとorigin照合が成功。サイドブラウザで企画作成・精算開始・Tools管理を実操作確認。
- Phase 3b候補: React側の一回限りroom-link予約、portal側protocol v2 job、worker側の既存room検証・ETag付き`applicationSync`のみの書込みを追加。応募フォーム応募者の取込項目は既存allowlist（氏名・学年・車出し可否・同乗定員）を維持し、参加者・精算等のroom rootデータは変更しない。React unit 166/166、RTDB Emulator 6/6、worker 96/96、portal history/session 33/33とApps Script history bridge smoke。修正後React browser full: 486 passed, 2 skipped (488 total、Chromium/WebKit desktop/mobile)。Portal build/browser smoke passed. Mountain unit 10/10, build passed, E2E 42/42 with one worker after Vite's first optimization cache was warm. React preview built from the current dirty source and verified against baseline SHA `bfe71a382deb8e4b5fb5ee091a3d2a0949e13cb1`; the side browser was opened to the new-project screen and its project-name field, four template choices, default tools, and create action were manually checked. No project was created in this manual review.
- 未完了: Phase 3bの本番デプロイ・専用検証フォームによるエンドツーエンド・本番room smoke。workerが既存roomへ書込みを行う新しい契約を含むため、利用者のデプロイ時確認を得るまで実行しない。Phase 6は確定仕様により将来対応。未完了をもって統合全体の完成・本番公開とは扱わない。
