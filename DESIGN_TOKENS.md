# Design Tokens

## Semantic color system

ライト／ダークを同じ役割で表現するため、画面 CSS は色名ではなく意味トークンを使用します。

今回の基調は、青ではなく「温かい紙・石のニュートラル＋オリーブ」です。

- `--bg-body`: わずかに黄味を含む画面背景
- `--surface-lowest`: 紙に近い最前面サーフェス
- `--surface-low` / `--surface-container` / `--surface-high`: 温度を揃えた階層差
- `--text-main` / `--text-sub` / `--text-faint`: 茶墨寄りの文字階層
- `--border-color` / `--border-section`: 温かいグレーの輪郭と区切り
- `--accent-color` / `--accent-container`: オリーブの主要操作と選択状態
- `--semantic-success` / `--semantic-warning` / `--semantic-danger`: 成功・注意・危険
- `--status-split-*`: セージ
- `--status-club-*`: 黄土
- `--status-payment-*`: ワイン

精算3区分は色だけで区別せず、既存のラベル・アイコン・配置も維持します。ライトは `tokens/01-color-scheme.css`、ダークは `tokens/01-theme-modes.css` が所有します。

## Shape and spacing

```css
--radius-xs: 8px;
--radius-sm: 12px;
--radius-main: 16px;
--radius-lg: 20px;
--radius-xl: 28px;
--radius-pill: 999px;

--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;
```

すべてを同じ角丸にせず、入力、内側面、カード、ダイアログ、ピル操作で段階を分けます。

## Controls

- デスクトップ基本高: `--control-height: 44px`
- モバイル基本高: `--control-height: 48px`
- モバイルアイコン操作: `--control-icon-size: 48px`
- 入力文字: モバイル16px以上
- キーボードフォーカス: 3px outline + 4px focus ring

## Typography

- caption: `--font-size-caption`
- label: `--font-size-label`
- body: `--font-size-body`
- title: `--font-size-title`
- headline: `--font-size-headline`
- amount: `--font-size-amount`

金額は等幅数字を使い、見出し・本文・補足・状態の強さを文字サイズとウェイトで分けます。

## Elevation

- `--shadow-card`: 通常カード
- `--shadow-float`: 浮遊操作、ドロワー
- `--shadow-modal`: ダイアログ
- `--shadow-tray`: 未割当ボトムシート

影だけで階層を作らず、surface と余白を主に使用します。
