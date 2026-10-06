# 山歩会企画ツール Product UI specification

Status: normative product UI specification v1.6 (2026-10-05; approved Phase H collection/payment tasks, exact-operation recovery and local-history/shared-restore contract)
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
- Collectionとrecipient paymentは異なるstateとheadingを持つ。Phase Hでは反復操作のため専用subrouteとし、同一control・同一statusへ統合しない。

### Incremental applicability

本書は完成時のtarget contractを定義する。既存feature内部の移行はRoadmapの担当Phaseで完了する。各PRでは、今回導入するsurfaceと累積済みinvariantを必須とし、未移行surfaceはAuditの問題と担当Phaseを明示する。既存の長いModalやfeedbackをPhase Bで維持することは移行延期であり、適合の証明ではない。後続Phaseまで新たに同じ問題を増やしてはならない。

## 1. Product model

山歩会企画ツールは、短期間の企画運営において、参加者確定、車割・班割の作成と発表、車ごとの費用入力、精算と支払い確認を完了するためのproductive toolである。一般的なproject management dashboardや常時利用する登山中のactivity trackerを既定modelにしない。

### Product reality — user-provided primary evidence (2026-09-30)

次は利用者が共有した実運用であり、Carbon公式のguidanceではない。担当者の名称は説明用で、権限roleや新たな認証modelを定義しない。

| 実運用 | Timing / actor | 成果とhandoff |
| --- | --- | --- |
| 応募から参加者を選ぶ、必要なら手動追加 | 準備中 / 参加者を決める担当者 | 確定した参加者が車割・班割の対象になる |
| 手動・ランダムで車割と班割を作る | 当日朝まで / 割り当てを作る担当者 | 当日朝に参加者へ発表する、識別可能な車・班とmember一覧 |
| 登山・移動を実施する | 当日 / 参加者 | ツールの常時操作は目的ではない。専用の「実施中」pageはこの説明から導入しない |
| 距離と必要な費用を求める | 前日まで・当日・終了後のいずれもある / 距離・費用を確認する人 | 距離計算ツールまたは車のメーター等の値を精算へ使用 |
| 自分の車の精算情報を入力する | 各ドライバー、複数人がそれぞれ入力 | 車単位の距離・費用が共有され、精算計算のinputになる |
| 精算額と集金・支払いを確認する | 費用確認後 / 精算する人 | 計算結果の確認と実際の金銭移動の追跡 |
| 精算完了 | 企画終了後 | この企画での主な役割が終了。履歴・復旧・設定は必要時に使う補助機能 |

### Product interpretation and protected capabilities

- Taskは往復・並行する。7段階をwizard、mandatory stage、進捗率へ変換しない。距離・費用入力を「登山終了後にしか使えない」taskにしない。
- 企画名・メモ・時刻表は共有contextであり、作業開始の必須stepではない。概要を必須landing/dashboardにしない。
- 各ドライバーの車単位入力と、企画全体の精算rule / 集金 / 支払いを区別する。driver入力で他車のdraftや企画全体設定を巻き込まない。
- 応募連携、手動登録、手動・ランダム割当、発表・引き継ぎ、距離計算、車両費用・その他費用、人数だけの精算、割勘、部費、免除、控除、精算内訳、支払い済み管理を維持する。実運用に明示されない機能も、用途・依存・計算への影響を確認せず削除・簡略化しない。
- 完了は既存の計算結果と集金・支払いstateに基づいて表現する。架空の「企画完了」flag、新たなworkflow schema、自動archiveを追加しない。domain object、persistence、sync、calculation、schema / legacy compatibilityは保護する。

## 2. Canonical information architecture

### Global level

- Product identity: 山歩会企画ツール
- Current project selector / project title
- Related tools switcher
- Global utilities: help、theme、bug report
- Connection / sync status: 問題がある時、または保存中だけ明確に表示

### Project level

主要作業:

1. **参加者**: 応募連携から参加者確定、必要時の手動追加、参加者発表、引き継ぎ
2. **車割**: 手動・ランダム割当、確認、当日朝の車割発表
3. **班割**: 手動・ランダム割当、確認、当日朝の班割発表
4. **車両費用** (Phase Fで公開): 各ドライバーの車選択、距離・ルート / 移動・車ごとの費用入力。精算からも同じ対象車へ接続
5. **精算**
   - 精算概要
   - 費用の確認、同じ車両費用workspaceへの入口（別のeditor / draftを複製しない）
   - 割勘・部費・免除・控除
   - 集金・支払い状況
補助機能:

- **概要**: 企画名、日程、メモ、時刻表の共有context。内容を確認・編集したい時に開く
- **履歴**: snapshot / restore
- **設定** (Phase Hで実在するtaskのみ公開): project settings、danger zone。精算ruleは精算のtaskであり、genericな設定へ移さない

この構造はtarget IAであり、既存4 Tabsの1対1改名ではない。URL、state restoration、権限、legacy compatibilityをPhaseごとに追加検証する。

### IA rationale and phase exposure

