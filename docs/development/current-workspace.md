# 作業元・プレビュー対応表

この文書は、このworktreeの基準を記録したものです。作業開始ごとに、公開manifestを取り直して更新してください。ポート番号や画面の見た目だけでソースの一致を判断しません。

## 公開基準

- 公開URL: <https://mutoshiki.github.io/circle-kikaku-tools/>
- 確認日時: 2026-11-01（公開manifestを再取得）
- manifest: <https://mutoshiki.github.io/circle-kikaku-tools/release-build.json>
- 公開source SHA: `9c7cc7bf96509785128165745517c9b36730806d`
- 公開asset digest: `7e62879f2f70bb231237ff19c6b5c56623c44f8dca4d6447b2073aedebe19616`
- 公開サイトはReactのルートビルド。CIで`apps/react/dist`からPagesルートを構成する。
- 公開manifestからsource SHA・asset digestを再取得し、確認済み。

## 作業元

- 専用worktree: `C:\Users\toshi\.codex\worktrees\project-management-integration\circle-kikaku-tools`
- branch: `codex/tabs-and-ui-behavior-consistency`
- 起点SHA: `9c7cc7bf96509785128165745517c9b36730806d`（2026-11-01に確認した公開manifest SHAと一致）
- この作業の主なReact owner: `apps/react/src/styles.scss`、`apps/react/src/components/ui/SectionHeading.jsx`、`ProjectEntry.jsx`、`Participants.jsx`、`ProjectToolsWorkspace.jsx`、`services/form-maker-workspace.js`
- 組込メーカー: Form Maker 1.0.7、Mountain Plan 1.0.9。ソースPRとPages production smokeは成功済み。
- 文字・余白の共通契約: `docs/design/react-typography-spacing.md`

## ブラウザーの使い分け

| 目的 | URL / 配信元 | 扱い |
|---|---|---|
| 実際の公開版を見る | `https://mutoshiki.github.io/circle-kikaku-tools/` | 読み取り専用の見た目参照。ライブの企画データは変更しない。版は毎回公開manifestで確認する。 |
| 以前から開かれている参照タブ | `http://127.0.0.1:4194/?room=PREVIEW-ORIGIN-VERIFY-20261011&view=seisan` | ユーザー指定のタブとして維持する。配信プロセス・build SHAを特定できるまでは、公開版や今回のpreviewと同一とは扱わない。 |
| このworktreeの変更後preview | `http://127.0.0.1:4292/?debugSample=all-tools&view=tools&room=DEBUG-TABS-20261101`（検証用port） | `apps/react/dist`をVite previewで配信。全ツールの架空サンプルはこのoriginのlocalStorageのみ。Firebase/Auth/本番ルーム・実フォーム作成には接続しない。 |

2026-11-01 tabs and UI behavior consistency: worktree `codex/tabs-and-ui-behavior-consistency`, source baseline `9c7cc7bf96509785128165745517c9b36730806d`. Preview URL `http://127.0.0.1:4292/?debugSample=all-tools&view=tools&room=DEBUG-TABS-20261101`; refresh the build/identity check before opening it. The debug sample and tab preferences are isolated to this preview origin.

2026-10-20 settlement detail refinement: preview URL `http://127.0.0.1:4281/?room=SETTLEMENT-DETAIL-20261020&view=seisan`. The in-app side-browser room uses only this preview origin's localStorage. A boundary example is currently stored there (per-person collection `¥1,234,567`, one detail `¥14,803,013`, long Japanese expense name); it is synthetic and does not affect the public site or another browser origin. Multiple driver names in the live side-browser view were not exercised.

2026-10-21 settlement workflow restructure: preview URL `http://127.0.0.1:4283/?room=SETTLEMENT-FLOW-LOCAL-20261021&view=seisan`. Port 4281 was stale and did not display this worktree's new UI; its process/tab was left untouched. Port 4283 is a fresh local-only Vite preview verified against the latest `apps/react/dist` build, and its synthetic sample is isolated to that origin's localStorage. The side-browser tab is marked as the current preview artifact. Mobile screenshots are saved under `.superpowers/sdd/2026-10-21-settlement-workflow-restructure/`.

## build・起動・照合

作業開始時に公開manifestを取得し、`sourceSha`を基準値にします。公開版が変わったらこの対応表を更新し、既存worktreeの基準を無言で入れ替えません。

```powershell
cd C:\Users\toshi\.codex\worktrees\project-management-integration\circle-kikaku-tools\apps\react
npm ci
npm run build:preview -- --baseline-source-sha 1936ea8dc7ff260e348946c25f295d8ce6563577
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4291 --strictPort
```

