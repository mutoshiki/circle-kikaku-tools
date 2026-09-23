# React GitHub Pages rollout

This workflow does not deploy on pushes or pull requests. Pull requests build and upload a preview artifact only. A Pages deployment requires `workflow_dispatch` on `main` and the `github-pages` environment.

## Required order

1. Create and review the Phase 9 checkpoint, then merge it into `main`. Do not dispatch a Pages workflow yet.
2. Before changing production Rules, inspect the live Rules in Firebase Console and confirm they match Phase 8 checkpoint `580c6c7`. If they differ, stop and establish a rollback from the actual live revision first. The Phase 8 rollback source is `580c6c7:firebase/database.rules.json` (blob `fa9daf4d07546800b5e7e5df6e52f5424b4f8d24`). Keep the checkpoint reachable in Git and record the live and rollback revisions. Verify the recovery checkout is available before release; the recovery command, to run only if rollback is needed, is:

   ```powershell
   git worktree add --detach ..\react-rules-rollback 580c6c7
   Push-Location ..\react-rules-rollback
   firebase deploy --only database --project sanpokai-tool
   Pop-Location
   ```

   Only after confirming the rollback source and recovery path, set `REACT_FIREBASE_RULES_ROLLBACK_READY_SHA` to the exact Phase 8 Rules blob SHA.
3. Separately review and release the new `firebase/database.rules.json` to production. The React cleanup flow omits legacy-only `activeAllocationType`; the updated rule permits it to be absent while still rejecting values other than `car` and `team`. After release, set `REACT_FIREBASE_RULES_RELEASE_SHA` to `git rev-parse main:firebase/database.rules.json`. This is an operator acknowledgment; GitHub Actions cannot verify the live Rules revision. If Rules release fails or causes a regression, restore the Phase 8 Rules from the recorded checkpoint before continuing.
4. Verify the legacy production site still loads and its critical flows work with the updated Rules.
5. Set `REACT_FIREBASE_CONFIG` to the existing public Firebase web config JSON and `REACT_MAPS_API_KEY` to a browser key restricted to `https://mutoshiki.github.io/circle-kikaku-tools/*`. Do not add service-account credentials. In repository Settings → Pages, switch the publishing source from `Deploy from a branch (main /)` to `GitHub Actions`. Configure required reviewers on the `github-pages` environment if available.

## Rollout

1. Run **React GitHub Pages** manually on `main` with target `compatibility`. The artifact contains the current Jekyll-built legacy app at `/` and React at `/react/`.
2. Verify the production URL at `/react/` using a dedicated test room. Confirm read/write, save/reload, two React tabs, and legacy-to-React-to-legacy sync. Keep production user links on `/` during this stage.
3. Only after that smoke passes, set `REACT_COMPATIBILITY_SMOKE_SHA` to the compatibility deployment's `main` commit SHA. Root cutover remains a later, separately approved step.

## Rollback

Run **React GitHub Pages** manually on `main` with target `legacy`. It builds the pinned legacy source commit `e37b8651eeba1cb52d2b7a98bc05674bb63591a8` and publishes it at `/`, without changing the Pages source setting. Keep that ref aligned with the last known-good legacy release if the production legacy site changes before cutover.

The React build uses `/circle-kikaku-tools/react/` for compatibility mode and `/circle-kikaku-tools/` for root mode. The workflow never uses production Firebase values for pull-request builds, and both the workflow and runtime validate the production Firebase project identity and required web config fields. The root cutover is gated on a compatibility smoke acknowledgment for the exact same commit SHA.