- 車割と班割は準備の中心で、参加者確定後から当日朝まで繰り返し開く。Carbon SideNavの直接linkを使い、「運営準備」「編成」という折りたたみgroupを挟まない。4 Tabsの再採用ではなく、URLを持つtask destinationとして扱う。
- 概要と履歴は主要作業の後で視覚的・semanticに別groupへ置く。概要入力や履歴操作を主要作業の前提にしない。既存`section=overview` / `section=history-settings`は維持する。
- 概要と履歴は実運用の中心ではない。補助情報・復旧への到達性だけを維持し、landing、主要CTA、進捗dashboard、必須終了操作として強調しない。Phase Bで追加したという理由は優先度の根拠にならない（利用者の2026-09-30補足）。
- `room`のみのlinkは**参加者**を既定着地とする。これは実運用の開始taskに基づくProject interpretationであり、旧「概要」defaultを2026-09-30に改訂したもの。ドライバー等には明示的なtask / 車のdeep linkを使う。従来のroom-only共有linkも同じ企画を開くことを保護し、旧UIのlanding順自体は固定しない。
- Phase Bの公開先は参加者・車割・班割・精算・概要・履歴。車両費用は現在の精算画面の各車の入口を暫定利用し、Phase Fで独立した車選択 / 費用workspaceを公開する。未実装のnav itemや設定placeholderを追加しない。
- SideNavは最大2階層。精算のrule・集金・支払いはpage内のlocal navigation / task linkを使う。ルートは車両費用に属する共有taskとし、車割からも同じ車のcontextへ接続できる。別入口ごとに距離draftや計算ownerを複製しない。

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
- Navigationのdismissでは元triggerへfocusを戻す。destination選択ではpageへ移動し、現在pageをprogrammaticに示す。
- Mobile navigationはnon-modalなCarbon SideNavを使う。triggerからTabでlinkへ入り、navigation外へTabで出たら閉じ、移動先focusを維持する。Escape、scrimによるdismissはtriggerへ戻す。現在地を選び直した場合も閉じて`h1`へ移す。triggerは`aria-controls`と`aria-expanded`を持つ。Shellのutility / app switcherとmobile navigationを同時に開かない。

### Invariants

- global headerはpage primary actionを所有しない。
- sync errorをToastだけにしない。
- theme切替は現行g10/g100 token contractを維持する。
- `room`だけを含む共有URLの既定着地は**参加者**とする。現在のsectionはcanonicalな`section` queryで表し、明示されたdeep linkはrefresh、browser back / forward後も同じsectionへ復帰しなければならない。
- 旧`view=participants`、`view=sheet&allocation=*`、`view=seisan`は対応する新sectionへ受け入れるが、新しいnavigation後のURLからlegacy presentation parameterを除く。
- client-side section change後はpage `h1`へfocusを移す。初回表示では閲覧開始位置を奪わない。

## 4. Page layout and header

各pageは次のanatomyを持つ。

1. Breadcrumb相当が必要なnested taskでは、戻り先を明示する。
2. `h1`: task / object名。
3. Status / summary: 人数、未割り当て、未回収など、判断に必要な1–3項目。
4. Page-level action: 閲覧pageではTertiaryの編集開始など。taskを完了するPrimaryは必要な場合だけ、最大1つ。
5. Secondary / tertiary actions。
6. Main sections: workflow順。

Layout rules:

- Carbon Grid / Column、標準breakpointを使う。
- Desktopのmain contentは、scan中心pageなら広く、form中心pageなら読みやすいcolumn幅に制限する。
- Sectionはheading + optional description + content。Tileで囲むことを既定にしない。
- Summaryと編集formを同時に全て表示しない。read modeから明確にedit modeへ移る。
- mobileは1-columnを基本とし、actionをcontent順へ移動する。無条件のfixed footerは使わない。
- Project contextは`h1`の前の補助text、`h1`は現在のtask名、descriptionは必要な時だけ短く示す。metadataは判断に必要な情報だけをdescriptionの後にまとめる。global HeaderとSideNavのcontextは移動中の識別、pageのcontextはcontent閲覧中の識別を担う。
- DOM順はcontext / title / description → metadata → page actions → main contentとし、mobileの視覚順とkeyboard順を一致させる。desktopでactionsを横へ置いてもmetadataは非操作情報に限定する。
- Shellのtype roleは`h1`にproductive `heading-05`、md未満には`heading-04`、補助context / metadata labelに`label-01`、descriptionに`body-01`、metadata valueに`heading-compact-01`、外枠section titleに`heading-03`を使う。これは本製品の階層選択であってCarbonが指定したpage anatomyではない。固定heading tokenをbreakpointで切り替え、独自fluid sizeや未定義CSS変数を使わない。
- Supporting contentは所属section内またはdesktopの補助columnへ置く。feedbackは原因のあるform / sectionの近傍、global sync障害は共通status領域に置く。Phase Cで共通feedback contractを実装する。

## 5. Action hierarchy

### Primary

現在のpage goalを前進・完了するaction。1 pageに**最大1つ**。閲覧、状態追跡中心のpageではPrimaryを置かなくてよい。read modeの概要の「企画情報を編集」はTertiary、edit modeの「保存」はPrimaryとする。

- 参加者: 応募者のselection modeは「参加者を確定」。応募連携も参加者もない空状態は「参加者を追加」。確定済みのread modeにはPrimaryを置かず、追加はTertiaryのsub-task開始とする。
- 車割: selection contextで「車へ割り当て」
- 精算: 「精算ルール」を独立taskの入口として提供する。運用時はrow-level集金・支払いstate changeが中心であり、新たな完了flagを作らない
- Form: 「保存」「登録」「適用」

### Secondary

Primaryと同じtask内の代替・補助。Cancelを含む。Primaryなしで単独使用しない。

### Tertiary

