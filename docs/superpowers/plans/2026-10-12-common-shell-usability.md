# 共通ヘッダー・企画情報 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. この作業は同一エージェントで順に進める。

**Goal:** 共通ヘッダー、企画名、タブ周辺の情報階層と操作の意味を明確にし、Carbonに沿った余白・キーボード操作・モバイル表示に整える。

**Architecture:** AppHeaderはアプリ共通の操作を担当し、企画名の表示・編集は独立したProjectIdentityにまとめる。既存Gridの配置とタブ構成を維持し、企画情報とタブを一つのmainで包む。企画名の確定は既存storeのrenameコマンドを使う。

**Tech Stack:** React 19.2.8、@carbon/react 1.115.0、@carbon/icons-react 11.87.0、Sass、既存Playwright環境。

**Spec:** 本書の「採用する設計」。直前の共通画面Carbon評価を実装対象とし、各タブ内の機能再設計は含めない。

## Global Constraints

- 作業元は `C:\Users\toshi\.codex\worktrees\production-baseline\circle-kikaku-tools`、branchは `codex/production-baseline-workspace`。旧Documents配下のcheckoutを作業元にしない。
- 実装前にAGENTS.mdと `docs/development/current-workspace.md` を確認し、公開manifestと作業元の対応を再確認する。本書作成時の起点SHAは `a8531f1be1353a156be4d2ed1c71f80af9c3ff6b`。
- 現在の未コミット変更を保全する。reset、stash、別ブランチからの一括取り込みを行わない。
- 参加者・車割・班割・精算のロジック、schema、同期契約、共有URLを変更しない。以前中止した広範なCarbon再設計を再開しない。
- Carbon MCPとインストール済みパッケージで、新しく使うコンポーネントのexport・propsを確認する。独自のヘッダー、スキップリンク、ボタンを作り直さない。
- テストは変更した契約を中心に選ぶ。既存検証のassertionを削除して通すことはしない。
- 今回は計画のみ。実装時の公開・pushは別の依頼で扱う。

## Review Focus

1. 日本語変換中のEnter/Escapeで保存・キャンセルが発生しないこと。
2. 別端末からの企画名変更で編集中のdraftが消えず、キャンセル後は最新の共有名が表示されること。
3. 長い企画名と同期メッセージが320px幅・200%拡大でも操作領域を押し出さないこと。
4. スキップ操作・編集終了・メニュー終了でフォーカスの行き先が明確なこと。
5. ローカルの保存受付とサーバー同期完了を混同せず、入力確定失敗時にdraftを保持すること。

## 採用する設計

| 部分 | 実装する形 | 公式指針と、この製品での判断 |
|---|---|---|
| アプリヘッダー | 現行の商品名・3つのアイコン・標準操作サイズを維持 | UI shellは共通識別と共通操作の場所。企画名は本文に置き、長い名前とグローバル操作の競合を避ける |
| スキップリンク | Carbon SkipToContentを先頭に置き、「メインコンテンツへ移動」。mainのidは `main-content` | 公式のキーボードアクセスに対応。移動先には企画情報とタブの両方を含める |
| 企画名 | 通常はページ見出し。「変更」はGhost、アクセシブル名は「企画名を変更」 | 固定の見出し階層は公式の考え方。常時入力から表示優先に変えるのは、読む頻度と変更頻度に基づく製品判断 |
| 企画名編集 | 見出しを残し、その直下にラベル「企画名」の入力と「保存」「キャンセル」。編集中だけ追加の高さを使う | inline編集と明示的な確定は製品判断。モーダル往復を増やさず、blurでの意図しない保存をなくす |
| 共有操作 | tooltipとアクセシブル名を「企画のリンクをコピー」に統一 | 操作の結果が分かるラベル。共有URL生成・clipboard処理は維持 |
| その他メニュー | ボタン・メニューの名前を「その他の操作」に統一 | 実装由来の「ユーティリティ」を利用者向けの言葉に変える。既存項目と関連アプリは維持 |
| 周辺レイアウト | Gridの左右位置と選択タブ・本文のレイヤー関係を維持。モバイル企画情報の上下余白は16pxを起点に確認 | 公式のspacing・layeringを使う。独立カードや追加Dividerを増やさない |
| 同期表示 | 企画情報内で副次情報として表示し、狭い幅では折り返す。現行の文言とrole=statusを維持 | 状態は見出しと競合させない。サービス側の状態・再試行・Auth処理は今回変更しない |

**採用しないもの:** 企画名をアプリヘッダーへ移す、黒いヘッダーへの固定、企画名専用モーダル、新しい外枠カード、タブ内容の再設計、ヘッダーのタップ領域縮小。いずれも今回の目的に対して競合・操作増・視覚的負担が増える。

## Task 1: 共通操作とmainの意味を整える