別のPowerShellで、ブラウザーで開く前に照合します。

```powershell
cd C:\Users\toshi\.codex\worktrees\project-management-integration\circle-kikaku-tools\apps\react
npm run check:preview -- --url http://127.0.0.1:4291/ --expected-source-sha 1936ea8dc7ff260e348946c25f295d8ce6563577
```

照合はmanifest基準SHA、worktreeのHEADとsource fingerprint、build metadata、配信中のHTMLとJS/CSSを確認する。ソースがbuild後に変わった場合、別worktree由来の場合、SHAやmetadataが違う場合は失敗する。成功は「このローカルpreviewが指定SHAを祖先に持つ現在のworktreeからbuildされ、ページ資産が一致する」ことを示す。公開manifestとpreviewを毎回取り直す前提なので、成功結果を次回の版確認に流用しない。

ローカルpreviewは公開source SHAからのビルドですが、データ接続をlocalに固定するため公開版と**同一バイナリではありません**。公開bundleの同一性はPages archiveの`assetDigest`で別に確認します。local previewは画面・ソース確認用です。

### データ接続

- `build:preview`は`VITE_REACT_SYNC_MODE=local`（未指定時もlocal）だけを許可し、Firebase設定値がある場合は停止する。
- Current sample room is `DEBUG-AB5CF31E9B9444DF` with `debugSample=all-tools`; data is synthetic and isolated to this origin. The unnecessary “初期状態に戻す” menu action has been removed.
- 検証用room: `PREVIEW-ORIGIN-VERIFY-20261011`。このroomの内容はこのブラウザoriginのlocalStorageにのみ保存する。
- 公開版の画面確認は読み取り専用にする。`148A7906`をlocal previewへ持ち込まず、検証用roomにsample dataを入れる。

## 以前の作業場所

### 2026-11-01 タブ編集・全画面の表示ルール統一

- 作業branch `codex/tabs-and-ui-behavior-consistency`。起点は公開source SHA `9c7cc7bf96509785128165745517c9b36730806d`。
- 最新local previewは `http://127.0.0.1:4292/?debugSample=all-tools&view=tools&room=DEBUG-BA87E067528B4EEA`。このroomは架空データで、preview originのlocalStorageだけに保存。Firebase/Auth、Google Forms、Apps Scriptには接続しない。
- Preview buildと配信中asset照合は起点SHAをbaselineに成功。manifest `sourceSha=9c7cc7bf96509785128165745517c9b36730806d`、asset digest `7e62879f2f70bb231237ff19c6b5c56623c44f8dca4d6447b2073aedebe19616`。
- Unit tests: 182/182 passed。Final browser matrix: 532 cases, 530 passed, 2 skipped, 0 failed across Chromium/WebKit desktop/mobile (20.1 minutes). The initial 30s limit on the WebKit-mobile all-tools sample flow timed out once during the combined suite; it passed twice in isolation (18.9s and 19.0s), was given a 60s budget, and passed in the final full matrix.
- Side-browser inspection covered tab editor, hidden/show tab change, inline Form Maker/Mountain Plan, participant selection, allocation overflow/capacity, settlement settings, and light/dark at the available fixed width (~536px). This is not a manual review of every modal or desktop viewport. Production release and production smoke have not been performed.

- `C:\Users\toshi\Documents\GitHub\circle-kikaku-tools`は`codex/react-migration-rc`上の既存作業場所。未コミット・未追跡変更85件をそのまま保持し、新しい作業の起点にしない。
- 既存の`public-current-parity` worktreeはAuth調査用のdirtyな別ブランチ。ここから公開版ソースを推測しない。
- 4184など、過去の誤ったローカルpreview portは再利用せず、現在のworktree・build・データ接続を照合してから新しい検証用portを選ぶ。

## 2026-10-26 site copy implementation

- Published baseline refreshed before preview: source SHA `5cbf3a4ab68af6909292412f03b7f389d7188c58`, asset digest `4233fce3d4bef9cbf74f182805f2d85b48ef55d28e35f532136c2916065ccd88` (retrieved from the live `release-build.json`).
- Isolated worktree: `C:\Users\toshi\.codex\worktrees\site-copy-improvements\circle-kikaku-tools`; build and preview identity checks use the published SHA as baseline.
- Local preview: `http://127.0.0.1:4284/?room=COPY-REVIEW-20261026&view=seisan`; local-only storage, synthetic regular sample. No production room/Firebase data used.
- Browser inspection included 393×852 and 1280×900 emulated viewports and light/dark themes. Modal evidence is recorded in `docs/design/react-typography-spacing.md`.

### 2026-10-28 vehicle action correction

