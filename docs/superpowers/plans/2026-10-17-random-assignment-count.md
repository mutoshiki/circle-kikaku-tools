# ランダム割り当て回数表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. サブエージェントは実装担当が必要性と明示的な許可を確認した場合に限る。

**Goal:** 車割・班割それぞれに「現在の条件になってからランダム割り当てした回数」を表示し、条件変更時のリセットと端末間の共有を行う。

**Architecture:** Reactのstoreの確定処理で条件の変更と実行を検出し、割り当て状態と実行記録を同じ保存操作に含める。純粋関数で条件キーと回数を計算し、既存syncをReact側の薄い拡張で補完する。同時実行と再送は一意な実行IDで扱い、単一の数値を上書きしない。

**Tech Stack:** React 19.2.8、@carbon/react 1.115.0、@carbon/icons-react 11.87.0、既存schema 6のstore/localStorage/Firebase RTDB、node:test、Playwright。

**Spec:** 本書「確定仕様」。直前のチャット提案を、現行実装の共有ピン設定と学年非使用に合わせて具体化したもの。

## Global Constraints

- この実行では計画のTask 1〜5を実装し、計画に列挙した検証を行う。公開操作はrepoの標準リリース契約に従い、公開結果を別途確認する。
- 元のcheckout `C:/Users/toshi/Documents/GitHub/circle-kikaku-tools` は既存の未コミット変更を多数含むため、実装の起点にしない。
- 本書の保存先は既存のrelease worktree。計画作成時HEADは `cda40da7893c2ae0b2e6c1caa069d0290e58f188`、公開版は `b2ba4f9574d391c2d5bf8281b69e581ee6d2f2f7`。公開manifestを2026-10-17に再取得して確認した。実装開始時は最新公開SHAを再確認し、その状態を含む適切な作業branchを選ぶ。
- 作業場所・previewは `AGENTS.md`、`apps/react/AGENTS.md`、`docs/development/current-workspace.md` の契約に従う。
- ランダムのアルゴリズム、固定・役割・定員の意味、割勘・部費・集金の計算を変更しない。
- `apps/react/src/domain/generated/*` は直接編集しない。既存の抽出元shared coreも、本機能のためだけに変更しない。
- 新規依存なし、schemaVersionは6を維持。現行Firebase Rulesで追加のallocationフィールドが保存できることをEmulatorで確認する。
- 回数表示は通常テキスト。新しい色付きTag、リセットボタン、履歴一覧、確認モーダルは追加しない。
- 同じ問題で20分以上進捗がなければ停止し、原因・試したこと・必要な判断を報告する。

## 確定仕様

### 1. 表示

- 車割・班割それぞれの「ランダム割り当て」ボタンのすぐ横に `実行 0回`、`実行 3回` と表示する。
- 0回も表示する。参加者ゼロの既存empty stateには追加しない。
- 未割り当て人数・総人数・車/班数の見出しは維持する。
- `未割り当て1人を確認` とランダム操作が併存する狭幅では、ランダムボタンと回数を一組として次の行へ折り返す。回数だけを別行に残さない。
- 320px/390px/1280px、ライト・ダークで横にはみ出さない。回数は既存の補助文字と同程度のCarbon typographyと `text-secondary` で表示する。
- ボタンの読み上げ名は「ランダム割り当て」を維持。補足説明を `aria-describedby` で「現在の条件でランダム割り当てを3回実行」と関連付ける。説明のためのTab停止点は追加しない。
- 回数は改ざん防止・公正さの証明ではなく、企画内の操作状況を知る表示として扱う。

例:

```text
未割り当て 0人　13人・3台
ランダム割り当て ⤨　実行 3回
```

### 2. リセット条件

比較対象は保存後に正規化した「割り当てに影響する条件」。変更コマンドの名前だけでは判定しない。

| 保存された変更 | 車割 | 班割 |
|---|---|---|
| 実際の参加者ID集合の増減・参加対象の確定変更 | 0に戻す | 0に戻す |
| 車の増減、運転手・車定員の変更 | 0に戻す | 維持 |
| 班の増減、班長・班定員の変更 | 維持 | 0に戻す |
| 参加者の固定ピン変更 | 0に戻す | 0に戻す |
| 通常メンバーの手動移動・順序変更 | 維持 | 維持 |
| 固定されている人の所属先変更 | 対象側を0に戻す | 対象側を0に戻す |
| 手動移動に伴う運転手/班長交代・元グループ削除 | 対象側を0に戻す | 対象側を0に戻す |
| 名前・メモ・学年・しるし・企画名・費用の変更 | 維持 | 維持 |
| 応募データだけの更新で、実参加者/役割/定員が不変 | 維持 | 維持 |
| 値が変わらない保存・キャンセル・失敗 | 維持 | 維持 |

