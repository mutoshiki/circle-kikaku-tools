# 班割・車割の操作と表示改善 Implementation Plan

> **実装完了記録:** 初版では計画作成のみとしたが、後続依頼「計画をすべて実装」に基づき実装・検証まで実施。公開は未実施。

**Goal:** 班長込みの定員と固定したA班／A車の呼び名を導入し、人数・割り当て・編集の操作を理解しやすくする。

**Architecture:** 班別のContainedListとインラインの候補展開を維持する。定員は既存の内部値を維持し、班割の表示・入力境界で変換する。呼び名は参加者名とは別の永続メタデータとして扱い、同期・旧形式への往復で失われないようにする。

**Tech Stack:** React 19、@carbon/react 1.115.0、既存room-store／canonical domain／sync、SCSS。

**Spec:** この計画の「確定する仕様」。根拠は2026-10-12のCarbon評価と、その後のユーザーとの定員・A班／A車の合意。

## Global Constraints

- 作業元は `C:/Users/toshi/.codex/worktrees/production-baseline/circle-kikaku-tools`。既存の未コミット変更を保全し、旧作業元や中止済みcarbon-redesignを起点にしない。
- 精算計算、参加者ID、group ID、既存の受入可能人数を維持する。本番の企画データを検証用に書き換えない。
- generated domainは直接編集しない。元の宣言と抽出境界を変更し、生成・互換性確認を行う。
- Carbonの公式コンポーネントとトークンを優先する。新しいprops・構成はMCPとインストール済みパッケージで確認する。
- プレビュー前に公開manifestを再取得し、build:previewとcheck:previewで作業元・配信成果物・local保存先を照合する。
- 今回は計画書だけを追加する。コード、テスト、ビルド、コミット、公開は実行しない。

## Review Focus

- 既存の内部定員5・班員2＋班長1は3/6人となり、あと3人を受け入れられる。
- 班長の役割フラグと構造上のownerIdは別。役割を外しても、同じ参加者を二重計上・除外しない。
- A/B/Cは削除・並べ替え・名前変更・役割変更・再読み込みで振り直さない。車と班は別採番。
- メタデータなしの旧データ、旧クライアント往復、同時作成で呼び名が欠落・重複しない。
- 候補追加で押したボタンが消えても、フォーカスと操作結果が分かる。満員化・移動先削除時に割り当てを失わない。

## 確定する仕様

1. **班の定員は班長込みで表示・入力する。** 現在の内部capacityは構造上の先頭参加者以外の枠数なので、班の合計定員=capacity+1、所属人数=members.length+1。既存の2/5人は3/6人になる。入力ラベルは「定員（班長を含む）」、既存内部範囲1〜99に対応する合計範囲は2〜100。既存初期値の内部5は合計6として維持する。車の定員契約は変更しない。
2. **見出しはA班／A車。** 同じ企画内で車・班それぞれA、B、…Z、AA、ABの順。班長・運転手はメンバー行の役割タグで示す。group IDと参加者名は変更しない。
3. **呼び名は固定。** 削除後も残った班・車を振り直さず、削除した文字を再利用しない。既存データの初回付番はorder、createdAt、idの順で安定化する。
4. **割り当て導線を維持・整理。** 「参加者を追加」→「未割り当てから追加」、「空席 N」→「あとN人追加可」。候補見出しは「A班に追加する参加者」。上部の未割り当て人数から既存一覧を開いて移動できる。
5. **参加者メニューを整理。** 「メモ」「しるし」「学年」「名前を変更」は「参加者情報を編集」に統合。「別の班へ移す／別の車へ移す」「班長にする／外す（車は運転手）」「未割り当てに戻す」を残す。未割り当て一覧の参加者削除は既存確認を維持する。別の班への移動は候補選択と確定を一つの小さなCarbon Modalで行い、既存moveコマンドを直接使用する。
6. **固定とランダムの意味を説明。** ピンの説明は「ランダム割り当てで移動しない」、解除時は「固定を解除」。本人名を読み上げラベルに含め、aria-pressedを維持する。lockedは車・班に共通の参加者属性であることを編集画面で説明する。確認文は役割付き参加者と固定された参加者を除き、現在の割り当てを組み替えることを伝える。新しいランダム方式は作らない。
7. **視覚的階層。** 班名／車名、参加者名、補足の順。班長・運転手タグは残し、学年はtext-secondaryの文字表示にする。行内と班間で余白の強弱を付け、名前と操作列を揃える。モバイルでは標準48pxの行・操作領域を基本とし、長い名前・メモでは高さを増やす。狭い幅は1列、広い幅は現在の複数列を維持する。
8. **操作結果。** 候補追加・移動・未割り当て戻しは短い成功通知を出す。候補追加後は次の候補へ、最後の候補なら開閉ボタンへフォーカスを移す。満員で開閉ボタンも消える場合は班見出しへ戻す。候補なしの表示と削除・満員時のエラーを整える。