独立したsub-task開始。例: 「ルートから距離を計算」「精算ルール」。複雑なtaskは専用pageへのnavigationとする。

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
| 精算ルール | local draft + explicit settings-only save | single-page task。field validity・write safetyを確認し、既存transactionとexact receiptを使用する。費用readinessは保存可否とは別 |
| 車両費用 | 車単位local draft + explicit shared save | dedicated workspace。費目切替に中間確定を要求しない。route結果だけを「適用」でdraftへ移す。nested modalにしない |
| 支払い済み / 集金済み | immediate state change + recoverability | row内で結果を即表示。既存ownerがreversalを許す場合は戻せる操作を提供し、失敗時は確定表示しない。毎回toastなし |
| 履歴復元 | explicit destructive/impact confirmation | 復元対象時刻、影響、取り消し可否を示す |

Label definitions:

- **保存**: draftをpersistent/shared stateへcommitし、通常surfaceを閉じる。
- **適用**: 計算・選択結果を現在のediting contextへ反映し、必要ならcontextを維持する。
- **確定**: 後続taskへ影響するstate transition。
- **キャンセル**: 未保存変更を破棄して戻る。
- **閉じる**: state変更なしでsurfaceを閉じる。Cancelと併置しない。
- **戻る**: 前step / parent taskへ戻り、draft保持規則を明示する。

精算ルールは戻る・navigation・refreshでUI-local raw draftを保持する。publish前のキャンセルはそのdraftのみ破棄し、no-op Saveはintentなしで親へ戻る。publish後は入力を固定し、既存operation receiptで成功・失敗・未確認を区別する。global sync状態や空のoutboxを成功の根拠にしない。retryは既存receipt helperの同一変更範囲を使用する。受理済みの調整結果やresetは成功として閉じず、明示的な「現在の精算を確認」で控えのみを破棄する。pending/unknownはこの操作で捨てない。

## 7. Overview / project creation and edit

### User goal

企画を作成し、他の作業の前提となる名前、日程、時刻表、メモを共有する。

### Target structure

- Dedicated Overview page。
- Header: project title、last saved / sync issue、Tertiary「企画情報を編集」。edit modeのPrimaryは「保存」。
- 必要なtask linkは提供してよいが、概要を必須dashboardにせず、未定義の準備進捗・完了率を作らない。
- Details: 日程、説明、時刻表をread viewでscan可能に表示。
- Edit mode: logical group順のform。時刻表はrepeating rowとして追加/削除。shared save 1つ。
- Danger zone: project delete/resetは通常contentから分離。

### Rules

- 長いOverview editorをModalにしない。
- 「この端末の下書き」は通常時のInline notificationではなく、edit headerのdraft statusとして表す。
- Project作成と既存project編集は同じform anatomyを共有してよいが、submit labelを区別する。

## 8. Participant workflow

### 8.1 Applicants and import

User goal: 自動連携の応募者から参加者を選び、必要な人を手動・表データから誤りなく追加する。

Target structure:

1. 手動・表データの追加はdedicated「参加者を登録」page。自動連携の応募者は参加者pageの選択・確定で扱う。
2. Source選択: spreadsheet paste / manual entry。
3. Paste areaと短いformat guidance。
4. 表データは同じpageで読取結果と編集可能なpreviewを示す。warningとblocking errorを区別する。parserがrow/field情報を提供する範囲で関連付け、存在しないrow identityを作らない。
5. 確認・修正の機会をcommit前に必須とするが、別step・確認buttonは必須ではない。短い手動追加は入力そのものを確認・修正できる構造と人数summaryで足りる。表データのsource変更後に古いpreview修正を適用しない。
6. 「参加者を登録」で既存addParticipantsへcommitする。参加者候補repositoryや新しい承認stageを作らない。自動連携の応募者だけは既存response identityを持つ選択を「参加者を確定」で適用する。

Rules:

- spreadsheet pasteとmanual fallbackの全fieldを1 large Modalへ同時に置かない。
- helpは必要箇所のdisclosure。必須手順をAccordion内へ隠さない。
- parse errorはglobal errorだけでなくrow/fieldへ関連付ける。
- mobile keyboardに合わせtextarea/input typeを選ぶ。
- Sourceごとの入力を保持し、UI-localで企画ごとにdraftを復元する。戻る・navigation・refreshでは保持、明示的キャンセル・成功した登録では破棄。端末保存不能時は入力を維持し、復元保証がないことを示す。
- 共有登録は既存syncの完了までbusyとし、失敗ではdraftと再試行を維持する。重複submitを防ぐ。UIの都合でschema、参加者identity、placement/driver副作用を変えない。
- 既存commandが端末へ反映した後は入力を固定し、共有保存の再試行で同じIDと変更範囲を維持する。復元用のUI-local receiptはそのcommandの変更pathと元値だけに限定し、room snapshot・他featureのdraft・認証tokenを複製しない。端末反映後のキャンセルは参加者を削除しないことを明示する。remote reset後に古い登録・確定を成功表示しない。

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
- 確定済みのread listはcanonicalな参加者属性と割当済みroleを表示し、応募者の選択listは応募回答・車出し可否を表示する。応募由来のname / grade / vehicle属性は既存の応募同期ownerに従い、手動修正を優先する新たな競合規則をUIだけで導入しない。
- 削除と「参加者から外す」を区別する。後者は応募dataを残す可能性と後続assignmentへの影響を明記する。

## 9. Car and team allocation

### User goal

当日朝までに参加者を車・班へ過不足なく割り当て、結果を参加者へ発表できる状態にする。

