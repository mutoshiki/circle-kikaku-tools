# 山歩会企画ツール Product UI specification

Status: normative product UI specification v1.0 (effective 2026-09-29)  
Research snapshot: 2026-09-29  
Design basis: [CARBON_PRODUCT_PRINCIPLES.md](./CARBON_PRODUCT_PRINCIPLES.md) / [CARBON_PATTERNS.md](./CARBON_PATTERNS.md)

Contract role: 山歩会企画ツール固有の唯一のnormative product UI specification。Phase B以降のtarget IA、workflow、interaction、content、responsive behaviorとUI PRのminimum review gateを所有する。

## 0. Contract authority and use

本書はPhase B以降のReact UI実装とdesign reviewが参照する、山歩会企画ツール固有の **normative specification** である。本書の規則はすべてProject interpretationであり、Carbon公式の直接的な規則ではない。Carbon公式の根拠はProduct Principlesの`Official guidance`、taskからpatternを選ぶ共通基準はCarbon Patternsへ分離する。

規則語:

- **MUST / 必須**: PRをmergeする前に満たす。満たせない場合は、仕様改訂または明示的な例外承認が必要。
- **SHOULD / 原則**: 強い既定。逸脱理由、代替、検証結果をPRへ記録する。
- **MAY / 任意**: task、data、viewportに応じて選べる。

### Document authority

| Document | Owns | Does not own |
| --- | --- | --- |
| 本書 | product固有IA、workflow、action/save/state/content/responsive contract | Carbon公式の一般要約、現状証拠、実装順序 |
| [CARBON_PRODUCT_PRINCIPLES.md](./CARBON_PRODUCT_PRINCIPLES.md) | Carbon公式の根拠と横断設計原則 | 個別flowのtarget structure |
| [CARBON_PATTERNS.md](./CARBON_PATTERNS.md) | taskからpatternを選ぶ共通基準 | 個別画面の必須構造 |
| [CURRENT_UI_AUDIT.md](./CURRENT_UI_AUDIT.md) | 現状証拠、問題、source owner | 将来仕様、優先順位、例外承認 |
| [CARBON_MIGRATION_ROADMAP.md](./CARBON_MIGRATION_ROADMAP.md) | Phase順序、依存関係、entry / exit gate | target UIの内容 |

適用順は次のとおり。

1. 既存data compatibility、domain calculation、sync / Firebase / persistenceなどのprotected behavior。
2. 本書のproduct-specific rule。
3. Product PrinciplesとCarbon Patternsの共通rule。
4. Roadmapの現在Phase gate。
5. Auditは判断の根拠として参照するが、normative ruleを上書きしない。

競合を見つけたPRは都合のよい文書を選ばず、仕様ownerと競合箇所を記録して先に文書を改訂する。Carbon公式や`@carbon/react`のversion更新は自動的に本contractを変更しない。現行packageのexport、props、DOM、keyboard behaviorを確認し、必要なcontract変更を同じPRでレビューする。

### Approved defaults for unresolved implementation choices

- Project list / project creationの新規product ownershipはPhase Bのscope外。既存room URL、shared link、project opening behaviorを維持し、別のdata / ownership承認なしに新しいproject repositoryを導入しない。
- Phase Bのnavigation component名は固定しない。現在地、stable destination、URL / refresh / back、focus、desktop / mobile behaviorを満たすことがcontractであり、installed Carbon versionで検証したcomponentを選ぶ。
- Carbonに安定したside-panel contractがない場合、full page、nested page、またはinline split viewを使う。独自panelをModal代替として増やさない。
- Settlement rulesはsingle-page grouped formを既定とする。順序依存を実データとtask testで示せた場合だけpage wizardを採用し、Modal wizardにはしない。
- Collectionとrecipient paymentは異なるstateとheadingを持つ。1 route内の別sectionでも別routeでもよいが、同一control・同一statusへ統合しない。

## 1. Product model

山歩会企画ツールは、1企画について次の成果を順に作るproductive applicationである。

