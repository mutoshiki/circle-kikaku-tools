# Design Tokens

UIの見た目は、できるだけここに書いたトークン経由でそろえます。

## 色

- `--bg-body`: ページ背景
- `--bg-card`: カード面
- `--text-main`: 本文
- `--text-sub`: 補助文
- `--border-color`: 標準の線
- `--accent-color`: 主要操作・選択状態
- `--accent-soft`: 薄いアクセント面

## 面・枠線・影

- `--shadow-card`: 通常カード
- `--shadow-float`: モーダル・浮いた部品
- `.ui-surface`: 共通面
- `.ui-surface--card`: 外側カード
- `.ui-surface--inset`: 内側の控えめな面

枠線を増やすときは、外側カードだけを少し濃く、内側の行や内訳は薄くします。二重枠に見える場合は内側を枠なし寄りにします。

## 角丸

- `--radius-control`: 入力欄・小ボタン
- `--radius-card`: 通常カード
- `--radius-panel`: 大きめの面

角丸は丸すぎない値を基準にします。

## 余白

- `--space-1`: 2px
- `--space-2`: 4px
- `--space-3`: 6px
- `--space-4`: 8px
- `--space-5`: 10px
- `--space-6`: 12px
- `--space-8`: 16px
- `--space-10`: 20px

細かい `padding: 7px 11px` のような値を増やす前に、近いトークンへ寄せます。

## 文字

- `--font-size-caption`: 補助ラベル
- `--font-size-label`: 小見出し
- `--font-size-body`: 本文
- `--font-size-title`: カード見出し
- `--font-size-amount`: 金額
- `--font-weight-amount`: 金額の太さ

金額は `.ui-amount` を使います。サマリー、車別費用、集金チェックで数字の雰囲気をそろえるためです。

## タグ

- `.ui-chip`: 共通タグ土台
- `.seisan-cost-type-badge`: 割勘/部費
- `.seisan-payment-tag`: 支払

タグは高さ・中央揃え・角丸を共通化し、色だけ意味別トークンで変えます。

## z-index

- `--z-base`
- `--z-raised`
- `--z-sticky`
- `--z-tray`
- `--z-dropdown`
- `--z-overlay`
- `--z-modal`
- `--z-toast`

数値を直接書くと重なり事故が起きやすいので、必ず `--z-*` を使います。
