# Feature Update QA — v29

## 変更範囲

v28を基準に、精算設定内の次の表示だけを変更した。

- 「車出し協力代（1台）」の入力欄と「車出し協力代の負担方法」の間にあった区切り線を削除

見出し、入力欄、Carbon Content Switcher、ARIA関連付け、上下の余白は維持した。後付けoverrideファイルは追加せず、所有CSSである`assets/css/settlement/controls/03-settings.css`を直接修正した。

## Carbon実装

- 金額入力は既存の`cds-text-input`を維持
- 負担方法は既存の`cds-content-switcher`を維持
- `aria-labelledby="seisanDriverRewardTypeLabel"`を維持
- 不要な装飾境界だけを削除し、情報のまとまりは余白と見出しで表現
- CSSキャッシュ値を`feature-polish-v29`へ更新

## 隔離ブラウザ検査

リポジトリ外の一時コピーを使用し、同じSystem Chromiumで確認した。空のポリシー用ディレクトリを起動引数へ指定し、管理対象URLへ依存せず、ローカル資産をインライン化して`page.set_content()`で隔離レンダリングした。リポジトリ本体とシステムポリシーファイルは変更していない。

確認環境：

- 360 × 800：ダーク
- 390 × 844：ダーク
- 390 × 844：ライト
- 1440 × 900：ダーク

確認結果：

- `.seisan-driver-reward-policy`の`border-top-style`：`none`
- `border-top-width`：`0px`
- ライト／ダークとも区切り線なし
- 入力欄、見出し、Content Switcherの配置崩れなし
- ブラウザ実行エラー：0件

## 自動検査

- `npm test`：PASS
- `npm run test:share`：PASS
- `npm run lint:maps`：PASS
- `npm run typecheck:maps`：PASS
- `npm run test:maps:contract`：PASS
- `npm run test:driver-reward`：PASS
- CSS 121ファイルの構文解析：エラー0件
- 区切り線の再混入を検知する契約テストを追加

GitHubへの書き込みは行っていない。
