// Carbon state icon adapter: keeps state-to-icon mappings out of feature controllers.
(function (global) {
  'use strict';

  const stateIcons = Object.freeze({
    theme: Object.freeze({
      light: 'moon',
      dark: 'sun'
    }),
    editLock: Object.freeze({
      unlocked: 'unlocked',
      locked: 'locked'
    }),
    waitingTray: Object.freeze({
      closed: 'chevron--up',
      open: 'chevron--down'
    })
  });

  function resolveIcon(group, state) {
    return stateIcons[group]?.[state] || null;
  }

  function findStateIcons(container, group) {
    return Array.from(container.querySelectorAll('[data-state-icon]'))
      .filter(node => node.dataset.stateIcon === group);
  }

  function addClassNames(node, className = '') {
    String(className).split(/\s+/).filter(Boolean).forEach(name => node.classList.add(name));
  }

  function setIcon(container, iconName, { className = '' } = {}) {
    if (!container || !iconName) return null;
    const current = container.querySelector('[data-carbon-icon-name], [data-carbon-icon]');
    if (current?.dataset.carbonIconName === iconName || current?.dataset.carbonIcon === iconName) return current;

    const placeholder = document.createElement('span');
    placeholder.dataset.carbonIcon = iconName;
    placeholder.setAttribute('aria-hidden', 'true');
    const slotName = current?.getAttribute('slot');
    if (slotName) placeholder.setAttribute('slot', slotName);
    addClassNames(placeholder, className);
    if (current) current.replaceWith(placeholder);
    else container.prepend(placeholder);
    return global.SanpoCarbon?.renderCarbonIcons(placeholder)?.[0] || placeholder;
  }

  function setStateIcon(container, group, state, { className = '' } = {}) {
    if (!container) return null;
    const iconName = resolveIcon(group, state);
    if (!iconName) {
      console.warn(`Unknown Carbon state icon: ${group}.${state}`);
      return null;
    }

    const matches = findStateIcons(container, group);
    const current = matches.shift() || null;
    matches.forEach(node => node.remove());

    const currentName = current?.dataset.carbonIcon || current?.dataset.carbonIconName;
    if (current && currentName === iconName) {
      current.dataset.iconState = state;
      current.setAttribute('aria-hidden', 'true');
      addClassNames(current, className);
      if (current.matches('[data-carbon-icon]')) {
        return global.SanpoCarbon?.renderCarbonIcons(current)?.[0] || current;
      }
      return current;
    }

    const placeholder = document.createElement('span');
    placeholder.dataset.carbonIcon = iconName;
    placeholder.dataset.stateIcon = group;
    placeholder.dataset.iconState = state;
    placeholder.setAttribute('aria-hidden', 'true');
    const slotName = current?.getAttribute('slot');
    if (slotName) placeholder.setAttribute('slot', slotName);
    addClassNames(placeholder, className);

    if (current) {
      current.replaceWith(placeholder);
    } else {
      const legacyIcon = container.querySelector('i');
      if (legacyIcon) legacyIcon.replaceWith(placeholder);
      else container.prepend(placeholder);
    }

    return global.SanpoCarbon?.renderCarbonIcons(placeholder)?.[0] || placeholder;
  }

  global.SanpoIconAdapter = Object.freeze({ setIcon, setStateIcon });
})(window);
