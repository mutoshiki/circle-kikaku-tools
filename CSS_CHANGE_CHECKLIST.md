# CSS Change Checklist

1. 変更対象の正規ownerを確認した。
2. DOM構造、計算、保存、同期、操作方法を意図せず変えていない。
3. 汎用UIで利用可能な公式Carbon Web Componentを独自再実装していない。
4. 既存semantic tokenで表現できる値を直接記述していない。
5. 同じ役割の要素に同じ寸法と状態表現を使っている。
6. 親の`gap`と子の`margin`が重複していない。
7. 固定幅と`min-width`、`max-width`、`overflow`の関係を確認した。
8. 320、390、768、1280pxで横方向のはみ出しがない。
9. ライト／ダーク双方で文字、境界、選択、警告を識別できる。
10. hover、focus、active、invalid、warning、readonly、disabledが識別できる。
11. モバイルの編集可能入力が16px以上で、iOSの自動入力ズームを誘発しない。
12. 可視操作が原則48px以上で、accessible nameを持つ。
13. Modal／Menu／PopoverがVisual Viewport外へ出ず、閉じた後のフォーカスが自然である。
14. Bottom Navigation、Toast、Tray、Menu、Modalのlayer順が衝突しない。
15. safe-areaを背景帯として塗りつぶしていない。
16. `!important`や不要な高詳細度を追加していない。
17. `99-*`、`override-*`、`final-fix*`等の場当たり的な修正を追加していない。
18. `npm run lint:css`が成功する。
19. `npm test`が成功する。
20. Playwright操作テストと画面監査が成功する。
21. Visual基準更新は差分を個別確認したものだけを保持する。