### Target structure

- Car allocationとteam allocationは同じallocation workspace patternを共有する。
- Page header: assigned / unassigned / capacity issue summary。
- Desktop: groupsとunassigned poolを同時に見られる2-column workspace。
- Mobile: current group list→group detail→unassigned selectionのtask順。長いdrag操作を必須にしない。
- Group list: title、member count/capacity、driver/leader、issue status。
- Row actions: 現行pin/lock semanticsは維持する。頻繁に使う根拠がない限り、rename/capacity/deleteとともにOverflowまたはgroup detailへ置く。
- 手動とRandom allocationは同じ成果を作る選択肢。手動で配置・調整でき、RandomはTertiaryの効率化toolとして発見可能にする。Random後も手動修正できる。実行前に既存lockと変更範囲、実行後に結果reviewを示す。
- 当日朝の発表は割当結果のhandoff。完成した車 / 班、運転手 / 班長、member、未割当 / capacity issueを確認・提示できるread presentationを持つ。投稿・コピー等の方式は既存capabilityと用途を確認してPhase Eで決定する。参加者発表文と割当結果発表を同一taskとして扱わない。

### Rules

- 現行のproductiveなlist densityと未割り当て表示は維持する。Contained listはrow semanticsが合う場合の既定componentとする。
- 空席はprimary data。closed disclosureのlabelに件数を残す。
- Deleteはmemberが未割り当てへ戻ることをconfirmする。
- dragがある場合もkeyboard/touchの選択→移動代替を必須にする。

### Phase E interaction contract

- 人数・上限は構造上の基準参加者（`ownerId`）を含む全員で表示する。保存上限は基準参加者以外を数えるため、表示・編集値は保存値+1とする。編集は全員を含む2〜100人（保存値1〜99）、既存のそれ以上の値は切り捨てず閲覧できる。これはUI換算であり、車の法定乗車定員の検証ではない。
- 基準参加者と運転手／班長は別概念。役割はplacementの明示値だけから表示し、複数人・未設定・基準参加者交代を保持する。固定は車割・班割共通のランダム制約であり、手動移動や上限縮小による既存の正規化を禁止しない。
- 手動操作は1人→1移動先→1回の既存move。別の車／班への移動を発見可能にし、一度未割り当てへ戻すことを要求しない。反復操作をModalにしない。上限・対象者・対象groupを実行時に再検証し、既存の正規化結果を表示する。
- 応募フォーム連携の車出し情報は既存のreconciliation ownerが維持する。連携車の上限変更／削除では連携値の再適用・車の再作成があり得ることを説明し、手動設定がsource ownerを上書きするとは約束しない。UIから連携やcapabilityを解除／削除して回避しない。
- `lg`以上はgroupと未割り当ての同時比較、未満は一覧→詳細→割当。durable taskは`group`、`assign`、`unassigned`、`presentation`、対象groupはstable IDをURLに持つ。resizeではURL・選択を変更せず、削除／不正contextは初回load解決後にparentへreplaceで戻す。親へ戻る操作は論理trigger、履歴移動はheadingへfocusする。
- 同じ表示名の車／班は、現在のprojected order内の番号で区別する。一覧・heading・移動先・割当先・結果コピーで同じ識別表現を使い、内部IDや個人の私的属性を識別のために公開しない。番号は表示上の区別であり、保存identityや永続的な車番号ではない。
- ランダム確認は既存helperの対象人数・固定・役割・空き枠・割当済みも変更する範囲を説明する。対象／固定／役割／group／resetが確認時から変わったsubmitでは実行せず、更新した内容を再確認する。無関係なメモ・費用変更は再確認を要求しない。既存commandを1回だけ実行し、preview用再抽選や架空のUndoを作らない。
- 当日朝用に読み取り専用結果とコピーを持つ。同じcanonical projectionから、実際の役割・全員人数・未割当・問題を示し、個人メモ・しるし・学年・内部ID・token・費用をコピーしない。同名の人を統合せず、識別できない場合は確認を促す。公開flag／送信サービス／必須完了操作／ランダム使用の来歴表示はPhase Eへ追加しない。
- 割当内の短い参加者editorでは、入力を端末へ適用した後は送信内容を固定し、共有保存中／未解決receipt中に新しい入力を混在させない。再試行は元の内容だけを保存する。成功後の再編集は新しいtaskとして扱い、表示中の別draftを保存済みと誤認させない。
- 共有保存の表示・再試行は当該operationの変更path・元値・reset世代だけをUI receiptに保持する。outbox全体が空になったことだけで成功判定しない。既に受理された操作を後の編集へ再適用せず、失敗再試行で新しいgroup IDや再抽選を生成しない。受理／調整を証明できない場合は未確認のまま現在結果へ誘導し、該当する未確認保存がある間は結果コピーを無効にする。後から完了しても移動済みpageのfocusを奪わない。

## 10. Route and movement

Phase F interaction contract（Project interpretation）:

