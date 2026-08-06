# Dark Mode Accent QA

## 方針

Gray 100の青は、見た目上の役割を次の2系統に限定する。

- 塗りのある主要操作: `--app-accent-fill`（Carbon Blue 60）
- 文字・アイコン・境界: `--app-accent-text` / `--app-accent-icon` / `--app-accent-border`（Carbon Blue 40）

低コントラスト通知と選択面は`--app-accent-surface`から生成し、Blue 50を機能CSSへ直接持ち込まない。

## 確認対象

- 通常／確認／警告モーダル
- 共有リンクモーダル
- 参加者登録・インポート結果
- 使い方モーダル
- 精算設定モーダル
- 車ごとの費用モーダル
- 移動距離計算ツール、経路選択、地点並べ替え
- 空席メンバー選択
- 編集ロック／合言葉
- Toast／Inline Notification
- ヘッダーOverflow Menu
- 自動割り当てPopover
- 人物カードOverflow Menu

## 自動確認

- `npm test`
- `npm run test:dark-accent`
- `npm run test:share`
- `npm run lint:maps`
- `npm run typecheck:maps`
- `npm run test:maps:contract`
- `npm run test:driver-reward`
- 全CSS 121ファイルの構文解析
- Carbon Web Componentsを実レンダリングした11種類のダークポップアップ色監査

実レンダリング監査では、ポップアップ内にBlue 50（`#4589ff`）が混入していないことを確認する。
