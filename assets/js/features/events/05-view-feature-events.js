// View tabs, modal commands, and form controls.
(function (global) {
    'use strict';

    const events = global.SanpoEvents || {};
    const bind = events.bind;
    const bindModalSubmit = events.bindModalSubmit;
    let personMenuTouchGesture = null;
    let personMenuHintSurface = null;
    let personMenuHintFrame = 0;
    const replayedPersonMenuItems = new WeakSet();

    function elementFromComposedPath(event, selector) {
        return event.composedPath?.().find(node => node?.matches?.(selector))
            || event.target?.closest?.(selector)
            || null;
    }

    function personMenuItemFromEvent(event) {
        return elementFromComposedPath(event, 'cds-menu-item');
    }

    function personMenuTriggerForItem(item) {
        return item?.closest?.('cds-overflow-menu.person-overflow-menu') || null;
    }

    function ensurePersonMenuScrollHint() {
        let hint = document.querySelector('.person-menu-scroll-hint');
        if (hint) return hint;
        hint = document.createElement('div');
        hint.className = 'person-menu-scroll-hint';
        hint.hidden = true;
        hint.setAttribute('aria-hidden', 'true');

        const label = document.createElement('span');
        label.className = 'person-menu-scroll-hint__label';
        const icon = document.createElement('span');
        icon.className = 'person-menu-scroll-hint__icon';
        icon.setAttribute('aria-hidden', 'true');
        hint.append(label, icon);
        document.body.appendChild(hint);
        return hint;
    }

    function openPersonMenuSurface() {
        const trigger = document.querySelector('cds-overflow-menu.person-overflow-menu[open]');
        const menu = trigger?.querySelector(':scope > cds-menu.person-pop-menu');
        return menu?.shadowRoot?.querySelector?.('.cds--menu') || null;
    }

    function updatePersonMenuScrollHint() {
        personMenuHintFrame = 0;
        const hint = ensurePersonMenuScrollHint();
        const surface = openPersonMenuSurface();
        if (!surface || surface.clientHeight <= 0 || surface.scrollHeight <= surface.clientHeight + 4) {
            hint.hidden = true;
            return;
        }

        if (personMenuHintSurface !== surface) {
            personMenuHintSurface?.removeEventListener('scroll', schedulePersonMenuScrollHint);
            personMenuHintSurface = surface;
            personMenuHintSurface.addEventListener('scroll', schedulePersonMenuScrollHint, { passive: true });
        }

        const canScrollDown = surface.scrollTop + surface.clientHeight < surface.scrollHeight - 4;
        const canScrollUp = surface.scrollTop > 4;
        if (!canScrollDown && !canScrollUp) {
            hint.hidden = true;
            return;
        }

        const direction = canScrollDown ? 'down' : 'up';
        const rect = surface.getBoundingClientRect();
        const hintHeight = 32;
        hint.dataset.direction = direction;
        hint.querySelector('.person-menu-scroll-hint__label').textContent = direction === 'down'
            ? '下に項目があります'
            : '上にも項目があります';
        hint.querySelector('.person-menu-scroll-hint__icon').textContent = direction === 'down' ? '↓' : '↑';
        hint.style.left = `${Math.round(rect.left)}px`;
        hint.style.top = `${Math.round(direction === 'down' ? rect.bottom - hintHeight : rect.top)}px`;
        hint.style.width = `${Math.round(rect.width)}px`;
        hint.hidden = false;
    }

    function schedulePersonMenuScrollHint() {
        if (personMenuHintFrame) cancelAnimationFrame(personMenuHintFrame);
        personMenuHintFrame = requestAnimationFrame(updatePersonMenuScrollHint);
    }

    function setupPersonMenuMobileEvents() {
        if (document.documentElement.dataset.personMenuMobileEvents === 'true') return;
        document.documentElement.dataset.personMenuMobileEvents = 'true';

        document.addEventListener('pointerdown', event => {
            const item = personMenuItemFromEvent(event);
            const trigger = personMenuTriggerForItem(item);
            const isDirectTouch = event.isPrimary !== false
                && (event.pointerType === 'touch' || event.pointerType === 'pen');
            if (!item || !trigger || !isDirectTouch || item.disabled || item.hasAttribute('disabled')) {
                personMenuTouchGesture = null;
                return;
            }
            personMenuTouchGesture = {
                item,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                startedAt: performance.now()
            };
        }, true);

        document.addEventListener('pointerup', event => {
            const gesture = personMenuTouchGesture;
            personMenuTouchGesture = null;
            if (!gesture || gesture.pointerId !== event.pointerId) return;
            if (personMenuItemFromEvent(event) !== gesture.item) return;
            const moved = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);
            const elapsed = performance.now() - gesture.startedAt;
            if (moved > 18 || elapsed > 900) return;

            // Sortable can consume the native click on iOS. Replay only a clean
            // touch tap so Carbon keeps ownership of submenu, focus and choice behavior.
            if (event.cancelable) event.preventDefault();
            event.stopImmediatePropagation();
            replayedPersonMenuItems.add(gesture.item);
            queueMicrotask(() => {
                gesture.item.click();
                schedulePersonMenuScrollHint();
            });
            window.setTimeout(() => replayedPersonMenuItems.delete(gesture.item), 900);
        }, true);

        document.addEventListener('pointercancel', () => {
            personMenuTouchGesture = null;
        }, true);

        document.addEventListener('click', event => {
            const item = personMenuItemFromEvent(event);
            if (!item || !event.isTrusted || !replayedPersonMenuItems.has(item)) return;
            replayedPersonMenuItems.delete(item);
            event.preventDefault();
            event.stopImmediatePropagation();
        }, true);

        const menuObserver = new MutationObserver(records => {
            if (!records.some(record => record.target?.matches?.('cds-overflow-menu.person-overflow-menu'))) return;
            window.setTimeout(schedulePersonMenuScrollHint, 160);
        });
        menuObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });

        window.addEventListener('resize', schedulePersonMenuScrollHint, { passive: true });
        global.visualViewport?.addEventListener('resize', schedulePersonMenuScrollHint, { passive: true });
    }

    function applyCarbonIconButtonLabels() {
        document.querySelectorAll('cds-icon-button[aria-label]').forEach(button => {
            const label = button.getAttribute('aria-label')?.trim();
            if (!label) return;

            let tooltipContent = button.querySelector(':scope > [slot="tooltip-content"]');
            if (!tooltipContent) {
                tooltipContent = document.createElement('span');
                tooltipContent.slot = 'tooltip-content';
                button.appendChild(tooltipContent);
            }
            tooltipContent.textContent = label;
            button.requestUpdate?.();
        });
    }

    function syncCarbonIconButtonLabels() {
        if (customElements.get('cds-icon-button')) {
            applyCarbonIconButtonLabels();
            return;
        }
        customElements.whenDefined('cds-icon-button').then(applyCarbonIconButtonLabels);
    }

    function setupSettlementOptionEvents() {
        ['seisanRounding', 'seisanOrganizerName', 'seisanOrganizerFree', 'seisanDriverCollectionOffset'].forEach(id => {
            const el = byId(id);
            if (el && el.dataset.eventOwnerBound !== 'true') {
                el.dataset.eventOwnerBound = 'true';
                el.addEventListener('change', () => global.onSettlementInput?.());
            }
        });

        const rewardType = byId('seisanDriverRewardType');
        if (rewardType && rewardType.dataset.eventOwnerBound !== 'true') {
            rewardType.dataset.eventOwnerBound = 'true';
            rewardType.addEventListener('change', () => {
                const state = ensureSettlementState();
                state.driverRewardType = rewardType.value === 'club' ? 'club' : 'split';
                global.onSettlementInput?.();
            });
        }

        const reward = byId('seisanDriverReward');
        if (reward && reward.dataset.eventOwnerBound !== 'true') {
            reward.dataset.eventOwnerBound = 'true';
            reward.addEventListener('input', () => global.onSettlementInputDelayed?.());
            reward.addEventListener('change', () => global.onSettlementInput?.());
        }
    }

    function setupAutoAssignOptionEvents() {
        ['optFemale', 'optMale', 'optGrade'].forEach(id => {
            const el = byId(id);
            if (el && el.dataset.eventOwnerBound !== 'true') {
                el.dataset.eventOwnerBound = 'true';
                el.addEventListener('change', () => updateAutoAssignSummary());
            }
        });
    }

    function setupViewAndFeatureEvents() {
        bind('tab-list', () => switchView('list'));
        bind('tab-sheet', () => switchView('sheet'));
        bind('tab-seisan', () => switchView('seisan'));
        bind('batchOpenBtn', () => openBatchModal());
        bind('sheet-quick-edit-btn', () => toggleQuickEdit());
        bind('seisanRefreshBtn', () => renderSettlementView());
        bind('clearAllBtn', () => global.clearAll());
        bind('applyGoogleFormPasteBtn', () => global.applyGoogleFormPasteImport?.());
        bindModalSubmit('executeBatchBtn', () => executeBatch());
        bindModalSubmit('saveSettlementSettingsBtn', () => global.saveSettlementSettings?.());
        bind('executeDebugBtn', () => global.executeDebugMode?.());
        bind('executeDebugMissingBtn', () => global.executeDebugMissingCostMode?.());
        bind('addRouteStopBtn', () => global.addRouteStop?.());
        bind('openGoogleRouteBtn', () => global.openGoogleRoute?.());

        const registrationMode = byId('batchRegistrationMode');
        if (registrationMode && registrationMode.dataset.eventOwnerBound !== 'true') {
            registrationMode.dataset.eventOwnerBound = 'true';
            const commitMode = value => global.setBatchRegistrationMode?.(value, { focus: true });
            registrationMode.addEventListener('change', () => commitMode(registrationMode.value));
            registrationMode.addEventListener('cds-content-switcher-selected', event => {
                const item = event.detail?.item;
                if (item && registrationMode.contains(item)) commitMode(item.value);
            });
        }

        setupSettlementOptionEvents();
        setupAutoAssignOptionEvents();
        setupPersonMenuMobileEvents();
        syncCarbonIconButtonLabels();
    }

    global.SanpoEvents = Object.freeze({
        ...events,
        setupViewAndFeatureEvents
    });
})(window);