- 車別のworking itineraryと既存のroom-local「前回使用ルート」を区別する。地点・候補・queryはURLやshared費用へ書き込まない。Googleへの送信と、距離だけが費用保存で共有されることを説明する。
- 検索は専用page。選択はその地点へのlocal操作で、追加の確認stepを要求しない。25経由地、順序変更・削除、道路設定、文字の候補・内訳、任意の地図、走行距離の直接入力を維持する。
- 検索・resolve・計算・地図の結果はroom/car/task/input revisionと現在の地点へ結び付ける。古い結果やfinallyが現在の結果・loading・focusを変更してはならない。
- 「この距離を適用」はcurrentなselected resultを既存distance helperで変換し、同じ車の未保存movement editorへ戻す。車割から入った場合も、別の車割return linkを維持する。route Backは距離を書き込まない。
- 候補は実際のradio keyboard behaviorを持つ。地図やpointerだけに依存せず、地図失敗でも文字候補のApplyと手動入力を残す。

### User goal

各車の出発・経由・目的地から移動距離と経路を確認し、費用計算へ正しい距離を適用する。

### Target structure

- 車両費用に属するdedicated route task。Car allocationとvehicle cost detailの両方から同じcar contextへdeep-linkでき、戻り先とdraftを保持する。計算ツールの値とメーター等の直接距離入力を両方維持し、登山実施の前後を問わず使用できる。Modal内でexpense→movement→routeをview切替しない。
- Header: 対象車、current distance、呼出元への戻り先。費用から開始した場合は同じ費用draftへ、編成から開始した場合は同じ車へ戻る。
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
   - rounding / organizer（collectorは集金記録のowner）
4. **集金**
   - participantごとの請求額、除外/免除理由、集金済み
5. **支払い**
   - recipient/driverごとの支払額、内訳、支払い済み
6. **メモ**

これらを1 pageの5 Tileへ連続stackしない。精算parentから明確なtask linkで各work areaへ移る。集金は`section=settlement&task=collection`、支払いは`section=settlement&task=payments`、既存ルールは`task=rules`。URLがdestinationの唯一のowner。global navigationは増やさず、local linkのcurrent pageとh1で現在taskを識別する。未知taskはload解決後parentへreplaceし、writeしない。

精算parentは確認項目→現在の精算額→残る集金/支払いのwork link→メモの順。請求額・負担人数/現金集金人数・割勘/部費・端数/差引/余剰/会計差額は既存resultから説明し、必須金額を閉じたdisclosureへ隠さない。readinessの既存structured issueを修正先へ接続し、message解析や会計差額0を新validationにしない。閲覧parentにPrimary・新たな完了flagは不要。

## 12. Costs and vehicle costs

### Target structure

- Vehicle cost list: 車、保存済み合計、距離、issue、未保存draftの有無。last updateは実際の対象車metadataがある場合のみ表示し、企画activityから捏造しない。
- 各ドライバーが自分の車を識別して直接編集できる入口を持つ。現在の認証から本人と車を確実に対応できない場合は車 / 運転手labelで選択させ、本人を推測しない。driver専用の権限・account・schemaはこのUI仕様から導入しない。
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
- 車別UI recoveryはcanonical persistenceと別namespace。保存前の入力・戻る・refreshを保持し、他車のdraftを共有保存へ混ぜない。本人を推測せずexisting cost targetを選ぶ。同名projectionなど保存先が曖昧な場合は理由を示して保存を止める。
- 保存先の名前比較は既存canonical ownerと一致させる（空白正規化・大文字小文字を区別しない）。name-only保存先が既存Firebase pathで安全に表現できない場合は理由と入力の控えを保持し、保存を止める。UI独自のescaping、identity、schemaで回避しない。これは既存保存境界のtechnical constraintへのProject interpretationであり、Carbon公式の規則ではない。
- 「車両費用を保存」はその車全体をvalidationし、表示外の問題がある費目へ移動して最初の無効fieldへfocusする。追加費用のblank/pendingを勝手に削除しない。
- 成功はexisting intent receiptで判定する。outboxが空という理由だけで成功にしない。保存失敗のretryは同じintentを使い、端末反映後のCancelをundoと説明しない。
- 受理済みでも現在値と異なるreceiptやresetは成功として閉じず、結果確認へ誘導する。明示的な「現在の費用を確認」で入力の控えを閉じる場合は、その破棄と共有費用を変更しないことを説明する。未確認receiptをこの操作で捨てたり、逆方向のwriteで取り消したりしない。
- 成功後は車一覧、またはallowlistedな呼出元の精算/車割へ戻り、実在する入口にfocusする。費目切替・Backはdraft保持、明示Cancelは未保存draftのみ破棄する。
- DesktopはCarbon lg以降でlist/editorのsplit、より狭い画面はlist→editのdrill-in。同じcontroller/formを維持し、resizeでURLや入力を変更しない。
- 車ごとにdraft / 保存中 / 保存失敗 / 確定値を区別する。別車の並行入力をpage全体のSaveで上書きしない。同じ車の同時編集は既存sync / conflict behaviorに従い、失敗や競合を確定表示しない。独自sync protocolを追加しない。
- 車一覧へ戻っても当該車の未確認・失敗・調整済みreceiptを識別できるようにする。端末へ適用された合計を共有保存済みと表示しない。車種切替で非表示になった入力は共有費用とは別のdraftとして復元し、古いcontrollerの完了が新しい同じ車の下書きを消してはならない。
- Deleteは追加費目のみ。標準費目の0円化/無効化とdeleteを混同しない。
- Formulaはread-only summaryとして常時確認可能。
- 「ルートから距離を計算」はtertiary navigation。nested modalにしない。
- Mobileは費目list→費目editのdrill-in構造を使い、Back時にlist位置とdraftを復元する。

## 13. Settlement rules: split, club fee, exemption, deduction

### Target structure

