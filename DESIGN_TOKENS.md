# Design Tokens

## 単一ビジュアルシステム

画面の色、余白、角丸、影、操作状態は、`assets/css/tokens/`にある意味トークンを通して管理します。画面固有CSSへ色の直接値を増やさず、役割に対応する変数を使用します。

- `tokens/01-color-scheme.css`: 背景、文字、境界、主操作色、意味色、影
- `tokens/02-radius-spacing-type.css`: 余白、角丸、文字、フォーカス
- `tokens/03-bootstrap-controls.css`: Bootstrap操作部品の基礎
- `tokens/04-forms-inputs.css`: フォーム入力の基礎
- `tokens/05-control-surface-tokens.css`: 共通操作寸法と表面階層

トークンを利用した最終的な表示責任は、共通部品なら`components/`、画面固有部品なら各機能ownerが持ちます。全画面へ後から適用するvisualスキンは置きません。

## 基本方針

- 背景は淡いニュートラル、主要コンテナは白を使用する。
- 主操作だけに`--accent-color`を使用する。
- 文字は`--text-main`と`--text-sub`で階層を作る。
- 境界は`--border-color`を基準にし、強調時のみ`--border-hover`や`--accent-line`を使う。
- 影は`--shadow-card`と`--shadow-float`に限定する。
- 状態色は成功、注意、危険、精算区分など意味を持つ箇所だけに使う。
- レスポンシブ差分は寸法と密度を中心とし、色や部品の役割を変えない。

## 主要トークン

```css
--bg-body
--bg-card
--text-main
--text-sub
--border-color
--accent-color
--accent-hover
--accent-soft
--surface-soft
--surface-muted
--shadow-card
--shadow-float
--control-height
--control-radius
```

新しい値が必要な場合は、既存の意味トークンで表現できないことと、参照先全体への波及を確認してから追加します。
