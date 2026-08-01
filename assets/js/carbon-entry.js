import '@carbon/web-components/es/components/button/index.js';
import '@carbon/web-components/es/components/icon-button/index.js';

import Add20 from '@carbon/icons/es/add/20.js';
import Calculator32 from '@carbon/icons/es/calculator/32.js';
import Car32 from '@carbon/icons/es/car/32.js';
import Close20 from '@carbon/icons/es/close/20.js';
import Edit20 from '@carbon/icons/es/edit/20.js';
import Link20 from '@carbon/icons/es/link/20.js';
import Menu20 from '@carbon/icons/es/menu/20.js';
import OverflowMenuHorizontal20 from '@carbon/icons/es/overflow-menu--horizontal/20.js';
import Receipt20 from '@carbon/icons/es/receipt/20.js';
import Table20 from '@carbon/icons/es/table/20.js';
import UserMultiple32 from '@carbon/icons/es/user--multiple/32.js';

const ICONS = Object.freeze({
  add: Add20,
  calculator: Calculator32,
  car: Car32,
  close: Close20,
  edit: Edit20,
  link: Link20,
  menu: Menu20,
  'overflow-menu-horizontal': OverflowMenuHorizontal20,
  receipt: Receipt20,
  table: Table20,
  'user-multiple': UserMultiple32
});

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function createIconElement(definition) {
  const node = document.createElementNS(SVG_NAMESPACE, definition.elem);
  Object.entries(definition.attrs || {}).forEach(([name, value]) => {
    node.setAttribute(name, String(value));
  });
  (definition.content || []).forEach(child => node.appendChild(createIconElement(child)));
  return node;
}

function renderCarbonIcon(placeholder) {
  const name = placeholder.dataset.carbonIcon;
  const definition = ICONS[name];
  if (!definition) {
    console.warn(`Unknown Carbon icon: ${name}`);
    return null;
  }

  const icon = createIconElement(definition);
  icon.classList.add('carbon-icon');
  placeholder.classList.forEach(className => icon.classList.add(className));
  icon.dataset.carbonIconName = name;
  icon.setAttribute('focusable', 'false');
  icon.setAttribute('aria-hidden', placeholder.getAttribute('aria-hidden') || 'true');
  ['id', 'slot'].forEach(attribute => {
    const value = placeholder.getAttribute(attribute);
    if (value) icon.setAttribute(attribute, value);
  });
  placeholder.replaceWith(icon);
  return icon;
}

function renderCarbonIcons(root = document) {
  const placeholders = [];
  if (root.nodeType === Node.ELEMENT_NODE && root.matches('[data-carbon-icon]')) placeholders.push(root);
  root.querySelectorAll?.('[data-carbon-icon]').forEach(node => placeholders.push(node));
  return placeholders.map(renderCarbonIcon).filter(Boolean);
}

function observeGeneratedIcons() {
  const observer = new MutationObserver(records => {
    records.forEach(record => {
      record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) renderCarbonIcons(node);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}

function startCarbonRuntime() {
  renderCarbonIcons(document);
  const iconObserver = observeGeneratedIcons();
  const versions = Object.freeze({
    webComponents: __CARBON_WEB_COMPONENTS_VERSION__,
    icons: __CARBON_ICONS_VERSION__,
    plexSans: __IBM_PLEX_SANS_VERSION__,
    plexSansJp: __IBM_PLEX_SANS_JP_VERSION__
  });
  window.SanpoCarbon = Object.freeze({ iconObserver, renderCarbonIcons, versions });
  document.documentElement.dataset.carbonReady = 'true';
  document.dispatchEvent(new CustomEvent('sanpo:carbon-ready', { detail: versions }));
}

if (document.body) startCarbonRuntime();
else document.addEventListener('DOMContentLoaded', startCarbonRuntime, { once: true });
