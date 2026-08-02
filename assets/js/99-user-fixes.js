(function () {
  'use strict';

  function closeModalFromControl(control) {
    const modal = control?.closest?.('.app-modal, cds-modal');
    if (!modal) return;
    const instance = window.AppModalAdapter?.getOrCreateInstance?.(modal);
    if (instance) instance.hide();
    else modal.open = false;
  }

  /* Restore every explicit close control, including Carbon close-button events. */
  document.addEventListener('click', event => {
    const path = event.composedPath?.() || [];
    const control = path.find(node => node?.matches?.('[data-modal-close]'))
      || event.target?.closest?.('[data-modal-close]');
    if (!control) return;
    event.preventDefault();
    event.stopPropagation();
    closeModalFromControl(control);
  }, true);

  /* Remove stale modal-open state when Carbon finishes closing. */
  document.addEventListener('cds-modal-closed', () => {
    requestAnimationFrame(() => {
      const hasOpenModal = !!document.querySelector('.app-modal[open]');
      document.body.classList.toggle('app-modal-open', hasOpenModal);
    });
  }, true);

  /* The removed fit button may still have a listener in older bundles. */
  document.getElementById('sheet-fit-btn')?.remove();
})();