- Dedicated「精算ルール」page。正規URLは`section=settlement&task=rules`でroom/shared queryを維持する。URLがtask選択の唯一のowner。legacy精算URLは親精算へ接続し、不明taskはload後に理由を示して親へreplaceする。
- Page headerにmode、対象人数、主要試算を示す。Appが一つのmain/h1を所有する。navigation後はh1、明示Back/Save/Cancelで親へ戻る場合は実在するrules入口へfocusする。初回direct entryでfocusを奪わない。
- Sections:
  - 精算対象（登録した参加者 / 人数だけ、企画者）
  - 割勘と端数
  - 車出し協力代・部費
  - 免除・差し引き
  - 計算への影響
- 参加者0でも参加者登録と人数だけの精算の入口を提供する。後者の初期値は新しいlocal draftにのみ適用し、開くだけで共有設定を変更しない。
- raw人数・名前・金額を入力途中に丸めない。入力可能範囲、negative guard、count/name normalizationは既存ownerに従い、新たな整数限定ruleを加えない。mode切替で非表示値を消さず、normalized countで反復入力を安全に表示する。
- 計算previewは既存domainのcurrentとcandidateを比較する。候補は最新roomへ変更settings patchだけを重ね、最新費用・未変更設定を使う。他車の未保存draftは使わない。入力で共有writeを起こさない。
- shareCount（費用を負担する人数）とpayerCount（現金を集める人数）を別表示する。1人額の端数単位と車ごとの100円切上げを区別し、原資・車別内訳・差引・余剰・会計差額を現行resultから説明する。会計差額0を新しいvalidation条件にしない。
- field validity、費用等のreadiness、write safety、global syncは別status。readinessは既存issue fields/rowsとsource predicatesから導き、文言の解析をしない。費用不足だけで有効なrules Saveを止めない。修正先は実在するparticipant/vehicle-cost taskを使う。
- Save前にactive fieldをvalidationし、最初のerrorへfocus。invalid Saveは修正先を示せるよう操作可能とし、IME中・pending・unsafe時は理由とともに止める。
- UI-local recoveryはroomごとのversioned namespaceにraw changed fields・dirty path元値・reset・exact receiptだけを保存する。room snapshot、認証情報、他feature draftを複製しない。保存不能時も入力は保持し、復元保証がないことを示す。古いcontrollerの完了が新しいdraftを消してはならない。
- 保存は既存settings-only patchのchanged pathsだけ。最新費用、paid/collector、memo、参加者、割当をopening snapshotで復元しない。同じdirty settingのremote変更、reset、企画者identity不明/曖昧は理由とdraftを維持し、未publishの場合のみ明示的な現行値からの再編集へ誘導する。

### Wizard choice

既定はsingle-page grouped formとする。Stepが順序依存で、後stepの内容が前stepによって変わることをtask testで確認できた場合だけpage wizardを使う。どちらもModalにはしない。

### Exemption / deduction rules

- 既存の役割ベースのchoice（運転手の通常集金 / 支払額から差し引き / 免除、企画者免除）を説明し、generic個人別・割合rule repositoryを追加しない。
- 免除は費用負担から除外、差し引きは負担に含めて現金を集めずdriver支払額から差引、集金済みは実際の回収記録。別conceptとして表示する。
- stored offset/free両方trueは「免除と差し引き（現在の設定）」で保持し、明示的な通常choice変更時のみpairを置換する。stored roundingが標準1/10/100以外でもcurrent optionとして保持する。
- 企画者の既存ID/name canonical equalityを維持する。同名の見た目からidentityを推測せず、削除・rename・重複時は再選択を要求する。未変更IDを別人へ付け替えない。
- 費用の差引は既存split-minus/club-minus等の費目ownerへ誘導する。collectorは§14の集金記録。rules formに新たなglobal担当設定は作らない。

## 14. Collection and payment status

### Collection

- h1「集金」、domain paidCount/payerCount・未集金額。filter「未集金 / すべて」は同種一覧のviewでありnavigationではない。fresh entryは未集金、room/taskごとのsession-local選択を復元する。
- 登録参加者は本人名・現在請求額・「集金済み」checkboxを直接操作できる。paidByは既存「集金した人」の補助記録であり本人identityや新しい会計担当roleではない。除外rowはすべてで理由を表示しcheckboxなし。企画者免除、運転手免除、支払額から差引を区別し、既存paidを削除しない。
- 人数だけの未記録rowは短いinline「集金した人」editor、Primary「記録」とCancel。一度に1行、rawを保持しIME中submit禁止。現在Reactの`collector.value || collector.name`とhelperのtrim/fallbackを維持し、legacyとの相違を今回揃えない。mode/slot集合/reset/contextが変わったらpublishを止める。navigation/refreshはraw保持、明示Cancel/成功で破棄。
- Ghost「未集金者をコピー」は表示filterにかかわらず実際の未集金全員を対象とする。コピー不能では選択可能なtextを残す。bulk処理はPhase Hで追加しない。

### Driver / recipient payment

- h1「支払い」、filter「未払い / すべて」。domain result.carsの一車に一row・一driverPaid記録。複数driverへの独自分割やdriver別flagを作らない。実際のdriver roleを表示し、未設定をownerから推測しない。
- Summaryは未確認車件数とその車の現在adjustedTotalPayのsigned合計。相殺した額だけで残る作業を示さない。0円/負額も符号・内訳と操作を残し、自動チェックや自動解除をしない。
- 割勘/部費・端数・差引・協力代・費目は既存resultを一段disclosureで示す。修正先はPhase Fの同じ車両費用taskであり費用editorを複製しない。
- 正規化名衝突、unsafe name fallback、削除/rename等で対象が一意でない時は表示と理由を残して記録のみ止める。独自escaping/identity/schemaで回避しない。

