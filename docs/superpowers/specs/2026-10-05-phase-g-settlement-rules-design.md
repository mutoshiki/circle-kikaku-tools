# Phase G implementation design: settlement rules and calculation explanation

Status: written design approved (2026-10-05) by the user's 「実装計画へ」. [Implementation plan](../plans/2026-10-05-phase-g-settlement-rules.md) prepared for review; Product UI implementation has not started. Normative-owner clarifications in §11 will be applied before UI implementation.

Integration base: `carbon-redesign` at `dbd4d76c3456e344d13f2f36004303616b99b385` (Phase F integrated). Working branch: `codex/phase-g-settlement-rules`.

## レビュー要点

- 運営者が精算ルールを一つのpageで見渡し、任意順に修正し、未保存の計算previewを確認して、設定だけを一回で保存する。wizard、別の確認step、項目ごとのautosaveは導入しない。
- 「割勘に含まれる人数」と「実際に集金する人数」、「負担の免除」と「車への支払額からの差し引き」、「1人額の端数処理」と「各車支払額の端数処理」を区別する。
- 参加者を登録した精算と人数だけの精算、企画者・運転手の扱い、協力代、部費、既存の差引費用と内訳を保持する。汎用の個人別免除、割合指定、新たな集金担当設定を追加しない。
- previewは既存domainを使う。ドライバーが入力した最新の費用を参照できるが、その費用・集金・支払いstateを設定Saveへ混ぜない。
- 戻る・refreshで未保存入力を保持。端末反映後は保存内容を固定し、当該operationの受理を確認する。失敗時の再試行は元の変更範囲だけ。全outboxが空という理由だけで成功にしない。
- 設定を保存できることと、費用が揃って精算できることを分ける。参加者がいない時も「人数だけで精算」へ到達できる。
- Phase Hの集金・支払い・メモ・履歴内部は変更しない。本番操作は行わない。

## 0. Authority, brief, and scope