1. 企画の基本情報を定義する。
2. 応募を取り込み、参加者を確定する。
3. 車・班・ルートを編成する。
4. 移動費、追加費用、部費、免除、控除を確定する。
5. 誰が誰へいくら支払うかを確定し、集金・支払い完了まで追跡する。
6. 履歴、共有、引き継ぎを管理する。

UIはこのlifecycleを反映する。domain objectと保存schemaは現行互換を維持し、表示構造の変更と切り離す。

## 2. Canonical information architecture

### Global level

- Product identity: 山歩会企画ツール
- Current project selector / project title
- Related tools switcher
- Global utilities: help、theme、bug report
- Connection / sync status: 問題がある時、または保存中だけ明確に表示

### Project level

1. **概要**: 企画名、日程、メモ、時刻表、進捗、次の作業
2. **参加者**: 応募取込、応募者確認、参加者確定、発表、引き継ぎ
3. **編成**
   - 車割
   - 班割
   - ルート / 移動
4. **精算**
   - 精算概要
   - 費用・車ごとの費用
   - 割勘・部費・免除・控除
   - 集金・支払い状況
5. **履歴と設定**: snapshot / restore、project settings、danger zone

この構造はtarget IAであり、既存4 Tabsの1対1改名ではない。URL、state restoration、権限、legacy compatibilityをPhaseごとに追加検証する。

## 3. App shell

### Desktop

- Carbon Headerはglobal navigationのownerとする。
- Product nameは左端。current project titleはheaderではread-only contextとして示し、編集はOverview pageだけで行う。
- Related appsはapp switcherに維持する。外部/別toolであることをlabelとlink semanticsで示す。
- Utility menuにはhelp、theme、bug reportを置く。sample dataは開発・demo contextに分離し、productionのglobal utilityには置かない。
- Project navigationはHeader Tabsではなく、project内work areaとして現在地を示す。実装componentはCarbon公式と現行versionをPhase Bで確定する。

### Mobile

- Headerはproduct identity、project/navigation trigger、essential utilityに絞る。
- 現在のwork areaとproject titleをmain contentのpage headerで再提示する。
- 4つ以上のwork areaを横幅いっぱいのTabsへ圧縮しない。
- Navigationを開閉した後は元triggerへfocusを戻し、現在pageをprogrammaticに示す。

### Invariants

- global headerはpage primary actionを所有しない。
- sync errorをToastだけにしない。
- theme切替は現行g10/g100 token contractを維持する。

## 4. Page layout and header

各pageは次のanatomyを持つ。

1. Breadcrumb相当が必要なnested taskでは、戻り先を明示する。
2. `h1`: task / object名。
3. Status / summary: 人数、未割り当て、未回収など、判断に必要な1–3項目。
4. Primary action: page goalを前進させる1つ。
5. Secondary / tertiary actions。
6. Main sections: workflow順。

Layout rules:

- Carbon Grid / Column、標準breakpointを使う。
- Desktopのmain contentは、scan中心pageなら広く、form中心pageなら読みやすいcolumn幅に制限する。
- Sectionはheading + optional description + content。Tileで囲むことを既定にしない。
- Summaryと編集formを同時に全て表示しない。read modeから明確にedit modeへ移る。
- mobileは1-columnを基本とし、actionをcontent順へ移動する。無条件のfixed footerは使わない。

## 5. Action hierarchy

### Primary

現在のpage goalを前進・完了するaction。通常1 pageに1つ。

- 参加者: 「参加者を確定」または未登録時の「応募を取り込む」
- 車割: selection contextで「車へ割り当て」
- 精算: 設定不足時「精算設定を完了」、運用時「集金を記録」ではなくrow-level state changeが中心
- Form: 「保存」「登録」「適用」

### Secondary

Primaryと同じtask内の代替・補助。Cancelを含む。Primaryなしで単独使用しない。

### Tertiary

独立したsub-task開始。例: 「ルートから距離を計算」「精算設定を編集」。ただし頻繁・複雑ならpage navigationに昇格する。

### Ghost

低強調の補助、コピー、表示切替、詳細。主要な状態変更をGhostへ隠さない。

### Icon-only / Overflow

