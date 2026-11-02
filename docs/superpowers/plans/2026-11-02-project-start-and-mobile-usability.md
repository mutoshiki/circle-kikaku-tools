# 企画開始・状態別導線・モバイル操作性の改善実装計画

> 実装時は `superpowers:executing-plans` で必要な作業を進める。不要な並列エージェント・反復検証は追加しない。本書の作成時点ではアプリコードを変更しない。

**Goal:** 企画を開いた直後から、その企画の状態と利用者の目的に合った操作へ進めるようにし、モバイルのタブ・入力欄・空状態を整える。

**Architecture:** 現行の企画workspace、参加者登録モーダル、フォームメーカーpackageを再利用する。開始画面の判断を純粋関数へ集約し、端末別の最終表示履歴と企画共有のタブ設定を分離する。データ構造やworkerを大きく変更しない。

**Tech Stack:** React 19 / `@carbon/react` 1.115.0 / Vite / Firebase RTDB / 組込フォームメーカー1.0.10 / Playwright Chromium・WebKit。

**Spec:** 本会話の写真1〜5に対する改善案と「初回は応募フォームがあれば応募フォーム、なければ参加者。ただしこの問題だけに偏らず検討する」という依頼。今回は計画策定のみ。

## 1. 調査結果と対象範囲

調査日は2026-11-02。添付画像と現行コードを照合した。iPhone実機のタップ・日付pickerは未確認で、入力不能とは断定しない。

| 確認した問題 | 根拠となる実装 | 方針 |
|---|---|---|
| 初期表示の判定が複数箇所にあり、精算優先も存在する | `services/project-workspace.js: resolveInitialTool`、`project-workspace-routing.js: resolveWorkspaceSelection`、`App.jsx: initialToolFromLocation`、`url-compat.js: prepareCompatibleUrl` | 新規・再訪・明示リンクを区別して共通化 |
| 新規作成はviewを付けるが、一覧からの既存企画リンクにはviewがない | `components/ProjectEntry.jsx: createProject / openProject / projectUrl` | 作成時の意図と再訪履歴を明示的に解決 |
| 参加者なしの案内は、フォームの表示有無を考慮しない | `components/Participants.jsx: initialEmpty` | 未作成フォームと手入力の選択肢を状態に合わせる |
| 非表示の参加者タブへの操作がタブ編集へ回り得る | `App.jsx: openParticipantRegistration`、`project-workspace-routing.js: resolveWorkspaceSelection` | 登録操作をタブ表示設定から独立させる |
| 精算の空状態でも参加者登録が主操作 | `components/Settlement.jsx`、`InitialEmptyState.jsx` | 人数だけの精算を主操作へ |
| ヘッダーとフォームに異なる仮の企画名が出る | `AppHeader.jsx`、`services/form-maker-workspace.js`、`application-form-link.js` | 共有企画名を正とし、未入力を架空名で埋めない |
| タブ端でラベルが切れ、フォームの日付欄が空白に見える | 写真1・3〜5、`styles.scss: .project-tool-tabs`、フォームpackageの`TextInput type=date` | 選択タブの可視性、日付欄の識別、本文の左右位置を調整 |

フォームメーカーの調査対象sourceは `C:/Users/toshi/.codex/worktrees/inline-form-maker-workspace/packages/form-maker/src/FormMakerWorkspace.jsx`、`form-maker.scss`、`index.d.ts`。ホストが利用しているのは `apps/react/vendor/sanpokai-form-maker-workspace-1.0.10.tgz`。実装開始時にsourceの版とpacked artifactを確認し、一致するsourceから変更する。`node_modules/dist`やtgzを直接修正しない。

## 2. 共通制約

- フォームなしでも参加者管理を使える。参加者タブ非表示でも登録できる。人数だけの精算を維持する。
- 回答の取得・既存の選択確定・基本情報の差分確認は維持し、回答から参加者を勝手に確定しない。
- タブの表示・順序は企画全体で共有する。最後に見た画面は端末内の履歴とし、Firebaseへ保存しない。
- 非表示タブのデータを消さない。画面を開くためだけにタブ設定を自動変更しない。
- 操作中の画面は回答到着・同期・別端末の更新を理由に自動遷移させない。
- 名前・日付の同期に、新しい「反映」「取り込み」ボタンや説明文を設けない。今回、日付同期全体の再設計には広げない。
- 確認ダイアログ、進行ステップ、ダッシュボード、説明カードは追加しない。保存成功の常設表示・毎入力トーストも追加しない。
- worker・queue・Firebase Rules・既存データのmigrationは本計画の変更対象外。
- Carbonの変更はBuilderとMCPで実際のprops・DOM・公式利用条件を確認する。公式指針と本サイトの判断を混同しない。