## 公式指針と設計判断

- 公式: [Contained list](https://carbondesignsystem.com/building-blocks/core/components/contained-list/guidelines/) は関連情報・行内操作・開示した候補に適する。[Button](https://carbondesignsystem.com/building-blocks/core/components/button/guidelines/) は押した結果を伝えるラベルを求める。[Menu](https://carbondesignsystem.com/building-blocks/core/components/menu/guidelines/#ordering-and-grouping) は使用頻度と意味で項目を並べる。[Accessibility](https://carbondesignsystem.com/building-blocks/core/components/button/accessibility/#labeling) はアイコンの名前とフォーカス時の説明を求める。
- 設計判断: A班／A車、班長込みの定員、重複する編集メニューの統合、直接移動は本アプリへの判断であり、Carbonの必須仕様ではない。
- 不採用: 全体のDataTable化、ドラッグだけの割り当て、全操作の常設、追加だけのためのモーダル、人数改善のための既存定員縮小。

### Task 1: 固定した呼び名の保存と互換性

**Files:** `assets/js/core/entity-state-v5.js`, `assets/js/core/sync-controller.js`, `apps/react/src/store/room-store.js`, `apps/react/tools/extract-domain.mjs` と再生成されるdomain・provenance。保存・旧形式往復の所有箇所を実装前に特定する。

**Interfaces:** groupに正の整数 `displayIndex`、allocationに削除後も減らない `nextDisplayIndex` を追加する。見出し専用の `groupDisplayName` を投影へ追加し、既存 `car.name` は参加者名として維持する。内部参加者名をA車へ置換して精算キーを壊さない。

- [x] 初回付番、新規作成、削除後作成、Z→AA、役割変更、再読込の期待値を固定する。
- [x] 正規化・作成・マージ・差分比較・旧形式取り込み／出力の全経路でメタデータを保存する。初回付番を単なる毎回のレンダー計算にしない。
- [x] 同時作成の重複を、既存同期の原子的な採番／確定処理で防ぐ。オフライン仮番号が競合する場合はcreatedAt・idの安定順で新規競合側だけを確定し、既存番号を振り直さない。確定後は両端末で同じ番号になることを確認する。
- [x] 旧クライアントが未知の値を落とす経路には、現存group IDでメタデータを保持する処理を置く。必要なschema方針を既存互換契約から判断し、無言の破壊的移行をしない。
- [x] `domain.test.mjs`, `store.test.mjs`, `sync-service.test.mjs`, `phase7-compatibility.test.mjs` に対応する互換ケースを配置し、変更理由に応じた範囲で確認する。

### Task 2: 見出しと班長込みの人数・定員

**Files:** `apps/react/src/components/Allocation.jsx`（GroupEditorを含む）。

**Interfaces:** Task 1のgroupDisplayNameを表示・候補・確認・読み上げラベルに使う。teamの入力時だけ合計定員から1を引いて既存capacityコマンドへ渡す。carは既存定員値を渡す。

- [x] A班／A車を表示し、本人名・役割を行内に残す。
- [x] teamの所属人数・定員をともに1加算する。内部枠数の変更や勝手な既存データ移行をしない。
- [x] 合計定員6→内部5、変更後も再表示6、班長フラグ解除時の人数、上限100と下限2を確認する。車の定員・精算は同じままであることを確認する。
- [x] `apps/react/tests/browser/allocation.spec.js` と `apps/react/tests/store.test.mjs` の対応箇所で確認する。

### Task 3: 未割り当てから追加と直接移動

**Files:** `apps/react/src/components/Allocation.jsx`。moveの既存検証は `apps/react/src/store/room-store.js` を利用する。

**Interfaces:** 追加・直接移動ともに `move({id,type,groupId,order})` を使う。表示前の候補だけを信用せず、コマンド時の満員・削除チェックを維持する。

- [x] 確定コピーに差し替え、上部の未割り当て人数から一覧の展開・フォーカス移動を行う。
- [x] 同一グループを除く移動先をCarbon Selectで選び、「移動」で直接確定する。満員候補は理由を表示し、キャンセルでは割り当てを変えない。
- [x] 成功時の通知とフォーカス移動を実装する。失敗時は候補・元の所属を維持する。
- [x] 候補0人、最後の候補、満員化、移動先削除、車と班それぞれの移動をブラウザで確認する。

### Task 4: メニューと固定・ランダムの説明

**Files:** `apps/react/src/components/Allocation.jsx`, `apps/react/src/components/ParticipantEditor.jsx`。

**Interfaces:** 編集は既存beginEdit／commitEdit、役割はrole、固定はlocked、ランダムはrandomizeのまま。

- [x] 編集項目を統合し、直接移動・役割変更・未割り当て戻しを意味のある順に置く。グループ削除と参加者削除を混同しない。
- [x] ピンとランダム確認の文言を実際のコードに合わせる。ownerIdだけを根拠に「班長は必ず動かない」と誤説明しない。
- [x] 参加者編集の保存・キャンセル、固定の切替、ランダム後の固定／役割保持、Escapeでメニューを閉じて元のボタンへ戻る動作を確認する。

### Task 5: 視覚的階層とアクセシビリティ

**Files:** `apps/react/src/components/Allocation.jsx`, `apps/react/src/styles.scss`。

**Interfaces:** 班名はheading、名前はbody、学年・人数・メモはsecondary。Carbon Typography／Spacing／Layer／Borderトークンを使い、既存精算CSSの変更は保持する。

- [x] 学年のタグを補足文字へ変更し、役割タグ・固定状態は識別できるままにする。
- [x] 行の操作列と文字を揃え、班間・候補領域の余白を調整する。行を一律圧縮しない。
- [x] 候補追加、メニュー、移動の読み上げ名に対象と行為を含める。ステータス通知は既存onNoticeのライブリージョンを確認して利用する。
- [x] 390px・デスクトップ、長い名前、長いメモ、200%拡大、ライト／ダークで折返し・コントラスト・フォーカス・画面外メニューを確認する。

### Task 6: 配信元照合と実ブラウザ確認

**Files:** `docs/development/current-workspace.md` を手順の根拠とし、必要なら `apps/react/tests/browser/allocation.spec.js`, `apps/react/tests/browser/visual-consistency.spec.js` を更新する。

- [x] 公開manifestを再取得し、基準SHAの不一致なら作業元を再確認する。
- [x] `npm.cmd run build:preview -- --baseline-source-sha <取得したSHA>` と `npm.cmd run check:preview -- --url http://127.0.0.1:4194/ --expected-source-sha <取得したSHA>` を成功させる。
- [x] local保存の検証用roomでサンプルを使い、390pxとデスクトップの全導線・キーボード・再読み込みを確認する。本番roomは操作しない。
- [x] 呼び名が精算の参加者キーに影響しないこと、既存定員で追加可能人数が変わらないこと、同期往復で呼び名が固定されることを確認する。
- [x] 既存変更と今回変更を分けた差分を確認し、変更点・結果・未確認事項を報告する。公開依頼がある場合だけ既存Release / ReadinessとReact Production Releaseの経路へ進む。

## 停止・再計画条件

- 未知メタデータの保存、旧形式互換、同時作成の採番を保証できない場合、A/B/Cを毎回再計算する実装で代用しない。Task 1を止め、具体的な保存・同期方式を再計画する。
- プレビューのSHA・source fingerprint・配信資産・データ接続が一致しない場合、画面比較を止めて配信元を特定する。
- 定員や役割変更が精算・参加者同一性を変える場合、表示境界の変更へ戻して原因を整理する。

## 最終レビューの判断

- 修正: 割り当て済み参加者の移動先から現在の班・車を除外した。既存の移動コマンドとキャンセル動作は維持し、ブラウザ回帰テストで確認する。
- 判断: この機能以前のメタデータなしレガシーデータには、削除済みグループの過去の番号を復元する情報がない。初回移行では存在する順序から決定的に付番する。移行後はcanonicalのgroup IDとdisplayIndexで保持し、旧クライアントがdisplayIndexだけを省略しても前のcanonical値を引き継ぐ。欠落前の履歴自体を復元する機能は追加しない。既存データにはA/B/Cの履歴がなかったため、影響は初回付番だけに限られる。

## 完了条件

- 全タスクの仕様が実ブラウザと対応する永続化・同期ケースで確認される。
- 既存企画の受入可能人数、参加者ID、精算結果が保持される。
- 呼び名が固定され、どの班／車の操作か、追加と登録の違い、固定とランダムの影響が分かる。
- 実装開始前の今回の成果物は本計画書のみ。