- Icon-onlyはspace-criticalで意味が標準的な時だけ。tooltipとaccessible name必須。
- Overflowは対象固有の低頻度action。編集、複製、削除の順序を統一する。
- Dangerをicon-onlyにしない。

## 6. Save and edit behavior

| Change type | Model | UI rule |
| --- | --- | --- |
| 企画名など単一・可逆値 | defaultは明示的edit + save | autosaveを導入する場合もedit state、保存中/失敗、確定値、復旧手段を示し、blurだけに依存しない |
| 企画情報・時刻表 | local draft + explicit shared save | page form。未保存表示。離脱時に扱いを確認 |
| participant / group属性 | explicit save | short formならModal可。複雑化したらdetail page |
| participant selection | staged selection + apply/confirm | selection toolbar。変更影響をconfirm |
| 精算設定 | explicit save as one transaction | dedicated settings task。validation後にcommit |
| 車両費用 | local draft + apply per logical unit + final save | dedicated workspace。nested modalにしない |
| 支払い済み / 集金済み | immediate state change + recoverability | row内で結果を即表示。既存ownerがreversalを許す場合は戻せる操作を提供し、失敗時は確定表示しない。毎回toastなし |
| 履歴復元 | explicit destructive/impact confirmation | 復元対象時刻、影響、取り消し可否を示す |

Label definitions:

- **保存**: draftをpersistent/shared stateへcommitし、通常surfaceを閉じる。
- **適用**: 計算・選択結果を現在のediting contextへ反映し、必要ならcontextを維持する。
- **確定**: 後続taskへ影響するstate transition。
- **キャンセル**: 未保存変更を破棄して戻る。
- **閉じる**: state変更なしでsurfaceを閉じる。Cancelと併置しない。
- **戻る**: 前step / parent taskへ戻り、draft保持規則を明示する。

## 7. Overview / project creation and edit

### User goal

企画を作成し、他の作業の前提となる名前、日程、時刻表、メモを共有する。

### Target structure

- Dedicated Overview page。
- Header: project title、last saved / sync issue、primary「編集」。
- Progress summary: participant確定、車割、精算など未完了taskへのlink。
- Details: 日程、説明、時刻表をread viewでscan可能に表示。
- Edit mode: logical group順のform。時刻表はrepeating rowとして追加/削除。shared save 1つ。
- Danger zone: project delete/resetは通常contentから分離。

### Rules

- 長いOverview editorをModalにしない。
- 「この端末の下書き」は通常時のInline notificationではなく、edit headerのdraft statusとして表す。
- Project作成と既存project編集は同じform anatomyを共有してよいが、submit labelを区別する。

## 8. Participant workflow

### 8.1 Applicants and import

User goal: 応募dataを誤りなく取り込み、確認可能な参加者候補にする。

Target structure:

1. Dedicated「応募を取り込む」page / flow。
2. Source選択: spreadsheet paste / manual entry。
3. Paste areaと短いformat guidance。
4. Parse result preview: recognized、warning、errorをrow単位で表示。
5. Correction step。
6. 「参加者候補として登録」でcommit。

Rules:

- spreadsheet pasteとmanual fallbackの全fieldを1 large Modalへ同時に置かない。
- helpは必要箇所のdisclosure。必須手順をAccordion内へ隠さない。
- parse errorはglobal errorだけでなくrow/fieldへ関連付ける。
- mobile keyboardに合わせtextarea/input typeを選ぶ。

### 8.2 Participant list and confirmation

User goal: 誰が参加するかを確定し、後続の車割・班割・精算を正しく作る。

Target structure:

- Page header: state「未確定 / 確定済み」、人数、primary action。
- Toolbar: Search、filter、result count。filterは必要時にexpandするが、適用中条件を常時見せる。
- Contained list: nameを主、学年/車出し/しるしをsecondary metadata、selectionを同じ位置に揃える。
- Selection mode: selected count + 「参加者を確定 / 選択を反映」+ Cancel/clear。
- Confirmed後: next tasksとして「車割へ」「発表文を作成」「引き継ぎdataを作成」。同格のcardを並べず、workflow groupにする。

