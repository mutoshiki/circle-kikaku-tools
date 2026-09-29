# Phase B browser evidence

This directory records the visual evidence for the Phase B app shell, project navigation, and shared page anatomy. It supplements behavior and accessibility assertions; screenshots are not the contract by themselves.

## Environment

- Build: local production build from the Phase B branch
- Desktop: Chromium and WebKit at 1280 × 900
- Mobile: Chromium and WebKit at 390 × 844 with touch enabled
- Data: local-only synthetic sample rooms named `PHASE-B-EVIDENCE-*`
- Themes: light overview and dark populated participants page
- Production Firebase: not used for evidence capture

## Before evidence

The following images were copied from the Phase A audit before Phase B implementation. They are retained beside the after evidence so a PR reviewer does not need an untracked audit directory:

- `before-desktop-flat-tabs-light.png`: desktop shell with the project flattened into four feature tabs.
- `before-mobile-flat-tabs-light.png`: the same feature-tab structure compressed to 390px without a mobile lifecycle-navigation model.
- `before-desktop-flat-tabs-dark.png`: the previous dark shell, where project context, current location, and page anatomy were still implicit.

These images are historical observations, not snapshot contracts.

## After evidence

| Evidence | State and action | Expected result |
| --- | --- | --- |
| `after-chromium-desktop-overview-light.png` | Desktop, populated project, Overview, light theme | Persistent lifecycle navigation, project context, one page title, metadata, and overview content share a stable page anatomy. |
| `after-webkit-desktop-overview-light.png` | Same state in WebKit | The same IA and geometry hold outside Chromium. |
| `after-chromium-mobile-overview-light.png` | 390px, Overview, navigation closed | Header remains compact, project context and title wrap, main content owns document scrolling, and there is no horizontal overflow. |
| `after-webkit-mobile-overview-light.png` | Same state in WebKit | Mobile page anatomy remains usable in WebKit. |
| `after-chromium-mobile-navigation-open.png` | 390px, lifecycle menu opened by touch | Carbon side navigation overlays rather than displacing the page, exposes the current location, and retains a close control. |
| `after-webkit-mobile-navigation-open.png` | Same interaction in WebKit | The overlay and scrim behavior remain consistent in WebKit. |
| `after-chromium-desktop-participants-dark.png` | Desktop, populated Participants, dark theme | Feature content is embedded beneath the shared page header without a duplicate `h1`. |
| `after-webkit-desktop-participants-dark.png` | Same state in WebKit | Dark tokens and page hierarchy remain consistent in WebKit. |
| `after-chromium-mobile-participants-dark.png` | 390px, populated Participants, dark theme | The feature remains reachable through the mobile shell and retains a single document scroll owner. |
| `after-webkit-mobile-participants-dark.png` | Same state in WebKit | The populated dark state has no horizontal overflow in WebKit. |

## Automated coverage paired with this evidence

`apps/react/tests/browser/app-shell-navigation.spec.js` verifies canonical and legacy deep links, browser history, refresh restoration, heading focus, current-page semantics, landmarks, keyboard and touch operation, menu focus return, protected local state, long project names, responsive geometry, and overflow. `phase-b-evidence.spec.js` generates only the images indexed above.

The final Phase B candidate passed:

- 52 React unit/contract tests and the production build.
- 134 full browser tests across Chromium desktop, Chromium 390px, and WebKit 390px, with four intended project-specific skips.
- The Phase B navigation contract in Desktop/Mobile Chromium and WebKit, plus evidence capture in all four environments.
- 3 Auth/Realtime Database Emulator unit tests and the two-client sync browser test in Chromium desktop and WebKit 390px.
- The legacy static contract suite and the protected-file verification guard.

No production environment, production Firebase room, deploy, cutover, or production smoke was used.