現行の固定状態は `participants[id].locked` にあり、両割り当てで共有される。車割だけのピン変更として扱わない。現行アルゴリズムは学年を使用しない。

追加事項:

- 変更前の条件に戻しても、昔の回数を復活させない。新しい世代で0回を継続する。
- 条件変更は同じ保存操作で回数もリセットする。回数のためだけの追加通信は行わない。
- 既存企画は初回0回。導入前の実行回数は推定しない。閲覧・タブ切替だけでは初期化の書き込みを発生させない。
- サンプル読込・企画リセットは0回にする。対応後に出力したバックアップは履歴も復元するが、条件が一致しない履歴は0回として扱う。sample読込とbackup復元の呼び出しを区別する。

### 3. 加算条件

- 確認モーダルで「実行」を押し、移動可能な参加者と利用できる配置枠があり、割り当て処理が成立したら1回増やす。
- 結果が偶然前回と同じでも1回増やす。配置差分が空でも実行記録は保存する。
- キャンセル、例外、全員固定、配置枠なし・車/班なしの場合は増やさない。既存の `assign()` は配置枠なしでもtrueを返す場合があるため、呼出前の対象判定も必要。
- ローカル保存時は即表示し、ネットワーク状態は既存同期表示に従う。サーバーに拒否された実行は確定回数に残さず、共有状態に戻して理由を通知する。
- 再読み込み・タブ切替・別端末で同じ企画の回数を維持する。車割と班割の実行は独立。
- 通信再試行で増やさない。同時に2端末で成立した実行は、最終配置の競合解決とは別に2回として数える。

### 4. 通知

- 成立時: `車割のランダム割り当てを実行しました。3回目。` / `班割のランダム割り当てを実行しました。2回目。`
- 対象なし: `ランダム割り当てできる参加者や空き枠がありません。`
- 参加者変更: `参加者が変わったため、車割・班割のランダム割り当て回数を0に戻しました。`
- 片側の条件変更: `車割の条件が変わったため、ランダム割り当て回数を0に戻しました。`（班割も同形）
- 固定変更: `固定設定が変わったため、車割・班割のランダム割り当て回数を0に戻しました。`
- 条件競合で共有保存を拒否: `割り当て条件が別の端末で変更されました。最新の状態でやり直してください。`
- リセット通知は1回以上の履歴を0に戻したときだけ。既に0回なら通知しない。
- 既存の操作成功通知と合わせて一度だけ通知する。初期読込、履歴欠損、リモート受信を理由に通知を連発しない。
- 読み上げは単一の `role="status"` / politeな領域で行い、フォーカスは移さない。Carbon通知が既に読み上げる場合、二重のlive領域を作らない。

## 設計・保存契約

### 条件キーと実行履歴

追加フィールドは `allocations.car.randomization` と `allocations.team.randomization`。

```text
{
  version: 1,
  epochId: "一意な世代ID",
  conditionsKey: "正規化した条件の安定JSON",
  runs: { "一意な実行ID": true }
}
```

- `conditionsKey` は参加者IDとlocked、対象のgroup ID/ownerId/capacity/order、役割driver=trueのIDと所属、固定メンバーの所属から作る。キー順と配列順を固定し、時刻・表示名・通常メンバーの所属と並び順を含めない。
- group.orderは配置枠の生成順に使用するため含める。表示ラベルだけの変更は含めない。
- 一意IDは既存のcrypto注入に従う。再送時は同じ実行ID、別の操作は別ID。壁時計の時刻を一意性の根拠にしない。
- 回数は現世代の `runs` の有効な実行ID数から得る。並行書込で数値の1が1を上書きする方式を使わない。
- 条件キー不一致・履歴なし・不正な型は安全に0回。空オブジェクトがFirebaseで省略されても扱える。
- 各世代の記録は次の条件変更で破棄する。同じ条件に戻っても以前の世代を再使用しない。

### 同期

現行の `diffAllocation()` は既知フィールドのみを同期するため、フィールド追加だけでは共有されない。React側の拡張で以下を一貫して処理する。