Rules:

- 検索0件、filter 0件、data 0件を異なるempty stateにする。
- Participant editは現在の少数fieldならModal可。fieldが増えたらdetail page。
- 削除と「参加者から外す」を区別する。後者は応募dataを残す可能性と後続assignmentへの影響を明記する。

## 9. Car and team allocation

### User goal

参加者を車・班へ過不足なく割り当て、未割り当てとcapacityを解消する。

### Target structure

- Car allocationとteam allocationは同じallocation workspace patternを共有する。
- Page header: assigned / unassigned / capacity issue summary。
- Desktop: groupsとunassigned poolを同時に見られる2-column workspace。
- Mobile: current group list→group detail→unassigned selectionのtask順。長いdrag操作を必須にしない。
- Group list: title、member count/capacity、driver/leader、issue status。
- Row actions: 現行pin/lock semanticsは維持する。頻繁に使う根拠がない限り、rename/capacity/deleteとともにOverflowまたはgroup detailへ置く。
- Random allocation: tertiary tool。実行前に保持されるlockと変更範囲、実行後に結果reviewを示す。

### Rules

- 現行のproductiveなlist densityと未割り当て表示は維持する。Contained listはrow semanticsが合う場合の既定componentとする。
- 空席はprimary data。closed disclosureのlabelに件数を残す。
- Deleteはmemberが未割り当てへ戻ることをconfirmする。
- dragがある場合もkeyboard/touchの選択→移動代替を必須にする。

## 10. Route and movement

### User goal

各車の出発・経由・目的地から移動距離と経路を確認し、費用計算へ正しい距離を適用する。

### Target structure

- Project IAの「編成」に属するdedicated route task。Car allocationとvehicle cost detailの両方から同じcar contextへdeep-linkでき、戻り先とdraftを保持する。Modal内でexpense→movement→routeをview切替しない。
- Header: 対象車、current distance、Back to vehicle costs。
- Stop list: origin、waypoints、destination。検索、並べ替え、削除。
- Map / route alternatives: desktopはlist + map、mobileはroute summaryを先、mapは必要時に表示。
- Advanced route optionはDisclosure。
- Primary「この距離を適用」。計算結果を保存済み費用と区別する。

### States

- Empty: 出発地と目的地の入力を促す。
- Loading: search field / route result regionだけbusy。
- No result: queryを保持し、修正方法を示す。
- Error: API / network / invalid stopsを区別し、再試行action。
- Map unavailable: text route summaryとmanual distance入力をfallbackとして保つ。

### Accessibility

- Mapを唯一の情報源にしない。
- Search result countとselectionをannounceする。
- Stop reorderにbutton/keyboard代替を用意する。
- `role="application"`は複雑なkeyboard contractを実装・検証できる場合だけ。

## 11. Settlement information architecture

### User goal

企画終了後、費用とルールを確定し、誰が誰へいくら支払うかを理解し、集金・支払い完了まで管理する。

### Canonical sections

1. **精算概要**
   - readiness / blocking issues
   - total、payer count、uncollected、unpaid driver payments
   - 次に必要なaction
2. **費用**
   - 車ごとの費用
   - 追加費用
   - 移動距離 / movement method
3. **精算ルール**
   - 割勘方式
   - 部費
   - 免除
   - 控除
   - rounding / collector / organizer
4. **集金**
   - participantごとの請求額、除外/免除理由、集金済み
5. **支払い**
   - recipient/driverごとの支払額、内訳、支払い済み
6. **メモ**

これらを1 pageの5 Tileへ連続stackしない。Overviewから明確なlocal navigationまたはtask linkで各work areaへ移る。Collectionとpaymentは同一route内に置けるが、独立heading・summary・state ownerを必須とし、同一status listへ混在させない。

## 12. Costs and vehicle costs

### Target structure

- Vehicle cost list: 車、合計、距離、issue、last update。
- Vehicle cost detail/workspace:
  1. 費目list
  2. 選択中費目のeditor
  3. 計算preview / formula
  4. route task link
  5. unsaved status + Save/Cancel