## 3. 初期表示の仕様

`services/project-start.js` に `resolveProjectStart({ requestedToolId, legacyEntry, standalone, workspace, room, formState, lastToolId, isNewProject })` を新設する。返却値は `{ toolId, reason }`。reasonはテスト・診断向けに限定し、画面には出さない。

| 優先 | 条件 | 表示 |
|---|---|---|
| 1 | 有効なview指定・旧sheet/allocation指定 | 明示された画面。非表示タブは既存のタブ編集案内を維持 |
| 2 | 人数だけの精算モード | 精算。明示的なタブ編集指定は維持 |
| 3 | 新規企画 | 応募フォームが表示対象なら応募フォーム、なければ参加者、両方なければ最初の表示タブ |
| 4 | 既存企画で有効な端末内履歴がある | 最後に利用した表示タブ |
| 5 | 履歴なし・参加者がいる | 参加者が表示対象なら参加者 |
| 6 | 履歴なし・参加者なし・応募フォームが表示対象 | 応募フォーム。未作成/作成中/作成済みはフォーム側で正しい状態を表示 |
| 7 | 上記以外 | 参加者、最初の表示タブ、タブ編集の順 |

共有リンクは現在の `createShareUrl` のroomだけを共有する挙動を維持する。view付きの直接リンクは尊重する。新規企画の判定に参加者0人だけを使わず、既存の作成intentを使う。

端末内履歴は `sanpo-project-last-tool:v1:<roomId>` にtool IDのみ保存する。フォーム入力・権限token・回答は含めない。明示的なタブ操作か、初期表示確定後に保存する。起動時の仮表示、loading中、非表示となったtool、カスタム企画の候補なしを履歴として誤保存しない。storageが利用できなくても通常利用できる。

workspaceとroomを読み込むまで初期判断を確定しない。URL指定とfallbackを区別し、旧URL互換の`initialView=3`が新しい判断を上書きしないようにする。既存の`legacy=1`は互換表示を維持する。

## 4. 状態別の画面・文言

フォーム状態は、既存session/job・`room.meta.applicationSync`を材料に、`uncreated / pending / ready / unknown`として扱う。回答数と参加者数は別に持つ。tabの有無、ローカル履歴が空、受付pauseだけを根拠に「未作成」と断定しない。判定のためだけの新DB・常時pollingを追加しない。

| 場所・状態 | 主操作 | 補助・表示 |
|---|---|---|
| 参加者なし、応募フォームを表示、フォーム未作成 | 応募フォームを作成 | 手入力で追加 |
| 参加者なし、フォーム作成待ち/結果不明 | 作成状況を確認 | 手入力で追加。新しい作成依頼を誘導しない |
| フォーム作成済み、回答なし | 応募リンクをコピー（リンク取得済みの場合） | 手入力で追加。リンク取得不能なら応募フォームを開く |
| 回答あり、参加者未確定 | 既存の応募者選択UI | フォーム作成を再案内しない |
| フォームを表示しない、参加者なし | 参加者を追加 | 人数だけの精算リンクは参加者画面から外す |
| 車割/班割、参加者なし、回答あり | 参加者を選ぶ | 既存選択画面へ |
| 車割/班割、参加者なし、それ以外 | 参加者を追加 | 登録モーダルを直接開く。フォーム経由は任意 |
| 精算、参加者なし | 人数だけで精算 | 参加者を追加、または回答があれば参加者を選ぶ |

見出しは「参加者を追加」「車割」「班割」「精算」のように画面の対象を短く示す。説明が必要な空状態だけ1文を置く。「〜を始める」と同義の説明・ボタンを重ねない。

`Participants.jsx`のRegistrationModalと開閉・フォーカス復帰を再利用し、App配下の共有登録操作へ移す。登録ロジックをコピーしない。フォーム応募者選択と手動追加は別のactionとして扱う。参加者タブが非表示のまま回答選択が必要な場合は、既存選択UIをモーダル/一時表示として再利用し、恒久的なタブ追加を求めない。

## 5. 企画名・フォーム入力・モバイル

### 名前の整合性

