import '@carbon/web-components/es/components/button/index.js';
import '@carbon/web-components/es/components/icon-button/index.js';

import Add20 from '@carbon/icons/es/add/20.js';
import Calculator32 from '@carbon/icons/es/calculator/32.js';
import Car20 from '@carbon/icons/es/car/20.js';
import Car32 from '@carbon/icons/es/car/32.js';
import ChevronDown20 from '@carbon/icons/es/chevron--down/20.js';
import ChevronUp20 from '@carbon/icons/es/chevron--up/20.js';
import Close20 from '@carbon/icons/es/close/20.js';
import Copy20 from '@carbon/icons/es/copy/20.js';
import Edit20 from '@carbon/icons/es/edit/20.js';
import Help20 from '@carbon/icons/es/help/20.js';
import Idea20 from '@carbon/icons/es/idea/20.js';
import Information20 from '@carbon/icons/es/information/20.js';
import Link20 from '@carbon/icons/es/link/20.js';
import Locked20 from '@carbon/icons/es/locked/20.js';
import MagicWand20 from '@carbon/icons/es/magic-wand/20.js';
import Menu20 from '@carbon/icons/es/menu/20.js';
import Moon20 from '@carbon/icons/es/moon/20.js';
import OverflowMenuHorizontal20 from '@carbon/icons/es/overflow-menu--horizontal/20.js';
import RecentlyViewed20 from '@carbon/icons/es/recently-viewed/20.js';
import Receipt20 from '@carbon/icons/es/receipt/20.js';
import Roadmap20 from '@carbon/icons/es/roadmap/20.js';
import SettingsAdjust20 from '@carbon/icons/es/settings--adjust/20.js';
import Sun20 from '@carbon/icons/es/sun/20.js';
import Table20 from '@carbon/icons/es/table/20.js';
import Task20 from '@carbon/icons/es/task/20.js';
import Touch120 from '@carbon/icons/es/touch--1/20.js';
import TrashCan20 from '@carbon/icons/es/trash-can/20.js';
import Unlocked20 from '@carbon/icons/es/unlocked/20.js';
import UserMultiple32 from '@carbon/icons/es/user--multiple/32.js';

const ICONS = Object.freeze({
  add: Add20,
  calculator: Calculator32,
  car: Car32,
  'car-small': Car20,
  'chevron--down': ChevronDown20,
  'chevron--up': ChevronUp20,
  close: Close20,
  copy: Copy20,
  edit: Edit20,
  help: Help20,
  idea: Idea20,
  information: Information20,
  link: Link20,
  locked: Locked20,
  'magic-wand': MagicWand20,
  menu: Menu20,
  moon: Moon20,
  'overflow-menu-horizontal': OverflowMenuHorizontal20,
  'recently-viewed': RecentlyViewed20,
  receipt: Receipt20,
  roadmap: Roadmap20,
  'settings--adjust': SettingsAdjust20,
  sun: Sun20,
  table: Table20,
  task: Task20,
  'touch--1': Touch120,
  'trash-can': TrashCan20,
  unlocked: Unlocked20,
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
  ['id', 'slot', 'data-state-icon', 'data-icon-state'].forEach(attribute => {
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
