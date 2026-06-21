# CSS Change Checklist

1. 変更対象の正規ownerを確認した。
2. DOM構造や操作方法を意図せず変えていない。
3. 既存トークンで表現できる値を直接記述していない。
4. 同じ役割の要素に同じ寸法と状態表現を使っている。
5. 親の`gap`と子の`margin`が重複していない。
6. 固定幅と`min-width`、`max-width`、`overflow`の関係を確認した。
7. モバイル、タブレット、デスクトップで横方向のはみ出しがない。
8. hover、focus、active、disabledが識別できる。
9. `!important`や不要な高詳細度を追加していない。
10. ファイル末尾へ場当たり的な修正を積み重ねていない。
11. `npm run lint:css`が成功する。
12. `npm test`が成功する。
13. Playwright操作テストと画像比較が成功する。
