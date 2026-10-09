# 本番反映の短縮設計

対象: `962d384f6debc3926a466f0d5b9f3bf48334ca7d` の既存リリース手順。このspecに沿ったworkflow変更を専用worktreeで進行中。本番反映はmerge後、既存のReadinessとReact Production Release経路を通す。

## 実測と目標

2026-10-09 の成功 run [37897402004](https://github.com/mutoshiki/circle-kikaku-tools/actions/runs/37897402004) は dispatch から完了まで **8分59秒**。直前の main CI [37896988636](https://github.com/mutoshiki/circle-kikaku-tools/actions/runs/37896988636) は **3分45秒**。CI待ちと公開処理を合わせて約13分、PR CIや修正・再実行の時間は別。

| 公開ジョブ | 所要時間 | 中身の実測 |
|---|---:|---|
| 成果物準備 | 2分04秒 | React build 13秒、npm ci 19秒、legacy組立32秒など |
| compatibility公開 | 28秒 | Pagesへの配信 |
| compatibility smoke | 2分06秒 | npm ci 20秒、ブラウザ導入61秒、テスト33秒 |
| compatibility cleanup | 1分00秒 | npm ci 19秒、ブラウザ導入28秒、削除確認3秒 |
| root公開 | 12秒 | Pagesへの配信 |
| root smoke | 1分48秒 | npm ci 19秒、ブラウザ導入60秒、テスト22秒 |
| root cleanup | 56秒 | npm ci 20秒、ブラウザ導入28秒、削除確認2秒 |

直近4回の成功releaseは8分10秒〜8分59秒。テスト本体は今回合計55秒で、テスト削減より実行環境の再準備を減らす効果が大きい。

目標は二段階。cleanupの重複起動を外し、互換性確認とroot確認を同じrunnerで続ける改善で約5〜6分を目指す。その後、条件を満たす通常のUI更新をroot一回の公開に整理し、**Readiness成功後3〜5分**を目標とする。所要時間は推定で、キュー待ち・外部API障害・再試行を別記して実測する。

## 採用する方針

1. 最優先は各smokeジョブ内でcleanupを実行して確認すること。二つの段階のcleanupを最後まで延期するのではなく、各段階の順序と安全性を保ちながら、独立cleanupジョブのnpm・ブラウザ導入を通常成功時から除く。
2. compatibility smokeとroot smokeを同じrunnerへ移し、npm/browser準備を一度にする。公式Playwright imageはローカル実測101秒・3.45GBでNode 24、本体テストは現在Node 22のため候補から外す。npmダウンロードキャッシュは既に有効。ブラウザキャッシュを追加すれば必ず速くなるとは扱わない。
3. 通常のReact UI更新と、旧版からの移行・shared互換変更を、同じ標準workflow内の明示的な経路に分ける。通常経路はroot一回公開、移行経路はcompatibility→root。同じSHAのReadiness、production設定検証、両ブラウザのroot smoke、cleanup、rollbackは両経路で必須。
4. rollback先を直前の成功React成果物として保存・検証する。旧legacyを毎回ビルドすることと、通常公開でトップを一時的にlegacyへ戻すことを解消する。移行経路のcompatibility artifactも公開中の成功React rootを保持し、旧版は必要な互換確認用の別パスで検証する。

現在のcompatibility artifactはJekyllでlegacy rootを組み立ててサイト全体に公開している。したがって、通常releaseでもrootが一時的に旧版になる構造がコード上存在する。これは準備時間だけでなく公開中の一貫性の問題として扱う。

## 必須条件

- `Release / Readiness` は対象main SHAの成功が必要。PR headや別SHAのCI結果を流用しない。
- compatibilityとrootで同じproduction buildとdigestを使う。localモードのCI成果物をproduction buildとして流用しない。
- Firebase Rules SHA・公開設定・キー制限・同時release禁止を維持する。
- Chromium desktop / WebKit mobileを維持する。予約room `P9A93LMQ` を共有するためsmoke並列実行はしない。
- 通常企画データに書かない。marker付き専用roomのみを扱い、クライアント停止後の削除とnull確認を必須とする。
- smoke成功でもcleanupが失敗したら成功にしない。root切替後のsmokeまたはcleanup失敗時は検証済み成果物へrollbackする。
- 変更経路は直前の公開成功SHAから今回SHAまでの**全変更**で判定する。直近commitだけでは判定しない。不明な変更・欠けた履歴・shared/schema/sync/Firebase/Maps/config/release基盤変更は保守的な経路にする。
- 既存チェックの削除や回帰を隠すassertion緩和を短縮手段としない。

## 公式資料と判断

- [Playwright CI / Caching browsers](https://playwright.dev/docs/ci#caching-browsers): 復元にダウンロードと同程度の時間がかかること、LinuxのOS依存はキャッシュできないことから、ブラウザバイナリのキャッシュは推奨されていない。
- [Playwright Docker](https://playwright.dev/docs/docker): 公式imageはブラウザとOS依存を含む。imageとプロジェクトのPlaywrightバージョンを一致させる。現在のpackageは1.61.0であり、導入時は一致するimageの取得可否とdigestを確認する。image pull時間も評価に含める。
- [GitHub workflow artifacts](https://docs.github.com/en/actions/tutorials/store-and-share-data): 成果物の受け渡しとdigestの照合に使う。保持期限のあるActions artifactだけに継続運用のrollbackを依存させない。

## 今回は優先しない案

- WebKitやproduction integration確認の削減: 現在は準備時間が主因。
- CIのPR/main二重実行を単純に省略: merge後のSHA保証を崩す。別の最適化として証拠付きで検討する。
- 自前runner: 運用・更新負担が大きく、現状の規模では先にジョブ再準備を減らす。
- すべてのmergeを自動公開: 今回の目的は依頼した本番反映の短縮。公開タイミングの変更は含めない。

公式image trial (mcr.microsoft.com/playwright:v1.61.0-noble) はローカルで101.3秒のcold pull、3,449,416,031 bytes。内蔵Nodeはv24.16.0で本workflowのNode 22要件と合わないため導入を見送る。smoke実行jobを同一runner化する方が、browser installの二重実行を直接なくせる。

## 完了判定

成功・smoke失敗・cleanup失敗・rollback不能・marker不一致の経路を検証したうえで、通常成功releaseを3回以上計測する。Readiness待ちとrelease自体を分けて記録し、段階1は通常成功経路から独立cleanup環境の再準備が消えること、段階2は環境準備の合計時間が改善すること、段階3は通常UI更新でroot一回公開・旧版への一時切替なし・3〜5分の目標に近づくことを確認する。
