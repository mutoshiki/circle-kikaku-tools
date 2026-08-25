// Mobile sticky-header scroll stability owner.
// When a long view collapses to a short confirmed state, browsers keep as much of
// the previous scrollTop as possible. That can leave the first actionable row
// underneath the sticky application navigation. Correct only that obstructed
// state; normal user scrolling and the project-title region remain untouched.
(() => {
    'use strict';

    if (window.__mobileStickyScrollOwnerInstalled) return;
    window.__mobileStickyScrollOwnerInstalled = true;

    let frame = 0;

    function activeOnMobile() {
        return window.matchMedia('(max-width: 768px)').matches;
    }

    function stabilizeParticipantHeader() {
        frame = 0;
        if (!activeOnMobile() || !document.body.classList.contains('view-mode-participants')) return;

        const page = document.querySelector('.participants-page.is-confirmed-collapsed');
        const controls = document.getElementById('participantsConfirmedControls');
        const nav = document.getElementById('app-view-navigation');
        const scroller = document.getElementById('app-layout');
        if (!page || !controls || !nav || !scroller || controls.hidden) return;

        const navBottom = nav.getBoundingClientRect().bottom;
        const controlsTop = controls.getBoundingClientRect().top;
        const clearance = 8;
        const overlap = navBottom + clearance - controlsTop;
        if (overlap <= 0) return;

        scroller.scrollTop = Math.max(0, scroller.scrollTop - overlap);
    }

    function schedule() {
        if (frame) return;
        frame = requestAnimationFrame(stabilizeParticipantHeader);
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class', 'hidden', 'aria-expanded']
    });

    window.addEventListener('resize', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });
    schedule();
})();