- Standard費目と追加費目を同じrow anatomyへ揃える。
- Amount、quantity、per-unit、movement typeの依存関係をform groupとして示す。

### Rules

- 費目を切替えても未保存draftを失わない。
- Deleteは追加費目のみ。標準費目の0円化/無効化とdeleteを混同しない。
- Formulaはread-only summaryとして常時確認可能。
- 「ルートから距離を計算」はtertiary navigation。nested modalにしない。
- Mobileは費目list→費目editのdrill-in構造を使い、Back時にlist位置とdraftを復元する。

## 13. Settlement rules: split, club fee, exemption, deduction

### Target structure

- Dedicated settings page。関連するgroupをworkflow順に並べる。
- Page headerにcurrent modeとblocking issues。
- Sections:
  - 対象者と企画者
  - 割勘 / rounding
  - 車出し協力代・部費
  - 免除 / 控除
  - 集金担当
- 右または末尾に計算preview: payer count、1人額、total consistency。
- Save前に全sectionをvalidationし、最初のerrorへfocus。

### Wizard choice

既定はsingle-page grouped formとする。Stepが順序依存で、後stepの内容が前stepによって変わることをtask testで確認できた場合だけpage wizardを使う。どちらもModalにはしない。

### Exemption / deduction rules

- 人単位・理由・金額/割合・計算への影響を同じrowで読める。
- Exemptとpaidを同じstatusにしない。
- 免除削除は通常のrule removal。計算結果の変化を保存前previewで示す。

## 14. Collection and payment status

### Collection

- Summary: 回収済み / 対象人数、残額。
- View filter: すべて / 未回収のみ。
- Row: participant、請求額、免除/除外、collector、paid state。
- Mark paidはrow-level immediate action。複数人のbulk updateが実際に必要ならselection modeを追加する。

### Driver / recipient payment

- Summary: 未払い件数 / total。
- Row: recipient/vehicle、支払額、state、detail disclosure。
- Detail: 誰からの集金を原資とするかではなく、計算内訳をscan可能に示す。
- Paid toggleは結果をrow内で即表示し、Toastを重ねない。

### Invariants

- Collection済みとrecipient支払い済みは別state。
- Calculation resultはUI側で再計算しない。現行domain resultをpresentationする。
- 同期競合や保存失敗時はoptimistic stateを確定表示しない。

## 15. History

### User goal

過去のsnapshotを識別し、安全に復元し、必要なら取り消す。

### Target structure

- Project navigationから到達するdedicated History page。Overviewからはtask linkで同じdestinationへ移動する。
- History list/Data table: timestamp、project name、creator/sourceがあれば表示、current marker。
- Primary actionは通常不要。「現在の状態をsnapshot」はpage headerのtertiary action。
- Row action「この状態を復元」。復元前に影響を確認。
- Restore undoが実在する期間だけInline actionとして表示。

### Rules

- 履歴をlarge Modalで長くscrollさせない。
- Empty stateは履歴の生成条件と「現在の状態を保存」を示す。
- Restore後に何が戻り、何が戻らないかを明記する。

## 16. Delete, reset, and danger zone

Risk tiers:

- Low / reversible: 即時実行し、既存ownerがreversalを保証できる場合はUndoまたは逆操作を提供する。
- Moderate: danger confirmation。対象、影響、戻し方を示す。
- High / broad reset: project settingsのDanger zone。対象名入力または同等に対象と影響を再確認できるstrong confirmationを必須とする。

Placement:

- Row delete: Overflow末尾、divider付き。
- Project delete / sample reset: normal utilityから分離。
- Resetは「最後に保存した状態へ戻す」、Deleteはdata除去としてlabelを分ける。

Wording examples:

- Title: `田中さんを参加者から外しますか？`
- Body: `車割・班割・精算の割り当ても解除されます。応募者データは残ります。`
- Primary: `参加者から外す`
- Secondary: `キャンセル`

## 17. Empty, loading, error, and notification

### Empty

