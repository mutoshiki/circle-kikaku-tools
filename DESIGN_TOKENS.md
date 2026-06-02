# Design Tokens

UIの見た目は、できるだけここに書いたトークン経由でそろえます。

## テーマ契約

テーマは、色セットとライト/ダークを分けて扱います。

- `assets/css/theme/00-theme-contract.css`: テーマごとの元色。`--theme-light-*` と `--theme-dark-*` を定義する。
- `assets/css/theme/01-theme-tokens.css`: 元色を `--bg-body`、`--bg-card`、`--accent-color` などのアプリ共通トークンへ変換する。
- 画面別CSSでは `--theme-light-*` を直接使わず、必ず `--bg-card` などの意味トークンを使う。

将来テーマを増やす場合は、基本的に `00-theme-contract.css` へ次のようなブロックを追加します。

```css
body[data-app-theme="forest"] {
  --theme-light-bg-body: ...;
  --theme-light-accent: ...;
  --theme-dark-bg-body: ...;
  --theme-dark-accent: ...;
}
```

この形にしておくと、ボタン、カード、精算タグ、モーダル側のCSSを個別に増やさずに済みます。

## 色

- `--bg-body`: ページ背景
- `--bg-card`: カード面
- `--text-main`: 本文
- `--text-sub`: 補助文
- `--border-color`: 標準の線
- `--accent-color`: 主要操作・選択状態
- `--accent-soft`: 薄いアクセント面


## コントラスト基準

標準テーマでは、本文と補助文の読みやすさを優先します。

- 本文 `--text-main` はカード面に対して十分に強いコントラストを保つ。
- 補助文 `--text-sub` も小さな文字で読めるように、白背景で4.5:1以上を目安にする。
- 主要ボタンは、ライトでは白文字、ダークでは暗い文字を使い、背景色とのコントラストを確保する。
- 精算タグの「割勘」「部費」も、淡い背景のまま文字だけが薄くならないようにする。

数値の確認は `tests/standard-theme-contrast-check.js` で行います。

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

## Theme picker note

- Theme selection is active again. The current first-paint theme is `standard`.
- Add or remove selectable themes in `assets/js/modules/theme-presets.js`.
- Add the matching color variables in `assets/css/theme/00-theme-contract.css`.
- Component and screen CSS should continue to use semantic tokens such as `--bg-body`, `--bg-card`, `--text-main`, `--border-color`, `--accent-color`, and `--accent-soft`.
- Do not put theme-specific colors directly into screen CSS unless the color is a fixed semantic state such as error, warning, or success.
