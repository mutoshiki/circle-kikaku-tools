# Carbon product principles for 山歩会企画ツール

Status: normative foundation v1.0 (effective 2026-09-29)
Research snapshot: 2026-09-29
Scope: React版のUI/UX設計。データモデル、同期、Firebase互換性、精算計算は別の変更境界とする。

Contract role: Carbon公式の根拠と、このプロダクト全体に共通する設計原則を定義する。個別flowの構造・文言・保存modelは [SANPOKAI_PRODUCT_UI.md](./SANPOKAI_PRODUCT_UI.md) が所有し、pattern選択は [CARBON_PATTERNS.md](./CARBON_PATTERNS.md) が補足する。本書は現行UIの説明や移行順序を所有しない。

## 1. この文書の使い方

この文書は「Carbon componentを何個使うか」ではなく、設計判断の順序を固定する。

1. User goal
2. User task / workflow
3. Information architecture
4. Information hierarchy
5. Carbon pattern
6. Interaction model
7. Carbon component
8. Grid / layout
9. Spacing / typography / layer
10. Visual detail

既存DOM、Tabs、Modal、Tileを出発点にしない。既存componentを置換する前に、その画面・surface自体が必要かを問い直す。

記述上の区別:

- **Official guidance**: Carbon公式が明示している内容。
- **Project interpretation**: 公式内容を山歩会企画ツールへ適用した設計判断。
- **Practical rule**: 実装・レビューで機械的に確認できるルール。

本書でCarbon公式の規則として扱うのは、`Official guidance`に記載し公式参照先を付けた内容だけである。`Project interpretation`と`Practical rule`は本プロジェクトの設計contractであり、Carbon公式の直接的な文言ではない。公式資料の更新だけで本contractを暗黙変更せず、参照日、現行package contract、影響する仕様をレビューして改訂する。

## 2. 参照する実装契約

- 現行依存: `@carbon/react` 1.115.0、`@carbon/icons-react` 11.87.0。
- 調査時点のCarbon公式component docsはReact `^1.117.0` を表示している。公式の最新例をそのまま実装せず、現行1.115.0のexport、props、DOM、keyboard behaviorを実装時に確認する。
- Preview / experimental componentは安定contractとして扱わない。採用する場合は、feature flag、fallback、upgrade riskを設計記録に残す。
- Carbon公式にない独自surfaceを「Carbon pattern」と呼ばない。独自であることと、継承した原則を明記する。

## 3. Product philosophy

### Official guidance

