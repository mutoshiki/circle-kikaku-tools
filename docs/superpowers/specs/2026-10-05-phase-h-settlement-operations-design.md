# Phase H design: collection, payouts, history, and safe recovery

Status: specification approved by 「実装計画へ」 and Native implementation authorized by 「実装へ」 (2026-10-05). Implementation is in progress; verification and integration outcomes belong to the phase evidence, not this design rationale.

Integration base: `carbon-redesign` at `c33962ed9c28fd3cd94e4a63d52e111a026c7b0f` (Phase G / PR #82 integrated). Working branch: `codex/phase-h-settlement-operations`.

## レビュー要点

- 精算parentは計算結果・不足情報・残る金銭移動を短く示す。「集金」「支払い」は精算配下の専用作業page。繰り返す操作をModalへ入れず、global navigationは増やさない。
- 集金と車への支払いを別の記録として維持する。行内で記録・解除し、内訳だけをdisclosureへ置く。毎回の成功Toast、bulk処理、新たな企画完了flagは追加しない。
- 金額は現在のdomain result。チェックに過去の金額・日時が保存されているとは扱わない。費用変更でチェックを自動解除せず、現在額の確認を促す。
- 人数だけの精算で必要な名前の記録も維持する。既存の「集金した人」入力は短いinline editorに移し、既存paidByの意味や保存先を新しい担当者roleへ変えない。
- 履歴一覧はこの端末の保存。復元は共有企画への変更。復元前に範囲を確認し、共有保存の受理・調整・未確認を分ける。Undoは同じセッションで安全条件が成立する間だけ。
- 未実装の企画削除・設定repositoryは作らない。サンプル置換は既存local/demo環境にだけ残し、通常utilityから分離する。
- schema、Firebase、domain/store/sync/services、計算、legacyを変更しない。仕様承認後に必要な規則を唯一のnormative ownerへ反映してから実装する。本番操作は禁止。

## 0. Authority, intent, and phase boundary

[SANPOKAI_PRODUCT_UI.md](../../design/SANPOKAI_PRODUCT_UI.md) v1.5が唯一のnormative Product UI specification。参照箇所は§0–6、§11–12、§14–23。本書はPhase Hの具体化案であり、第二のnormative specificationではない。採用する改訂は§12に列挙する。[Roadmap Phase H](../../design/CARBON_MIGRATION_ROADMAP.md#phase-h--settlement-operations-collection-payouts-history-and-danger-zone)が依存関係とgate、[Patterns](../../design/CARBON_PATTERNS.md)がpattern選択、[Principles](../../design/CARBON_PRODUCT_PRINCIPLES.md)が公式根拠、[Audit §15–18](../../design/CURRENT_UI_AUDIT.md#15-settlement-overview-and-data-presentation)が過去の監査証拠を所有する。

本書のUI判断はすべて **Project interpretation**。§2の公式主張だけを **Official guidance**、§1と保存/復元ownerの制限を **Technical constraint** として扱う。

### Agreed brief

車ごとの距離・費用と精算ルールを確認した運営者が、参加者からの集金と車への支払いを短時間で繰り返し記録し、未処理を見つけ、間違いを訂正する。ドライバーの費用更新は並行して起こり得る。計算の完成と実際の金銭移動は別task。精算後に履歴・設定・archiveを必須操作として要求しない。利用者を新しい認証roleへ分割しない。

### Scope

対象は精算parent、集金・支払いsubroute、row-level記録と回復、精算メモ、履歴pageの端末保存・復元・条件付きUndo、既存サンプル置換の入口と確認、対応するcontent/responsive/accessibility/test contract。

対象外は参加者/編成/車両費用/route/精算ルール内部の再設計、domain calculation、schema/Rules、Firebase config、store/sync/persistence/history serviceの仕様変更、legacy UI、project削除API、共有履歴・監査台帳、授受金額や日時の新規記録、bulk金銭処理、production操作。Phase Gで残したreceipt robustness/readiness wordingと間欠WebKit navigationはPhase Iの記録を維持し、本Phaseで修正済みとは扱わない。

## 1. Current evidence and protected owners

以下は統合baseのcode evidenceであり、Phase Hのbrowser validation結果ではない。

| 現在の実装 | 確認した意味 / 保護対象 |
| --- | --- |
| [Settlement.jsx](../../../apps/react/src/components/Settlement.jsx) | rules入口、issues、各車の内訳、集金summaryとModal、精算memo。反復する集金がModal内。現在の車rowには支払い記録controlがない |
| [settlement/edit.js](../../../apps/react/src/components/settlement/edit.js) `collectionChange` | paidとpaidBy、またはdriverPaidを既存settlement commandで更新。paymentは車の既存name projectionへ接続する。戻り値はwhole-map Undo用でありintent receiptではない |
| 同 `undoCollectionChange` | 既存whole-map Undo。無関係な行の記録も戻し得るので新UIの通常訂正に採用しない。helper自体と既存contract testは変更しない |
| [generated/canonical.js](../../../apps/react/src/domain/generated/canonical.js) | paid / collector / driverPaidのIDとname fallbackへの変換。UIで独自identityやescapingを加えない |
| [generated/settlement.js](../../../apps/react/src/domain/generated/settlement.js) | 請求額、除外、免除・差引、各車adjustedSplitPay/adjustedClubPay/adjustedTotalPay、集金人数・残額。driver複数でも車単位の一括支払い |
| [history.js](../../../apps/react/src/services/history.js) | room別端末storage、最大20件、先頭と完全一致なら重複保存しない。saveのreturnだけではstorage成功を証明しない。restoreBackupはruntime memoryだけ |
| [room-store.js](../../../apps/react/src/store/room-store.js) / runtime | restoreは既存migrationとentity patchを経由し、現行resetGenerationを維持。metadataには既存の維持/置換規則。履歴は自動生成されていない |
| [room-sync.js](../../../apps/react/src/sync/room-sync.js) / [allocation-save.js](../../../apps/react/src/ui/allocation-save.js) | one-record outbox、既存transaction/fallback、operation receipt。connectedや空outboxは個別操作の成功証拠ではない |

旧Auditの「支払いcheckboxがある」記録と現在UIを混同しない。Phase Hで既存driverPaid capabilityへの入口を戻す。名前の重複、削除、rename、standaloneの仮名は既存projectionの制限であり、見た目の番号だけで別保存identityを作らない。

## 2. Official guidance, interpretation, and alternatives

公式確認日: 2026-10-05。現行`@carbon/react` 1.115.0を更新しない。component export/props/keyboard behaviorは実装前にinstalled packageで検証する。

| Official guidance | Project interpretation |
| --- | --- |
| [Modal](https://www.carbondesignsystem.com/building-blocks/core/components/modal/guidelines): 短く非頻繁な中断task。反復taskはmain pageでの完了を検討。危険な操作は結果を説明して確認する | 集金一覧・支払い一覧・履歴一覧をModalにしない。復元等の短い危険確認だけをdanger dialogにする |
| [Contained list](https://www.carbondesignsystem.com/building-blocks/core/components/contained-list/guidelines): 同じrow構造をgroup化し、inline actionを含められる。複雑な深いnestや多列headerには別pattern | 金銭作業をcompactなon-page listへ置く。費用内訳の長いnestは別の一段disclosure/詳細regionへ分ける |
| [Content switcher](https://www.carbondesignsystem.com/building-blocks/core/components/content-switcher/guidelines): 同種/関連contentの代替view。異なるsubpageのnavigationに使わない | 各一覧の未処理/すべてに使い、集金/支払い間のnavigationには実際のlinkを使う |
| [Checkbox](https://www.carbondesignsystem.com/building-blocks/core/components/checkbox/guidelines): 明確なlabelを持つ独立した選択、checked state | 行の「集金済み」「支払い済み」を現在状態として表示。保存確定の意味はreceipt表示で補う |

専用作業page案を採用する。同一pageの独立2一覧もnormative上は可能だが、390pxで長い他方の一覧を越えて反復操作する負担がある。wizard案は任意順・並行・訂正に不適合。Tabs/ContentSwitcherで既存大画面を丸ごと置換しない。Carbonがこの分割・URL・金銭計算・Undo条件を規定しているとは書かない。

## 3. IA, URL, and focus

| Destination | URL contract | 見出し / 主な内容 |
| --- | --- | --- |
| 精算parent | `section=settlement` | h1「精算」、結果・readiness・作業link・memo |
| 集金 | `section=settlement&task=collection` | h1「集金」、summary、filter、行記録、コピー |
| 支払い | `section=settlement&task=payments` | h1「支払い」、summary、filter、車rowと内訳 |
| 精算ルール | 既存`section=settlement&task=rules` | Phase Gを変更せず接続 |
| 履歴 | 既存`section=history-settings` | h1「履歴」、端末のsnapshot一覧と復元 |
| サンプル置換 | `section=history-settings&task=sample`、local/demo限定 | h1「サンプルデータ」、入力と危険確認 |

URLをdestinationの唯一のownerとする。room/shared query、legacy inbound、Back/Forward、refreshを維持。`history-settings`は互換上の識別子であり、UIで「履歴と設定」と表示しない。未知taskと共有環境のsample URLはload解決後parentへreplaceし理由を示し、writeしない。filterはroom/task別session-local状態で復元し、URLへ人名、金額、履歴payloadを入れない。

集金/支払いには「精算へ戻る」と相互の明確な作業link。global navのcurrentは精算、page h1/local navの`aria-current="page"`がsubtaskを識別する。navigation/履歴移動はh1、明示Backはparentの実在する入口へfocus。direct loadでfocusを奪わない。コピー/receipt完了で移動済みpageのfocusを変えない。

未処理filterで操作行が消える時は、focused controlの消失を検出し、次の未処理行→前の行→filterの順で論理focusを置く。pointer/touch操作で無条件にfocusやscrollを先頭へ飛ばさない。保存中/失敗/未確認行はfilterから消さず、状態を解決できる位置に残す。解除は「すべて」で操作できる。

## 4. Settlement parent anatomy

Appの一つのmain/h1を使用。project context→title/短いdescription→判断に必要なmetadata→main contentの順。

1. **確認が必要な項目**: 既存readiness issueを一つのまとまったregionに示し、具体的なルールfield/参加者/対象車費目へlink。金額計算・issue条件は既存owner。issues.messagesの文字列解析でseverityを決めない。
2. **精算額**: 1人請求額、負担人数と現金集金人数、割勘/部費/車への支払い、端数・差引・余剰・会計差額を既存resultから説明。必須金額を閉じたAccordionへ隠さず、補足内訳だけ開閉する。会計差額0を新validationにしない。
3. **残る作業**: 「集金を確認」「支払いを確認」のlinkと未処理人数/件数・金額。one-information-per-Tileや巨大dashboard cardを作らない。費用/精算ルール入口は同格の金銭操作buttonではなく補助task link。
4. **メモ**: read summary + Tertiary編集開始。編集状態は§7へ。

閲覧parentにはPrimary不要。「精算完了」buttonを作らない。readinessに問題がなく、関連writeが確認済みで、対象の集金/支払い記録が揃う場合に限り「現在の集金・支払いチェックはすべて記録されています」と表示できる。空対象、0円や負額を自動的な完了としない。これは現在のチェック状態であって、授受額の監査や最終額lockを証明しない。

計算額には「現在の費用・ルールによる金額」を示す。チェックは金額を保存しないため「チェック後に費用・ルールを変更した場合は、集金・支払いを再確認してください」を短い通常説明として残す。観測できる変更時は再確認を促せるが、過去の授受額・時刻や変更履歴を推測しない。チェックを自動解除しない。

## 5. Collection workspace

### Read mode

- summary: domainのpaidCount/payerCount、unpaidAmount。費用負担人数と集金人数を混ぜない。
- ContentSwitcherは「未集金」「すべて」。fresh entryは未集金、session復元時は既存選択。表示件数を添える。コピーはGhost「未集金者をコピー」。表示filterに関係なく既存の未集金対象全員をコピーし、成功/失敗は短いfeedback。
- 登録参加者row: 本人の名前、現在請求額、集金済み/未集金、既存記録があれば「集金した人」の補助情報。paidByで本人identityを置き換えない。
- 除外rowは「すべて」に表示し、checkboxを置かない。企画者免除、運転手免除、支払額から差引を既存role/結果に従って区別。保存済みpaidが存在しても勝手に消さない。
- checkboxのvisible labelは「集金済み」、accessible nameに対象を含める。金額と状態を色だけで表さない。登録参加者の通常記録に名前入力を要求しない。

### 人数だけの精算

未記録rowのチェックは、その行の短いinline入力を開く。既存label「集金した人」を保持し、元の仮名を添えて対象slotを識別する。新しい会計担当role・本人認証・参加者登録は行わない。raw textを保持、submit時のtrimと空欄時fallbackは現在Reactの`collector.value || collector.name`と既存helperの意味を保つ。旧legacyの空欄拒否とReactのfallbackの差を今回揃えない。

一度に1行を編集し、「記録」Primaryと「キャンセル」をその行内に置く。publish前のキャンセルはwriteなし。入力中は別slotへ切替えてdraftを失わせない。IME composition中はsubmitしない。記録後は既存paidByを表示し、解除で既存helperどおりpaidByも解除する。登録参加者modeへ切替わった/slotが消えた場合は再検証して保存を止め、理由と未保存入力を残す。

入力前のraw draftはroom + mode/slot contextを持つsession-local UI recoveryに限る。navigation/refreshで復元し、明示キャンセル/成功で破棄。同じ見た目のslotでも対象集合やmodeが変わった場合は再開を要求し、自動writeしない。

## 6. Payment workspace

- summaryは未確認車件数と、その車の現在支払額を集計して示す。domain resultの車額を加算するpresentationであり、費用/端数を再計算しない。正負を相殺した残額だけで作業量を示さず、件数も残す。
- ContentSwitcher「未払い」「すべて」。現在のresult.carsごとに一つのrow。複数driverへの金額分割やdriverごとのpaid flagを作らない。
- rowは車label、実際の運転手、adjustedTotalPay、「支払い済み」checkboxと状態。運転手未設定をgroup ownerから捏造しない。既存driverPaidの車name projectionを守る。
- 内訳は割勘/部費・端数・運転手分差引・協力代・費目の既存resultを表示。詳細は一段のdisclosure、費用修正はPhase Fの同じ対象車workspaceへlink。費用editorを複製しない。
- 0円/負額も隠さず符号と内訳を残す。既存チェックを自動true/falseにしない。負額を正の「受け取り額」と誤表示せず、現在計算の調整額として確認を促す。既存の記録操作を金額条件で削除しない。
- 同名/正規化名衝突、unsafe name fallback、削除/renameで保存対象を一意に解決できない場合は表示を維持し記録だけ止める。説明用番号は保存identityにならない。participant IDへの独自name解決をしない。

## 7. Write, reversal, memo, and recovery contract

### 操作単位

毎回最新roomから既存`collectionChange`を一回だけ呼ぶ。**Technical constraint (Task 3 verified):** helperはlegacy projection全体も正規化するため、transport/persistenceのないdetached storeで一回実行し、解決済み対象の変更pathだけを既存beginEdit/commitEditから一回publishする。live intentを短命のsubscriptionで捕捉し既存receipt helperへ接続する。唯一のnormative owner §14の適用でありhelperの変更ではない。集金は対象paidと必要なpaidByだけ、支払いは対象driverPaidだけ、memoはmemoだけが意味上の変更範囲。実装testで発行patchを確認する。全settlement snapshotを復旧cacheに保存しない。

同名/target消失/reset世代/context変更をpublish直前に再検証する。同一行の重複操作、未解決receiptに反対操作を重ねることを禁止する。one-record outboxをUIでqueueへ変えない。別operationのoutboxが存在する場合は新しいH writeを待たせ、閲覧・navigationは維持し、理由を示す。H操作は一件ずつ受理を確認する。別featureの後続writeが既存outboxを置換した場合は元操作を未確認として残し、successへ進めない。

| Outcome | UI / permitted next action |
| --- | --- |
| local | 「この端末に記録」。共有済みとは表示しない |
| pending | 変更値と保存中を併記。対象操作を固定、別の金銭writeを開始しない |
| saved | exact operation受理と現在の対象pathを確認、行内stateのみ確定。成功Toastなし |
| failed | 入力/receiptを残し関連error。既存helperが許すretryだけを同じ変更範囲で送る |
| unresolved | 「保存結果を確認できません」。観測を継続。空outbox/connectedを証拠にしない。逆writeやreceipt破棄で解決したふりをしない |
| adjusted / reset | 現在結果を示し確認へ誘導。元操作の再適用は禁止。terminalと証明できたreceiptだけ明示確認後に閉じる |

UI receiptはroom別versioned namespaceで対象、operation ID、変更path/元値、reset、dispositionを保持。auth token、room全体、別feature draftを複製しない。storage失敗でもmemory入力とreceiptを残し、refresh復元を保証しない。既存receiptの受理と現在pathの一致は別判定。保存後に他者が訂正した値を昔のreceiptで上書きしない。古いcontroller completionが新しいdraftを消してはならない。

訂正は「すべて」から対象checkboxを解除する新しい行操作。新UIは`undoCollectionChange`を呼ばず、同helperのwhole-map契約を弱めない。解除でも保存中/失敗を表示し、他の行のチェックを戻さない。

### UI owner boundaries

App/navigationはdestinationと一つのpage anatomy/focusを所有。精算projectionはcurrent roomと既存domain resultから表示modelを作り、writeしない。金銭operation controllerは対象の再検証、既存command一回、exact receiptと回復だけを所有し、rowsはcontrollerへintentを渡す。memo controllerはmemo-only draft/save。history controllerは端末list/read-backと広範なrestore/Undo確認を所有し、既存history serviceを置換しない。controllerのlifetimeをpage unmountより長く必要なreceipt recoveryへ接続し、render effectからcommandを発行しない。

### Memo

精算メモは短いinline read/edit。TextArea、Primary「メモを保存」、Cancel。raw draftとopening memoだけをsession-local recoveryに持ち、Back/refreshは保持、publish前Cancelは破棄。保存は最新stateへmemoだけを重ねた既存command一回。他者が同じmemoを変更した場合は保存前に止め、控えを残して現在値から再編集を提供する。publish後はreceipt解決まで固定し、Cancelを共有変更のUndoと説明しない。メモ保存でcost/rules/paidを戻さない。

## 8. History page and restoration

### Local snapshots

`section=history-settings`で一覧を直接表示。説明「履歴はこの端末に保存されます。復元すると共有企画の状態を変更します。」page headerのTertiary「現在の状態を保存」。最大20件、新しい順、日時・企画名。保存者やsourceは実在するmetadataだけ。現在一致markerは既存snapshotとの比較で証明できる場合だけで、直前に選択した履歴を常に「現在」としない。

空状態は「この端末に履歴はありません。現在の状態を保存すると、ここから復元できます。」書込後は`history.read()`で対象time/dataをread-backして保存を確認。saveの返り値だけで成功にしない。quota/read failureはsection error。service.readはJSON/access errorを空配列へ変換するため、UIのread-only storage adapterで既存`history.key`の読み取り可能性/JSON arrayを検証し、不明や破損をdata 0件と区別する。既存storage shapeを書き換えたり自動修復しない。成功は増えたrow/現在markerで示す。重複なら新履歴を増やさず「同じ状態が保存されています」。初回loadやnavigationで自動snapshotしない。未解決共有writeの間はsnapshot作成を待たせ、端末反映だけの状態を共有確定backupと誤認させない。

### Restore confirmation

row「この状態を復元」から短いdanger dialog。title「この履歴を復元しますか？」、対象企画名/日時、既存migration後の参加者・車/班・費用/ルール・集金/支払い記録・企画情報への変更範囲を要約する。snapshotの生JSON、tokens、内部pathを表示しない。

説明は「記録を復元しても、実際の集金や支払いは取り消されません」。端末の未保存draft、履歴一覧、ルート作業draft/認証は復元対象外。応募連携metadataは既存restoreと同期ownerの規則に従うため、応募フォーム自体や連携解除まで戻るとは約束しない。current resetGenerationを戻さない。既存tombstone/mergeが昔の参加者を復活させない場合も調整として扱い、domainを迂回しない。

Primary danger「この状態を復元」、Secondary「キャンセル」。対象・影響を明示し、全体変更の理解を示す確認checkboxを要求する（企画名入力を二重に要求しない）。submit直前にcurrent business state/target snapshotを再照合。確認中に関連stateが変わったら実行せず、最新影響を提示して再確認する。sync ledger/revisionだけの更新とbusiness変更は既存entity patch semanticsで区別する。未知の新版/壊れたsnapshotは保存済み一覧から削除せず復元を止める。

確認済みのtargetに`history.restore`を一回だけ実行し、その既存intentを捕捉する。成功boolは共有受理ではない。受理・調整・失敗・未確認は§7同様、入力済み金銭チェックも復元されることを明示。失敗retryでrestoreを再実行してbackupを上書きしない。既存receipt helperが許す同一patch再送だけ。既存domainの同時編集mergeを維持し、原子的な全roomロックを保証しない。

復元の変更範囲は広いため、history payload/metadataを新しいUI recoveryへ複製しない。full patch/backupを新規browser storage・ログへ保存しない。既存history/outboxをsourceとし、UIのdurable控えはoperation ID/reset/履歴time/disposition等の最小識別だけ。refresh後にexact patch/outcomeを安全に復元できなければ「受理済み・現在の企画を確認」または未確認を示す。受理証拠がない場合は未確認、受理だけで完全一致の成功とは扱わない。復元commandの自動再実行は禁止。

### Conditional undo

Undoはserviceのmemory backupがあり、同じruntimeセッション、直前のrestoreが調整なしで受理確認済み（localなら端末適用済み）、他の未解決writeなし、受理状態全体が当該commandの端末適用後のbusiness状態と一致し、その後変化していない場合だけ提供する。own patch一致だけで、保存中に追加された別の他者dataを安全に戻せるとは判断しない。UIは端末適用後と受理直後のbusiness状態のfingerprintをmemoryに持ち、確認中/実行直前も再照合する。後続の他者・自端末編集、reset、新たなrestore、refreshで条件を失ったら入口を閉じる。固定秒数やrefresh後の取り消し保証を作らない。

「復元を取り消す」も全体への変更なので短いimpact確認を行い、既存`history.undo`を一回だけ実行してそのwriteを追跡する。現行serviceのbackup消費を保持し、失敗で架空の2回目Undoを作らずexact patch retryを使用する。安全なUndoが提供できない時は既存履歴からの明示復元へ誘導する。各金銭記録の通常訂正とは別操作。

## 9. Existing danger utilities

既存participant/group deleteのworkflowはPhase D/E契約を維持し、Hで再設計しない。実在しないproject delete/reset/設定pageを足さない。共有環境にはsample entryを公開しない。

local/demoのサンプル入口は通常help/theme/bug menuから外し、履歴pageの分離された「開発用操作」からsample taskへ接続する。既存通常/入力漏れ/応募連携sampleと車数選択を保持。選択自体はwriteなし。Tertiary「置換内容を確認」→短いdanger dialogで対象企画と失われる現在data、local/demoであることを示し、理解checkbox + danger「サンプルで置き換える」。cancelで元dataと選択を保持。submit時にcurrent/choiceを再検証し、既存sample生成とrestore commandを一回だけ実行する。fixture/実在サンプルの生成規則やmetadataを変えない。

「リセット」を「最後に保存した状態へ戻す」と一律に説明するとsample置換の実態と異なる。§12のnormative改訂案で、履歴復元・サンプル置換・削除を実際の結果に即して区別する。sampleを汎用本番resetとして流用しない。

## 10. Responsive, accessibility, and content

- Carbon Grid/Columnと既存token。lg以上でsummary/補助をcolumn化できるが、金銭一覧を二つ並べない。lg未満は現在taskのsummary→filter→一覧→補助の順。document scrollがowner、独立scroll cage/fixed footer/bottom sheetを追加しない。
- 約390pxのrowは名前→金額/状態→操作が読めるcompact配置。long name/企画名/負額をwrapし、行の高さを固定しない。内訳とhistory日時に横scrollを要求しない。
- filter/checkbox/記録actionはtouch hit areaを確保。UI追加CSSはowner-localで、spacing/type/layer/breakpoint tokensを優先。global Carbon internal selector/focus overrideは禁止。
- 一つのmain/h1、各summary/list/disclosureに適切なheading/name。checkboxに対象名、記録inputにlabel、error association。行全体を曖昧なclick targetにしない。
- 記録開始はinput、cancelは行trigger、submit errorはinvalid field、Modal dismissは実在row/utility triggerへfocus。対象が消えたらlist headingへfallback。filter変更でh1へfocusを飛ばさない。
- 金額・件数・保存状態の更新は短いpolite announcement。全一覧の再読み上げや毎回Toast、長い同一原因notificationsを避ける。pending checkboxと確定記録を読み分けられる。
- 短い確認Modalはkeyboard trap/Escape/focus returnを検証。publish前だけCancelはwriteなし。publish後の閉じる/戻るでoperationを取消済みと説明しない。
- g10/g100、reduced motion、短いviewport/safe-area、software keyboard時のinline input/actionsへの到達性を確認。Playwright viewport/touchの結果を実機keyboard/実screen reader確認と混同しない。後者は未検証ならPhase Iに明示する。
- 用語は「未集金」「集金済み」「未払い」「支払い済み」。古い「未回収」testは文言ではなくobservable stateへ移す。copy結果は対象が分かる短文。履歴は端末保存と共有復元を区別し、内部語を露出しない。

Empty/state rule: 初期loadはpage anatomyのSkeleton、local記録待ちは行のloading。参加者0（人数だけの精算でない）は既存登録/rules入口、車0は車割/rulesの前提確認、未処理filter 0件は「現在の未集金者/未払いの車はありません」+「すべて」、対象0と全記録済みを区別する。履歴load不能はerrorであって空状態ではない。保存不能/対象曖昧のdisabled controlには理由を隣接表示し、コピー不能時は選択可能な名前textを残す。

## 11. Validation and exit gates

本書作成時点では未実施。実装計画で下記を具体的なtests/fixtures/commandsへ割り当てる。source textやclassだけをcontractにしない。

| Coverage | 必須の観測 / 比較 |
| --- | --- |
| URL / shell | direct/shared/legacy、parent↔collection↔payments、rules/費用への接続、Back/Forward/refresh、current location、heading/return focus。初回entry無write |
| Calculation preservation | normal/standalone、割勘/部費、免除/差引、協力代、端数、0/負額、複数driver。同じinputsの既存result、他feature stateが不変 |
| Collection | 登録参加者直接チェック、standaloneのinline記録/Cancel/fallback/IME/context変更、除外理由、未集金/すべて、コピー、解除で他行を維持、focused row消失 |
| Payment | 車単位、運転手role表示、driverPaid記録/解除、未払いfilter、内訳/費用link、0/負額、同名/unsafe/deleted/renamed targetの安全停止 |
| Write recovery | exact intent/changed paths、double submit、一件outbox、receiptのpending/failed/unknown/adjusted/reset、reject/expiry/retry、refresh、storage failure、古いcompletionの無作用 |
| Real Emulator / multi-client | 別行集金、同一行訂正、車支払いと別車費用/ルールの並行変更、rename/delete/reset、offline/reconnect。他者変更を戻さず、受理証拠なしsuccess不可 |
| Memo | raw recovery、Cancel無write、同じmemoの競合、他者paid/costを保存で戻さない、receipt retry/failure |
| History | empty、save/readback/quota failure/dedup/20件、current marker、restore confirmation/Cancel/変更中再確認、metadata/tombstone/paid等の実際のrestore範囲、共有受理/調整 |
| Restore Undo | 同session条件付き成功、後続自端末/他者変更で停止、refresh/reset/pendingで停止、Undo失敗のexact retry。copy/log/cacheにroom/tokenを複製しない |
| Sample danger | local/demoだけ入口、共有URL無write、選択/確認Cancel、strong確認、stale target再確認、通常/連携/入力漏れfixtureと既存metadata互換 |
| Browser / semantics / geometry | Desktop Chromium/WebKit、約390px Chromium/WebKit、light/dark、keyboard/touch、focus/landmark/label/disclosure、long title/name、no overflow、short viewport。before/after証跡 |

Phase G含む累積unit/browserと関係するshared互換checkをgateで実行。旧Modal構造を固定したtestだけはbehaviorへ置換し、paidBy/driverPaid、whole-map helper等のdomain assertionは弱めない。新しいskip/timeout緩和でgreenにしない。手計算fixtureと複数client再読込でも結果一致を確認する。

Exitは必要なspec改訂承認、実装、関連test/browser証跡、PR/CIがgreen、`carbon-redesign`への安全な統合。Phase Hだけでproduction releaseしない。physical keyboard/SR、provider live coverageなどPhase I事項は実測未確認と区別して残す。

## 12. Proposed normative clarification after written-spec approval

実装前に唯一のownerへ次を反映し、本書では詳細根拠・traceabilityを残す。現行v1.5を本書だけで上書きしない。

1. §11/14: collection/paymentsのdurable subroute、リンクnavigationと各一覧のfilterの分離。車単位state、名前記録、field/receipt、0/負額・計算額と授受記録の限界を明示。
2. §6/14: 新UIの訂正は対象行の逆操作。既存whole-map Undoを変更せず採用しない。exact receipt、一件outbox、未確認保存の回復規則、memo-only Saveを具体化。
3. §15: 履歴は端末に最大20件、手動保存/read-back、共有復元。current markerの証拠、復元確認とmemory Undoの成立条件。source/creatorがない時は捏造しない。
4. §16: Resetの一律label定義を、履歴復元・サンプル置換・実在する削除それぞれの結果に基づくlabelへ改訂。sampleのhigh-impact確認を具体化。未実装settings/project deleteは導入しない。
5. §17/18/20/22: 金銭状態の用語、row消失のfocus、page/list layout、no false completion/receipt success。保護domain/serviceを変えない条件を維持。

## 13. Specification self-review and handoff

- 2026-10-05: code owners、normative precedence、Phase H entry/exit、公式一次資料を照合。local履歴とshared復元、金額と記録、reversalとwhole-map Undoを区別した。
- conversational approvalを実装許可と混同せず、statusをwritten review待ちにした。存在しないdelete/settings、archive、授受台帳、bulk/new protocolをscopeへ入れていない。
- storage returnの成功誤認、同名target、single-outbox置換、refresh後Undo、resetGenerationがrestoreで増えない制限、receipt payloadの機密data複製を明示した。
- placeholdersなし。受理と現在値の一致、Cancelとpublish後の戻るを分離。spec作成は機能/test/browser完了の証拠ではない。
- 本書は「実装計画へ」で承認済み。次のgateはimplementation planのレビュー。normative改訂はplan Task 1でUI実装前に行い、plan review/実行方式の承認後に実装へ進む。
