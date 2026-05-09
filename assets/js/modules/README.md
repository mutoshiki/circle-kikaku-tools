# サークル企画ルーム

サークルの企画で使える、車割作成・発表・精算をまとめたWebツールです。
参加者登録、車割、共有、ガソリン代や部費負担を含む精算まで、スマホで扱いやすいようにしています。

- `ui.js` is loaded as a classic script before `app.js`. It owns shared confirmation modals, alert modals, the sync-status badge, and the undo bar.
- `utils.js` and `state.js` are ES-module-safe pure helpers prepared for the next refactor step.

The main `app.js` is still loaded as a classic script because the current HTML intentionally keeps legacy `onclick` handlers for stability.