- Public baseline refreshed: `f16105eca49f32da769b126f81825b8591dcd509`, asset digest `458bfb58fc370274b4ee73c709802a54539f9450504dea7c38c2b6a5dd7f1e49`.
- Same worktree, branch `codex/settlement-row-actions-from-main` (PR #115). Local-only preview remains `http://127.0.0.1:4284/?room=COPY-REVIEW-20261026&view=seisan`.
- Reproduced the misplaced arrow/label and narrowed amount column in the side browser. The corrected three-row header was inspected at 393×852 and 1280×900 in light/dark themes. Pointer and Space disclosure operations, collapsed-row expense editing, Escape dismissal and focus return were exercised. No horizontal page overflow was observed. The participant tab was also inspected.
- Physical-device behavior, browser zoom and screen readers were not manually exercised. Automated narrow-width cases cover 320px through desktop and both themes.

### 2026-10-28 cross-screen visual consistency

- Worktree: `C:\Users\toshi\.codex\worktrees\site-copy-improvements\circle-kikaku-tools`, branch `codex/cross-screen-visual-consistency`; public baseline at implementation start was `428224eba22e1358951c4002028b3fc5952af50e` (asset digest `afef2d8ccb21c24bffde3da8eb7ca7e5c01b02efd2b612b34cdb65606f7c9e39`).
- Preview: `http://127.0.0.1:4285/?room=CONSISTENCY-LOCAL-20261028&view=seisan`; sample data is synthetic and saved only to this preview origin. Port 4284 was already in use and was left unchanged.
- This change aligns the shared content inset and the typography/spacing roles on participants, car allocation, team allocation, and settlement. Allocation edits already present at task start were preserved. No calculation, persistence, sync, Firebase, schema, or permission behavior was changed.
- Browser evidence: Playwright checks cover 320px, 393px, 676px and desktop widths, both themes, and interaction/focus behavior. In-app side-browser inspection was available at approximately 420×594; this CUA surface has no viewport-resize control, so exact 393×852 and 1280×900 visual inspection is not claimed. Browser automation covers the plan's exact responsive ranges. Browser zoom, physical devices, and screen readers remain unverified.

### 2026-10-29 allocation row actions and fixed status

- Worktree: `C:\Users\toshi\.codex\worktrees\site-copy-improvements\circle-kikaku-tools`, branch `codex/allocation-row-overlap-fix`; preview baseline is public source SHA `eb5704634f606039bd56899b5801b3391d0f5a9f`.
- Preview: `http://127.0.0.1:4285/?room=CONSISTENCY-LOCAL-20261028&view=car`. The page uses synthetic room data in preview-origin localStorage only.
- Cause: Carbon positions `ContainedListItem` actions at the row edge. With the pin as a second direct action, the grade column crossed the pin button at 1280px.
- Fix: move pin/unpin into the participant's overflow menu. Show a gray `固定` Tag beside the name when pinned, using the same Carbon style as the driver Tag. This removes the frequent row-end icon and retains visible fixed status. No allocation or persistence semantics changed.
- Verification: geometry and menu interaction checks passed 8/8 in Chromium and WebKit at desktop and mobile. They assert a 4px gap between grade and the remaining overflow action at 1280px in light/dark, 390px and 320px, check no horizontal overflow at 320px, and exercise fix/unfix through the menu. The updated UI was also inspected in the in-app side browser.

### 2026-10-31 usable all-tools sample

- Worktree: `C:\Users\toshi\.codex\worktrees\project-management-integration\circle-kikaku-tools`, branch `codex/hide-debug-sample-banner`; public baseline `1936ea8dc7ff260e348946c25f295d8ce6563577`.
- Preview: `http://127.0.0.1:4291/?debugSample=all-tools&view=application-form&room=DEBUG-AB5CF31E9B9444DF`. It uses isolated local storage. It does not connect to Firebase, Apps Script, or Google Forms.
- The fixture populates applicants/participants, 3 vehicles with settlement details, 3 teams with one unassigned participant, CSV preview, Form Maker editable inputs, and Mountain Plan draft. Form Maker edits persist locally across tool tabs. The Mountain Plan fixture automatically loads a complete sample draft; its event date is derived from the linked project data.
- Verification: package tests 10/10, Form Maker build passed, Circle unit tests 179/179, focused sample unit tests 5/5, and the all-tools browser flow 4/4 in Chromium/WebKit desktop/mobile. Browser checks cover edits, save/restore, fee expansion, CSV preview, draft autosave, and zero external writes. `build:preview` and `check:preview` passed against the public baseline.
- Only the sample-data milestone is complete. The broader sitewide screen/modal audit and UI consistency implementation remain pending; no production release was performed.
