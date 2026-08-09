// User guide mounting and in-modal navigation.
(function (global) {
    'use strict';

    function mountUserGuide() {
        const root = document.getElementById('userGuideContent');
        if (!root || root.dataset.mounted === 'true') return;
        root.innerHTML = global.SanpoUserGuideContent || '<p>使い方を読み込めませんでした。</p>';
        root.dataset.mounted = 'true';

        root.addEventListener('click', event => {
            const link = event.target.closest?.('.user-manual-nav a[href^="#"]');
            if (!link) return;
            const target = root.querySelector(link.getAttribute('href'));
            if (!target) return;
            event.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    global.mountUserGuide = mountUserGuide;
    document.addEventListener('DOMContentLoaded', mountUserGuide);
})(window);
