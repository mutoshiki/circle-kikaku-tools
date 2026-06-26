// CDN dependency availability feedback for optional visual and interaction helpers.
window.addEventListener('DOMContentLoaded', function reportMissingDependencies() {
    if (!window.bootstrap) {
        console.warn('Bootstrap JS could not be loaded. Some menus and modals may not work.');
        document.body.classList.add('cdn-bootstrap-missing');
    }
    if (!window.Sortable) {
        console.warn('Sortable could not be loaded. Legacy drag helper is disabled.');
        document.body.classList.add('cdn-sortable-missing');
    }
    if (!document.querySelector('.fa, .fas, .fa-solid')) {
        document.body.classList.add('cdn-icons-missing');
    }
});