### Invariants

- Collection済みとrecipient支払い済みは別state。
- 集金担当は既存paidBy / paidCollector記録のowner。精算ルールSaveから集金・支払い済みを変更しない。
- 費用入力、計算結果、実際の集金・支払い確認は異なるtask。費用が揃っていないのに精算完了と表示しない。完了後は追加の管理stageを要求せず、内訳・履歴・訂正へ必要時に戻れる。
- Calculation resultはUI側で再計算しない。現行domain resultをpresentationする。
- 同期競合や保存失敗時はoptimistic stateを確定表示しない。

### Phase H recording and recovery

- 計算額は現在の費用/ルールの結果で、チェックには過去の授受額・日時が保存されない。その限界を短く説明し、費用変更でチェックを自動解除しない。readiness問題なし・関連write確認済み・非空対象すべてのチェック成立時だけ「現在の集金・支払いチェックはすべて記録されています」と言える。実際の金銭移動の監査や最終額lockを証明しない。
- 最新roomとtarget/context/resetをpublish直前に検証し既存collectionChangeを一回だけ実行。集金は対象paid/paidBy、支払いは対象driverPaid、memoはmemoだけ。Technical constraint: helperはlegacy projection全体も正規化するため、transportなしのdetached storeで既存helperを一回使い、得られた対象pathだけを既存commitEditで実roomへ一回publishするUI adapterを使う。費用/ルート/設定の付随正規化はチェック操作でpublishしない。helper/domain自体は変更しない。既存whole-map Undoは変更せず、新UIでは対象行の逆操作を訂正とする。
- H writeは一件ずつ、既存one-record outboxとexact intent receiptを使う。foreign outbox・非terminal receipt中の新write/逆writeを止め、閲覧は維持。retryは同じpatchだけでcommandを再実行しない。connected・空outbox・helper boolを受理証拠にしない。受理と現在path一致は別に確認する。
- localはこの端末、pendingは保存中、failedは同じ内容の許可されたretry、unresolvedは結果未確認。pending/unknownを破棄/取消済みと説明しない。adjusted/resetは現在結果の明示確認へ誘導し、terminalと証明できた控えだけ閉じる。毎回の成功Toastなし。
- 回復cacheはroom別versioned namespace、raw/対象/changed paths/元値/reset/receiptだけ。room全体/auth/別feature draftを複製しない。保存不能でもmemoryを維持しrefresh保証なしを示す。古いcompletionが新しい入力を消さない。広範な復元のcache制限は§15。
- メモは短いinline read/edit、Primary「メモを保存」とCancel。raw/opening memoを保持し最新stateへmemo-only Save。同じmemoのremote変更はpublish前に止め、控えを維持し明示的な再編集へ。publish後はreceipt解決まで固定しCancelを共有Undoとしない。
- 未処理filterでfocused rowが消える時は次row→前row→filterへfocus。pending/failed/unknown rowは残す。pointer/touchで無条件に先頭へ飛ばさない。戻るはparentの実在入口、履歴移動はh1、direct loadでfocusを奪わない。

## 15. History

### User goal

過去のsnapshotを識別し、安全に復元し、必要なら取り消す。

### Target structure

- Project navigationから到達するdedicated History page。Overviewからはtask linkで同じdestinationへ移動する。Phase Bの履歴Modal接続はPhase Hまでの移行入口であり、完成仕様ではない。
- History list/Data table: timestamp、project name、creator/sourceがあれば表示、current marker。
- Primary actionは通常不要。「現在の状態をsnapshot」はpage headerのtertiary action。
- Row action「この状態を復元」。復元前に影響を確認。
- Restore undoが実在する期間だけInline actionとして表示。

### Rules

- 履歴をlarge Modalで長くscrollさせない。
- Empty stateは履歴の生成条件と「現在の状態を保存」を示す。
- Restore後に何が戻り、何が戻らないかを明記する。

### Phase H local history / shared restore