| State | Message purpose | Primary next action |
| --- | --- | --- |
| project未設定 | 作業開始条件 | 企画情報を入力 |
| participant 0 | 登録方法 | 応募を取り込む |
| search 0 | query/filterに結果なし | 条件を解除 |
| car/team 0 | 前提または作成 | 車/班を追加 |
| history 0 | まだsnapshotなし | 現在の状態を保存 |
| settlement not ready | blocking prerequisite | 問題のsectionへ移動 |

### Loading

- App initial load: page anatomyに合わせたSkeleton。
- Local save/search: 対象control/regionのloading。
- Sync: backgroundで進み、長引く時だけstatus。

### Error

- Field: field下、修正方法。
- Form: field error + page/form summary。
- Section: Inline notification + retry/action。
- Global: load不能、sync outageのみ。
- Errorで入力draftを消さない。

### Notification

- Success Toastはclipboard、background exportなど画面変化だけで不明な時に限定。
- Persistent warning/errorは関連sectionに置く。
- 同一原因の複数Inline notificationsをstackしない。

## 18. Content wording

- User conceptを統一: `応募者`、`参加者`、`車出し`、`車割`、`班割`、`集金済み`、`支払い済み`。
- `反映`は単独で使わず、`参加者を確定`、`距離を適用`、`選択を保存`のように対象と結果を明記する。
- `設定を確認してください`だけで終わらず、欠けている項目をtitleまたはlistで示す。
- Buttonは短い動詞。説明文をButtonへ入れない。
- Confirmationに不要な敬語を入れない。
- Internal terms (`room`, `schema`, `outbox`, adapter)を表示しない。

## 19. Touch, keyboard, focus, motion

- Icon-only / menu triggerは44×44px相当のhit areaを確保する。
- Pointer dragにselection + moveの代替を用意する。
- Keyboard順はvisual orderと一致させる。
- Modal close、menu close、nested task backで元の論理triggerへfocusを戻す。
- Page navigation後は原則`h1`へprogrammatic focusを移す。Headingをfocus targetにできない実装では`main`へ移し、screen readerへpage changeを伝える。
- Error submit後は最初のinvalid fieldへfocus。
- MotionはCarbon productive motion tokenを使い、`prefers-reduced-motion`で不要animationを抑える。

## 20. Responsive rules

| Area | Desktop | ~390px mobile |
| --- | --- | --- |
| Project navigation | Persistent/local nav | Collapsible project nav、current pageをheaderで表示 |
| Page header | title + actions横配置可 | title/status、primary actionを順にstack |
| Participant list | rich row | 2–3行row、metadata priority、44px actions |
| Allocation | group + unassigned 2-column | list→group detail→assign flow |
| Cost editor | list + editor split | list page→edit page |
| Route | stops/results + map | summary/results先、map optional |
| Settlement overview | summary + task links | blocking issueとnext action先、long card stackを避ける |
| Data table | selected columns | semantic list/detailへ変換 |
| Modal | short centered | short viewport-contained。長いtaskはpage |
| Selection action | contextual toolbar | safe-area対応、contentを覆わない |

## 21. Component and token governance

- 実装前に現行`@carbon/react`のexport、prop、DOM、keyboard contractを確認する。
- Carbon Grid、spacing/type/color/layer tokens、breakpointを優先する。
- 任意CSSを追加するPRは「Carbonで表現できない理由」を説明する。
- Custom UIには、継承するCarbon principle、keyboard/touch/state contract、theme contractを記録する。
- Global `.cds--*` selector overrideは禁止する。回避不能な例外はowner、影響範囲、Carbonで代替できない理由、upgrade regression testを同じPRで承認する。
- UI surface変更時もdomain store、sync protocol、Firebase shape、settlement calculationを変更しない。

## 22. Global design invariants

Phase B以降のすべてのUI変更で、次を同時に守る。

