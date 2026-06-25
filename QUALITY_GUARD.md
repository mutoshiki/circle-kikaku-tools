# Quality Guard

Run before merging:

```sh
npm ci
npx playwright install --with-deps chromium
npm run test:guard
```

Protection layers:

- `npm run lint:css`: invalid CSS, duplicate declarations, unknown properties, and `!important`.
- `npm test`: CSS owner, breakpoint, file-size, token, and architecture contracts.
- `npm run test:ui`: critical interactions and modal behavior.
- `npm run test:visual`: Linux Chromium screenshot comparison at 360, 390, 430, 768, 1280, and 1440px, overflow checks, and console failure checks.
- `.github/workflows/quality-guard.yml`: repeats all guards on pull requests and `main`.

When a visual change is intentional:

```sh
npm run test:visual:update
npm run test:visual
```

Review changed snapshot PNG files before committing them.

Repository setting still required once:

1. Protect `main`.
2. Require `CSS lint and static contracts`.
3. Require `UI and visual regression`.
4. Require pull requests before merge.
