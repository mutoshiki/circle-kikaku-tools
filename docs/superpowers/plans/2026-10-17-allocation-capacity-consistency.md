# 車割・班割の定員統一 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 関連する表示・判定の小さな修正なので、同じセッションで順に実装する。

**Goal:** 車割・班割の人数と定員を、どちらも構造上の先頭参加者（運転手・班長）を含む全員で表示・入力し、実際の追加可能人数と一致させる。

**Architecture:** 保存契約は車=`capacity`人の同乗者枠、班=`capacity`人の班長込み定員を維持する。Reactの表示・入力境界の変換をまとめ、storeの移動判定と共有ランダム割り当てを既存canonicalの上限に揃える。schema移行や既存roomの定員書き換えは行わない。

**Tech Stack:** React 19.2.8、@carbon/react 1.115.0、既存canonical/store、Playwright 1.61.0、Node組み込みテスト。

**Spec:** 2026-10-17のユーザー画像と改善案「車も班も責任者を含む全員で統一」。以下の確定仕様を実装対象とする。

## 確認した原因

- `Allocation.jsx` は車の人数からownerを除外し、班の保存定員には余分な1人を加算している。編集時も班だけ1を引いて保存する。
- `canonical.ensureAllParticipantsPlaced` は既に車を同乗者枠、班を班長込みとして上限を守る。`projectAllocation` の `displayMemberCount` は両方ともowner込み。
- `room-store.js` の `move` は班でも同乗者枠と同じ判定をしており、満員の班への操作を受け付けてからcanonicalに差し戻される可能性がある。
- `auto-assign.js` の `randomSlotsFromCanonical` は班長の枠を差し引かない。班の空きがあるのにランダム割り当て後に未割り当てが残る条件を作り得る。
- 旧計画 `2026-10-12-allocation-usability.md` は班の保存定員をowner抜きと説明している。この説明・関連する旧テスト期待値は現行canonicalと一致しない。本計画が定員部分の仕様を置き換える。A班／A車など他の仕様は維持する。

## 確定仕様・保存契約

| 項目 | 車 | 班 |
|---|---|---|
| 所属人数 | `displayMemberCount`（ownerを含む） | 同左 |
| 表示する合計定員 | 保存`capacity + 1` | 保存`capacity` |
| 入力値から保存値への変換 | 入力値`- 1` | 入力値をそのまま保存 |
| owner以外の受入上限 | 保存`capacity` | 保存`capacity - 1` |
| 一覧表示 | `4/4人` | `4/5人` |
| 入力ラベル | `定員（運転手を含む）` | `定員（班長を含む）` |
| 編集可能範囲 | 合計2〜100人 | 合計1〜100人 |
| 新規作成の入力初期値 | 合計4人（従来の同乗3人枠を維持） | 合計6人（従来の入力初期値を維持し、6を保存） |

- 「班員」の接頭辞は除去し、一覧・移動先候補とも `N/M人` に統一する。
- 空きは `max(0, 合計定員 - 所属人数)`。0人なら追加候補を開く操作は出さず、移動先には「満員」を表示する。
- 人数は役割タグの数ではなく配置された参加者を数える。ownerは1人だけ数え、運転手・班長フラグの解除や同じ車内の複数運転手で増減させない。
- 例：既存車の保存定員3・同乗者3人は `4/4人`。既存班の保存定員5・owner以外3人は `4/5人`、あと1人追加可。
- 編集を開いて保存／キャンセルするだけで定員・参加者・配置を変更しない。入力値は有限な整数に限定し、範囲外・空欄・小数を該当欄で拒否する。
- 既存の範囲外データは表示時に勝手に切り詰めない。変更する場合に入力範囲を案内する。
- 定員縮小で超過者を未割り当てへ戻す既存の順序・処理を維持する。所属人数を下回る入力時には保存前に「定員を減らすと、超過した参加者は未割り当てに戻ります。」を表示する。

## Global Constraints

