# v44 QA — 精算保存 / マイナス費用 / カード移動スクロール

## 根本原因と修正

### 1. 精算カード・精算設定の「保存」が閉じない / 保存されない
- index.html に常設されている Carbon Modal Footer Button が、生成DOM向けの document-level `data-action` 委譲に依存していた。
- 常設モーダルの Save は `modal-controller.js` が直接所有するように変更。
- 保存処理は **DOM同期 → canonical/local persistence → modal close → render** の順に固定。
- persistence が失敗した場合だけモーダルを閉じず入力を保持する。

### 2. 「割勘 − / 部費 −」が保存後に通常の割勘/部費へ戻る
- Save直前のvalidationが正常なフォームまで再描画していた。
- 再生成直後の Carbon `<cds-select>` は、一時的に host `.value === ''` でも selected `<cds-select-item>` は正しい状態になる。
- その短いupgrade gapで空値を既定値 `split` として再同期していた。
- 正常フォームはSave直前に再描画しない。さらに select 読み取りを `host.value -> selected Carbon item -> current state` の順に変更。

### 3. 人カードの入れ替え後に #top-area が一番上へ戻る
- drag中は待機トレイを一時収納するため、iOS Safariのscroll anchoringが働く。
- 旧処理はトレイ復元直後、`updateUI()` より前に `overflow-anchor` を戻していた。
- 今回はpointer release時の `#top-area.scrollTop` を取得し、カードreparent・トレイ復元・`updateUI()`・`save()` を1つのvisual mutationとして完了するまで anchoring を無効化。
- sync / microtask / 2 RAF / 80ms guard で同じscrollTopを維持してからanchoringを戻す。

### 4. 探索テストで追加発見した参加者再登録のID再利用リスク
- 参加者登録画面から削除する経路はparticipant masterを置換していたが、tombstone予約が不足していた。
- 削除IDを予約し、削除をtombstoneとして記録。後から同名を再登録しても古いIDを再利用しない。

## 実行結果

### 全回帰テスト
`npm test`: PASS

含む:
- Carbon/static contracts
- design/dark/accent/polish
- person-card interaction
- route distance apply
- signed settlement / focus / auto-fit
- card drag stability
- canonical entity schema
- v40/v41 concurrent sync regressions (current canonical schemaへ更新)
- driver reward
- Google route planner contract
- share links
- five-device chaos 50 scenarios

### 5端末 deep chaos
`CHAOS_SCENARIOS=100 CHAOS_STEPS=120 node tests/five-device-chaos-v42.mjs`

PASS:
- scenarios: 100
- operations: 35,865
- commits: 24,190

### 実Carbonブラウザ相当テスト（Chromium + Carbon 2.60.0）
Mobile viewport: 390 × 844
- 車精算 Save: 20連続 open/edit/save/close -> 20/20 PASS
- 精算設定 Save: 10連続 open/save/close -> 10/10 PASS
- `部費 −` -> local canonical storage `club-minus` -> PASS
- reopen -> selected Carbon item `club-minus` -> PASS
- `割勘 −` -> local canonical storage `split-minus` -> PASS
- rounding `10` -> settings Save -> storage `10` -> PASS
- card swap: 20連続 -> 20/20 PASS
- scrollTop: 360 -> drag/reparent/updateUI/save -> 360 -> PASS

Desktop viewport: 1280 × 900
- car editor opens -> Save closes -> PASS
- settlement settings -> Save closes -> PASS

Participant roster exploratory check:
- participant delete -> participant absent + tombstone exists -> PASS
- same display name re-add -> new participant id allocated (`oldId_2`) -> PASS

### 構文 / Maps
- all `assets/js/**/*.js`: `node --check` PASS
- Google route planner lint: PASS
- TypeScript maps check: PASS

## 環境上の制約
Browser pluginはこのセッションにありません。さらにsystem Chromiumはlocalhost navigationが管理ポリシーで遮断されるため、URLからの完全なGitHub Pages相当E2Eは実行できませんでした。
その代わり、実プロジェクトHTML/CSS/JSと同梱Carbon 2.60.0を `page.set_content()` にロードして、対象のCarbon Modal / Select / drag DOM mutationをブラウザで実動作させています。
実機iOS Safariでの最終確認は依然として別レイヤーのリスクとして残ります。
