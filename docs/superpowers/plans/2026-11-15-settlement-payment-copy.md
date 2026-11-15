# 精算画面の支払額表示を分かりやすくする実装計画

> **実装担当:** `superpowers:executing-plans` を使い、完了した工程にチェックを付ける。

**目的** — 参加者から集める1人分の金額と、各車へ支払う金額を区別し、各車の支払元を見て分かるようにする。

**実装方針** — Reactの精算画面で一覧見出し・金額ラベル・内訳見出しを揃える。一覧と内訳には既存の計算済み金額を使う。レイアウトは既存のCarbonの見出しと余白に合わせる。

**仕様** — 2026-11-15の精算画面の画像とレビューで選んだ「集金から／部費から」。

| 箇所 | 表示 |
| --- | --- |
| 車一覧の先頭 | 車ごとの支払額 |
| 車ごとの金額 | 集金から ／ 部費から |
| 区分別の内訳見出し | 集金分の内訳（¥2,200） ／ 部費分の内訳（−¥100） |

内訳の見出しは「〜分の内訳」とし、差し引きで負の金額になる場合にも使えるようにする。「集金から」は支払元の区分を示す。計算済みの配分を表示し、回収済み金額に応じて表示額やラベルを切り替えない。今回の対象はこの表の3箇所。集金ボタン、進捗表示、費用編集、メモは別の変更として扱う。

## 1. 表示を揃える

- [x] `apps/react/src/components/Settlement.jsx` の車一覧の `Tile` 内で、車があるときだけ一覧の上に `h2`「車ごとの支払額」を置く。既存の `settlement-section-heading` を使い、車がないときは現在の空表示を使う。見出しと車名の階層を揃え、既存の精算画面の見出しに合わせる。
- [x] `apps/react/src/components/settlement/SettlementPaymentRow.jsx` の金額ラベルを「集金から」「部費から」に揃える。部費が0円の場合は既存の1列表示で「集金から」を出す。金額の表示形式、開閉操作の読み上げ名、金額を参照する `aria-describedby` を維持する。
- [x] `Settlement.jsx` の区分別見出しを「集金分の内訳（{金額}）」「部費分の内訳（{金額}）」にする。1区分の内訳は現在の簡潔な表示を使う。費用の編集や設定で使う「割勘」「割勘から差し引き」は費用の分類・操作を表すため維持する。
- [x] `apps/react/tests/browser/settlement.spec.js` にある対象ラベルの既存期待値を更新する。`vehicle settlement keeps both payment amounts visible while cost details are collapsed` で一覧見出しと2区分の表示を確認する。`vehicle settlement presents expense and breakdown with an accessible Carbon accordion` では新見出しに加え、既存の `¥2,200`・`−¥100` とキーボード開閉の検証を維持する。`one payment category shows only its own details` と `collection remains usable when participants have no cars` で1区分と車なしの表示を確認する。

## 2. 表示とリリース条件を確認する

- [x] `docs/development/verification-and-release.md` に従いoffline設定で `npm --prefix apps/react run test:browser -- tests/browser/settlement.spec.js --project chromium-desktop --project chromium-mobile --project webkit-mobile --workers=2` を実行する。111件すべて成功。0円・負額、長い車名、狭い幅、見出しのTypography、余白を含む。
- [x] `docs/development/current-workspace.md` の手順に従って公開SHA `d81b6ac91966400457f0d61607fa2788cc35ea66` を照合したローカルプレビューを作成。サイドブラウザで合計支払額と集金分だけの表示、開いた内訳、ライト・ダークを確認した。自動テストでは320–1280px、Chromium desktop/mobileとWebKit mobileで通常精算・人数のみ・内訳を検証。文字と余白の結果をデザイン記録と画面マトリクスに反映。
- [ ] （本番公開を依頼された場合）標準手順でPRの必須CI、マージ、mainの対象SHAに対する `Release / Readiness`、既存の `React Production Release` を実施し、本番rootのChromium／WebKitスモーク、専用テストデータcleanup、公開manifestのSHAを確認する。今回は公開依頼がないため未実施。