- この依頼は計画作成のみ。製品コード変更・テスト実行・commit・push・公開は行わない。後続実装時はその時点のユーザー指示とAGENTS.mdに従う。
- 現在の作業場所は `C:/Users/toshi/.codex/worktrees/vehicle-payments-ui/circle-kikaku-tools`、branchは `codex/vehicle-payments-ui`。未コミットの支払い画面改善・集金状況の順序変更を保持する。
- 既存の適切なworktreeを再利用する。実装開始時にbranch・dirty差分・公開manifestを確認し、今回分と既存変更を区別する。無関係な変更をstage/reset/stashしない。
- schema、Firebase、同期形式、参加者ID、group ID、A班／A車の命名、精算計算は変更しない。
- CarbonのModal・NumberInput・Select・OverflowMenuを継続使用する。入力エラー・補助説明のpropsは実装時にCarbon MCPとインストール済み型定義で確認する。新しいUIライブラリは追加しない。
- 共有ロジックの修正元はlegacy source。`src/domain/generated` を直接編集せず `generate:domain` で再生成し、関係のない生成差分は調査する。
- 公開roomに書き込まない。検証はofflineの合成データ。previewは公開SHAとsource fingerprint・配信asset照合後に開く。
- 同じ問題で20分以上進捗がない場合は停止し、原因・変更済み範囲・再開点を報告する。

## Review Focus

1. 既存班capacity5がUI変更で6や4へ書き換わらないこと → Task 1と2の編集無変更・再読込。
2. 満員の班への追加が成功通知だけ出て差し戻されないこと → Task 1のstore拒否とTask 2の満員候補。
3. ランダム割り当てが班長枠を二重に使わず、空きがあれば参加者を収容できること → Task 1の固定乱数・複数班。
4. 定員縮小やownerの役割解除で参加者を消さず、車割と班割を独立して保つこと → Task 1の配置比較とTask 2の再読込。
5. 既存車・班、フォーム由来、legacy往復データの保存契約が変わらないこと → Task 1のstore/domain比較とTask 3の互換確認。

## Task 1: 移動・ランダム割り当ての上限をcanonicalに揃える

**Files:**
- Modify: `apps/react/src/store/room-store.js`（`move`、`createGroup`）。
- Modify: `assets/js/features/auto-assign.js`（`randomSlotsFromCanonical`）。
- Generate: `apps/react/src/domain/generated/allocation.js`、`apps/react/migration/domain-provenance.json`。
- Test: `apps/react/tests/store.test.mjs`、`apps/react/tests/domain.test.mjs`。

**Interfaces:** 保存契約とcanonicalの正規化を維持する。`randomSlotsFromCanonical(allocation, participants)` の公開形は変更しない。

- [x] 既存テストに次を追加し、対象の失敗を確認する：班定員5にowner＋4人が収まり6人目を`move`で拒否／拒否前後のsnapshot不変／車の同乗定員3にはowner＋3人が収まる。
- [x] 複数班・固定参加者を含む固定乱数ケースを追加する。owner以外の枠数は班`capacity-1-fixedMembers`、車`capacity-fixedMembers`。総空き枠以内の候補が不要に未割り当てへ戻されず、owner込みの定員を超えないことを検証する。班capacity1では追加枠0。
- [x] `move` の上限を上記契約に揃え、`kind === 'member'` の所属者だけを数える。変更前に満員を拒否し、source側のowner変更などを起こさない。
- [x] `createGroup` の保存上限を車99・班100とし、班100人の入力が99へ縮まらないようにする。移動以外のコマンド契約は変更しない。
- [x] 共有sourceの空き枠計算を修正し、`npm.cmd run generate:domain` を実行する。canonicalの既存上限処理は変更しない。
- [x] 定員縮小時の余剰者の未割り当て移動、独立した別allocation、参加者ID、車の既存容量、legacy projection往復が保たれることを既存store/domainテストで確認する。旧テストの`班capacity+1`という誤った意味付けを修正する。

## Task 2: 表示・入力・移動先候補を全員込みに統一する

**Files:**
- Create: `apps/react/src/components/allocation-capacity.js`（UIの保存値変換のみ）。
- Modify: `apps/react/src/components/Allocation.jsx`。
- Test: `apps/react/tests/browser/allocation.spec.js`。