- `section=history-settings`の識別子を維持しh1「履歴」。この端末に最大20件、新しい順、手動保存のみ。自動snapshot/新たな終了stageなし。日時/企画名を示し実在しないcreator/sourceは捏造しない。current markerはbusiness状態の一致で証明できる時だけ。
- history.save returnだけで成功とせずtime/dataをread-backする。read-only adapterで既存history.keyの読取/JSON arrayを確認し、破損/access errorを0件と区別。自動修復・削除なし。未解決共有write中はsnapshot作成を待たせる。成功はrow/markerで示しToastなし。
- 短いdanger「この履歴を復元しますか？」で対象日時/企画名、既存migration後の参加者・割当・費用/ルール・金銭記録・企画情報への影響を提示。理解checkboxとdanger「この状態を復元」、Cancel。実際の集金/支払いは取り消されないこと、local draft/履歴一覧/route作業/authは対象外であることを明示する。生JSON/tokenを表示しない。
- 確認中/実行直前にcurrent business stateとsnapshotを再照合。既存metadata/tombstone/merge/reset規則を保護し、全room原子lockや応募フォーム自体の復元を約束しない。history.restore一回のintentを追跡し、retryでrestore/backup作成を再実行しない。
- Technical constraint: restore通知では既存applicant sync ownerが派生intentを発行する場合がある。UIは単一の利用者restore intentと既知の派生reconciliationを区別し、後者を新たな利用者command・UI outboxへ再構成しない。結果が元の変更pathと異なれば調整として現在確認を要求し、完全一致・安全なUndoと誤表示しない。
- Technical constraint: 復元確認の影響表示は、transportなしの隔離storeでも既存applicant reconciliationを適用した結果から作る。command単独ではフォーム連携の参加者・車割の復元結果と異なる場合がある。既存ownerを参照し、別の復元・割当algorithmを作らず、確認だけでlive stateや共有writeを変更しない。
- 広範なreceipt/backupはmemoryと既存history/outboxだけ。新UIのdurable控えはoperation ID/reset/history time/disposition等の最小識別でありfull patch/room/tokenを複製しない。refresh後に完全復元できないなら受理済み・現在確認または未確認で止め、自動再実行しない。
- Undoは同runtimeの実在backup、調整なし受理/local適用、他の未解決writeなし、全business状態がcommand端末適用後と一致し以後変化なしの場合だけ。own patch一致だけで安全としない。後続編集/他者変更/reset/new restore/refreshで入口を閉じる。短いimpact確認で既存history.undoを一回だけ使い、backup消費と失敗時exact patch retryを維持する。固定時間/refresh後Undo保証を作らない。

## 16. Delete, reset, and danger zone

Risk tiers:

- Low / reversible: 即時実行し、既存ownerがreversalを保証できる場合はUndoまたは逆操作を提供する。
- Moderate: danger confirmation。対象、影響、戻し方を示す。
- High / broad reset: task固有の分離されたdanger領域。対象名入力または同等に対象と影響を再確認できるstrong confirmationを必須とする。実在しないproject settings/delete/reset APIをこの仕様から追加しない。

Placement:

- Row delete: Overflow末尾、divider付き。
- Project delete / sample reset: normal utilityから分離。
- 履歴は「この状態を復元」、sampleは「サンプルで置き換える」、実在するDeleteは対象のdata除去。genericな「リセット」や一律「最後に保存した状態へ戻す」で異なる結果を説明しない。
- sampleはruntime.sampleDataEnabledのlocal/demoだけ、履歴の「開発用操作」から`section=history-settings&task=sample`。通常/入力漏れ/応募連携と車数の既存factoryを保護する。選択は無write、Tertiary「置換内容を確認」→対象/失われるdata・理解checkboxの短いdanger確認。submitでcurrent/choiceを再照合し既存生成/restore一回。共有環境の直接URLはparentへreplace、無write。

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
| Settlement rules | Carbon lg以上でform 10/16・preview 6/16 | 一つのform DOMを入力→preview→末尾actionの順にし、lg未満は1列。metadataは主要人数/金額、詳細はSave前。document scroll、fixed footerや独立scroll cageは作らない |
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
2. 1 page / 1 dialog / 1 selection contextのprimary actionは最大1つ。閲覧pageでは0でもよい。独立taskを同じTabsやModalへ押し込めない。
3. 長い、複数step、反復、元context参照が必要なtaskはModalにしない。Modalはbrief / focused / interruptible taskだけに使う。
4. Data shape、participant identity、calculation、sync、Firebase、persistence、shared-link compatibilityをUI都合で変更しない。必要な変更は別scopeと別承認に分ける。
5. Carbon Grid / component / token / interactionを先に使う。arbitrary value、独自focus / hover / dialog、global Carbon overrideは承認済み例外だけにする。
6. Empty、loading、error、disabled、unsaved、sync failure、destructive stateをhappy pathと同じ設計単位で定義する。Message文字列の解析でseverityやbehaviorを決めない。
7. Mobileをdesktopの縦積みとして扱わない。~390pxでtask順、touch、software keyboard、safe area、scroll owner、overflowを確認する。
8. Carbon componentの採用だけでaccessibleと判定しない。semantic structure、keyboard、focus entry / trap / return、name / label、announcement、reduced motionをcompositionとして検証する。
9. 操作結果を画面上のstate変化で理解できる場合、success Toastを追加しない。Persistent problemは関連sectionに置く。
10. Design完了やCI成功はproduction releaseの許可ではない。Deploy、compatibility、cutover、production smoke、production Firebase writeは別の明示承認を必要とする。
11. 精算ルールは既存domain capabilityをpreserveし、UI draft/preview/receiptだけをorchestrateする。最新費用・未変更settingを使い、dirty settingだけを保存する。未確認保存を成功・取消済みと表示しない。

## 23. Minimum design review checklist for UI PRs

次の項目はPR descriptionまたはreview evidenceに残す。`N/A`は理由が具体的な場合だけ許可する。

### Scope and traceability

- [ ] 対象user goal、task、変更するflow、参照した本書sectionを記載した。
- [ ] 現在Phaseと、Roadmapのentry / exit gateを記載した。前Phaseのcontractを迂回していない。
- [ ] UI orchestrationとdomain / data changeを分離した。後者がある場合は別scopeと承認を示した。
- [ ] Existing componentを置換する前に、page / Modal / Tabs / Tile自体が必要か再評価した。

### Pattern, hierarchy, and content

- [ ] 選んだpatternの`Use when`と、退けた主要代替の`Do not use when`を説明した。
- [ ] Page anatomy、section hierarchy、最大1 primary action、secondary / tertiary / overflow / dangerのownerが明確である。
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
