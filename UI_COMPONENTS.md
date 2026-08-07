# UI Components

## Navigation

画面下部の「車割・班割」「共有画面」「精算」は公式Carbon Content Switcherです。現在位置は選択面、文字ウェイト、ARIA状態で示します。外側のsafe-areaは塗りつぶさず、バー本体だけを画面下端から浮かせます。ヘッダーの共有、ロック、その他、概要は公式Carbon Icon Button／Overflow Menuです。通常のユーティリティは中性色、共有と明示的なロック状態だけをアクセント色で示します。

## Surface

- `surface-lowest`: 入力・読み取りの主要面
- `surface-low`: セクション背景、補助面
- `surface-container`: 選択肢や内部グループ
- 浮遊面: 未割当トレイ、共有編集操作、ドロワー、Popover、Menu、Modal

不要な入れ子カードや装飾影を避け、Carbonのlayer、余白、見出し、罫線で情報を分けます。通常カードには影を使用しません。

## Button and menu

- Primary: 参加者登録、保存、実行
- Secondary: 距離確認、コピーなどの補助行動
- Tertiary／Ghost: 戻す、編集、文脈内操作
- Danger: 削除
- Icon Button: ヘッダーや単一アイコン操作
- Overflow Menu／Menu: ヘッダー、人カードの文脈操作
- Popover: 未割り当ての割り当て条件

モバイルの可視操作は原則48px以上です。アイコン操作は公式Carbon Iconsを使用し、`aria-label`または可視ラベルを持ちます。Menuは開いたトリガーを基準にVisual Viewport内へ収め、閉じた後はトリガーへフォーカスを戻します。

## Input and selection

Text Input、Number Input、Textarea、Select、Checkbox、Toggle、Content Switcherは公式Carbon Web Componentsです。

- デスクトップのCarbon入力文字は14pxの公式寸法
- iOS自動拡大を避けるため、768px以下の編集可能な内部入力は16px
- invalid、warning、readonly、disabledをCarbon属性・補助文・ARIAへ同期
- エラー修正中は`input`で状態を即時解除
- プレースホルダーは具体例を示し、値の代替として使用しない

## Allocation card

車カードの見出し、定員、戻す操作の位置関係を維持します。運転者は選択面、同乗者は静かな面とし、学年Tag、メモ、Carbon Menuの優先順位を分けます。未割当は下部トレイに保持し、0人時は不要な面積を確保しません。空席の追加操作は文字記号ではなく公式Carbon Addアイコンを使います。

## Shared presentation

車割を上、班割を下に表示する既存順序を維持します。スマートフォン幅ではパン・ピンチで閲覧し、移動可能な端を視覚的に示します。編集は公式Carbon Icon Buttonから開始し、下部ナビと重なりません。

## Settlement

設定、全体費用、ドライバー支払、集金チェック、共有の順序を維持します。全体費用は「参加者集金 + 部費支出 = 支払総額」の関係をCarbon layerとTagで示します。車両費編集は公式Carbon Modal内で、距離・燃費・単価、諸経費、負担区分、候補を編集します。

## Modal

すべて公式Carbon Modalのanatomyを使用します。

- `cds-modal-header`、`cds-modal-heading`、`cds-modal-close-button`
- `cds-modal-body`
- 必要時のみ`cds-modal-footer`／`cds-modal-footer-button`

開いた直後は操作ボタンへ青枠を出さず、見出しを初期フォーカス先にします。X、キャンセル、Escapeで閉じ、閉じた後は起点へ戻します。長い本文だけがスクロールし、フッターは画面内へ残ります。

## Notification and status

Toast／Inline Notification／Tagを公式Carbonで表示します。通知は下部ナビの上に置き、操作を隠しません。同期、ロック、支払、費用区分は色だけでなく文字とアイコンでも区別します。