1. 既存のentity patchに履歴の差分を追加する。初期canonical移行の `allocations` 全体patchと子patchを同時に入れない。
2. 既存transactionの中で配置・条件・履歴をまとめて確定する。履歴のために別transactionを作らない。
3. 同世代の実行IDは集合として統合する。再送・transaction updater再実行では追加IDを生成しない。
4. randomize時の条件キーと世代を保存前提として検証する。条件や世代が変わった古い実行は、配置と履歴を一緒に拒否する。
5. 通常の条件変更は、マージ後の最終条件から新世代・0回を確定する。通常メンバーの移動は同世代を維持する。
6. 古い世代の記録が遅れて来ても、現世代へ混入・復活させない。
7. outboxが1件にまとめられても、未送信の複数実行IDを保持する。新outbox作成時に旧outboxの未確定実行を取りこぼさない。
8. この機能のrandomizeでは前提検証のないupdate fallbackを使用しない。既存の無関係な保存のfallback契約は維持する。
9. 旧クライアントの編集が履歴を更新しなくても、条件キーが違えば新クライアントは0回として扱う。旧版で行われたランダム実行の回数は取得できないことを制約として記録する。

## 対象ファイルと責務

| ファイル | 変更 |
|---|---|
| `apps/react/src/domain/randomization-history.js` | 新規。条件キー、履歴正規化、回数、対象判定、条件差分の純粋関数 |
| `apps/react/src/domain/randomization-sync.js` | 新規。既存syncのpatch生成とtransactionマージを拡張 |
| `apps/react/src/domain/index.js` | 履歴機能とsync拡張をdomainから提供 |
| `apps/react/src/store/room-store.js` | command/commitEdit双方の確定境界で加算・リセット。実行ID・条件前提をintentへ載せる |
| `apps/react/src/sync/room-sync.js` | 競合拒否メッセージ、outbox集約、拡張マージの受渡し |
| `apps/react/src/components/Allocation.jsx` | ボタン横の回数・説明関連付け・実行結果通知 |
| `apps/react/src/App.jsx` | 他画面からの参加者変更も拾う通知配線。既存通知の読み上げ重複を確認 |
| `apps/react/src/components/ProjectTools.jsx` | sample/reset/backup復元の履歴の扱いを接続 |
| `apps/react/src/styles.scss` | 専用クラスで操作と回数を一組にし、補助文字・折返しを調整 |

## Review Focus

1. 固定ピンが共通であること。片側だけリセットしない。
2. 本人だけの車/班からの手動移動はグループ消滅を伴うこと。通常移動とは区別する。
3. 配置結果が同じでも抽選は成立すること。配置差分だけで加算を決めない。
4. 複数端末・オフライン連打・transaction再試行でも欠落/二重加算しないこと。
5. 開いたままの古い編集draftや旧世代outboxが、現在の条件と回数を巻き戻さないこと。

---

## Task 1: 条件・履歴の純粋関数

**Files:** Create `apps/react/src/domain/randomization-history.js`、`apps/react/tests/randomization-history.test.mjs`。

**Interfaces:**
- `getRandomizationConditionsKey(room, type): string`
- `getRandomizationStatus(room, type): { count, epochId, conditionsKey }`
- `hasRandomizationTargets(room, type, assignment): boolean`
- `getRandomizationConditionChanges(before, after): Array<{ type, reason }>`
- `normalizeRandomizationHistory(value, conditionsKey): History | null`
- typeは `'car' | 'team'`。reasonは `'participants' | 'fixed' | 'allocation'`。不一致の履歴はnull、status.countは0。

- [x] 正常な3実行IDでcount=3、欠損/不正値/条件不一致でcount=0になるテストを書く。
- [x] 名前・学年・時刻・通常移動は同じキー、参加者ID・固定・定員・役割・group順・固定所属は異なるキーになるテストを書く。共通ピン変更は両type、片側定員は片側だけ変わる。
- [x] 移動可能者ゼロ/配置枠ゼロはfalse、両方ありはtrueとなるテストを書く。
- [x] `node --test tests/randomization-history.test.mjs` で追加テストの失敗を確認してから実装し、同じコマンドで全件PASSを確認する。
- [x] 対象ファイルだけをcommitする。

## Task 2: storeで実行と条件変更を記録

**Files:** Modify `apps/react/src/domain/index.js`、`apps/react/src/store/room-store.js`、`apps/react/tests/store.test.mjs`。

**Interfaces:**
- domainに `randomization` としてTask 1の関数群を提供。
- intentに任意の `randomizationIntent` を追加: `{ type, epochId, conditionsKey, runIds: string[] }`。通常編集には付けない。
- 成立したrandomizeはintentを返す。対象なしはnull。例外は既存どおりthrow。
- リセット理由は確定したintentの `randomizationResets: Array<{ type, reason }>` に付ける。count>0から0になった対象だけ。

