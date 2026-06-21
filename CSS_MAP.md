# CSS Map

- Foundations: `tokens/`
- Shared component contracts: `components/`
- Application frame and header: `app-shell/`
- Dialogs, guides and drawer: `guides-modals/`
- Allocation cards and waiting tray: `cars-members-tray/`
- Settlement screen: `settlement/`
- Presentation screen: `sheet-view/`
- Drag interactions: `07-drag-interactions.css`
- Utilities: `08-utilities.css`
- Type-weight tuning: `09-font-weight-tuning.css`

全画面共通の後勝ちvisual層はありません。色や寸法の共通値はtokens、部品の共通挙動はcomponents、画面固有の表現は各機能ownerが管理します。

Color values originate in `tokens/01-color-scheme.css`. Control dimensions and shared surface values originate in `tokens/05-control-surface-tokens.css`.
