# 使い方ガイド再構築・スマホ最適化レポート

## 実施内容

旧使い方ガイドのモーダル、本文生成処理、段階送り処理、専用CSS、疑似画面は削除済みのまま維持した。

新ガイドは、実際の操作順に合わせて文章を短く整理した。内部仕様の説明や同じ内容の言い換えを削り、画面上の名称に合わせた表現へ修正した。

掲載画像はすべて、幅390pxの実際のスマホ表示から切り抜いた11枚のWebP画像へ差し替えた。デスクトップ版の画像は使っていない。

画像が大きく引き伸ばされないよう、ガイド内ではスマホ画面の幅を上限に表示するよう調整した。

## 主な更新ファイル

- `USER_GUIDE_DRAFT.md`
- `assets/js/templates/user-guide-content.js`
- `assets/css/guides-modals/manual/01-manual-shell.css`
- `assets/css/guides-modals/manual/02-manual-media.css`
- `assets/css/guides-modals/manual/03-manual-mobile.css`
- `assets/images/user-guide/01-navigation.webp` ～ `11-settlement-checks.webp`
- `tests/user-guide-rebuild-check.js`

## ガイドの構成

1. 参加者登録
2. 車割
3. 班割
4. 共有画面
5. 予定と共有
6. 精算
7. 保存と復元

精算内は、設定、車ごとの費用、移動距離、結果の順に説明している。

## 検証結果

- 静的テスト: 63件通過
- Stylelint: 通過
- JavaScript構文検査: 通過
- 使用画像: 11枚すべて幅390pxのスマホ表示
- 390×844pxでガイド上部・中部・下部を描画し、横方向のはみ出しがないことを確認

確認画像は `screenshots/user-guide-mobile-revision/` に保存した。