[SANPOKAI_PRODUCT_UI.md](../../design/SANPOKAI_PRODUCT_UI.md) v1.4が唯一のnormative Product UI specification。参照箇所は§0–6、§11–14、§17–23。本書はその具体化案であり、normative ruleを上書きしない。[Roadmap Phase G](../../design/CARBON_MIGRATION_ROADMAP.md#phase-g--settlement-rules-and-calculation-explanation)は実装順序・gate、[Product Principles](../../design/CARBON_PRODUCT_PRINCIPLES.md)は公式根拠、[Carbon Patterns](../../design/CARBON_PATTERNS.md)はpattern選択、[Current Audit §14](../../design/CURRENT_UI_AUDIT.md#14-settlement-settings-split-club-fee-exemption-deduction)は現状証拠のowner。

本書のProduct UI判断はすべて **Project interpretation**。公式の主張は§2の **Official guidance**、既存実装の制限は **Technical constraint** として分ける。§13との具体化上の差は§11の改訂案へ明示する。承認後、必要な規則をnormative ownerへ反映してから実装し、別仕様を二重管理しない。

### Agreed brief

参加者確定・車割の後、各ドライバーの距離・費用入力と並行して、精算する人が負担・免除・差し引きを調整する。目的は精算額がどう決まるかを理解し、設定の誤りを直すこと。実際の金銭移動を記録するtaskとは異なる。設定を企画実施後だけに制限せず、概要入力や履歴確認を前提にしない。新たなrole・本人認証・承認者を設けない。

### Scope

対象: 精算ルールへの入口とdurable URL、単一grouped form、UI-local recovery、未保存previewと計算根拠、field/form/readinessのfeedback、設定限定Saveとreceipt、keyboard/focus/responsive、対応する検証。

対象外: participant/allocation/route/cost内部の再設計、集金・支払い・メモ・履歴・danger zoneの全面移行、計算式・identity・schema・Firebase Rules/config・domain/store/sync/persistence変更、legacy UI、production操作。精算parentの改修はルールtaskへの入口・短い状態表示・問題からの誘導に限る。Phase Hの完成した精算overviewを先取りしない。

## 1. Current evidence and protected capability mapping

以下はPhase F統合baseの観察であり、新UIの検証結果ではない。

- [Settlement.jsx](../../../apps/react/src/components/Settlement.jsx)の`SettingsModal`は精算方法→協力代→集金ルールの3-step。各stepを行き来しなければ関連値を同時に確認できず、金額previewがない。最初のstepにも「戻る」がある。
- 現行の設定開始buttonは各車への支払いsectionにある。参加者0の早期returnでは、そのbuttonへ到達できない。精算ルールは車ごとの編集ではなく企画全体taskとして接続する。
- 前turnの安全なoffline実画面では架空サンプルの3-stepと各入力を確認し、設定を保存せず閉じた。新UI、Emulator同時編集、実機・native SRの検証はまだ行っていない。
- [settlement/edit.js](../../../apps/react/src/components/settlement/edit.js)の`beginSettlementEdit`/`writeSettlementDraft`は既存変換と変更設定の抽出を行う。`commitSettlementEdit`の全体flush/error判定だけを新UIの成功判定に流用しない。
- [room-store.js](../../../apps/react/src/store/room-store.js)のsettings scopeと[generated/sync.js](../../../apps/react/src/domain/generated/sync.js)が設定限定patchを所有する。UIは既存public boundaryを使い、scopeを広げない。
- [domain/index.js](../../../apps/react/src/domain/index.js)の`settlementInput`が登録参加者か人数だけのprojectionを選ぶ。[generated/settlement.js](../../../apps/react/src/domain/generated/settlement.js)がnormalization、役割・人数・免除・費用・端数・内訳を計算する。UIに第二の計算engineを作らない。

| User concept | Existing owner / setting | UI responsibility |
| --- | --- | --- |
| 精算対象 | `standalone.enabled/driverCount/memberCount/driverNames`、既存参加者projection | modeに応じた入力と実際の対象を説明 |
| 企画者 | `organizerParticipantId/organizerNameFallback` ↔ 既存UI name projection | 保存identityを保持し、対象を推測しない |
| 1人額の端数 | `rounding` | 1/10/100円の既存選択、保存済みの別値も勝手に置換しない |
| 協力代 | `driverReward/driverRewardType`、既存generated reward extra | 金額と割勘/部費。車別の費用へ直接書き込まない |
| 運転手の扱い | `driverCollectionOffset/driverCollectionFree`、車割の明示driver role | 徴収・差し引き・免除を区別。group ownerをdriverと推測しない |
| 企画者の扱い | `organizerFree` | 負担免除と集金済みを区別 |
| 費目からの差引 | `split-minus/club-minus`、符号付きextra、movementの既存type | 車両費用の既存ownerへ誘導し、previewに根拠を表示 |
| 集金担当の記録 | `paidBy` ↔ `paidCollectorByParticipantId/Name` | Phase Hの集金記録に維持。新global ruleにしない |
| 集金済み/支払い済み | `paid/driverPaid`と既存ID/name maps | 閲覧previewのみ。rules Saveから変更しない |

settings Saveの許可範囲は既存の9 prefixだけ: `settlement/rounding`、`organizerFree`、`organizerParticipantId`、`organizerNameFallback`、`driverCollectionOffset`、`driverCollectionFree`、`driverReward`、`driverRewardType`、`standalone`（後8個も同じ`settlement/`配下）。全設定を毎回送らず、実際に変更したpathだけを既存ownerへ渡す。

## 2. Official guidance and selected pattern

参照確認日: 2026-10-05。installed `@carbon/react`は1.115.0、変更しない。

| Official guidance | Project interpretation |
| --- | --- |
| [Forms](https://www.carbondesignsystem.com/building-blocks/core/patterns/forms): 関連入力のgrouping、論理順、必要な時だけ追加入力を開示 | 独立groupを持つ1 page。人数入力は人数だけのmodeで表示。必須ruleをTabs/Accordionへ隠さない |
| 同Forms: in-page actionはform末尾。長いformでinvalidを理由にPrimaryを無効化し続けず、submit中は重複操作を防止 | 末尾にSave/Cancel。invalid submitは修正先へfocus。無条件sticky/fixed trayを設けない |
| [Progress indicator](https://www.carbondesignsystem.com/building-blocks/core/components/progress-indicator/guidelines): linear multistep用。任意順のprocessには使わない | 現行stepは独立groupであり、page wizardもProgressIndicatorも使わない |
| [Radio button](https://www.carbondesignsystem.com/building-blocks/core/components/radio-button/guidelines): mutually exclusive selection | mode、端数、負担先、運転手の扱いに実際のradio semanticsとArrow-key操作 |
| [Notification](https://www.carbondesignsystem.com/building-blocks/core/components/notification/guidelines): 状況に応じたfeedbackと関連する文脈 | field error、form summary、費用readiness、global syncを分離。通常の未保存状態・成功に通知を重ねない |

Carbonがこのアプリの項目順や人数算定を指定しているとは扱わない。Accordion formをCarbon全体が禁止しているとも断定しない。本製品では関連ruleの比較と単一Saveの明瞭さを優先し、補足内訳だけdisclosureにする。

比較した代替: page wizardは任意順の修正に往復を増やす。parent内の項目別inline autosaveは一組のルールを途中状態で共有する。大きなModalはcontext比較・URL・mobileを妨げる。single-page grouped formを採用する。

## 3. Information architecture, entry, URL, and focus

- Global/SideNavに新しい独立製品や「設定」groupを作らない。主要destination「精算」の内部taskとして「精算ルール」を公開する。
- 正規URLは既存room queryを保持した`section=settlement&task=rules`。rule値、人数、名前、preview、receiptをURLへ含めない。URLがtask選択の唯一のownerで、別の`settingsOpen` stateを持たない。
- parentに実在する「精算ルール」linkを置く。設定不足からの修正linkも同じdestinationに接続する。各車の支払いheadingにglobal設定開始を所属させない。
- 参加者0のparentにも「参加者を登録」と「人数だけで精算」の入口を置く。後者は同じrules taskで既存の`beginSettlementEdit(..., { standalone: true })`相当の既存初期値だけを新規draftへ適用する。復旧draft/receiptがある場合はそれを優先し、入口だけで上書きしない。初期値の選択はshared writeではない。
- direct rules URLはcurrent modeを開く。reload、Back/Forward、精算nav再選択でtaskと入力の復元を区別する。未知のsettlement taskはload解決後、parentへreplaceし理由を一度示す。legacy `view=seisan`は引き続き同じ企画の精算parentへ入る。
- rulesへのclient navigationと履歴移動は`h1`へfocus。初回direct loadは閲覧開始位置を奪わない。上部の「精算へ戻る」はdraftを保持し、parentの実在するルール入口へfocus。Save成功/Cancelも同じ入口へ戻す。入力errorからの移動はfieldを優先し、heading focusで奪い返さない。
- readinessから具体的なruleへ誘導する場合はUI-owned issue keyでfieldを特定し、移動後focusする。金額や人名をlocatorとしてURLへ公開しない。欠けた費用はPhase Fの正確な対象車・費目へ接続する。

## 4. Page anatomy and grouped form

1. 「精算へ戻る」link、project context、`h1`「精算ルール」。
2. 短いdescription「負担と集金の扱いを設定し、計算への影響を確認します。」
3. current mode、未保存/共有保存状態。未保存をsuccessや進捗率として表示しない。
4. form-level問題と必要な修正link。費用未入力は別のreadiness領域。
5. 関連group、計算preview、末尾のaction。

### Group A — 精算対象

- Radio「登録した参加者で精算」「人数だけで精算」。current stateを既定にし、開くだけでmode変更しない。
- 登録参加者mode: 現在の対象人数と企画者selection。参加者の追加・削除・driver role変更はここで行わず、既存taskへlinkする。
- 人数だけmode: 運転手人数、同乗者人数、運転手名のrepeating inputs。blank nameは既存fallback、重複名は既存normalizerの扱いを説明し、別identityを作らない。
- modeを往復してもraw入力・非表示値をlocal draftに保持する。shared保存時は既存normalizationの結果だけを書き、費用・参加者・割当・支払いmapsをresetしない。
- 人数だけのprojectionは既存`hasStandaloneSettlementCounts`に従う。正の人数が成立しない時にUIだけで架空の対象を生成しない。normalizationで人数や名前が変わる場合は、入力値と実際の計算対象を区別して示す。

### Group B — 割勘と端数

- 端数単位は1/10/100円のradio。既存の別値は「現在の設定」の選択肢として表示し、明示変更まで保持する。
- Labelは「1人あたりの集金額の端数単位」。これは各車への支払額の端数設定ではない。
- 割勘対象人数と集金対象人数、部費が同じ原資でないことを短く説明する。独自の割勘方式・別の分配formulaは追加しない。

### Group C — 車出し協力代・部費

- 「1台あたりの協力代（円）」とRadio「参加者で割勘」「部費から支払う」。現在の文字列入力と数値解釈を維持し、IME中にSaveしない。
- 対象はdomainの車と実際のreward extra。driver roleの人数を掛けて独自に協力代を計算しない。
- 各費目の負担先・差引は車両費用で編集する。ここに全車のexpense formを複製しない。既存費目がgroup全体の協力代と異なる計算結果を作る場合もdomain結果を表示し、global金額だけから全車同額と断定しない。

### Group D — 免除・差し引き

| Input | Stored choice | User-facing explanation |
| --- | --- | --- |
| 運転手「集金する」 | offset=false、free=false | 割勘対象と集金対象に含む |
| 運転手「車への支払額から差し引く」 | offset=true、free=false | 割勘の負担は残り、現金集金せず車の支払額から控除 |
| 運転手「割勘を免除する」 | offset=false、free=true | 割勘の負担から除外。集金済みという意味ではない |
| 企画者「集金する／割勘を免除する」 | organizerFree=false/true | 選択した企画者に既存ルールを適用 |

- offset/freeが両方trueの保存済みデータは、開くだけで片方をfalseにしない。「免除と差し引き（現在の設定）」を追加のcurrent選択として示し、現行計算をpreviewする。利用者が通常の3択へ変更した時だけ上記pairへ置換する。新しいdefaultにはしない。
- 企画者がdriverでもある時、複数driverが同じ車にいる時、ownerがdriverでない時の優先関係はdomain結果を使う。車単位の差引内訳に対象と理由を示し、人数・役割をUIで再解釈しない。
- 個人の免除理由・任意金額・割合・対象者repositoryを新設しない。既存のrole-based免除と費目差引を同一の個人別rule editorへ押し込めない。
- 人数だけmodeでは企画者選択/免除を非表示にするが、未編集のstored値は保持する。driver flagsをmode切替のたびに勝手にresetしない。

### Group E — 計算への影響

§5のpreview。Save/Cancelの前に詳細へ到達できる。各groupは`h2`、入力groupはlabel/legendを持つ。4 groupを同格のwrapper Tileとして積み重ねない。集金担当の新しいform sectionは作らない。

## 5. Preview and calculation explanation

### Ownership and freshness

- 計算は既存`settlementInput`と`calculateSettlement`、readinessは既存`getSettlementIssues`を使用する。preview用に作る一時roomはmemoryだけで、store command、Firebase、canonical persistence、local room snapshotへpublishしない。
- 現在roomへ変更したsettingsだけを既存canonical変換でoverlayしてcandidateを作る。入力開始時の古い車・支払いmapsや未変更settingsを全面復元しない。企画者IDは既存変換の結果と現在のparticipantに照合する。
- 比較は「現在の設定による試算」と「未保存のルールによる試算」の並列値。UIが独自の差額・割勘・端数formulaを計算しない。現在値がoptimisticである可能性を残し、「共有保存済み精算」と呼ばない。
- 他driverの費用更新はcandidateのsourceを更新するが、raw settings入力を上書きしない。「費用が更新されたため試算を更新しました」の局所statusを必要時だけ示す。キャッシュされた別車の未保存draftをpreviewへ取り込まない。
- 自端末の未確認費用保存・global sync障害がある場合、その状態を併記する。試算できることを費用受理や精算確定の証明にしない。初期roomが未解決なら偽の0円を出さずSkeleton/errorとする。
- fieldへのtypingごとにpreviewを計算しても、結果全体を毎回live announcementせずfocusを動かさない。

### Required presentation

| Information | Existing result | Explanation boundary |
| --- | --- | --- |
| 割勘に含まれる人数 | `shareCount` | 負担の分母。集金人数と区別 |
| 集金対象人数 | `payerCount` | 現金集金する対象。免除/差引で異なる |
| 1人あたりの集金額 | `perPerson`、`rounding` | 既存割勘結果と1人額の端数処理 |
| 割勘費用・部費負担 | `totalSplit`、`totalClub` | 原資別。signed extraもそのまま |
| 集金予定と車への支払い | `expectedCollected`、`driverTotal` | 実際の回収済み/支払い済みと別 |
| 車別の根拠 | `cars[].movementAmount/extras/splitPay/clubPay/splitRound/clubRound/collectionOffset/adjustedSplitPay/adjustedClubPay` | 費目→原資別端数→driver控除→支払額 |
| 全体の端数・差引・差額 | `totalSplitRound/totalClubRound/totalDriverCollectionOffset/surplus/accounting` | domain値と意味を表示。ゼロを強制する新しい会計validationを作らない |

- 各車の割勘分・部費分支払いは現行100円単位の処理を継承する。1人額のradio変更が車別の丸めも変更すると説明しない。
- 主要previewは人数2種・1人額・原資別合計をscan可能にする。車別の詳細はdisclosureだが、問題件数と対象車は閉じても残す。
- 免除は「負担から除外」、offsetは「負担はあるが車支払いで相殺」、paidは「実際に集金済み」。同じbadgeへ統合しない。
- 対象0、費用未入力、集金対象0、未確認保存では「計算条件を確認」「入力済みの費用による試算」等を示す。既存domainが返す0円を完成額として強調しない。
- 内訳は実際のresult/sourceだけ。内部ID、operation、架空の最後更新時刻を公開しない。同名車の識別はPhase Fの既存targetと表示labelを共有する。

## 6. Validation, issues, and save readiness

三つの層を混同しない。

1. **Form validity**: 現行UIのnegative人数/協力代、人数だけmodeのraw人数合計0以下等、既存設定formの保存条件を全groupで評価。先に単体characterizationで受理範囲を固定し、blank/0/comma/decimal/範囲外の解釈をUI都合で厳格化しない。numeric normalizationは上記ownerを使用し、raw入力をtyping中にclampしない。
2. **Target/write safety**: reset、削除/変更された企画者identity、canonical同値名の曖昧な新selection、stale同path変更を判定。対象を推測して別人の免除へpublishしない。unchangedの既存fallback・別値は無関係の設定Saveで書き換えず、移行不能なら入力を保持して説明する。
3. **Settlement readiness**: 車/参加者/費用不足、集金対象0、企画者未選択など既存domain issues。設定修正途中にも見せるが、費用入力を終えるまで設定Save自体を禁止しない。既存の企画者未選択advisoryを無断で必須fieldへ昇格しない。

- domainのmessage日本語を`includes`/正規表現で解析してseverity・navigation・save可否を決めない。構造化fields/rowsとsource predicatesに対応したUI issue keyを使い、既存判定との一致をfixtureで証明する。表示のためのadapterがdomainのcalculation/readinessを置換しない。
- 全groupのfield validationはblur/submit。Saveでは隠れたconditional fieldの適用可否も確認し、最初のactive invalid fieldへfocusする。summaryのlinkも同じfieldへ移る。
- 原因不明のdisabled Saveにしない。通常のinvalidではSaveで修正先を示す。IME、保存中、未解決receipt、unsafe/stale contextではdisabledと理由を示す。
- form summaryは1つ。車別readinessを同じ「設定を確認してください」Notificationの連続stackにしない。保存失敗はaction領域近傍、global障害は既存共通領域。無関係なsync失敗だけを当該Save拒否の証明にしない。

## 7. Draft, edit, save, retry, and completion

### Draft boundary

- UI-local cacheのnamespace案は`sanpo-ui:settlement-rules:v1:<encoded roomId>`。保存するのはraw settings変更、対応するopening path values、reset世代、復旧receipt。room全体、車別draft、参加者repository、auth/tokenは保存しない。
- `standalone`は変更objectの既存normalizationとintent粒度に従う。非表示raw name/人数を入力中は保持するが、canonical storageへ新しいdormant schemaを追加しない。
- 戻る、SideNav、費用taskへの移動、Back/Forward、refreshで復旧する。端末保存不能ではmemory入力を保持し「この端末に入力を保存できません。再読み込みすると失われます。」を示す。
- 未publishの「キャンセル」はこのrules draftだけを破棄しparentへ戻る。他車のcacheやstore設定をundoしない。Cancelのために逆方向のshared writeをしない。
- 同じroomの新しいdraftを、離脱済みcontrollerの古い完了が消さない。cacheの更新/clearは当該recordの所有が続く時だけ。

### Save boundary

1. 「精算ルールを保存」で全groupのvalidationと現contextを確認。
2. 既存settings edit session、canonical conversion、settings intent patchを使う。既存のchanged-path比較を維持して9 prefix以外をpublishしない。
3. 当該intentを受け取るreceiptをUI orchestrationに保持し、端末反映以降はraw入力とpayloadを固定する。操作前のdraftと同じ編集可能stateに戻さない。
4. 既存のoperation acceptance、patch outcome、reset世代で成功/調整/失敗/未確認を区別する。[allocation-save.js](../../../apps/react/src/ui/allocation-save.js)の既存public receipt処理を再利用できるが、settingsに対するbehavior testを必須とする。sync/domainは変更しない。
5. 受理かつ意図した結果を証明できた時だけdraftを閉じ、parentへ戻す。離脱済みpageへ後からnavigation/focusしない。受理済みintentを再publishしない。

設定Saveは一つの既存transactionだが、他clientをlockしない。mode/名前変更後も既存費用・paid mapsが残ることと、現在projectionへの影響をpreviewに示す。Save前の別確認pageや計算額の「確定」flagは追加しない。

### Receipt states

| State | UI / next action |
| --- | --- |
| 未publish・未保存 | raw入力とpreview、Save/Cancel/Back |
| 共有保存中 | 同内容を固定、重複submit不可、Backは保持。共有保存済みとは表示しない |
| 受理済み・意図した値 | 当該成功を確認しparentへ。通常success Toastなし |
| 保存失敗・再試行可能 | 控えと原因を保持。「同じ内容を再試行」。別outboxを上書きせず既存処理へ委譲 |
| 保存結果は未確認 | 控えを保持してobserve。operationの証拠なくfresh intentを作らない |
| 同時編集で結果が異なる | 現在値と控えを表示し、再試行で後の設定を上書きしない |
| 企画reset | 古い控えを成功表示・再applyせず、現在設定への確認を促す |
| offline local | 「この端末に保存」と共有保存を区別。安全なlocal test/demo modelのまま |

端末反映後は「キャンセルで元に戻る」を約束しない。受理済み調整/resetの「現在の設定を確認」は控えを閉じるだけで共有設定を変えないことを説明する。pending/unknownはこの操作で控えを捨てない。修正して再保存は、既存結果を確認した後の新しいtaskとする。

no-opでは新intentを作らない。比較結果が変更なしなら「変更はありません」でparentへ戻せる。現在値との一致だけを、過去の未確認receiptの受理証明として使わない。

## 8. Collaboration and source changes

- opening settingsのdirty pathだけをUIが所有し、未変更settingsは最新roomの値を使う。別clientの費用、支払い、メモ、参加者変更をsettings payloadへ混ぜない。
- dirty pathが保存前に別clientから変更された時は入力を保持し、現在設定と入力の控えを比較できるstale stateにする。無断rebase/overwriteしない。明示的に現在設定から再編集を始め、old receiptのretryで新変更を潰さない。これはUIの競合確認であり、新しいdomain merge規則ではない。
- 単なる別車の費用更新や未変更setting更新で全formを無効化しない。preview sourceだけ更新する。企画者の削除/identity変更、mode/人数による対象変更、resetは実際の依存先を再検証する。
- 通常modeの同名participantを独自suffixだけで別の保存対象へ変換しない。既存canonical equalityとID対応を使い、ambiguous selectionは理由付きで止める。現在の明確なIDを無関係なSaveで別IDへ付け替えない。
- 車別の費用が未確認/拒否でもrules復旧を可能にし、その試算sourceと保存状態を説明する。domainやtransportへ新たな共有lock、権限、完成flagを追加しない。

## 9. Responsive, accessibility, Carbon composition, and wording

### Desktop / mobile

- `lg`（installed Carbon 1056px）以上: Gridのform 10/16、preview 6/16を基本とする。DOMはform groups→preview→末尾actionの一つで、CSS配置だけを変える。Saveは複製しない。preview内にもう一つformを作らない。
- `lg`未満: 1-column。header metadataに主要な試算要点だけを示し、詳細previewは入力後・Save前。mobileで旧3-stepや狭いoverlayへ戻さない。
- previewは入力form全体のread summaryではなく変更の効果を示す補助情報。入力値をすべて重複表示しない。metadataの要点は同じderived resultを参照し、別stateを持たない。
- scroll ownerはdocument。fixed/sticky footer、previewの独立縦scroll cage、見た目のためのsummary Tileを導入しない。390px/short viewport/長い名前/大きな金額/99人相当の反復入力でもdocument overflowなし、fieldとactionへ到達できることを検証する。
- spacing/type/color/layer/breakpointはCarbon token。標準のpage anatomyとg10/g100を継承する。global `.cds--*` override、独自focus/shadow/radiusでlayoutを補修しない。

### Keyboard / semantics

- 一つの`main`とtask `h1`、group `h2`、legend/label、補助previewの見出しを持つ。視覚順とTab順を一致させる。
- radioは実際のArrow-key契約、企画者selectionはlabel付きpublic Carbon選択control。installed props/DOM/focusを実装前に確認し、hidden native inputへのforce clickをテスト契約にしない。
- target/error helperはinputと関連付ける。submitでinvalid fieldへfocus。form error/readiness/statusを全て`role=alert`にして読み上げを重ねない。
- loadingは保存対象だけbusy。即時計算previewに不要なspinnerを出さない。IMEとdouble submitを別条件で保護する。
- 有効な控除理由、費目、金額はkeyboard/textで読め、色・地図・pointerだけに依存しない。icon-only/menuは44px相当のhit areaとname/tooltip、reduced motionを継承。

### Copy

用語は「精算ルール」「未保存の試算」「割勘に含まれる人数」「集金対象人数」「割勘を免除」「車への支払額から差し引く」「集金済み」「支払い済み」を分ける。「反映」「完了」「集金対象外」だけで負担/保存/金銭移動を曖昧にしない。内部のroom、schema、outbox、receipt、prefixを利用者へ表示しない。

## 10. Verification contract for implementation

本節は今後実行するacceptanceであり、この仕様書を作成しただけでPASSとは扱わない。source text、Modal class、step数、snapshotだけを契約にしない。

| ID | Required observable contract / evidence |
| --- | --- |
| G-01 | direct/shared/legacy URL、rules task、invalid task、Back/Forward/refresh、current nav、client heading focus、parent trigger return、同current-section再選択を維持 |
| G-02 | 参加者0から人数だけ精算へ到達。人数/名前/協力代/flagsをモード往復・戻る・refreshで保持し、未保存previewではshared state・intentが一切変わらない |
| G-03 | Raw/IME、blank/0/comma/decimal/範囲外、fallback/重複名、保存済み非標準端数/dual flagsをcharacterize。入力の自動clampや開いただけのmigrationをしない |
| G-04 | 通常/人数だけ、企画者兼driver/非driver owner/複数driver、全免除/offset、負担先2種、private/Times、signed/blank/extraについて既存referenceと全計算resultが同値 |
| G-05 | shareCount/payerCount、perPerson/車別100円端数、raw費用/原資/端数/offset/支払いのpresentationが実際のresultに対応。差額ゼロ強制や独自formulaなし |
| G-06 | 全field validation、最初のinvalidへのfocus、summary link、費用readinessから正確なPhase F費目へ往復。費用未入力でも有効なルールSaveは可能 |
| G-07 | Saveの実際のpatchはchanged settings prefixだけ。費用・participant/allocation・paid/driverPaid/collector・memo/routeを完全保持。Save前Cancelはintentなし |
| G-08 | 当該受理、拒否、pending/unknown reload、exact retry、adjusted/reset、別outbox、受理後の別編集を実transport/receiptで検証。drained outboxだけを成功にしない |
| G-09 | 2 Emulator clientでdriver費用とルールの並行保存、同/別settings path、企画者削除/同値名、resetを観測。古い失敗retryが新しい設定を上書きしない |
| G-10 | 旧controllerの遅延完了は離脱後のfocus/route、新しい同room draftを変更しない。cache失敗/破損/namespace分離、控え確認の非shared writeも検証 |
| G-11 | Chromium/WebKit desktop/~390px、light/dark、1055/1056/short viewport、長い日本語名/金額、反復入力、touch/keyboard/focus/reduced motion、document overflow/action非遮蔽を実操作とgeometryで確認 |
| G-12 | Phase B–Fのnavigation/participants/allocation/vehicle-cost/route、現存の集金/支払い/memo/history、protected bytesとgolden fixturesを累積検証。旧3-step assertionは同等以上のbehavior coverageへ置換 |

- 現在の`settlement-edit.test.mjs`、`phase7-compatibility.test.mjs`、`vehicle-cost-calculation.test.mjs`と関連browser/Emulatorを保持し、settings controller/draft/previewのfocused testsを追加する。RED→GREENは実装計画のtaskごとに記録する。
- Emulatorはdemo Auth/RTDB、専用synthetic roomsだけ。複数clientを閉じ、outboxの状態を確認し、Rulesを変更する拒否試験では必ずrestore・room削除・absence assertionを行う。
- beforeはPhase F統合baseの実画面、afterは新rulesの同等state。light/dark/viewport/input method/commitを記録し、後のbuildをbeforeと呼ばない。
- 実Maps、実機software keyboard/browser chrome/safe area、native NVDA/VoiceOverの未実施項目はPhase Iに残し、synthetic viewportやsemantic assertionでPASSにしない。
- historical `verify:legacy`のPhase F以前の4 manifest不一致は継続して区別する。manifest再採取やskipでgreen化しない。今回のprotected executable diff、実計算・shared checkを独立に要求する。

## 11. Normative-owner clarification proposed for approval

現行§13のsingle-page方針は維持する。一方、列挙された「集金担当」と「人単位・理由・金額/割合」の記述をそのままformへ変換すると、現行domainにないglobal担当設定や汎用個人別免除を追加することになる。protected behavior優先を踏まえ、次の具体化を提案する。

| Normative owner | Proposed clarification to apply after approval |
| --- | --- |
| §6 / §13 | rulesは一つのsettings限定Save。未publish Cancel、保持するBack、exact receipt recovery、no-op、reset/同時編集を本書§7–8の意味で明記 |
| §11 / §13 | mode/対象・企画者、割勘/端数、協力代/部費、免除/差し引き、計算影響のgroup。集金担当の記録は§14のcollection taskへ維持 |
| §13 exemption/deduction | 既存role-based免除と費目差引を対象に、対象・理由・計算への影響を表示。汎用個人別金額/割合入力や新しいschemaは導入しない。既存逆操作で免除を解除し、専用rule delete repositoryを作らない |
| §13 / §14 | shareCountとpayerCount、1人額と車別端数、未保存試算と共有受理、費用readinessとsettings validityを区別 |
| §20 / §22 | 一つのURL-owned rules task/controller/form、lg split/狭幅single column、末尾action、document scroll、既存focus/keyboard/token contractを累積適用 |

written-specは承認済み。実装計画Task 1で、同じPhase G branchのnormative ownerへ必要な規則を反映してからUI実装へ進む。上記具体化を仕様回避の例外として使わない。反映後の本書はそのownerへのtraceabilityと実装説明だけを担う。

## 12. Implementation boundaries, review focus, and completion

予定するowner分離: rules pageはform anatomy、UI-only controllerはraw draft/receipt/current依存とlifecycle、preview adapterは既存domain呼出と表示用issue mapping、navigationはURLとfocus。既存Settlementはrules入口と移行済みtask接続だけ。既存UI receipt/patch helperを利用し、settings用のbusiness engineを抽出しない。

独立reviewで重点確認する失敗mode:

1. 企画者同値名/削除/兼driverと複数driverで、別人免除・人数誤表示・別path publicationが起こらないか。
2. 最新費用を見せるpreviewとsettings Saveが、opening snapshotの他車/paid/未変更設定を復元していないか。
3. 人数だけの名前変更・人数縮小・mode往復で既存name-backed費用/paid mapsやraw recoveryを黙ってresetしていないか。
4. 失敗/reload/別operation/後の設定変更/remote resetで、偽成功・重複intent・古いretry・newer draft消去を起こさないか。
5. readinessのmessage文字列解析、独自計算、会計差額の誤ったerror化、ProgressIndicator/Tile/Notificationの再導入がないか。
6. 390px・長い反復form・keyboardでSave/Cancel/error correctionが到達可能で、desktop/mobileの二重formがないか。

Phase G実装完了は、上記acceptance・累積regression・実ブラウザ・reviewと必要CIが成功し、実装PRが`carbon-redesign`に統合され、remote SHA/treeを確認した時。文書commitはPhase G完了ではない。`main`へのmerge、Release dispatch、compatibility deploy、root cutover、production smoke、production Firebase writeは禁止。

次の順序はwritten-specレビュー→必要なnormative具体化とimplementation plan→planレビュー・実行方式選択→実装。Phase Hは集金/支払い/履歴/dangerの内部移行、Phase Iはcross-product hardeningと未実施device/provider/SR、最終統合release gateを担当する。