**Files:** `apps/react/src/components/AppHeader.jsx`、`apps/react/src/App.jsx`、`apps/react/tests/browser/shell.spec.js`。既存テスト中の旧ヘッダーラベル参照も対象。

**Interfaces:** AppHeaderの既存props・callbacksを維持。mainに `id="main-content"` と `tabIndex={-1}` を設け、SkipToContentがそこへ移動する。

- [ ] Carbon MCP・実パッケージでSkipToContentのhref、ラベル指定とフォーカス挙動を確認する。
- [ ] shell検証に「最初のTabでスキップリンクが現れ、Enterでmainへ移動する」「3つの共通操作がキーボードから使える」を追加する。
- [ ] `main` を企画情報GridとタブGridの外側に移す。既存 `.main-content` の余白はタブ側のラッパーで維持し、main移動による余白増を防ぐ。
- [ ] 共有ボタンを「企画のリンクをコピー」、その他ボタンとMenuを「その他の操作」に変更する。「使い方」の共有手順も同じ名称に合わせる。
- [ ] `rg -n '共有リンク|ユーティリティメニュー' apps/react/tests apps/react/src` で依存を探し、操作名のlocatorだけを更新する。旧画面用の無関係な文字列は変更しない。
- [ ] `npm.cmd run test:browser -- tests/browser/shell.spec.js` をapps/reactで実行。キーボード、メニュー、共有入口、関連アプリ、テーマ、4タブが合格する。

## Task 2: 企画名を表示と明示的な編集に分ける

**Files:** 新規 `apps/react/src/components/ProjectIdentity.jsx`。変更 `apps/react/src/App.jsx`、`apps/react/tests/browser/shell.spec.js`、`apps/react/tests/browser/domain-store.spec.js`、`apps/react/tests/browser-emulator/sync.spec.js`。

**Interfaces:** `ProjectIdentity({ name, syncStatus, onRename })`。nameはroom.roomName、syncStatusは現在のsnapshot、onRenameは `name => runtime.store.command('rename', { name })`。戻り値を同期完了として扱わない。

- [ ] 企画名の見出し、編集開始、保存後の再読込、キャンセル、blurで未保存、IME中Enter/Escape、同期更新中のdraft保持を検証する。変換前Enterのassertionは「編集継続・保存先の値が不変」。
- [ ] 通常表示の見出しは `h1#project-heading`。空の名前は「企画名未設定」。既存nameの空文字・空白の扱いを変更せず、新しい必須制約やtrimを追加しない。
- [ ] 「変更」で最新nameをdraftへコピーし、入力へフォーカス。「保存」はCarbon primary、「キャンセル」はghost。「変更」は編集中には隠す。
- [ ] draftと確定nameを別に持ち、受信したnameでdraftを上書きしない。Tab切り替えでも編集中のdraftは保持する。
- [ ] 保存はonRenameを一度だけ実行し、受付成功後に編集を終了する。未変更ならコマンドを発行せず終了。同期中・同期失敗は既存syncStatusが担当し、サーバーへの保存完了を先取りして通知しない。
- [ ] 同期的なコマンド失敗は入力付近に簡潔なエラーを出し、draftと編集状態を保持する。キャンセルはrenameを呼ばず、最新のnameを表示する。
- [ ] Enter保存・Escapeキャンセルはcomposition中には無効。保存/キャンセル後は「変更」にフォーカスを戻す。見出しは編集時にも残す。
- [ ] AppのroomName編集stateとonBlur保存を撤去する。mainを `aria-labelledby="project-heading"` にする。子画面にh1がある場合は意味上必要な見出しタグのみ調整し、既存の表示サイズ・操作内容を維持する。
- [ ] Emulator検証は両端末で明示的に編集開始・保存する形へ更新。端末Bの日本語draftが端末Aの保存で消えず、Bの保存が共有され、participantsとapplicationSyncが不変であることを確認する。
- [ ] `npm.cmd run test:browser -- tests/browser/shell.spec.js tests/browser/domain-store.spec.js` を実行。Emulatorは既存の安全な起動手順・target設定で `npm.cmd run test:browser:emulator -- --grep "active Japanese draft"`。環境が使えなければ未確認として残し、成功を推測しない。

## Task 3: 共通領域の余白・文字・状態を仕上げる

**Files:** `apps/react/src/styles.scss`、`apps/react/src/components/ProjectIdentity.jsx`、`apps/react/tests/browser/shell.spec.js`、`apps/react/tests/browser/visual-consistency.spec.js`。

**Interfaces:** 企画情報を `.project-title`、見出し/操作を `.project-identity-heading`、編集欄を `.project-name-editor`、同期表示を既存 `.sync-status` で局所指定する。