**Interfaces:** `getCapacitySummary(type, storedCapacity, memberCount)` は `{ occupied, totalCapacity, remaining }` を返す。`memberCount`はowner以外の人数、`occupied=memberCount+1`、合計定員と空きは確定仕様に従う。`toStoredCapacity(type, totalCapacity)` は確定仕様の保存値を返す。UI helperはstore/domainからimportしない。

- [x] 既存browserテストの人数表示・入力ラベル・保存値の期待値を更新する。既存車capacity3が4/4人、既存班capacity5で4/5人・あと1人、追加後5/5人になるケースを追加する。
- [x] 一覧、追加候補の可否、`openMoveEditor`、移動先Selectの表示を同じhelper経由にする。「班員」を除去し、見た目・DOM・読み上げの人数を一致させる。
- [x] `GroupEditor` の初期表示・新規初期値・保存変換・min/maxを確定仕様へ変更する。班の余分な加減算を除去する。NumberInputに入力エラーを関連付け、定員縮小時の説明を条件付きで表示する。
- [x] 車の合計定員3を保存するとstored2、班の合計定員6を保存するとstored6になることを確認する。既存の班5／車3を編集無変更で保存しても値が変わらず、キャンセル・再読込でも維持されることを確認する。
- [x] 班1人・100人、車2人・100人、空欄・小数・範囲外の入力を確認する。範囲外では保存せず、エラー修正後に保存できることを確認する。
- [x] 満員移動先が選択不可、最後の1人だけ追加可、別の役割持ちの参加者を含んでも人数が二重計上されないことを確認する。役割解除と定員縮小の既存挙動も確認する。

## Task 3: 互換確認とpreviewの照合

**Files:** 対象テスト、`docs/development/current-workspace.md`、本計画の進捗。

- [x] offline変数を明示し、まずstore/domain、次にallocationのChromium mobile／WebKit mobileを実行する。

```powershell
$env:SANPO_TEST_FIREBASE_TARGET='offline'
$env:SANPO_TEST_FIREBASE_PROJECT_ID='demo-circle-kikaku-tools'
$env:SANPO_TEST_FIREBASE_DATABASE_URL='http://127.0.0.1:9000'
cd <worktree>/apps/react
node --test tests/store.test.mjs tests/domain.test.mjs
npm.cmd run test:browser -- tests/browser/allocation.spec.js --project=chromium-mobile --project=webkit-mobile
node tools/extract-domain.mjs --check
```

- [x] 共有auto-assign変更に対し、repo rootでoffline変数を渡して`npm.cmd run test:legacy:static`と`node tests/assignment-workspace-drag-free-contract.mjs`を実行する。成功終了を確認し、失敗時はbaseとの差分とテストIDで今回の回帰を判別する。skipやassertion緩和で通さない。生成物・provenanceの整合性も確認する。
- [x] `npm.cmd run build` と `git diff --check` を実行する。今回の変更に精算・schema・sync・Firebaseの差分がないことと、既存の支払い画面変更が保持されていることを確認する。
- [x] 公開manifestを再取得し、現在のworktreeを`build:preview`でビルドする。使用中のpreviewを扱う場合も配信元を確認し、`check:preview`の一致後に表示する。古い4279のbuildを変更後とみなさない。
- [x] 合成データで320／390／1280px、ライト／ダークを確認する。車4/4人、班4/5人、追加後の満員、移動先選択、定員編集、保存・キャンセルを実ブラウザで確認する。
- [x] 差分・確認結果・残る制約を報告する。後続で公開する場合は共有ロジック変更として既存のcompatibility／Readiness／Production Release／smokeとcleanupの経路を使う。

## 完了条件

- 表示人数が一覧の実人数と一致し、車も班も責任者込みの`N/M人`になる。
- 編集欄・一覧・移動先・追加可人数・実際の受入上限が一致する。
- 満員の班へ移動して成功通知だけ出ることや、ランダム割り当てで余分な班長枠を使うことがない。
- 既存保存値を自動変換せず、旧データの受入可能人数・参加者同一性を保持する。
- この計画作成段階では製品コードを変更しない。