- 未設定は未入力として扱う。ヘッダーの未設定表示と、フォーム入力の「新しい企画」という保存され得る仮名を混在させない。
- 企画内のフォーム入力では企画名を共有値にする。フォームからの有効な名前変更は既存storeの`rename`へ接続し、ヘッダーの変更もフォームへ反映する。
- packageに任意の `onProjectNameChange(name: string): void` callbackを追加する。埋込だけで使い、単独フォームメーカーの保存仕様を壊さない。名前の長さ上限はフォーム作成の現行100文字に合わせ、過長な既存名を自動切断しない。フォーム送信時に対象欄で修正可能にする。
- IME変換中・未確定の空欄を共有値に即保存しない。変換終了後のblur/確定操作で保存し、外部更新で編集中の文字を上書きしない。独自のタイマーpollingは設けない。
- 作成済みGoogleフォームの名前を自動変更する処理は追加しない。既存フォームの情報は作成結果として保持する。
- `application-form-link.js`のcontextにも保存済みの新しい企画名を渡す。表示用fallbackと作成payloadを分け、必須入力の検証前に仮名を埋めない。

### 見た目と入力

- モバイルの本文左右余白は16pxを基本に、フォームpackage内Grid/Tileによる二重余白を調整する。全ツールの本文・見出し・ラベルの左端をそろえる。
- 日付はラベルと入力領域を明確にし、空欄でも選択対象だと分かる表示にする。iOS native date inputの挙動を確認してから最小の調整を行う。見た目だけのために別のpickerライブラリを導入しない。
- メール欄は「編集権限を共有するメールアドレス」、補足は「Googleフォームの編集に使うアドレスです。」を候補とし、現行workerの共有処理と照合して確定する。必須入力は維持する。
- 「100文字以内」は常設説明から外し、maxLength/必要時のエラーを残す。説明欄の文字数表示は上限付近またはフォーカス中に限定し、読み上げを毎文字発生させない。
- Carbon TabListのスクロールを再利用する。二重スクロールの有無をDOMで調べ、選択タブを全体表示する。選択のたびに先頭へ戻さず、タッチで横移動できるようにする。tab名自体は省略しない。
- 選択表示とキーボードfocusを区別する。青い枠を写真だけで不具合と判断して削除しない。
- 画面下の空白は維持できる。空白を埋める説明・イラスト・カードは追加しない。

## 6. 実装順序と変更対象

### Task 1: 初期表示を共通化

**Files:** 新規`services/project-start.js`、変更`App.jsx`、`ProjectEntry.jsx`、`services/project-workspace.js`、`project-workspace-routing.js`、`url-compat.js`。unitは新規`tests/project-start.test.mjs`、既存`project-entry.test.mjs`・`project-workspace.test.mjs`を拡張。

- [x] 第3節の優先順位を純粋関数に実装し、作成・一覧・直接URL・戻る操作に接続する。
- [x] room/workspaceの読込待ちと端末内履歴を接続する。初期表示確定後の同期で画面を奪わない。
- [x] unitで明示view優先、新規フォーム有無、精算のみ、履歴の無効化、storage失敗、旧sheet/allocation互換を確認する。

**完了条件:** 同じ状態・同じ入口は常に同じ画面になる。未読込時の精算/参加者のちらつきや意図しない履歴保存がない。

### Task 2: 状態別導線と非表示タブからの登録

**Files:** `App.jsx`、`Participants.jsx`、`Allocation.jsx`、`Settlement.jsx`、`RegistrationModal.jsx`、`InitialEmptyState.jsx`、`ProjectToolsWorkspace.jsx`、`services/form-maker-workspace.js`。新規`components/ParticipantSelectionPanel.jsx`は既存の応募者選択部分だけを抽出し、通常画面と参加者タブ非表示時の選択モーダルで再利用する。必要な状態導出は`project-start.js`に同居させ、UIだけで独自判断しない。

- [x] 第4節のactionを実装し、既存の参加者画面・登録モーダルを共有操作として再利用する。追加の`ParticipantSelectionPanel`は不要と判断し、重複コンポーネントを作らない。
- [x] 既存job情報の受け渡しを確認。packageのjob状態処理で満たすため`onCreationStateChange`は追加しない。token/回答を新しいcallbackへ載せない。
- [x] 非表示参加者タブからの登録→保存を確認し、参加者タブ設定を変更せずにデータだけ更新する。
- [x] pending/unknownの重複作成防止と回答0件時の作成済みリンクは既存packageのsession・recoveryテストを再利用して確認する。

**完了条件:** 各画面の主操作が目的と一致し、フォーム利用を強制せず、非表示タブへの移動で操作が止まらない。

### Task 3: 企画名とフォーム入力の整合性

**Files:** ホスト`services/form-maker-workspace.js`、`application-form-link.js`、`AppHeader.jsx`、`store/room-store.js`の既存rename呼出箇所。package側`packages/form-maker/src/FormMakerWorkspace.jsx`、`index.d.ts`と既存入力初期化helper。host testは`form-maker-workspace.test.mjs`、package既存unitを利用する。