Carbonの[Patterns](https://carbondesignsystem.com/patterns/overview/)は、component一覧ではなく、繰り返し現れるuser goalとflowに対する再利用可能な解決策である。Carbonは一貫性、明瞭さ、効率、アクセシビリティをsystemとして扱う。

### Project interpretation

本製品は、企画準備から参加者確定、配車、ルート、費用、精算完了までを扱うproductive toolである。最優先は装飾ではなく、現在地、未完了事項、次の行動、結果の予測可能性である。

### Practical rule

- 変更理由は「Carbon componentに置き換えた」ではなく「どのuser taskを短く、安全にしたか」で記録する。
- 1情報1カード、巨大な余白、mobile app風の過大なcontrolを避ける。
- データ互換性、同期、計算をUI変更と同じPRで再設計しない。
- 状態を隠して見た目を単純化しない。必要な密度を、明確なhierarchyで提示する。

## 4. Information architecture and hierarchy

### Official guidance

Carbonの[2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/)は、配置だけでなく、key lineと階層の一貫性を作る。Carbonの[Typography](https://carbondesignsystem.com/elements/typography/overview/)と[Spacing](https://carbondesignsystem.com/elements/spacing/overview/)は、意味的な関係を視覚階層へ変換する。

### Project interpretation

最上位の情報構造はコード上の4 componentでも一般的なproject management lifecycleでもなく、実際のactor、時期、反復頻度、引き渡し、完了条件から導く。利用者が共有した実運用を一次情報として扱い、企画の定義や履歴管理を必須の開始・終了stageにしない。具体的なproduct realityとIAは唯一のownerであるProduct UI仕様§1–2を参照する。

### Practical rule

- Page titleはユーザーが達成する対象を示す。「精算設定」のような利用者のtask名は使えるが、component名や内部state名を露出しない。
- Page headerはtitleで現在taskを示し、判断に必要なmetadataとactionを区別する。具体的なDOM順・mobile順はProduct UI仕様§4が所有する。section titleでpage titleを代用しない。
- 重要度をsurfaceの数で表さない。heading level、位置、spacing、action emphasisで表す。
- 互いに独立したwork areaをTabsへ押し込まない。Tabsは同じ文脈内の関連viewに限定する。
- 同じ事実を複数surfaceで繰り返さない。summaryから詳細へ辿れる構造にする。

## 5. Page anatomy

### Official guidance

Carbon gridはbreakpointごとのcolumn、margin、gutter、key lineを一貫させる。CarbonのUI shellは、global navigationとproduct contentの責務を分ける。

### Project interpretation

原則的なpage anatomyは次の順とする。

1. Global header: product identity、project switcher / related tools、global utilities
2. Project context: project name、sync/status、project-level actions
3. Local navigation: 主要work areaと必要時の補助機能
4. Page header: current task、status、primary action
5. Main content: task順に並ぶsection / list / workspace
6. Contextual actions: selection時、editing時だけ表示
7. Persistent feedback: relevant region内

### Practical rule

- global、project、page、rowのactionを同じtoolbarへ混在させない。
- footerは文書末尾用。保存actionを置く独自fixed footerを常設しない。
- mobileでもglobal headerとpage titleの役割を残す。titleを省いてTabsだけにしない。
- page-level primary actionは必要な場合だけ最大1つ。selection modeやmodalは別の一時的contextとして数える。

## 6. Grid and responsive layout

### Official guidance

[2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/)の標準breakpointはSmall 320、Medium 672、Large 1056、X-large 1312、Max 1584で、4 / 8 / 16 columnへ変化する。各breakpointを個別に設計・確認する。

### Project interpretation

390pxは縮小desktopではなく主要な設計条件である。内容の順序、操作位置、table/list、dialogのtask surfaceを再選択する。

### Practical rule

- Carbon `Grid` / `Column`と標準breakpointを第一選択にする。
- content max width、column span、gutterはtokenとgridで説明する。
- 390×844、keyboard表示相当の短いviewport、desktop、WebKitで検証する。
- horizontal page scrollは不可。横長dataはcolumn priority、stacked row、または明示的な局所scrollへ変換する。
- fixed/sticky actionはcontentを覆わず、safe-area insetとkeyboardを考慮する。
- desktopの2-pane workspaceはmobileでtask順の1-columnまたは別pageへ変換し、単純に縮めない。

## 7. Spacing

### Official guidance

[Spacing](https://carbondesignsystem.com/elements/spacing/overview/)は2x Gridを基礎に、2、4、8、12、16、24、32、40、48、64、80、96、160px相当のtokenで関係を表す。

### Project interpretation

compactは余白を消すことではない。row内、group内、section間、page間でspacingの意味を変える。

### Practical rule

- arbitrary `px` / `rem`を追加する前にCarbon spacing tokenを使う。
- 同一group内は小、group間は中、section間は大という一貫した差を作る。
- Tileのpaddingで階層を作らず、gridとsection spacingで作る。
- magic numberを残す場合は、map height、safe-area、実測touch geometryなどの理由をcommentまたはdesign noteへ残す。

## 8. Typography

### Official guidance

[Typography](https://carbondesignsystem.com/elements/typography/overview/)は、productive / expressiveの役割とtype tokenで階層を構成する。

### Project interpretation

業務的taskにはproductive typographyを基本とし、marketing的な大見出しは使わない。金額、人数、状態はscanできる揃え方を優先する。

### Practical rule

- Carbon type tokenを使い、任意のfont-size / line-heightを増やさない。
- installed packageのSass `type-style`等、実際に出力される公開APIを使う。token名に似た未定義CSS変数を作って参照しない。computed typographyでhierarchyが成立することをbrowserで確認する。[Type sets](https://carbondesignsystem.com/elements/typography/type-sets/)のproductive fixed headingとutility / body roleを混同しない。
- 見た目の大きさではなくsemantic heading levelを正しくする。
- 金額は単位と桁の可読性を保ち、同じlistではalignmentを揃える。
- helper、metadata、statusをすべて同じsmall textに落とさず、役割を分ける。

## 9. Color and theme

### Official guidance

[Color](https://carbondesignsystem.com/elements/color/overview/)はrole tokenで使い、hard-coded valueを避ける。[Themes](https://carbondesignsystem.com/elements/themes/overview/)は同じroleをg10 / g100等で一貫して変換する。色はaction、status、hierarchyの意味を持つ。

### Project interpretation

学年、車出し、支払い済みなどを色だけで区別しない。dark themeは反転ではなく、同一role tokenの変換として保つ。

### Practical rule

- Carbon color / theme token以外の色を原則追加しない。
- 独自shadow、radius、hover、focusを作らない。
- statusはtextまたはicon labelを併用する。
- themeごとにcontrast、focus、disabled、layer境界を実画面で確認する。

## 10. Layer and surface

### Official guidance

Carbonは[Layer](https://carbondesignsystem.com/elements/color/usage/#layering-model) tokenでsurfaceの入れ子を表現し、theme間でroleを維持する。surfaceを増やすこと自体はhierarchyではない。

### Project interpretation

現在の「sectionごとにTile」は廃止方向とする。surfaceは選択可能性、contained group、明確なlayer差が必要な場合だけ使う。

### Practical rule

- まずpage background + sectionを検討し、必要な時だけTile / contained surfaceを使う。
- 同じlevelのTileを連続させて長いpageを作らない。
- layerの入れ子は最小にし、modal内Tile、Tile内ExpandableTileの多重surfaceを避ける。
- borderやshadowで独自layerを再発明しない。

## 11. Action hierarchy

### Official guidance

[Button usage](https://carbondesignsystem.com/components/button/usage/)では、Primaryはpageの主要なcall to actionに限定する。閲覧中心pageはPrimaryなしでよく、page headerにはTertiaryを推奨する。SecondaryはPrimaryと対になる補助、Ghostは最小強調。actionが多い場合はgroupingやoverflowを検討する。Danger actionをicon-onlyにしない。

### Project interpretation

primaryは「現在のtaskを前進・完了させる操作」。表示切替、コピー、編集開始、詳細表示は原則primaryではない。

### Practical rule

- 各page / dialog / selection contextでPrimaryが必要か判断し、必要な場合は最大1つにする。具体的な選択はProduct UI仕様§5を参照する。
- destructive actionは通常overflowまたはdanger zoneへ置き、日常actionと距離を取る。
- Buttonをnavigation linkとして使わない。
- icon-onlyにはvisible-on-focus/hover tooltipとaccessible nameを付ける。
- action labelは結果を表す動詞にする。「OK」「実行」は使わない。

## 12. Forms and save model

### Official guidance

[Forms pattern](https://carbondesignsystem.com/patterns/forms-pattern/)と[Form usage](https://carbondesignsystem.com/components/form/usage/)は、関連fieldのgrouping、論理順、常時見えるtop-aligned label、必要なhelper、field近傍のerrorを求める。長いformをTabsやAccordionで隠さない。mobileは原則1-column。

### Project interpretation

form surfaceを開く前に、auto-save、explicit save、draft、apply、cancelの意味を決める。複雑・反復・context参照が必要な入力はmodalへ置かない。

### Practical rule

- Auto-save: 変更が局所的で、即時反映が安全、undoまたは状態表示がある場合だけ。
- Explicit save: 複数fieldが1つの整合した変更になる場合。saveまでshared stateへ反映しない。
- Apply: 計算・選択結果を現在のediting contextへ反映する。共有保存と同義にしない。surfaceを閉じるかはtaskの戻り先contractで決める。具体的な保存境界はProduct UI仕様§6 / §10を参照する。
- Cancel: 未保存変更を破棄して閉じる。Closeと同じdialogで併用しない。
- validationは該当fieldへ関連付け、blur後またはsubmit時に表示する。最初のinvalid fieldへfocusを移す。
- native input typeとmobile keyboardを選ぶ。選択肢が少なく全て見せる価値がある場合はRadio、独立booleanはCheckboxを使う。
- reset / delete / cancel draftを混同しない。

## 13. Feedback and system state

### Official guidance

[Notification pattern](https://carbondesignsystem.com/patterns/notification-pattern/)は、relevant、timely、informative、minimally disruptiveであることを求める。Inline notificationは文脈内の持続情報、toastは短命なglobal feedbackに使う。[Loading pattern](https://preview.carbondesignsystem.com/building-blocks/core/patterns/loading)は、初期loadのSkeleton、局所loading、screen readerへの状態通知を区別する。

### Project interpretation

画面の状態変化だけで成功が明白なら、追加toastを出さない。同期中、未保存、失敗は成功toastより重要である。

### Practical rule

- Errorは原因だけでなく次の行動を示す。
- Field errorはfieldに、section errorはsectionに、global outageだけglobal notificationに置く。
- Toastをaction logとして使わない。mobileのheaderやprimary actionを覆わない。
- 初回の構造loadはSkeleton、操作中は対象controlのloading/disabled、長時間処理はprogressを選ぶ。
- `aria-live` / busy stateは変化量に合わせる。連続更新を読み上げ過ぎない。
- Empty stateは欠けたcontent領域を置き換え、理由と次の行動を示す。[Empty states](https://carbondesignsystem.com/patterns/empty-states-pattern/)

## 14. Content design

### Official guidance

Carbonの[Content](https://carbondesignsystem.com/guidelines/content/overview/)、[Writing style](https://carbondesignsystem.com/guidelines/content/writing-style/)、[Action labels](https://carbondesignsystem.com/guidelines/content/action-labels/)は、簡潔、具体的、会話的なplain languageとsentence case、結果が分かるaction labelを推奨する。

### Project interpretation

日本語では不必要な敬語と内部用語を減らし、同じ概念に同じ名称を使う。「反映」「保存」「確定」は異なる状態遷移として定義する。

### Practical rule

- Button単体で結果が分かる: 「保存」より必要なら「精算設定を保存」。
- Confirmationは対象、結果、影響範囲を明示する。
- Errorは「できませんでした」だけで終わらず、再試行・修正・戻るのどれかを示す。
- helper textでUIの使い方を長文説明しない。構造自体を直す。
- system key、sync mode、schema名をユーザーへ出さない。

## 15. Accessibility

### Official guidance

Carbonの[Accessibility overview](https://carbondesignsystem.com/guidelines/accessibility/overview/)、[Developers](https://carbondesignsystem.com/guidelines/accessibility/developers/)、[Keyboard](https://carbondesignsystem.com/guidelines/accessibility/keyboard/)は、componentだけでなくcomposition、semantic structure、focus order、screen reader、contrastを製品側の責任とする。

### Project interpretation

Carbon component使用を合格条件にしない。task開始から完了までkeyboardとscreen readerの文脈が保たれるかを確認する。

### Practical rule

- semantic landmarkとheading outlineを保つ。
- 全controlにvisible labelまたはaccessible nameを付ける。
- modalはfocus trap、初期focus、Escape/close、triggerへのfocus returnを検証する。
- disclosure、menu、switcherはexpanded / selected stateをprogrammaticに伝える。
- error textをfieldへ関連付け、submit後は最初のerrorへ移動する。
- focus ringを消さない。theme別contrastを確認する。
- motionにはreduced-motionまたは静的代替を用意する。[Motion](https://carbondesignsystem.com/elements/motion/overview/)
- [Icons](https://carbondesignsystem.com/elements/icons/usage/)は標準sizeを使い、icon-onlyのhit areaは44px以上を目安にし、色だけで意味を伝えない。
- disabledだけで理由を隠さない。必要なら近傍に理由を出す。
- loading完了・失敗を適切にannounceする。

## 16. Mobile

### Official guidance

Carbonのresponsive gridとcomponent responsive behaviorを基礎にする。Modalはbrief、focused、必要な中断に限定し、body scroll時もheader/footer actionを利用可能に保つ。[Modal usage](https://carbondesignsystem.com/components/modal/usage/)

### Project interpretation

mobileはdesktopの縦積みではない。長いmodal、多列data、hover依存、常時sticky actionをtask surfaceごと再設計する。本projectでは44px相当のtouch hit areaを実装・実測targetとする。

### Practical rule

- 390pxでprimary action、現在地、未完了stateが最初のviewportから理解できる。
- mobileのdata tableは重要columnを選んだlistへ変換し、詳細はdisclosureへ送る。
- bottom-aligned独自modalを安易に作らない。taskが長いならdedicated pageへ移す。
- software keyboard表示中もfocused inputとsave/cancelへ到達できる。
- sticky actionはselection/editing中など期限付きcontextに限定する。
- notch / browser chrome / safe areaを含む短いviewportで確認する。

## 17. Anti-patterns

次をレビューで差し戻す。

- 既存componentの1対1 Carbon置換から設計を始める。
- lifecycle上独立したworkspaceを、同じ文脈だという理由なしにTabsへ入れる。
- 長いform、複数step、反復作業、context参照が必要なtaskをModalへ入れる。
- sectionごとにTileを置き、surfaceの数でhierarchyを作る。
- 各操作成功をToastで通知する。
- 1 pageに複数Primary actionを常時表示する。
- danger actionを日常actionと同列に常時露出する。
- Accordionで必須情報やformの論理順を隠す。
- Content switcherをnavigationやworkflow progressに使う。
- arbitrary px、独自色、shadow、radius、hover、focusをCarbon代替の確認なしに追加する。
- desktopを縮小・縦積みしただけのmobile layout。
- Carbon componentを使ったことだけでaccessibility完了とする。

## 18. Review handoff

本書は設計原則の根拠を所有し、PRのblocking checklistは重複定義しない。実装reviewでは [SANPOKAI_PRODUCT_UI.md §23](./SANPOKAI_PRODUCT_UI.md#23-minimum-design-review-checklist-for-ui-prs) を唯一のminimum checklistとして使い、必要な原則の根拠だけを本書の該当sectionから引用する。
