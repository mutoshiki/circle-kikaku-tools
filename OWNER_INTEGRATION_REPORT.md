# Owner Integration Report

## 目的

後勝ちで読み込まれていた`assets/css/visual/`を廃止し、現在の落ち着いた日本語業務ツールの表現を、各コンポーネントの正規CSS ownerへ直接統合した。

## 実施内容

- `index.html`からvisual CSS 5件の読み込みを削除
- `assets/css/visual/`を削除
- グループセレクタを展開した286件のスタイル定義を49個の正規ownerファイルへ移管
- 同一セレクタ・同一メディア条件に存在した旧プロパティを除去し、最終値を正規定義へ統合
- ヘッダーの通常・レスポンシブ定義を12ファイルから3個の正規ownerへ整理
- 旧visual層を要求していた静的テストを、visual層の不在と正規owner構成を保証するテストへ変更
- CSS設計資料をowner直接編集方式へ更新

セレクタごとの移管元、移管先、メディア条件、除去件数、プロパティ数は`owner-integration-log.json`に保存している。

## 正規owner

- ヘッダー共通: `assets/css/app-shell/header/01-header-base.css`
- 企画名・同期状態: `assets/css/app-shell/header/02-room-status.css`
- タブ・ヘッダー操作: `assets/css/app-shell/header/03-tabs-actions.css`
- 共通操作: `assets/css/components/buttons/`
- 共通フォームとトークン: `assets/css/tokens/`
- 車・班・参加者: `assets/css/cars-members-tray/`
- 発表ビュー: `assets/css/sheet-view/`
- 精算: `assets/css/settlement/`
- モーダル、ガイド、ドロワー: `assets/css/guides-modals/`

## 再発防止

静的テストは以下を検査する。

- `assets/css/visual/`が存在しない
- `index.html`がvisual CSSを読み込まない
- 全画面向けのoverride、final、skin相当CSSを追加しない
- ヘッダーが3個の正規ownerだけから読み込まれる
- 主要な共通トークンと操作定義が維持される
- CSS leaf fileが過大化せず、`!important`を含まない

## 検証方針

- CSS lint
- 静的アーキテクチャテスト
- Playwright操作テスト
- 360、390、430、768、1280、1440pxの全状態撮影
- コンソールエラー、通信失敗、横方向オーバーフローの監査
- 最終状態を基準にした画像回帰テスト

## 保証範囲

固定監査データとPlaywright専用Chromiumで開ける主要画面、編集状態、空状態、エラー状態、メニュー、ドロワー、モーダルを対象とする。実際のFirebase通信、極端に長い入力、端末固有フォント差は別途確認が必要である。

## 最終結果

### CSS構造

| 指標 | 統合前 | 統合後 |
|---|---:|---:|
| CSSファイル数 | 134 | 120 |
| セレクタ数 | 2,044 | 1,898 |
| 重複セレクタ数 | 719 | 628 |
| CSS総行数 | 19,307 | 17,415 |
| CSS総容量 | 477,894 bytes | 421,781 bytes |
| ヘッダーowner数 | 12 | 3 |
| visual後勝ちファイル | 5 | 0 |

CSSは14ファイル、1,892行、56,113 bytesを削減した。単に末尾のvisualファイルを削除したのではなく、必要な最終値を正規ownerへ移し、同じ責任の旧宣言を整理した結果である。

### ブラウザ監査

Playwright専用Chromiumで以下を確認した。

- 360×800
- 390×844
- 430×932
- 768×1024
- 1280×720
- 1440×900

結果:

- 最終スクリーンショット: 84枚
- 監査状態: 44状態
- コンソールエラー・警告: 0件
- 通信失敗: 0件
- 文書全体の横方向オーバーフロー: 0件
- 主要スクロール領域の横方向オーバーフロー: 0件
- 操作テスト: 4件成功
- 画像回帰テスト: 6サイズ成功
- CSS lint: 成功
- 静的テスト: 65件成功

最終画像は`screenshots/04-final/`、幅別の計測結果は同フォルダの`audit-report-*.json`に保存している。

## 設計判断の基準

現在の落ち着いた高密度業務ツールという方向性を維持し、次の公式設計資料を判断基準にした。

- デジタル庁デザインシステム「タイポグラフィ」: 管理画面・業務システム向けの情報密度と行高
- デジタル庁デザインシステム「エレベーション」: 過密な画面では高低差と装飾を抑える考え方
- Atlassian Design System「Foundations」「Typography」「Elevation」「Accessibility」: トークン、階層、表面、同一パターンの一貫性
- IBM Carbon Design System「Spacing」「Typography」「2x Grid」: 2・4・8系の余白、productive UIの文字階層、局所的な高密度と画面全体の余白

参照先:

- https://design.digital.go.jp/dads/foundations/typography/
- https://design.digital.go.jp/dads/foundations/elevation/
- https://atlassian.design/foundations
- https://atlassian.design/foundations/typography/applying-typography
- https://atlassian.design/foundations/elevation
- https://atlassian.design/foundations/accessibility
- https://carbondesignsystem.com/elements/spacing/overview/
- https://carbondesignsystem.com/elements/typography/type-sets/
- https://carbondesignsystem.com/elements/2x-grid/overview/
