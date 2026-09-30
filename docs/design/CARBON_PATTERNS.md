# Carbon pattern selection for 山歩会企画ツール

Status: normative pattern-selection reference v1.0 (effective 2026-09-29)
Research snapshot: 2026-09-29

Contract role: user taskからsurface / interaction patternを選ぶための共通判断基準。本書は個別画面のtarget structureを所有せず、[SANPOKAI_PRODUCT_UI.md](./SANPOKAI_PRODUCT_UI.md) のproduct-specific ruleを補足する。現行UIの事実は [CURRENT_UI_AUDIT.md](./CURRENT_UI_AUDIT.md)、実装順序は [CARBON_MIGRATION_ROADMAP.md](./CARBON_MIGRATION_ROADMAP.md) を参照する。

Source labeling:

- 公式link直前の説明、または明示した`Official guidance`だけがCarbon公式の要約である。
- `Use when`、`Do not use when`、`User task`、`Interaction principle`、`Mobile behavior`、`Accessibility`、`Project example`は、公式資料を本製品へ適用した **Project interpretation** である。
- 本書とProduct UI仕様が競合する場合はProduct UI仕様を優先する。ただし、公式のaccessibility requirementや既存のprotected behaviorを緩和してはならない。

## 1. Selection rule

Patternは見た目ではなくtaskの性質で選ぶ。順に問う。

1. ユーザーは何を完了しようとしているか。
2. 元のcontextを見ながら操作する必要があるか。
3. 入力は短く、単一stepで、低頻度か。
4. 何度も繰り返す操作か。
5. 情報は比較、選択、編集、確認のどれか。
6. 結果は可逆か、破壊的か。
7. mobileで同じsurfaceが成立するか。

