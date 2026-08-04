# Design Tokens

## Semantic color system

ライト／ダークを同じ役割で表現するため、画面CSSは色名ではなく意味トークンを使用します。基調はCarbon White／Gray 100 themeです。

- `--bg-body`: アプリ外側の背景
- `--surface-lowest`: 主要な読み取り・入力面
- `--surface-low` / `--surface-container` / `--surface-high`: Carbon layer階層
- `--text-main` / `--text-sub` / `--text-faint`: text-primary／secondary／placeholder相当
- `--border-color` / `--border-section`: border-subtle／strong相当
- `--app-accent-fill`: Primary Buttonや選択確定など、塗りのある主要操作
- `--app-accent-text` / `--app-accent-icon` / `--app-accent-border`: リンク、情報アイコン、選択境界
- `--app-accent-surface` / `--app-accent-surface-strong`: 低コントラスト通知や選択面
- `--accent-*`: 既存機能との互換用。新規オーナーCSSからは直接使用しない
- `--semantic-success` / `--semantic-warning` / `--semantic-danger`: 成功・注意・危険
- `--status-split-*`: 割勘
- `--status-club-*`: 部費
- `--status-payment-*`: 支払

精算区分は色だけで区別せず、ラベル・アイコン・配置も維持します。ライトは`tokens/01-color-scheme.css`、ダークは`tokens/01-theme-modes.css`が所有します。

### ダークモードの青

Gray 100では、見えている青を次の2系統に限定します。

- 塗りのある主要操作: Carbon Blue 60
- 文字・アイコン・境界: Carbon Blue 40

通知や選択面は上記の色から導く暗いsurfaceを使います。機能CSSやモーダルCSSにBlue 40／50／60を直接記述せず、`--app-accent-*`または公式`--cds-*`トークンを使用します。

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

Carbonに合わせ、入力、カード、ダイアログ、Tagを直線的な形で統一します。

## Controls

- 基本操作高: `--control-height: 48px`
- モバイルアイコン操作: `--control-icon-size: 48px`
- キーボードフォーカス: 2pxのCarbon focus outline
- Bottom Navigation clearance: `--bottom-navigation-clearance`
- safe-area: `env(safe-area-inset-*)`を余白として使い、帯として塗りつぶさない

## Typography

ルートの基準文字サイズは16pxです。これによりCarbonのrem寸法を公式スケールで計算します。

- Carbon標準のデスクトップ入力文字: 14px
- 768px以下の編集可能入力文字: 16px（iOS Safariの自動入力ズーム防止）
- caption: `--font-size-caption`（常時表示する補足・Tagの基準）
- micro: `--font-size-micro`（固定表示など、ごく短い補助表示に限定）
- label: `--font-size-label`
- body: `--font-size-body`
- title: `--font-size-title`
- headline: `--font-size-headline`
- amount: `--font-size-amount`

金額は等幅数字を使い、見出し・本文・補足・状態の強さをサイズとウェイトで分けます。IBM Plex Sans／IBM Plex Sans JPをself-hostします。

## Elevation and layer

- 通常カード: 影なし
- Popover／Menu／Drawer: 浮遊layerと限定的な影
- Modal: Carbon overlayとmodal elevation
- 未割当: 下部トレイ専用layer
- Bottom Navigation: トレイより上、Menu／Modalより下

通常面は境界線、layer、余白で階層を作り、影は浮遊面に限定します。
