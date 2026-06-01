// Guide modal feature
// Extracted from app.js during S cleanup.
// Owns guide step navigation and modal reset behavior.

const GUIDE_KEYS = { global: 'globalGuide', car: 'carGuide', seisan: 'seisanGuide' };
const currentGuideSteps = { global: 0, car: 0, seisan: 0 };

function guideCount(guide) {
    return document.querySelectorAll(`.guide-step-panel[data-guide="${guide}"]`).length || 1;
}

function showGuideStep(guide, step) {
    window.mountGuideTemplates?.();
    if (typeof guide === 'number') {
        step = guide;
        guide = 'car';
    }
    guide = guide || 'car';
    const total = guideCount(guide);
    const safeStep = Math.max(0, Math.min(total - 1, Number(step) || 0));
    currentGuideSteps[guide] = safeStep;

    document.querySelectorAll(`.guide-step-panel[data-guide="${guide}"]`).forEach(p => {
        p.hidden = Number(p.dataset.panel) !== safeStep;
    });
    document.querySelectorAll(`.guide-step-btn[data-guide="${guide}"]`).forEach(b => {
        b.classList.toggle('active', Number(b.dataset.step) === safeStep);
    });

    const prefix = GUIDE_KEYS[guide] || 'carGuide';
    const prevBtn = byId(`${prefix}PrevBtn`);
    const nextBtn = byId(`${prefix}NextBtn`);
    const closeBtn = byId(`${prefix}CloseBtn`);
    if (prevBtn) prevBtn.hidden = safeStep <= 0;
    const isLast = safeStep >= total - 1;
    if (nextBtn) nextBtn.hidden = isLast;
    if (closeBtn) closeBtn.hidden = !isLast;
}

function guideNavStep(guide, dir) {
    if (typeof guide === 'number') {
        dir = guide;
        guide = 'car';
    }
    guide = guide || 'car';
    const total = guideCount(guide);
    const current = currentGuideSteps[guide] || 0;
    const next = Math.max(0, Math.min(total - 1, current + dir));
    showGuideStep(guide, next);
}

window.SanpoApp?.exposeCompat?.('showGuideStep', showGuideStep);
window.SanpoApp?.exposeCompat?.('guideNavStep', guideNavStep);

document.addEventListener('DOMContentLoaded', () => {
    window.mountGuideTemplates?.();
    [
        ['globalGuideModal', 'global'],
        ['guideModal', 'car'],
        ['seisanGuideModal', 'seisan']
    ].forEach(([modalId, guide]) => {
        const el = byId(modalId);
        if (el) el.addEventListener('show.bs.modal', () => showGuideStep(guide, 0));
    });
});