Carbon公式の基礎: [Patterns overview](https://carbondesignsystem.com/patterns/overview/)、[Dialogs](https://carbondesignsystem.com/patterns/dialog-pattern/)、[Forms](https://carbondesignsystem.com/patterns/forms-pattern/)、[Notifications](https://carbondesignsystem.com/patterns/notification-pattern/)、[Disclosures](https://carbondesignsystem.com/patterns/disclosures-pattern/)。

## 2. Task surface

### 2.1 Modal

- **Use when**: ユーザーが開始した、短い、集中した、元のworkflowを一時中断してよいtask。確認、少数fieldの編集、acknowledgement。
- **Do not use when**: 長いform、複数step、頻繁な反復、context比較、検索・map・list編集、別のmodal相当へ遷移するtask。Carbon公式もlarge modalを超える内容はfull pageを検討する。[Modal usage](https://carbondesignsystem.com/components/modal/usage/)
- **User task**: 1つの判断または小さなtransactionを完了する。
- **Interaction principle**: triggerから開き、明確なtitle、通常1 primary + 1 secondary、閉じたらtriggerへfocusを戻す。bodyがscrollしてもheader/footerを固定する。
- **Mobile behavior**: viewport内に収める。横scroll不可。keyboard表示時もfieldとactionへ到達可能。独自bottom sheetへ自動変換しない。
- **Accessibility**: dialog name、focus trap、initial focus、Escape、close label、focus return、danger文言を検証する。
- **Project example**: 「参加者を削除」「班を削除」はModal候補。「参加者登録」「ルート計算」「車両費用の反復編集」はfull page / task workspace候補。

### 2.2 Full page

- **Use when**: taskが長い、複数section/step、頻繁、元contextを参照、履歴を持つ、URLやback navigationの価値がある。
- **Do not use when**: 1判断で終わり、移動によるcontext lossの方が大きい。
- **User task**: 独立した成果物またはworkflow stageを完了する。
- **Interaction principle**: page headerにgoal、status、必要なpage action。閲覧中心pageはPrimary不要。途中stateを保持し、Backの行先を明示する。
- **Mobile behavior**: 最も安定する既定surface。sectionを1-columnへ並べ、必要ならlocal progress / disclosureを使う。
- **Accessibility**: route変更時のpage title、main heading、focus移動、browser back、unsaved changesを扱う。
- **Project example**: 応募取込、企画情報編集、履歴、精算設定、車両費用・ルート確定。

### 2.3 Side panel相当

- **Use when**: desktopで元のlist/mapを見ながら、短中程度の詳細確認・編集を行い、contextを維持する価値が高い場合。
- **Do not use when**: taskが独立workflow、画面幅が必要、modalの代用品、mobileでも同じpanelを強制する場合。
- **User task**: 選択したitemのdetailをcontext内で確認・小編集する。
- **Interaction principle**: selectionとpanelの関係を明示し、閉じてもlist位置を保つ。
- **Mobile behavior**: dedicated pageへ変換する。狭いoverlay panelを発明しない。
- **Accessibility**: panel title、landmark、開閉focus、背景が操作可能かどうかを明確にする。
- **Project example**: desktopのparticipant detail、車のsummary/detail。ただし現行`@carbon/react` 1.115.0に安定した汎用SidePanel contractがあると仮定しない。実装Phaseでexportと公式statusを再確認し、なければinline splitまたはfull pageを選ぶ。

### 2.4 Inline edit

- **Use when**: 1値または小さなrow変更、周辺contextが必要、結果が即座に理解できる。
- **Do not use when**: 複数fieldの整合性、強いvalidation、destructive影響、同時に多数rowが編集状態になる。
- **User task**: scanを止めずに値を直す。
- **Interaction principle**: read stateとedit stateを明確にし、Save/Cancelまたは安全なautosaveを一貫させる。
- **Mobile behavior**: keyboardでrow/actionが隠れない。小さいicon-only actionを並べない。
- **Accessibility**: edit開始時にlabel付きfieldへfocus、保存後はtriggerまたはupdated valueへ戻す。statusをannounceする。
- **Project example**: 企画名の単一field編集はautosave条件を明示すれば候補。車の複数費目編集はinlineにしない。

## 3. Disclosure and view switching

### 3.1 Accordion

- **Use when**: 非必須の関連sectionをprogressively discloseし、spaceを節約する。[Accordion usage](https://carbondesignsystem.com/components/accordion/usage/)
- **Do not use when**: 全員が読む必須情報、formの論理順、比較対象、panel内scrollが必要。
- **User task**: 必要な補足だけ展開する。
- **Interaction principle**: titleが内容を予測でき、複数同時openの意味を保つ。
- **Mobile behavior**: 有効だが、必須actionをfold下へ隠さない。
- **Accessibility**: button semantics、`aria-expanded`、focus order、heading levelを保つ。
- **Project example**: 「スプレッドシートからの貼り付け方」は補足なので適合。未割り当て参加者が主要taskならAccordion風に隠し過ぎない。

### 3.2 Disclosure

- **Use when**: 1つのtriggerで補足detail、内訳、advanced optionを同じcontextに表示する。
- **Do not use when**: navigation、workflow step、必須form section。
- **User task**: summaryから必要なdetailだけ確認する。
- **Interaction principle**: summaryは閉じた状態でも判断に必要な情報を持つ。
- **Mobile behavior**: list/detailの情報密度調整に有効。展開後の長さとnested disclosureを制限する。
- **Accessibility**: expanded state、control対象、focus順を伝える。
- **Project example**: 車ごとの費用内訳、計算式、免除理由。主要な「支払い済みにする」は内訳内へ隠さない。

### 3.3 Tabs

- **Use when**: 同じ上位contextに属する、互いに重ならない関連content view。[Tabs usage](https://carbondesignsystem.com/components/tabs/usage/)
- **Do not use when**: global navigation、連続step、独立workspace、比較のため同時に見る必要があるcontent。
- **User task**: 同じ対象を別の関連viewで確認する。
- **Interaction principle**: tab変更で未保存stateを失わず、選択をURLまたは復元可能stateにする。
- **Mobile behavior**: labelが収まらない数を置かない。横scrollを前提にしない。
- **Accessibility**: tab / tabpanel relation、arrow key、selected state、focusとactivationを検証する。
- **Project example**: 現在の「参加者・車割・班割・精算」は独立work areaであり、Tabsよりproject navigationが妥当。精算内の同一data viewに限定してTabsを再検討できる。

### 3.4 Content switcher

- **Use when**: 同じdata / objectの相互排他的で似たviewを即時切替する。[Content switcher usage](https://carbondesignsystem.com/components/content-switcher/usage/)
- **Do not use when**: navigation、workflow progress、異質なcontent、4つ以上の複雑なview。
- **User task**: filterに近い軽量なview切替。
- **Interaction principle**: 2–3語の短いnoun label。選択で即座に反映し、Saveを要求しない。
- **Mobile behavior**: 2–3 optionに限定し、touch targetとlabel幅を確保する。
- **Accessibility**: tab semanticsとselected state。content更新後に文脈を失わない。
- **Project example**: 集金の「すべて / 未回収のみ」は適合。ただし単なるfilterならcheckbox/filter controlとの比較も行う。

## 4. Menus and selection controls

### 4.1 Overflow menu

- **Use when**: row/objectの低頻度secondary action、特に3つ以上のactionをまとめる。
- **Do not use when**: primary action、頻繁なaction、現在state、actionを隠すと発見不能になる場合。
- **User task**: 対象固有の追加操作を選ぶ。
- **Interaction principle**: common actionは外、rare/destructiveは中。項目順とdividerを全listで統一する。
- **Mobile behavior**: 44px相当のtrigger、viewportからmenuが切れない位置、長押し依存なし。
- **Accessibility**: accessible nameに対象名、keyboard open/close、Escape、triggerへのfocus return。
- **Project example**: 参加者・車・班の「編集 / 削除」。固定toggleのような高頻度actionは実測して外置き可否を決める。

### 4.2 Dropdown

- **Use when**: 事前定義されたoptionから1つ選び、spaceを節約する。[Dropdown usage](https://carbondesignsystem.com/components/dropdown/usage/)
- **Do not use when**: optionが2–4個で同時表示が判断を助ける、free text、検索が必要、form-heavyなmobileでnative Selectが優れる。
- **User task**: 既知の選択肢を選ぶ。
- **Interaction principle**: placeholderをlabel代わりにしない。現在値とoption wordingを一致させる。
- **Mobile behavior**: option数、keyboard、native behaviorを比較し、Selectを優先できる。
- **Accessibility**: visible label、expanded/selected state、typeahead、error association。
- **Project example**: 長いparticipant候補選択。学年4択はSelectまたはRadioを比較する。

### 4.3 Select

- **Use when**: form内の単一選択、特に頻繁なmobile利用やnative controlの利点がある場合。
- **Do not use when**: optionの説明を同時表示する必要、複数選択、入力候補検索。
- **User task**: small/mediumな既知optionから1つ選ぶ。
- **Interaction principle**: labelと現在値を常時見せる。
- **Mobile behavior**: OS-native pickerを利用でき、長いformで安定する。
- **Accessibility**: native semantics、label、required/error association。
- **Project example**: 学年、しるし、集金担当、精算のrounding単位。

### 4.4 ComboBox

- **Use when**: optionが長い、検索したい、候補外入力を許すcontractがある。
- **Do not use when**: 少数option、任意値を受け入れてはいけない、単純filter。
- **User task**: 大きな候補集合から検索・選択する。
- **Interaction principle**: free textと確定selectionを区別し、no resultを示す。
- **Mobile behavior**: keyboard表示でlistと入力が見えること。full-height候補を避ける。
- **Accessibility**: combobox state、active descendant、result count、selectionをannounceする。
- **Project example**: 多人数から企画者を選ぶ、地名候補を選ぶ。ただしmap検索は外部adapterのloading/errorも同じfieldへ関連付ける。

## 5. Lists and data presentation

### 5.1 Data table

- **Use when**: column間比較、sort/filter、複数rowの構造化dataが主要task。[Data table usage](https://carbondesignsystem.com/components/data-table/usage/)
- **Do not use when**: rich card、複雑なinline interaction、少数key-value、spreadsheet代替。
- **User task**: 特定recordを探す、比較する、bulk actionする。
- **Interaction principle**: primary columnを左、numeric alignment、row actionは一貫、selection modeは明示する。
- **Mobile behavior**: 全column横scrollを既定にしない。column priority、condensed list/detail、別pageを選ぶ。
- **Accessibility**: caption/header、sort state、selection label、row action対象、keyboard traversal。
- **Project example**: 応募者の大規模一覧や履歴比較。現在の参加者はrich row + selectionなのでContained listの方が自然。

### 5.2 Structured list

- **Use when**: 単純で比較可能なrowをread-onlyまたは1選択で示す。[Structured list usage](https://carbondesignsystem.com/components/structured-list/usage/)
- **Do not use when**: sort、bulk selection、複数action、nested content、複雑編集。
- **User task**: 少数属性を行ごとに比較する。
- **Interaction principle**: 全rowで同じcolumn意味を保つ。
- **Mobile behavior**: columnが保てないならlabel-value stackへ変換する。
- **Accessibility**: row/cell relation、selectable rowのlabelとselected state。
- **Project example**: 精算ルールのread-only summary、車ごとの単純な費用比較。

### 5.3 Contained list

- **Use when**: confined area内で関連itemをscanし、row actionやselectionを行う。[Contained list usage](https://carbondesignsystem.com/components/contained-list/usage/)
- **Do not use when**: 多列比較、任意grid、1 itemごとに大量のcontrols。
- **User task**: participant、車、班、候補をscanして対象を操作する。
- **Interaction principle**: row anatomy、metadata位置、action位置を揃える。
- **Mobile behavior**: 本製品の主要productive pattern。重要情報を2–3行に絞り、actionのtouch targetを確保する。
- **Accessibility**: list name、row accessible name、action対象、selection state。
- **Project example**: 参加者一覧、未割り当て、車・班のmember、車両費用の費目。

### 5.4 Tile

- **Use when**: distinct object / option / destinationをcontained surfaceとして表し、surface自体の選択・展開に意味がある。[Tile usage](https://carbondesignsystem.com/components/tile/usage/)
- **Do not use when**: page sectionの背景、heading group、単なるpadding、1情報ごとのcard化。
- **User task**: objectを選ぶ、展開する、独立summaryを比較する。
- **Interaction principle**: clickable / selectable / expandableの種類と結果を一致させる。
- **Mobile behavior**: card列を延々とstackしない。listで十分ならlistを使う。
- **Accessibility**: surfaceと内部buttonのclick target競合を避け、expanded/selected stateを伝える。
- **Project example**: 現行精算の5つのsection Tileは不適合。車ごとの内訳はExpandableTileよりsummary row + disclosureも比較する。

## 6. Feedback and state

### 6.1 Notification

- **Use when**: system/global scopeで、ユーザーが継続して知る必要があるstatusや障害。
- **Do not use when**: field error、既に画面の変化で明白な成功、単なる説明文。
- **User task**: 影響と次の行動を理解する。
- **Interaction principle**: severity、title、説明、actionを最小限にする。
- **Mobile behavior**: header/actionを覆わず、長文にしない。
- **Accessibility**: live regionのpoliteness、dismiss label、focusを奪わない。
- **Project example**: 同期全体停止、共有保存失敗。本番接続状態を隠さず、内部実装語は出さない。

### 6.2 Inline notification

- **Use when**: section/formに関係する持続的なinfo/warning/error。
- **Do not use when**: 各field error、毎回の成功、通常説明。
- **User task**: 現在のsectionを修正または判断する。
- **Interaction principle**: 問題の近傍へ置き、具体的な解決actionを示す。
- **Mobile behavior**: 同じissueを複数枚stackしない。要約 + detail disclosureを検討する。
- **Accessibility**: heading相当のtitle、severityを色以外で示し、関連fieldへ導く。
- **Project example**: 精算設定不足、ルート検索失敗、引き継ぎdata作成不能。

### 6.3 Toast相当の一時feedback

- **Use when**: background / global actionが完了し、状態変化が現在画面だけでは分からないが、blockingでない。
- **Do not use when**: save error、destructive result、field validation、画面の変化で成功が明白。
- **User task**: 作業を中断せず結果を知る。
- **Interaction principle**: 短く、重複せず、undoが価値を持つならactionを付ける。
- **Mobile behavior**: project title、nav、sticky action、keyboardを覆わない。
- **Accessibility**: 自動消去前に読める時間、live announcement、重要情報をtoastだけにしない。
- **Project example**: clipboardへのコピー完了。participant追加やtab変更はtoast不要。

### 6.4 Progress

- **Use when**: 複数の明確なstep、または時間のかかる処理の進行を示す。
- **Do not use when**: navigation、単純loading、任意順のsettings section。
- **User task**: 現在step、完了済み、残りを理解する。
- **Interaction principle**: step名はtaskを表し、Back/Next/Saveを一貫させる。
- **Mobile behavior**: vertical progressを検討するが、progress自体がcontentを圧迫しない。
- **Accessibility**: current step、completed state、step countを伝える。
- **Project example**: 精算設定が本当に順序依存なら3-step。独立設定なら1 pageのsectionへ変える。

### 6.5 Loading

- **Use when**: action後の短い待ち、局所data更新、結果の取得。
- **Do not use when**: 初期page構造全体のplaceholderにはSkeletonを使う。
- **User task**: systemが処理中で二重実行不要と知る。
- **Interaction principle**: 対象範囲だけbusyにし、完了・失敗を返す。
- **Mobile behavior**: fullscreen spinnerでcontextを消さない。
- **Accessibility**: `aria-busy`、status announcement、二重submit防止、timeout/error recovery。
- **Project example**: ルート検索、共有保存、履歴復元。

### 6.6 Skeleton

- **Use when**: 初回loadで最終layoutが予測でき、構造の安定を保つ。
- **Do not use when**: button action、modal submit、未知の長時間処理。Carbon loading guidanceもaction/modalでのSkeleton乱用を避ける。
- **User task**: layoutを先に認識し、content到着を待つ。
- **Interaction principle**: 実contentと近いshape、過度なanimationなし。
- **Mobile behavior**: final responsive layoutと同じcolumnで描画する。
- **Accessibility**: decorative skeletonを読み上げず、containerのloading statusをannounceする。
- **Project example**: 企画初回load、参加者list初回load。local即時stateには不要。

### 6.7 Empty state

- **Use when**: contentがまだない、filter resultがない、権限/前提不足。[Empty states](https://carbondesignsystem.com/patterns/empty-states-pattern/)
- **Do not use when**: errorやloadingを「空」と表現する。
- **User task**: 空の理由と次の行動を理解する。
- **Interaction principle**: missing content領域を置換し、必要なら1つの具体actionを置く。
- **Mobile behavior**: 巨大illustrationで主要actionを下へ追いやらない。
- **Accessibility**: heading/text/actionの順、状態変化をannounceする。
- **Project example**: 参加者0人→「参加者を登録」、検索0件→filter解除、車0台→参加者確定を先に促す。

## 7. Confirmation and destructive actions

### 7.1 Confirmation

- **Use when**: 影響が大きい、結果が戻しにくい、ユーザーが結果を誤認しやすい。
- **Do not use when**: 安全で高頻度、容易にundo可能、既に明示的なSaveで意思が明確。
- **User task**: 対象と影響を最終確認する。
- **Interaction principle**: titleで結果、bodyで影響、buttonで具体動詞。二重confirmationは避ける。
- **Mobile behavior**: concise。対象名と影響を最初に置く。
- **Accessibility**: danger modal name、initial focus方針、Cancel経路、triggerへのfocus return。
- **Project example**: participant削除、参加者から外して配車・精算を解除、履歴復元、sample dataでreset。

### 7.2 Destructive action

- **Use when**: delete、reset、解除でdata/assignmentが失われる。
- **Do not use when**: 単なる閉じる、未保存draft cancel、filter clear。
- **User task**: 不要dataを安全に除去する。
- **Interaction principle**: 既存ownerがreversalを保証できる場合はUndoを優先。低頻度dangerはOverflow内。moderate impactはdanger modal、高impactは対象名入力など、対象と影響を再確認できるstrong confirmationを使う。[Common actions](https://preview.carbondesignsystem.com/building-blocks/core/patterns/common-actions)
- **Mobile behavior**: swipe-onlyにしない。danger buttonをicon-onlyにしない。
- **Accessibility**: 色だけでdangerを示さず、対象と不可逆性を読める文言にする。
- **Project example**: participant/group/car delete、sample投入による全reset。支払い済み解除はstate toggleでありdeleteと区別する。

## 8. Quick decision matrix

Product reality、actor、時期、handoff、完了条件のownerはProduct UI仕様§1–2である。以下は選択基準であり、7段階をwizard化したり、実運用説明に出ないdomain capabilityを削除したりする根拠ではない。

| Task characteristic | First candidate | Avoid |
| --- | --- | --- |
| 短い・単一・中断可 | Modal | Full workflowをModal化 |
| 長い・反復・複数step | Full page | nested / full-screen-like Modal |
| ドライバーごとの距離・費用入力 | 車を選べるdurable workspace / task deep link | 企画概要からの必須開始、actorごとのdraft混同 |
| 当日朝の完成した車割・班割の発表 | 読み取り可能なallocation presentation / handoff | 応募者発表と同一機能だと推測すること |
| desktopでcontext参照 | Inline split / verified panel | 未確認の独自SidePanel |
| rich rowのscan/action | Contained list | 1 row 1 Tile |
| 多列比較/sort | Data table | card列 |
| summary→補足detail | Disclosure | navigation代用 |
| 同一dataの2–3 view | Content switcher | workflow step |
| 同一contextの関連view | Tabs | app-wide navigation |
| section内の持続issue | Inline notification | global Toast |
| 状態変化だけで成功明白 | 追加feedbackなし | success Toast |
| ownerがreversalを保証するdelete | Immediate + Undo / inverse action | 毎回confirmation |
| moderate/high impact delete | Danger confirmation | icon-only danger |

## 9. Project-wide prohibited substitutions

- 現行ModalをCarbon Modalへ置換しただけで適合としない。
- 現行cardをTileへ置換しただけで適合としない。
- 現行navigationをTabsへ置換しただけで適合としない。
- 独自collapseをAccordionへ置換しただけで適合としない。
- すべてのfeedbackをNotificationへ置換しない。
- Carbonに汎用SidePanelがあると仮定しない。実装時のversion contractを検証する。
