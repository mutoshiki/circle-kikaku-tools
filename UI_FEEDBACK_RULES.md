# UI feedback rules

The app uses one feedback surface per task level.

- Field-specific invalid input: Carbon invalid state directly on the field, with concise invalid text.
- Screen or modal-wide guidance: Carbon Inline Notification inside the owning surface.
- Completed background action outside a modal: Carbon Toast Notification above bottom navigation.
- Destructive or discard decision: Carbon Modal with explicit primary and secondary actions.
- Undoable allocation action: the persistent undo bar, never a second toast.

A global toast must not cover a modal footer, required field, or primary action. When a modal is open, `AppUI.showStatus` renders a low-contrast Inline Notification at the top of that modal body.