1. User goal → task → IA → hierarchy → pattern → interaction → componentの順で判断し、既存componentの置換を設計理由にしない。
2. 1 page / 1 dialog / 1 selection contextのprimary actionは1つ。独立taskを同じTabsやModalへ押し込めない。
3. 長い、複数step、反復、元context参照が必要なtaskはModalにしない。Modalはbrief / focused / interruptible taskだけに使う。
4. Data shape、participant identity、calculation、sync、Firebase、persistence、shared-link compatibilityをUI都合で変更しない。必要な変更は別scopeと別承認に分ける。
5. Carbon Grid / component / token / interactionを先に使う。arbitrary value、独自focus / hover / dialog、global Carbon overrideは承認済み例外だけにする。
6. Empty、loading、error、disabled、unsaved、sync failure、destructive stateをhappy pathと同じ設計単位で定義する。Message文字列の解析でseverityやbehaviorを決めない。
7. Mobileをdesktopの縦積みとして扱わない。~390pxでtask順、touch、software keyboard、safe area、scroll owner、overflowを確認する。
8. Carbon componentの採用だけでaccessibleと判定しない。semantic structure、keyboard、focus entry / trap / return、name / label、announcement、reduced motionをcompositionとして検証する。
9. 操作結果を画面上のstate変化で理解できる場合、success Toastを追加しない。Persistent problemは関連sectionに置く。
10. Design完了やCI成功はproduction releaseの許可ではない。Deploy、compatibility、cutover、production smoke、production Firebase writeは別の明示承認を必要とする。

## 23. Minimum design review checklist for UI PRs

次の項目はPR descriptionまたはreview evidenceに残す。`N/A`は理由が具体的な場合だけ許可する。

### Scope and traceability

- [ ] 対象user goal、task、変更するflow、参照した本書sectionを記載した。
- [ ] 現在Phaseと、Roadmapのentry / exit gateを記載した。前Phaseのcontractを迂回していない。
- [ ] UI orchestrationとdomain / data changeを分離した。後者がある場合は別scopeと承認を示した。
- [ ] Existing componentを置換する前に、page / Modal / Tabs / Tile自体が必要か再評価した。

### Pattern, hierarchy, and content

- [ ] 選んだpatternの`Use when`と、退けた主要代替の`Do not use when`を説明した。
- [ ] Page anatomy、section hierarchy、1 primary action、secondary / tertiary / overflow / dangerのownerが明確である。
- [ ] Save / Apply / Confirm / Cancel / Close / Backの意味と、draft / persistence / failure時の挙動が明確である。
- [ ] 日本語labelだけで操作結果が分かり、同じconceptに同じ用語を使っている。
- [ ] Empty / loading / error / disabled / unsaved / sync / destructiveの該当stateを確認した。

### Carbon and custom implementation

- [ ] 現行`@carbon/react` versionのexport、props、DOM、keyboard contractを実装またはfocused testで確認した。
- [ ] Grid、spacing、type、color、layer、breakpoint tokenを使い、arbitrary CSS / 独自component / `.cds--*` overrideには承認済み理由とowner-local testがある。
- [ ] Official guidanceとProject interpretationをPR内で混同していない。公式主張にはCarbon公式の参照先がある。

### Interaction, responsive, and accessibility

- [ ] Desktop Chromium、~390px Chromium、~390px WebKitで主要taskを実操作した。
- [ ] Light / dark、keyboard-only、focus entry / order / return、short viewport、software keyboard、touch target、safe area、no horizontal overflowを確認した。
- [ ] Modal、menu、disclosure、navigation、validation、loading stateのaccessible name / relationship / announcementを確認した。
- [ ] Pointer / drag / mapだけに依存せず、keyboard / touch / textによる代替がある。

### Regression and evidence

- [ ] Protected data behavior、React / legacy compatibility、sync / persistence、settlement resultに変更がないことを適切なcontract / behavior testで示した。
- [ ] Exact source textやmagic numberではなく、ユーザーが観測するbehavior / geometry / accessibility contractをtestした。
- [ ] 変更範囲に必要なunit / contract / browser testと`git diff --check`がpassした。既知の別scope failureは名称と非影響根拠を報告した。
- [ ] Production deploy、compatibility deploy、root cutover、production smoke、production Firebase writeを実行していない。実行が必要なrelease PRでは別の明示承認とgateを示した。
