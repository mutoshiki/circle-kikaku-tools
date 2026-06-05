# CSS Map

Load order:
1. Vendor CSS: Bootstrap, Font Awesome.
2. `assets/css/tokens/*`: fallback tokens, reset, Bootstrap/control bridge, primitive color aliases.
3. `assets/css/components/*`: reusable surfaces, buttons, chips, icon/action primitives.
4. Feature owners: `app-shell/*`, `guides-modals/*`, `cars-members-tray/*`, `settlement/*`, `sheet-view/*`.
5. Cross-cutting utilities: `07-drag-interactions.css`, `08-utilities.css`, `09-font-weight-tuning.css`.
6. Theme layer: `theme/00` palette contract, `theme/01` semantic mapper, `theme/02` token bridge, picker/accent application.

Token ownership:
- `theme/00-theme-contract.css` is the palette source of truth.
- `theme/01-theme-tokens.css` maps palette values to semantic app tokens.
- `tokens/01-color-scheme.css` is fallback/reset/base only.
- `theme/02-border-normalization.css` only bridges border/control variables and `color-scheme`.

Component rule:
- Shared shapes go in `components/*`: surfaces, empty states, buttons, icon/action controls, summary pill primitives, modal shell primitives.
- Components define base shape and tokens only. Screen layout, density, and feature meaning stay in owner CSS.

Feature owner rule:
- App shell/header/tabs live under `app-shell/*`.
- Modal/dropdown/dialog/overview/import-guide live under `guides-modals/*`.
- Settlement page cards, summary, checklists, car inputs, cost tags, dark settlement surfaces live under `settlement/*`.
- Car/member/tray allocation UI lives under `cars-members-tray/*`.
- Sheet/presentation UI lives under `sheet-view/*`.

Override rule:
- No `!important` by default.
- Allowed only for verified vendor/plugin override, with a comment explaining the target and why specificity/load order cannot solve it.
- Do not create repair/fix/final override files. Move rules to the owning feature or component file.
