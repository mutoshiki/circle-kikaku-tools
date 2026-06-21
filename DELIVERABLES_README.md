# 成果物案内

- `CHANGE_OWNER_MAP.md`: 実際の変更と正規CSS ownerの対応
- `FINAL_BROWSER_AUDIT.md`: 問題分類、検証条件、最終結果、公式資料
- `BEFORE_AFTER_INDEX.md`: 代表比較画像の索引
- `representative-before-after/`: 変更前後の比較シートと原寸画像
- `screenshots/final-audit-*`: 360 / 390 / 430 / 768 / 1280 / 1440px の最終監査
- `screenshots/final-interactions/`: hover / focus / active / disabled / selected / drag / 長文 / 長金額 / modal の状態監査
- `final-verification-logs/`: 最終テストログ

## 検証コマンド

```bash
npm install
npm run lint:css
npm test
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:ui
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:refinement
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:visual
```
