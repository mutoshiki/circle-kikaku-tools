const INVALID_SELECTOR = '[aria-invalid="true"]:not([disabled]), [data-invalid-focus]:not([disabled])';

export function focusFirstInvalid(root = globalThis.document) {
  const target = root?.querySelector?.(INVALID_SELECTOR);
  if (!target) return false;
  target.focus();
  target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  return true;
}