- [x] callbackを任意propsとして追加し、ヘッダー/フォームの名前を接続する。
- [x] 保存名の初期表示・フォームからの変更・ヘッダーからの変更・合成中の未確定値をChromium/WebKitで確認する。IME確認は合成イベントであり、実機入力ではない。
- [x] packageを正規build/packで更新し、hostのvendor・依存lockを更新する。単独利用向けpropsは任意のまま。
- [ ] 100文字を超える既存企画名の表示・修正、および複数端末間renameは未確認。

**完了条件:** 名前の二重入力と仮名の誤保存を解消し、作成中jobのpayloadや作成済みフォームを勝手に変更しない。

### Task 4: モバイルの表示・入力を整える

**Files:** `styles.scss`、`InitialEmptyState.jsx`、packageの`form-maker.scss`・`FormMakerWorkspace.jsx`。既存browser spec `initial-empty-state.spec.js`、`project-workspace.spec.js`、フォームpackageの既存browser testを再利用する。

- [x] Carbon Builder/MCPでTabs・TextInput/date・focusの現在の仕様を確認し、第5節を実装する。
- [x] Chromium/WebKitのモバイル・desktop対象で初期表示、フォーム、日付、エラー、タブ操作を確認する。サイドブラウザでもローカルプレビューを確認。
- [ ] iOS Safari実機での日付と横スワイプは未確認。WebKit結果を実機確認の代用にしない。

**完了条件:** 選択タブの全文が見え、本文横はみ出しがなく、フォーム入力とエラー箇所への移動が可能。空状態の主操作を片手で押しやすい。

## 7. 必要な検証と公開範囲

- 計画書のみの今回：新規文書の内容・参照path・diffを確認して終了。アプリテスト/CI/公開は実行しない。
- 実装中：変更した純粋関数・package契約をunitで確認し、ブラウザーは対象specをChromium mobile/desktopとWebKit mobileで各1回。成功済みの同じ集合を理由なく反復しない。
- 開始ロジックとpackage変更を含むため、PRでは現行分類器のfull CIが必要。分類器を狭めて今回だけ通す変更は行わない。PR/mainのrequired Readinessは既存手順に従う。
- 通常テストはoffline/demoまたはEmulator。mock jobで作成中/失敗/不明を再現し、表示調整のための本番フォーム作成・回答送信・worker再デプロイは行わない。
- 今回調整する企画名が既存rename経路を使う範囲では既存Emulator checkを利用。新しい共有保存経路が必要になった場合だけ、その境界のEmulator検証を追加する。
- 将来、公開を依頼された場合のみ既存React Production Releaseを使用する。必要なroot smoke/cleanup/rollbackは既存workflowへ任せ、独自の公開経路は作らない。

## 8. 重点確認・採用しない案

重点確認は①明示リンクと端末履歴の競合(Task 1)、②読込途中を空企画と誤判定(Task 1)、③pending/unknownのフォーム重複作成(Task 2)、④非表示タブの登録とfocus復帰(Task 2)、⑤IME/他端末更新による入力消失(Task 3)。上記の対象testに各caseを含める。

「フォームがある企画は毎回フォームを開く」「データが届いたら勝手に次のタブへ進める」「参加者登録のためにタブを自動追加」「状態説明を常時長文表示」「全画面を大きな新レイアウトへ変更」は採用しない。

実装前の追加のユーザー判断は必須ではない。上記を既定案として進められる。写真で判定できないiOS日付動作と、package source/artifact一致は実装開始時の確認事項であり、推測で不具合を確定しない。

## 9. Carbon参照

- 公式：Tabsは横スクロールを前提にラベルを扱う。https://carbondesignsystem.com/building-blocks/core/components/tabs/guidelines/
- 公式：空状態は状況に合った短い案内と次の操作を示し、説明を増やしすぎない。https://www.carbondesignsystem.com/building-blocks/core/patterns/empty-states
- 本サイトの判断：初回応募フォーム優先、端末内の再訪履歴、精算の主操作、16pxの本文余白、状態別のaction表は公式の必須仕様ではなく、この企画ツールへの適用案。

## 実装結果（2026-11-02）

- 初期タブ判定、端末内の最終閲覧記録、空状態の文言と主操作、企画名の同期、Form Makerの日付・入力密度・タブの見切れ対策を実装。
- 参加者タブを非表示にしても車割/班割から登録できることを追加確認。最初のブラウザーテストで未実装の経路を発見し、テストを先に失敗させた後に修正した。
- ローカルpreviewのみ。Firebase・実フォーム作成・本番公開は実施しない。
- iOS Safari実機、複数端末rename、100文字超の旧企画名は未確認。
