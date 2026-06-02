# CSS変更チェックリスト

CSSを足す前に確認すること。

1. 直したいUIのowner CSSはどこか確認する。
2. 既存のトークン、`.ui-surface`、`.ui-amount`、`.ui-chip`、`.ui-input` で表現できないか確認する。
3. `!important` を使っていないか確認する。
4. `z-index` を数値で書いていないか確認する。
5. ライト/ダーク両方で見えるか確認する。
6. iPhone SE相当、iPhone 12/13相当、広めスマホで崩れないか確認する。
7. 枠線を増やして二重枠に見えていないか確認する。
8. CSSファイル名に `repair`、`fix`、`guard`、`continued` を使っていないか確認する。
9. 1ファイルが320行を超えていないか確認する。
10. `npm test` を通す。
11. テーマ色を増やす場合、画面別CSSではなく `assets/css/theme/00-theme-contract.css` の `--theme-light-*` / `--theme-dark-*` を増やす。
12. `body[data-app-theme="..."] .component` のようなテーマ別個別指定を増やす前に、意味トークンへ流し込めないか確認する。
13. 色を変更した場合、`tests/standard-theme-contrast-check.js` の基準を満たすか確認する。

## Theme picker note

- Theme selection is active again. The current first-paint theme is `standard`.
- Add or remove selectable themes in `assets/js/modules/theme-presets.js`.
- Add the matching color variables in `assets/css/theme/00-theme-contract.css`.
- Component and screen CSS should continue to use semantic tokens such as `--bg-body`, `--bg-card`, `--text-main`, `--border-color`, `--accent-color`, and `--accent-soft`.
- Do not put theme-specific colors directly into screen CSS unless the color is a fixed semantic state such as error, warning, or success.
