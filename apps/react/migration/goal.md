# React Migration Goal

## Objective

現行のサークル企画ツールを本番として維持したまま、同一リポジトリ内に独立したReact版を構築してください。

React版は、現行版の主要機能、canonical state、schema、Firebase同期契約、保存形式との互換性を維持し、Phase 7終了時点でrelease candidateとして評価できる状態まで完成させてください。

調査、設計、一部実装、Phase途中の完了をGoal完了とはみなしません。

必要な調査、実装、テスト、browser QA、原因調査、修正、regression verificationまで自律的に進めてください。

合理的に判断できる事項については確認待ちで停止せず、既存コード・テスト・仕様から判断して進めてください。

---

## Production invariants

React移行中も現行版を本番として維持してください。

以下は実行しないでください。

- 現行 `index.html` のReact版への切替
- 現行runtimeの置換
- 現行Firebase同期経路の本番置換
- 現行schema契約の破壊
- GitHub Pages本番入口の変更
- 本番URL変更
- 現行版削除
- React版を現行版の起動経路へ読み込ませる変更
- `main` の本番サイト置換
- production deployment
- Phase 8
- 本番公開を伴うmerge

React版開発ではfixture、Emulator、staging、独立Previewを優先し、本番Firebase roomへ不用意に書き込まないでください。

---

## Architecture direction

React版は原則として `apps/react/` 配下の独立アプリとして構築してください。

以下を独立させてください。

- package.json
- lockfile
- development environment
- production build
- Preview environment

React版では、

- React
- React DOM
- `@carbon/react`
- `@carbon/icons-react`

を使用してください。

バージョン依存APIは、実際に使用するバージョンの公式ドキュメントと実APIを確認してください。

旧版とReact版でlocalStorage、outbox、Preview state等が意図せず共有されない構成を優先してください。

---

## State architecture

基本責務は次のように分離してください。

Shared project data\
→ React外のexternal store

UI-only state\
→ React state

Uncommitted editing state\
→ draft / edit session

Firebase synchronization\
→ React外のservice

React DOMをsource of truthにしないでください。

基本データフローは、

user action\
→ command / domain operation\
→ canonical store\
→ React render\
→ patch\
→ sync

としてください。

Firebase listener、timer、subscription等はReact render/remountによって二重登録されないよう明確なlifecycleを持たせてください。

---

## Compatibility

既存ロジックは、挙動を維持できるものを優先して再利用してください。

特に、

- canonical state
- allocation / role normalization
- settlement calculator
- settlement state
- form parser
- auto assignment
- patch / version / merge
- route helper
- history
- storage

について、DOM依存部分とpure logic/serviceを分離してください。

classic script全体をReact内で丸ごと実行する構造にはしないでください。

React移行に便乗して既存仕様を勝手に変更しないでください。

特に、

- `activeAllocationType` / Rules
- `update()` fallback
- Undo
- `applicationSync`
- single outbox
- `load()` implicit writes
- handoff token

はcompatibility対象として扱ってください。

---

## Migration phases

### Phase 0

Baseline、既存失敗分類、匿名fixture、新旧semantic comparison。

### Phase 1

現行版から完全に独立したReact build / Preview基盤。

### Phase 2

canonical、role、parser、settlement等のDOM非依存domain boundary。

### Phase 3

external store、Firebase adapter、sync lifecycle、draft/edit boundary。

### Phase 4

参加者、車割、班割。

### Phase 5

精算。

### Phase 6

距離計算、企画情報、履歴、共有、案内文、CSV、通知、その他主要機能。

### Phase 7

全体compatibility、multi-client、browser、responsive、regression verification。

Phase 0〜7は途中報告で停止せず、進行可能な限り連続して実施してください。

Phase 8は実行しません。

---

## Critical compatibility cases

少なくとも次を保護してください。

- participantの消失・復活
- 車割と班割の独立性
- multiple drivers
- `driver` と `ownerId`
- fixed placement
- capacity
- settlement
- positive / negative expense
- 部費 / 割勘
- exemption
- deduction
- extras merge
- reset
- outbox
- IME
- remote update during editing
- room
- legacy → React
- React → legacy

旧版をreference implementationとして利用し、可能なケースでは同一fixtureまたは同等操作によるsemantic comparisonを行ってください。

---

## Browser QA

最低限、

- Chromium
- WebKit
- 約390px
- desktop
- light
- dark

を確認してください。

主要フローでは必要に応じて、

- focus
- keyboard
- Modal
- OverflowMenu
- scroll
- horizontal overflow
- IME

も確認してください。

単なるrender成功ではなく実際の主要操作を検証してください。

---

## Execution behavior

作業状態はリポジトリ、テスト、git diff、`apps/react/migration/progress.json` 等から復元してください。

コンテキスト圧縮、モデル切替、セッション再開が発生しても、完了済み作業を最初からやり直さず、現在地点からGoal達成まで続けてください。

テスト失敗だけを理由に停止せず、

reproduce\
→ identify cause\
→ fix\
→ relevant regression test

まで進めてください。

既存失敗・環境依存問題と今回新しく発生したregressionを区別してください。

すでに成功済みのテストを理由なく何度も繰り返す必要はありません。変更範囲とリスクに応じたmeaningful verificationを行ってください。

---

## Definition of Done

Phase 7終了時点で次を確認してください。

- React版が独立して起動する
- production build成功
- 主要機能React化
- canonical互換
- schema互換
- Firebase互換
- legacyデータをReact版で読込可能
- React版保存データをlegacy版で読込可能
- 主要sync tests成功
- 主要compatibility tests成功
- Chromium主要フロー成功
- WebKit主要フロー成功
- mobile成功
- desktop成功
- light / darkで重大な問題なし
- IMEを含む主要入力成功
- 現行版への破壊的変更なし
- 現行本番は旧版のまま
- React版が現行本番起動経路へ混入していない

この状態まで到達するか、解決不能またはscope外であることを具体的に確認した問題だけが残る状態まで進めてください。

---

## Final state

最後にのみ、変更内容・テスト・browser QA・互換性・残存issueを簡潔にまとめてください。

React版を実際の検証結果に基づき、

- Ready
- Ready with minor issues
- Not ready

のいずれかで評価してください。

本番切替は行わず、ここで終了してください。
