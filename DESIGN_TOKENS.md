# Design Tokens

## Semantic color system

ライト／ダークを同じ役割で表現するため、画面 CSS は色名ではなく意味トークンを使用します。

基調はFigmaの `(v11) Carbon Design System` に合わせたWhite／Gray 100テーマです。

- `--bg-body`: WhiteはGray 10、Gray 100はGray 100の画面背景
- `--surface-lowest`: 主要な読み取り面
- `--surface-low` / `--surface-container` / `--surface-high`: Carbonのlayer階層
- `--text-main` / `--text-sub` / `--text-faint`: Carbonのtext-primary／secondary／placeholder相当
- `--border-color` / `--border-section`: Carbonのborder-subtle／strong相当
- `--accent-color` / `--accent-container`: Blue 60を中心とした主要操作と選択状態
- `--semantic-success` / `--semantic-warning` / `--semantic-danger`: 成功・注意・危険
- `--status-split-*`: Blue系
- `--status-club-*`: Yellow系
- `--status-payment-*`: Magenta系

精算3区分は色だけで区別せず、既存のラベル・アイコン・配置も維持します。ライトは `tokens/01-color-scheme.css`、ダークは `tokens/01-theme-modes.css` が所有します。

## Shape and spacing

```css
--radius-xs: 0;
--radius-sm: 0;
--radius-main: 0;
--radius-lg: 0;
--radius-xl: 0;
--radius-pill: 0;

--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;
```

Carbon v11に合わせ、入力、カード、ダイアログ、タグを直線的な形で統一します。

## Controls

- 基本高: `--control-height: 48px`
- モバイル基本高: `--control-height: 48px`
- モバイルアイコン操作: `--control-icon-size: 48px`
- 入力文字: モバイル16px以上
- キーボードフォーカス: 内側2px outline

## Typography

- caption: `--font-size-caption`
- label: `--font-size-label`
- body: `--font-size-body`
- title: `--font-size-title`
- headline: `--font-size-headline`
- amount: `--font-size-amount`

金額は等幅数字を使い、見出し・本文・補足・状態の強さを文字サイズとウェイトで分けます。

## Elevation

- `--shadow-card`: 通常カードでは使用しない
- `--shadow-float`: 浮遊操作、ドロワー
- `--shadow-modal`: ダイアログ
- `--shadow-tray`: 未割当ボトムシート

通常面は境界線、layer、余白で階層を作り、影はドロワーやモーダルなどの浮遊面に限定します。
