// Keep Carbon checkbox host state aligned with its internal native checkbox.
// The participant workflow reads the host `checked` state so it stays framework-agnostic.
(() => {
  'use strict';

  const selector = '#formApplicantList cds-checkbox[data-form-applicant-key], #formApplicantList cds-checkbox[data-manual-participant-id]';

  function checkboxFromEvent(event) {
    if (event.target?.matches?.(selector)) return event.target;
    return event.composedPath?.().find(node => node?.matches?.(selector)) || null;
  }

  function internalChecked(checkbox, event) {
    if (typeof event?.detail?.checked === 'boolean') return event.detail.checked;
    const native = checkbox?.shadowRoot?.querySelector?.('input[type="checkbox"]');
    if (native instanceof HTMLInputElement) return native.checked;
    return Boolean(checkbox?.checked || checkbox?.hasAttribute?.('checked'));
  }

  function mirror(checkbox, checked) {
    if (!checkbox) return;
    checkbox.checked = Boolean(checked);
    checkbox.toggleAttribute('checked', Boolean(checked));
  }

  function syncFromEvent(event) {
    const checkbox = checkboxFromEvent(event);
    if (!checkbox) return;
    queueMicrotask(() => mirror(checkbox, internalChecked(checkbox, event)));
  }

  document.addEventListener('change', syncFromEvent, true);
  document.addEventListener('cds-checkbox-changed', syncFromEvent, true);
  document.addEventListener('click', event => {
    const checkbox = checkboxFromEvent(event);
    if (!checkbox) return;
    requestAnimationFrame(() => mirror(checkbox, internalChecked(checkbox)));
  }, true);
})();