- [x] キャンセル相当の未command、失敗、全員固定、枠なしは加算しない。成立を2回実行すると2回、同じ配置結果でも3回になるテストを追加する。
- [x] 参加者増減、selection確定、フォーム由来の役割/定員更新、手動の役割/定員/group増減、共通ピン、参加者編集draftのcommitを表どおり検証する。
- [x] 通常メンバー移動では維持、owner移動に伴うgroup削除/owner交代ではリセット。条件を戻しても旧回数が復活しないことを検証する。
- [x] 同じ定員の保存やmetadataのみの受信は履歴を作らず、回数のためだけにstore通知・保存を発生させないことを検証する。
- [x] `node --test tests/randomization-history.test.mjs tests/store.test.mjs` の追加テストが失敗することを確認後、commandだけでなくpublish/commitEditを通る確定処理にも統合する。
- [x] 同コマンドでPASSを確認し、対象だけcommitする。

## Task 3: 保存・再読込・複数端末の整合

**Files:** Create `apps/react/src/domain/randomization-sync.js`、`apps/react/tests/randomization-sync.test.mjs`。Modify `apps/react/src/domain/index.js`、`apps/react/src/sync/room-sync.js`、`apps/react/tests/sync-service.test.mjs`、`apps/react/tests/emulator/room-sync.test.mjs`。

**Interfaces:**
- `withRandomizationSync(sync): SyncDomain`。既存の関数を保持し、`buildEntityPatch` と `applyVersionedEntityPatch` を履歴対応にする。
- 拡張後の `applyVersionedEntityPatch(remote, base, local, patch, requestVersion, operationId, operationAppliedAt, context = {})` は、第8引数で `context.randomizationIntents` を受け取る。既存の7引数呼出しも有効とする。
- outboxには `randomizationIntents: Array<{ type, epochId, conditionsKey, runIds: string[] }>` を保存する。storeの単一intentをこの配列に加え、同じtype/世代/条件はrunIdsを集合統合する。条件変更で不要になった旧世代の未送信実行を、新世代へ付け替えない。
- `mergeRandomizationHistory({ remote, base, local, next, intent }): Room`。nextは既存の配置等の競合解決後のroom。独立した純粋関数として競合例をテストする。
- condition競合は識別可能なerror.code `randomization/conditions-changed` を返し、既存の精算名前変更用エラーと区別する。
- この競合は再試行で解消しないため、既存precondition拒否と同じく該当outboxを破棄し、最新remoteを再適用して通知する。成功扱いやupdate fallbackには進めない。
- 履歴差分は `allocations/{type}/randomization` 配下。無関係なmeta/applicationSync/settlementは変更しない。

- [x] 2端末の同時実行でcount=2、同一runId再送でcount=1、各画面とサーバーが一致するテストを書く。
- [x] オフラインで3回実行→再接続で3回、送信中の追加実行も欠落しないテストを書く。
- [x] 端末Aの条件変更後に端末Bの旧実行を送るケースで、配置・世代・回数が巻き戻らないことを検証する。
- [x] 条件の違う2端末からの更新、企画resetGeneration変更、古いparticipant draft確定、旧クライアント相当の条件変更を検証する。
- [x] fixture transportでretry updaterを繰り返しても同じrunIdだけが保存されること、transaction失敗時に履歴だけが保存されないことを検証する。
- [x] `node --test tests/randomization-sync.test.mjs tests/sync-service.test.mjs` の追加テストの失敗を確認後、同期契約を実装する。
- [x] 同コマンドでPASS。既存Emulator設定で `tests/emulator/room-sync.test.mjs` を実行し、実SDK・Rules・空runs省略・2端末収束を確認する。設定手順は既存 `apps/react/DEPLOYMENT.md` に従う。
- [x] generatedファイル・shared core・Rulesにdiffがないことを確認し、対象だけcommitする。

## Task 4: 表示・通知とsample/backup接続

**Files:** Modify `Allocation.jsx`、`App.jsx`、`ProjectTools.jsx`、`styles.scss`。Test: Create `apps/react/tests/browser/randomization-count.spec.js`、既存 `apps/react/tests/browser/allocation.spec.js`。

**Interfaces:**
- Allocationは `runtime.store.domain.randomization.getRandomizationStatus(room, type)` のcountを表示する。
- `randomizationResets` をstoreのintent購読で拾い、別画面の操作にも既存通知へ接続する。コンポーネントのmount/unmountで購読を重複しない。
- `restore` に `source: 'sample' | 'backup'` を明示し、sampleだけ履歴を初期化する。既存呼び出しを全確認する。

