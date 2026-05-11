# UI_BUTTON_PRIORITY_REPORT

## 変更内容
- `assets/css/08-control-consistency.css` に、全体ボタンの優先度ルールを追加。
- Primary / Secondary / Tertiary の見た目を統一。
- 共有、参加者登録、移動距離計算、自動割り当てを Primary として強調。
- 使い方、ロック、空席を埋めるを Secondary として控えめに統一。
- その他、再計算、設定、ズーム系を Tertiary / icon 操作として弱めた。
- ボタンの高さ、角丸、余白、文字太さ、フォーカス表示を統一。
- 車割タブ、精算タブ、下部待機メンバートレイのボタン配置のリズムを調整。

## 確認
- `npm test` 実行済み。
- Static test suite OK（32 files）。
- `!important` は追加していない。