- [ ] layoutの `$spacing-04`（12px）、`$spacing-05`（16px）、`$spacing-06`（24px）を既存の余白用途に対応させる。モバイル企画情報の上下は `$spacing-05`、デスクトップは `$spacing-06` を起点とする。
- [ ] 見出しはCarbon heading-04、補助情報はlabel-01、入力・ボタンはコンポーネント標準を使う。モバイル入力の16pxはiOS拡大防止を考慮して維持する。
- [ ] 企画名は長い日本語・連続英数字を折り返し、操作を圧縮しない。sync-statusのnowrapを外し、見出しの下に配置する。Carbonのtext/layer/backgroundトークンを使い、独自色を追加しない。
- [ ] 320px・390px・1280px、light/dark、通常/編集、空名/長い日本語/長い英数字、同期中/失敗の実画面を確認する。横スクロールなし、操作の欠けなし、200%拡大で全文と操作に到達できること。
- [ ] Tab内の一覧密度・費用内訳・割当UIを変更しない。既存styles.scssの未コミット変更に一括置換をかけない。
- [ ] shellおよびvisual-consistencyの該当検証を実行し、文字折り返しとレイヤー接続を実ブラウザで確認する。input背景色のassertionは編集開始後に検証し、テーマ検証を削除しない。

## Task 4: 検証入口を更新し、正しいpreviewで受け入れる

**Files:** `apps/react/tests/browser/production-smoke.spec.js`、`apps/react/tests/production/production-smoke.spec.js`、`apps/react/tests/react-production-release-contract.test.mjs`、Task 1で旧ラベルが見つかった関連テスト。

**Interfaces:** 起動完了の検証は企画名textboxから `heading#project-heading` の確定名へ変更。`.application`、企画名、`同期完了`、配信SHA/digest照合とsmoke専用roomの制約を維持する。

- [ ] sample挿入後・再読込後の確定名は見出しで確認し、名称変更が必要な手順だけ「企画名を変更」→入力→保存へ更新する。
- [ ] 本番smokeの待機条件・リリース契約テストを新DOMに追従させる。待機を削除したり、任意の文字が見えるだけの緩いassertionに変えない。本番smoke自体は今回のローカル実装検証では実行しない。
- [ ] 変更したlocatorを使う関連browserテストと `react-production-release-contract.test.mjs` を安全なoffline設定で実行する。新たな失敗は機能回帰とselector差分を区別して直す。
- [ ] `docs/development/current-workspace.md` の手順で公開manifestを取り直し、作業基準の変化がないことを確認する。基準が変わっていたら差分を記録し、既存変更を保全して対応を決める。
- [ ] apps/reactで `npm.cmd run build:preview -- --baseline-source-sha <確認済みSHA>`、4194の配信を照合し `npm.cmd run check:preview -- --url http://127.0.0.1:4194/ --expected-source-sha <確認済みSHA>` が成功してからユーザーのpreviewを更新する。
- [ ] ローカルroom `PREVIEW-ORIGIN-VERIFY-20261011` だけで受け入れ確認。4タブで共通領域が一致すること、名前保存・取消・再読込、最初のTab、メニュー終了時のfocus、長い名前、コピー成功/失敗表示を確認する。
- [ ] 結果を「変更内容／検証済み／未確認／公開なし」に分けて短く報告する。

## 完了条件と作業を止める条件

- 完了: 共通領域の意味と見た目が4タブで一貫し、明示的な企画名編集・IME・同期draft・キーボード・狭幅が確認され、previewの配信元が照合済み。
- 停止: 作業元や配信元が不明、既存変更を壊す必要が生じた、同じ原因不明の失敗が続く場合。診断事実と残作業を報告し、Auth/APIキーや精算ロジックへ推測で変更を広げない。
- 公開は完了条件に含めない。公開依頼が来た時点で既存リリース手順を使う。

## Carbon公式参照

- [UI shell header: Guidelines](https://carbondesignsystem.com/building-blocks/core/components/ui-shell-header/guidelines/)
- [UI shell header: Accessibility](https://carbondesignsystem.com/building-blocks/core/components/ui-shell-header/accessibility/)
- [Button: Guidelines](https://carbondesignsystem.com/building-blocks/core/components/button/guidelines/)
- [Typography: Type sets](https://carbondesignsystem.com/building-blocks/foundations/typography/type-sets/)
- [Spacing: Overview](https://carbondesignsystem.com/building-blocks/foundations/spacing/overview/)
- [Color: Guidelines](https://carbondesignsystem.com/building-blocks/foundations/color/guidelines/)

## 計画の自己レビュー

- 評価対象のヘッダー・企画情報・周辺余白・アクセシビリティをTask 1〜3で対応し、検証入口と正しい配信の確認をTask 4で扱う。
- 公式指針と製品判断を分け、採用しない構造と理由を明記した。
- renameとsyncの契約を分離し、既存テストの常時textbox/blur保存依存を更新対象に含めた。
- 実装・テスト・build・公開は本書作成時には実施していない。
