// Runtime availability feedback for optional interaction helpers.
window.addEventListener('DOMContentLoaded', function reportMissingDependencies() {
    if (!window.Sortable) {
        console.warn('Sortable could not be loaded. Legacy drag helper is disabled.');
        document.body.classList.add('cdn-sortable-missing');
    }
    if (!document.querySelector('[data-carbon-icon], [data-carbon-icon-name]')) {
        document.body.classList.add('cdn-icons-missing');
    }
});