- [x] ランダム操作の隣に0回→実行後1回、キャンセルで1回維持、再読込後も1回となるブラウザテストを書く。
- [x] 車割と班割の独立、参加者編集からの両側reset、定員変更の片側reset、ピンの両側resetを確認する。
- [x] 対象なし通知、成立通知、reset理由の通知、共有競合の通知を確認する。通知の読み上げを重複させず、フォーカスを奪わない。
- [x] sample読込は0、backup復元は条件が一致した実行記録を維持、履歴のない旧backupは0になるテストを書く。
- [x] 追加テストの失敗を確認後、既存Carbon Button/Toastの公開APIをMCPとインストール済みpackageで再確認して実装する。内部 `.cds--*` 上書きを増やさない。
- [x] 390pxと1280px、ライト/ダーク、未割り当て確認の有無、回数0/3/1000で表示を確認する。320px・文字拡大でも回数が単独で折り返されないことを確認する。
- [x] キーボードで実行・キャンセル・フォーカス復帰を確認。補足説明の関連付けとpolite通知をDOM/アクセシビリティツリーでも確認する。
- [x] 対象だけcommitする。

## Task 5: 統合確認と公開引き継ぎ

- [x] apps/react内でoffline用の環境変数を設定し、`npm.cmd test` を実行する。136件PASS。本番Firebase設定を流用しない。
- [x] 対象browser確認: `npm.cmd run test:browser -- tests/browser/randomization-count.spec.js tests/browser/allocation.spec.js`。Chromium/WebKit desktop/mobile 32件PASS。
- [x] `npm.cmd run build` と `git diff --check` はPASS。`verify:legacy` は既存の保護対象 legacy ファイル差分で失敗。`node tools/extract-domain.mjs --check` は既存の `canonical.js` 生成ドリフトで失敗。今回変更はどちらの範囲にも含まれない。
- [x] 公開manifestのsource SHA `b2ba4f9574d391c2d5bf8281b69e581ee6d2f2f7` とdigestを再取得済み。最終変更後もlocal-only previewのbuild/checkが成功。
- [x] 新規の同期・store変更なので、React UIのみの公開経路を使わず、compatibility確認を含む標準経路を選択。
- [ ] 実装依頼時の公開範囲とrepoルールに従い、push/PR/CI/merge、対象main SHAのReadiness、React Production Release、公開manifest SHA/digest、両ブラウザproduction smokeと専用room cleanupを確認する。
- [ ] 成功済みの同一SHAのチェックを理由なく繰り返さない。不具合が出た範囲だけ原因に沿って再確認する。

## 受け入れ条件

- [x] 各タブのランダム操作のそばに、現在の条件での実行回数が常時表示される。
- [x] リセット表どおりに動き、名前・費用・通常移動では履歴を失わない。
- [x] 共通ピン、ownerの移動、配置枠ゼロ、同じ結果の抽選を正しく扱う。
- [x] 再読込・別端末・オフライン・同時操作・再送で回数が欠落/重複/旧世代復活しない。
- [x] 参加者登録/選択、役割/定員、精算・部費・集金、既存同期と復元が維持される。
- [x] 狭幅・両テーマ・キーボード・読み上げで表示と通知が使える。

## Carbonの根拠とアプリ固有の判断

- 公式: Buttonは操作を開始する要素、Tagはラベル・分類のための要素。回数には通常テキストを採用するのは本アプリの判断。
  - https://carbondesignsystem.com/building-blocks/core/components/button/guidelines/#button
  - https://carbondesignsystem.com/building-blocks/core/components/tag/guidelines/#tag
- 公式: 状態変化へのフィードバックは必要だが、通知は控えめに使う。reset時だけ理由を通知し、回数自体は常時表示するのは本アプリの判断。
  - https://carbondesignsystem.com/building-blocks/core/components/notification/guidelines/#when-to-use
- リセット条件・カウント成立条件・保存方式はCarbonの規定ではなく、本アプリの仕様。

## 計画の自己確認

- 全仕様はTasks 1〜4と受け入れ条件に対応。Review Focusの5項目はTasks 1〜3のテストへ割り当てた。
- Tasks 1〜4の実装・テストを完了。offline単体136件、Chromium/WebKit desktop/mobile 32件、Emulator 3件、production build、local-only previewのbuild/checkと実ブラウザー確認は成功。保護ファイル/抽出確認は既存baseline driftで失敗し、内容をTask 5に記録。push/PR/CI/merge後の本番Release Readiness・Production Release・smoke・cleanupはこれから実施する。
- 初期案からの具体化: 共通ピンは両側reset、通常移動でもgroup/役割/固定配置が変われば対象側reset。現行データモデルに基づく仕様。

