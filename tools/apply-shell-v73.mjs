import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, content) => fs.writeFileSync(path.join(root, rel), content.endsWith('\n') ? content : `${content}\n`, 'utf8');

function replaceOnce(rel, before, after) {
  const source = read(rel);
  if (!source.includes(before)) throw new Error(`${rel}: replacement anchor not found`);
  if (source.indexOf(before) !== source.lastIndexOf(before)) throw new Error(`${rel}: replacement anchor is not unique`);
  write(rel, source.replace(before, after));
}

function replaceRange(rel, startMarker, endMarker, replacement) {
  const source = read(rel);
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) throw new Error(`${rel}: range anchors not found`);
  write(rel, `${source.slice(0, start)}${replacement}${source.slice(end)}`);
}

const headerEventsPath = 'assets/js/features/events/02-static-header-events.js';
const shellPrefix = `    const APP_NAVIGATION_LINKS = Object.freeze([
        ['山歩会フォームメイカー', 'https://script.google.com/macros/s/AKfycbwveM99euD8V5dxB6xLPYlpHuIc-KJlaaP8LHffh6ZMQBnAmO6XwX_ijQG-brUgqZmj/exec'],
        ['提出書類作成ツール', 'https://github.com/mutoshiki/sampokai-submission-builder/releases'],
        ['山歩会企画ポータル', 'https://mutoshiki.github.io/sanpokai-kikaku-portal/']
    ]);
    const PROJECT_TITLE_SCROLL_THRESHOLD = 8;
    const PROJECT_TITLE_PULL_THRESHOLD = 16;
    let projectTitlePointerStartY = null;

    function createCarbonShellIconButton(id, label, iconName) {
        const button = document.createElement('cds-icon-button');
        button.id = id;
        button.className = 'app-shell-menu-button';
        button.kind = 'ghost';
        button.size = 'lg';
        button.type = 'button';
        button.setAttribute('aria-label', label);
        button.setAttribute('align', 'bottom-left');
        const icon = document.createElement('span');
        icon.slot = 'icon';
        icon.dataset.carbonIcon = iconName;
        icon.setAttribute('aria-hidden', 'true');
        button.appendChild(icon);
        return button;
    }

    function dispatchRoomTitleInput(roomInput) {
        roomInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }

    function normalizeProjectTitleEditor(editor) {
        const value = String(editor.textContent || '').replace(/[\\r\\n]+/g, '');
        if (!value && editor.childNodes.length) editor.replaceChildren();
        else if (editor.textContent !== value) editor.textContent = value;
        return value;
    }

    function createProjectTitleEditor(roomInput) {
        const editor = document.createElement('div');
        editor.id = 'projectTitleEditor';
        editor.className = 'project-title-editor';
        editor.setAttribute('contenteditable', 'plaintext-only');
        editor.setAttribute('role', 'textbox');
        editor.setAttribute('aria-label', '企画名');
        editor.setAttribute('aria-placeholder', '企画名を入力');
        editor.setAttribute('aria-multiline', 'false');
        editor.setAttribute('data-placeholder', '企画名を入力');
        editor.setAttribute('spellcheck', 'false');
        editor.tabIndex = 0;

        const syncFromSource = () => {
            if (document.activeElement === editor) return;
            const next = String(roomInput.value || '');
            if (editor.textContent !== next) editor.textContent = next;
            if (!next && editor.childNodes.length) editor.replaceChildren();
        };
        const syncToSource = () => {
            const next = normalizeProjectTitleEditor(editor);
            if (roomInput.value !== next) roomInput.value = next;
            roomInput.setAttribute('value', next);
            dispatchRoomTitleInput(roomInput);
        };

        editor.addEventListener('beforeinput', event => {
            if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') event.preventDefault();
        });
        editor.addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            editor.blur();
        });
        editor.addEventListener('input', event => {
            if (!event.isComposing) syncToSource();
        });
        editor.addEventListener('compositionend', syncToSource);
        editor.addEventListener('blur', syncFromSource);

        new MutationObserver(syncFromSource).observe(roomInput, { attributes: true, attributeFilter: ['value'] });
        syncFromSource();
        return editor;
    }

    function ensureProjectTitleRegion(brand) {
        const roomField = brand.querySelector('.app-room-field');
        const roomInput = byId('roomNameInput');
        const header = byId('app-header');
        if (!roomField || !roomInput || !header) return;

        let region = byId('projectTitleRegion');
        if (!region) {
            region = document.createElement('section');
            region.id = 'projectTitleRegion';
            region.className = 'project-title-region';
            region.dataset.state = 'expanded';
            region.setAttribute('aria-label', '企画名');
            header.insertAdjacentElement('afterend', region);
        }

        let editor = byId('projectTitleEditor');
        if (!editor) {
            editor = createProjectTitleEditor(roomInput);
            region.appendChild(editor);
        }

        roomField.classList.add('project-title-source');
        roomField.setAttribute('aria-hidden', 'true');
        roomInput.tabIndex = -1;
        roomInput.setAttribute('aria-hidden', 'true');
        region.appendChild(roomField);
        setProjectTitleExpanded(true);
    }

    function ensureCarbonShellHeader() {
        const main = document.querySelector('#app-header .app-header-main');
        const brand = main?.querySelector('.app-brand');
        const actions = main?.querySelector('.header-actions');
        if (!main || !brand || !actions) return;

        let navigationButton = byId('overviewMenuBtn');
        if (!navigationButton) {
            navigationButton = createCarbonShellIconButton('overviewMenuBtn', 'ナビゲーションを開く', 'menu');
            main.insertBefore(navigationButton, brand);
        }
        navigationButton.setAttribute('aria-controls', 'overviewDrawer');
        navigationButton.setAttribute('aria-expanded', 'false');

        let title = brand.querySelector('.app-brand-title');
        if (!title) {
            title = document.createElement('span');
            title.className = 'app-brand-title';
            title.textContent = 'サークル企画ツール';
            brand.prepend(title);
        }

        ensureProjectTitleRegion(brand);

        const headerMore = actions.querySelector('.header-more');
        const overflow = headerMore?.querySelector('cds-overflow-menu');
        const menu = overflow?.querySelector('cds-menu');
        const share = byId('shareLinkBtn');

        if (overflow) {
            overflow.classList.add('header-app-switcher');
            overflow.setAttribute('label', 'アプリメニュー');
            overflow.setAttribute('aria-label', 'アプリメニュー');
            overflow.setAttribute('align', 'bottom-end');
            overflow.querySelector('[slot="icon"]')?.remove();
            if (!overflow.querySelector('[data-carbon-icon="switcher"]')) {
                const glyph = document.createElement('span');
                glyph.className = 'app-switcher-icon';
                glyph.slot = 'icon';
                glyph.dataset.carbonIcon = 'switcher';
                glyph.setAttribute('aria-hidden', 'true');
                overflow.prepend(glyph);
            }
        }

        if (menu) {
            const guide = byId('userGuideBtn');
            const sample = byId('sampleDataBtn');
            const theme = byId('themeToggleBtn');
            const currentLock = byId('editLockBtn');
            let lockItem = currentLock?.tagName === 'CDS-MENU-ITEM' ? currentLock : null;
            if (!lockItem) {
                lockItem = document.createElement('cds-menu-item');
                lockItem.id = 'editLockBtn';
                lockItem.setAttribute('label', 'ロック');
                lockItem.innerHTML = '<span data-carbon-icon="unlocked" data-state-icon="editLock" data-icon-state="unlocked" slot="render-icon" aria-hidden="true"></span>';
                currentLock?.remove();
            }
            [guide, sample, theme, lockItem].filter(Boolean).forEach(item => menu.appendChild(item));
        }

        if (share && headerMore) actions.replaceChildren(share, headerMore);
        global.SanpoCarbon?.renderCarbonIcons?.(main);
    }

`;
replaceRange(headerEventsPath, '    function createCarbonShellIconButton', '    function readCurrentShellView()', shellPrefix);

const drawerBlock = `    function setProjectTitleExpanded(expanded) {
        const region = byId('projectTitleRegion');
        const editor = byId('projectTitleEditor');
        if (!region || !editor) return;
        const nextState = expanded ? 'expanded' : 'collapsed';
        if (region.dataset.state === nextState) return;
        if (!expanded && document.activeElement === editor) editor.blur();
        region.dataset.state = nextState;
        editor.inert = !expanded;
        editor.tabIndex = expanded ? 0 : -1;
    }

    function getActiveProjectTitleScrollNodes() {
        if (document.body.classList.contains('view-mode-sheet')) {
            return [byId('sheet-view-area'), byId('sheet-canvas')].filter(Boolean);
        }
        if (document.body.classList.contains('view-mode-seisan')) return [byId('seisan-view-area')].filter(Boolean);
        return [byId('top-area')].filter(Boolean);
    }

    function getActiveProjectTitleScrollTop() {
        return Math.max(0, ...getActiveProjectTitleScrollNodes().map(node => Number(node.scrollTop || 0)));
    }

    function setupProjectTitleReveal() {
        if (document.documentElement.dataset.projectTitleRevealBound === 'true') return;
        document.documentElement.dataset.projectTitleRevealBound = 'true';
        const scrollNodes = [byId('top-area'), byId('sheet-view-area'), byId('sheet-canvas'), byId('seisan-view-area')].filter(Boolean);
        scrollNodes.forEach(node => node.addEventListener('scroll', () => {
            if (Number(node.scrollTop || 0) > PROJECT_TITLE_SCROLL_THRESHOLD) setProjectTitleExpanded(false);
        }, { passive: true }));

        document.addEventListener('wheel', event => {
            if (event.deltaY < -PROJECT_TITLE_SCROLL_THRESHOLD && getActiveProjectTitleScrollTop() <= 0) setProjectTitleExpanded(true);
        }, { passive: true });
        document.addEventListener('pointerdown', event => {
            if (event.pointerType === 'touch') projectTitlePointerStartY = event.clientY;
        }, { passive: true });
        document.addEventListener('pointermove', event => {
            if (event.pointerType !== 'touch' || projectTitlePointerStartY === null) return;
            if (getActiveProjectTitleScrollTop() <= 0 && event.clientY - projectTitlePointerStartY >= PROJECT_TITLE_PULL_THRESHOLD) {
                setProjectTitleExpanded(true);
                projectTitlePointerStartY = event.clientY;
            }
        }, { passive: true });
        ['pointerup', 'pointercancel'].forEach(type => document.addEventListener(type, () => {
            projectTitlePointerStartY = null;
        }, { passive: true }));
        document.addEventListener('keydown', event => {
            if (!['ArrowUp', 'PageUp', 'Home'].includes(event.key)) return;
            if (getActiveProjectTitleScrollTop() <= 0) setProjectTitleExpanded(true);
        });
    }

    function createAppNavigationDrawer() {
        const drawer = byId('overviewDrawer');
        const scrim = byId('overviewDrawerScrim');
        if (!drawer || !scrim) return null;
        drawer.className = 'app-nav-drawer';
        drawer.setAttribute('aria-hidden', 'true');
        drawer.setAttribute('aria-label', '山歩会ツール');
        scrim.className = 'app-nav-drawer-scrim';

        const nav = document.createElement('nav');
        nav.className = 'app-nav-drawer-nav';
        nav.setAttribute('aria-label', '山歩会ツール');
        const list = document.createElement('ul');
        list.className = 'app-nav-drawer-list';
        APP_NAVIGATION_LINKS.forEach(([label, href]) => {
            const item = document.createElement('li');
            const link = document.createElement('a');
            link.className = 'app-nav-link';
            link.href = href;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = label;
            item.appendChild(link);
            list.appendChild(item);
        });
        nav.appendChild(list);
        drawer.replaceChildren(nav);
        return drawer;
    }

    function setAppNavigationDrawerOpen(open, { restoreFocus = false } = {}) {
        const drawer = byId('overviewDrawer');
        const scrim = byId('overviewDrawerScrim');
        const trigger = byId('overviewMenuBtn');
        if (!drawer || !scrim || !trigger) return;
        drawer.classList.toggle('is-open', open);
        drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        trigger.setAttribute('aria-label', open ? 'ナビゲーションを閉じる' : 'ナビゲーションを開く');
        scrim.hidden = !open;
        document.body.classList.toggle('app-nav-drawer-open', open);
        if (open) queueMicrotask(() => drawer.querySelector('.app-nav-link')?.focus());
        else if (restoreFocus) queueMicrotask(() => trigger.focus());
    }

    function setupAppNavigationDrawer() {
        const drawer = createAppNavigationDrawer();
        if (!drawer) return;
        bind('overviewMenuBtn', () => setAppNavigationDrawerOpen(drawer.getAttribute('aria-hidden') !== 'true'));
        bind('overviewDrawerScrim', () => setAppNavigationDrawerOpen(false, { restoreFocus: true }));
        drawer.addEventListener('click', event => {
            if (event.target.closest?.('.app-nav-link')) setAppNavigationDrawerOpen(false);
        });
        if (document.body.dataset.appNavigationEscapeBound !== 'true') {
            document.body.dataset.appNavigationEscapeBound = 'true';
            document.addEventListener('keydown', event => {
                if (event.key === 'Escape' && drawer.getAttribute('aria-hidden') === 'false') {
                    setAppNavigationDrawerOpen(false, { restoreFocus: true });
                }
            });
        }
    }

`;
replaceRange(headerEventsPath, '    function setOverviewDrawerOpen', '    function setupStaticHeaderEvents()', drawerBlock);
replaceOnce(headerEventsPath, '        setupOverviewMenuFields();', '        setupAppNavigationDrawer();\n        setupProjectTitleReveal();');

write('assets/css/app-shell/header/01-header-base.css', `/* Carbon UI shell header, page-title reveal, and app navigation. */
#app-header {
  position: relative;
  z-index: var(--z-header);
  display: grid;
  flex: 0 0 auto;
  order: 0;
  gap: 0;
  width: 100%;
  min-width: 0;
  padding-top: env(safe-area-inset-top);
  border: 0;
  background: #161616;
  color: #f4f4f4;
  box-shadow: inset 0 -1px #393939;
  backdrop-filter: none;
  --cds-background: #161616;
  --cds-background-hover: #262626;
  --cds-background-active: #393939;
  --cds-layer: #262626;
  --cds-layer-01: #262626;
  --cds-layer-02: #393939;
  --cds-text-primary: #f4f4f4;
  --cds-text-secondary: #c6c6c6;
  --cds-icon-primary: #f4f4f4;
  --cds-icon-secondary: #c6c6c6;
  --cds-border-subtle: #393939;
  --cds-border-interactive: #0f62fe;
  --cds-focus: #0f62fe;
}

.app-header-main {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0;
  width: 100%;
  max-width: none;
  min-width: 0;
  min-height: 48px;
  margin: 0;
  padding: 0;
  background: #161616;
}

.app-shell-menu-button {
  flex: 0 0 48px;
  width: 48px;
  min-width: 48px;
  height: 48px;
  min-height: 48px;
  color: #f4f4f4;
  --cds-icon-primary: #f4f4f4;
}

#overviewMenuBtn.app-shell-menu-button,
#overviewMenuBtn.app-shell-menu-button > :is([slot="icon"], .carbon-icon),
#overviewMenuBtn.app-shell-menu-button::part(button) {
  color: #f4f4f4;
  --cds-icon-primary: #f4f4f4;
  --cds-link-primary: #f4f4f4;
}

.app-header-main > .app-brand {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  min-width: 0;
  min-height: 48px;
  padding-inline: 16px;
}

.app-brand-title {
  flex: 0 0 auto;
  min-width: 0;
  overflow: hidden;
  color: #f4f4f4;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.2857;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-header-main > .header-actions {
  flex: 0 0 auto;
  width: auto;
  margin: 0 0 0 auto;
}

.project-title-region {
  position: relative;
  z-index: var(--z-view-navigation);
  box-sizing: border-box;
  display: flex;
  flex: 0 0 auto;
  order: 1;
  align-items: flex-end;
  width: 100%;
  height: 256px;
  min-height: 0;
  padding: 0 32px 32px;
  overflow: hidden;
  background: #000000;
  color: #f4f4f4;
  box-shadow: inset 0 -1px #393939;
  transition: height var(--motion-medium) cubic-bezier(0.2, 0, 0.38, 0.9), padding-block var(--motion-medium) cubic-bezier(0.2, 0, 0.38, 0.9);
  --cds-focus: #0f62fe;
}

.project-title-region[data-state="collapsed"] {
  height: 0;
  padding-block: 0;
}

.app-nav-drawer-scrim {
  position: fixed;
  top: calc(env(safe-area-inset-top) + 48px);
  right: 0;
  bottom: 0;
  left: 0;
  z-index: var(--z-modal-backdrop);
  background: rgba(var(--black-rgb), 0.42);
}

.app-nav-drawer {
  position: fixed;
  top: calc(env(safe-area-inset-top) + 48px);
  bottom: 0;
  left: 0;
  z-index: var(--z-modal);
  width: min(256px, calc(100vw - 48px));
  overflow-y: auto;
  background: #161616;
  color: #f4f4f4;
  box-shadow: 2px 0 6px rgba(var(--black-rgb), 0.3);
  visibility: hidden;
  transform: translateX(-100%);
  pointer-events: none;
  transition: transform var(--motion-medium) cubic-bezier(0.2, 0, 0.38, 0.9), visibility 0s linear var(--motion-medium);
}

.app-nav-drawer.is-open {
  visibility: visible;
  transform: translateX(0);
  pointer-events: auto;
  transition-delay: 0s;
}

.app-nav-drawer-nav,
.app-nav-drawer-list {
  width: 100%;
  margin: 0;
  padding: 0;
}

.app-nav-drawer-list { list-style: none; }

.app-nav-link {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 48px;
  padding: 0 16px;
  color: #c6c6c6;
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.2857;
  text-decoration: none;
}

.app-nav-link:hover { background: #262626; color: #f4f4f4; }
.app-nav-link:active { background: #393939; color: #f4f4f4; }
.app-nav-link:focus-visible { outline: 2px solid #ffffff; outline-offset: -2px; }
body.app-nav-drawer-open { overflow: hidden; }

@media (max-width: 768px) {
  .project-title-region {
    height: 240px;
    padding: 0 16px 24px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .project-title-region,
  .app-nav-drawer { transition: none; }
}
`);

write('assets/css/app-shell/header/02-room-status.css', `/* Project-title editor and transient save/sync status. */
.app-room-control {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  min-width: 0;
}

/* The original Carbon text input remains the persistence source for roomName.
 * It is visually hidden after the shell creates the editable page-title view. */
.app-room-field,
.project-title-source {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  pointer-events: none;
}

.app-room-kicker { display: none; }
.app-room-input { width: 1px; min-width: 1px; min-height: 1px; opacity: 0; pointer-events: none; }

.project-title-editor {
  box-sizing: border-box;
  width: min(100%, 960px);
  min-width: 0;
  min-height: 64px;
  padding: 0 0 8px;
  overflow: hidden;
  outline: 0;
  color: #f4f4f4;
  font-size: 3.375rem;
  font-weight: 300;
  line-height: 1.05;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;
}

.project-title-editor:empty::before {
  color: #8d8d8d;
  content: attr(data-placeholder);
  pointer-events: none;
}

.project-title-editor:focus-visible {
  outline: 2px solid #0f62fe;
  outline-offset: 2px;
}

/* Save/sync feedback stays a short-lived status announcement in the shell. */
.sync-status-badge {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  max-width: calc(100% - 16px);
  min-height: 24px;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transform: translate(-50%, -50%) translateY(-2px);
  transition: opacity var(--motion-fast) ease, transform var(--motion-fast) ease, visibility 0s linear var(--motion-fast);
  --cds-layer: #393939;
}

.sync-status-badge.is-visible {
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, -50%);
  transition-delay: 0s;
}

.sync-status-label {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

#appUndoBar {
  position: fixed;
  left: 50%;
  bottom: 16px;
  z-index: var(--z-drag);
  display: inline-flex;
  align-items: center;
  gap: 12px;
  max-width: min(92vw, 520px);
  padding: 10px 10px 10px 16px;
  border-radius: 0;
  background: var(--text-main);
  color: var(--surface-lowest);
  box-shadow: var(--shadow-float);
  font-size: 0.82rem;
  font-weight: 600;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 18px);
  transition: opacity var(--motion-medium) ease, transform var(--motion-medium) ease;
}

#appUndoBar.visible { opacity: 1; pointer-events: auto; transform: translate(-50%, 0); }

#appUndoBar cds-button {
  min-height: 40px;
  --cds-button-ghost: transparent;
  --cds-button-ghost-hover: rgba(var(--white-rgb), 0.14);
  --cds-button-ghost-color: currentColor;
}

@media (max-width: 768px) {
  .project-title-editor {
    min-height: 56px;
    padding-bottom: 8px;
    font-size: 2.625rem;
    line-height: 1.1;
  }

  .sync-status-badge { width: fit-content; max-width: calc(100% - 16px); }
  .sync-status-badge.is-visible { opacity: 1; visibility: visible; }
}

@media (max-width: 520px) {
  #appUndoBar { width: calc(100vw - 24px); justify-content: space-between; }
}

@media (max-width: 360px) {
  .sync-status-badge {
    position: fixed;
    top: calc(env(safe-area-inset-top) + 104px);
    left: 50%;
    max-width: calc(100vw - 24px);
    transform: translate(-50%, -2px);
  }
  .sync-status-badge.is-visible { transform: translate(-50%, 0); }
}
`);

replaceOnce('assets/css/app-shell/header/03-tabs-actions.css', '  order: 1;\n  flex: 0 0 auto;', '  order: 2;\n  flex: 0 0 auto;');
replaceOnce('assets/css/app-shell/layout/01-app-frame.css', '  order: 2;\n  flex: 1 1 auto;', '  order: 3;\n  flex: 1 1 auto;');
replaceOnce('assets/css/app-shell/layout/01-app-frame.css', '#bottom-tray { order: 3; }', '#bottom-tray { order: 4; }');

write('assets/css/guides-modals/overview/01-overview-drawer.css', `/* The legacy memo/timetable drawer markup is a pre-init compatibility shell only.
 * Header startup replaces it with the Carbon-aligned application navigation. */
.overview-drawer,
.overview-drawer-scrim { display: none; }
`);
write('assets/css/guides-modals/overview/02-overview-mobile.css', `/* Mobile navigation is owned by app-shell/header/01-header-base.css. */
`);

replaceOnce('CSS_OWNER_MAP.md', '| Header shell and layout | `assets/css/app-shell/header/01-header-base.css` |', '| Header shell, page-title reveal and application navigation | `assets/css/app-shell/header/01-header-base.css` and `assets/js/features/events/02-static-header-events.js` |');
replaceOnce('CSS_OWNER_MAP.md', '| Room title and sync status | `assets/css/app-shell/header/02-room-status.css` |', '| Project-title editor, persisted room-title source and sync status | `assets/css/app-shell/header/02-room-status.css` |');
replaceOnce('CSS_OWNER_MAP.md', '| Overview drawer and timetable | `assets/css/guides-modals/overview/` and `assets/js/features/overview-drawer.js` |', '| Legacy overview markup concealment and overview snapshot compatibility | `assets/css/guides-modals/overview/` and `assets/js/features/events/02-static-header-events.js` |');

const existingVisual = read('tests/carbon-complete.visual.spec.js');
if (!existingVisual.includes("expect(shellGeometry.roomInputVisibility).toBe('hidden');")) throw new Error('visual test anchor missing');
write('tests/carbon-complete.visual.spec.js', existingVisual
  .replace("      const roomInput = document.querySelector('#roomNameInput');", "      const roomInput = document.querySelector('#roomNameInput');\n      const projectTitle = document.querySelector('#projectTitleRegion');\n      const projectTitleEditor = document.querySelector('#projectTitleEditor');")
  .replace("        navPosition: getComputedStyle(nav).position,\n        headerBottom: headerRect.bottom,", "        navPosition: getComputedStyle(nav).position,\n        headerBottom: headerRect.bottom,\n        projectTitleTop: projectTitle?.getBoundingClientRect().top ?? -1,\n        projectTitleBottom: projectTitle?.getBoundingClientRect().bottom ?? -1,\n        projectTitleHeight: projectTitle?.getBoundingClientRect().height ?? 0,\n        projectTitleState: projectTitle?.dataset.state || '',\n        projectTitleEditorText: projectTitleEditor?.textContent || '',\n        projectTitlePlaceholder: projectTitleEditor?.dataset.placeholder || '',")
  .replace("        roomInputVisibility: roomInput ? getComputedStyle(roomInput.closest('.app-room-field')).visibility : 'missing',", "        roomInputVisibility: roomInput ? getComputedStyle(roomInput.closest('.app-room-field')).position : 'missing',")
  .replace("    expect(Math.abs(shellGeometry.navTop - shellGeometry.headerBottom)).toBeLessThanOrEqual(1);", "    expect(Math.abs(shellGeometry.projectTitleTop - shellGeometry.headerBottom)).toBeLessThanOrEqual(1);\n    expect(Math.abs(shellGeometry.navTop - shellGeometry.projectTitleBottom)).toBeLessThanOrEqual(1);\n    expect(shellGeometry.projectTitleHeight).toBeGreaterThanOrEqual(200);\n    expect(shellGeometry.projectTitleState).toBe('expanded');\n    expect(shellGeometry.projectTitleEditorText).toBe('秋名山登山企画');\n    expect(shellGeometry.projectTitlePlaceholder).toBe('企画名を入力');")
  .replace("    expect(shellGeometry.roomInputVisibility).toBe('hidden');", "    expect(shellGeometry.roomInputVisibility).toBe('absolute');")
  .replace("    await page.locator('#tab-team').evaluate(node => node.click());", "    await page.locator('#top-area').evaluate(node => { node.scrollTop = 64; node.dispatchEvent(new Event('scroll')); });\n    await expect(page.locator('#projectTitleRegion')).toHaveAttribute('data-state', 'collapsed');\n    await page.locator('#top-area').evaluate(node => { node.scrollTop = 0; node.dispatchEvent(new Event('scroll')); });\n    await expect(page.locator('#projectTitleRegion')).toHaveAttribute('data-state', 'collapsed');\n    await page.dispatchEvent('#top-area', 'wheel', { deltaY: -120 });\n    await expect(page.locator('#projectTitleRegion')).toHaveAttribute('data-state', 'expanded');\n\n    await page.locator('#tab-team').evaluate(node => node.click());"));

const completeSpec = read('tests/carbon-complete.spec.js');
write('tests/carbon-complete.spec.js', completeSpec
  .replace("test('primary views, theme, navigation and overview remain operable'", "test('primary views, theme, navigation and app drawer remain operable'")
  .replace("      await hostClick(page, '#overviewDrawerCloseBtn');\n      await expect(page.locator('#overviewDrawer')).toHaveAttribute('aria-hidden', 'true');", "      await hostClick(page, '#overviewMenuBtn');\n      await expect(page.locator('#overviewDrawer')).toHaveAttribute('aria-hidden', 'false');\n      await expect(page.locator('#overviewDrawer .app-nav-link')).toHaveCount(3);\n      await page.keyboard.press('Escape');\n      await expect(page.locator('#overviewDrawer')).toHaveAttribute('aria-hidden', 'true');")
  .replace("  test('mobile sync status temporarily overlays the room-name field'", "  test('mobile sync status temporarily overlays the product-title slot'")
  .replace("      const inputBox = document.querySelector('#roomNameInput')?.getBoundingClientRect();\n      return { badgeBox, inputBox };", "      const brandBox = document.querySelector('.app-brand')?.getBoundingClientRect();\n      return { badgeBox, brandBox };")
  .replace("    expect(bounds.badgeBox.width).toBeLessThan(bounds.inputBox.width);\n    expect(Math.abs((bounds.badgeBox.left + bounds.badgeBox.right) / 2 - (bounds.inputBox.left + bounds.inputBox.right) / 2)).toBeLessThanOrEqual(1);\n    expect(bounds.badgeBox.top).toBeGreaterThanOrEqual(bounds.inputBox.top - 1);\n    expect(bounds.badgeBox.bottom).toBeLessThanOrEqual(bounds.inputBox.bottom + 1);", "    expect(bounds.badgeBox.width).toBeLessThan(bounds.brandBox.width);\n    expect(Math.abs((bounds.badgeBox.left + bounds.badgeBox.right) / 2 - (bounds.brandBox.left + bounds.brandBox.right) / 2)).toBeLessThanOrEqual(1);\n    expect(bounds.badgeBox.top).toBeGreaterThanOrEqual(bounds.brandBox.top - 1);\n    expect(bounds.badgeBox.bottom).toBeLessThanOrEqual(bounds.brandBox.bottom + 1);"));

write('tests/shell-project-title-navigation-v73-contract.mjs', `import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const html = read('index.html');
const js = read('assets/js/features/events/02-static-header-events.js');
const header = read('assets/css/app-shell/header/01-header-base.css');
const room = read('assets/css/app-shell/header/02-room-status.css');

assert.match(html, /id="roomNameInput"[^>]*placeholder="企画名を入力"/);
assert.match(js, /projectTitleEditor/);
assert.match(js, /data-placeholder', '企画名を入力'/);
assert.match(js, /PROJECT_TITLE_SCROLL_THRESHOLD = 8/);
assert.match(js, /PROJECT_TITLE_PULL_THRESHOLD = 16/);
assert.match(js, /setProjectTitleExpanded\(false\)/);
assert.match(js, /event\.pointerType === 'touch'/);
assert.match(js, /event\.deltaY < -PROJECT_TITLE_SCROLL_THRESHOLD/);
assert.match(js, /drawer\.replaceChildren\(nav\)/);
assert.doesNotMatch(js, /setupOverviewMenuFields\(\);/);
for (const [label, url] of [
  ['山歩会フォームメイカー', 'https://script.google.com/macros/s/AKfycbwveM99euD8V5dxB6xLPYlpHuIc-KJlaaP8LHffh6ZMQBnAmO6XwX_ijQG-brUgqZmj/exec'],
  ['提出書類作成ツール', 'https://github.com/mutoshiki/sampokai-submission-builder/releases'],
  ['山歩会企画ポータル', 'https://mutoshiki.github.io/sanpokai-kikaku-portal/']
]) {
  assert.ok(js.includes(label), label);
  assert.ok(js.includes(url), url);
}
assert.match(header, /height:\s*256px/);
assert.match(header, /max-width:\s*768px[\s\S]*height:\s*240px/);
assert.match(header, /\.app-nav-link[\s\S]*min-height:\s*48px/);
assert.match(header, /\.app-nav-link:focus-visible/);
assert.match(room, /\.project-title-editor:empty::before[\s\S]*content:\s*attr\(data-placeholder\)/);
assert.doesNotMatch(header + '\\n' + room, /!important/);
console.log('PASS shell project title and application navigation contract');
`);

write('tests/shell-project-title-navigation-v73.spec.js', `import { test, expect } from '@playwright/test';

const expectedLinks = [
  ['山歩会フォームメイカー', 'https://script.google.com/macros/s/AKfycbwveM99euD8V5dxB6xLPYlpHuIc-KJlaaP8LHffh6ZMQBnAmO6XwX_ijQG-brUgqZmj/exec'],
  ['提出書類作成ツール', 'https://github.com/mutoshiki/sampokai-submission-builder/releases'],
  ['山歩会企画ポータル', 'https://mutoshiki.github.io/sanpokai-kikaku-portal/']
];

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(String(viewport.width) + 'px title reveal and application navigation', async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('#projectTitleEditor') && customElements.get('cds-icon-button'));

    const title = page.locator('#projectTitleRegion');
    const editor = page.locator('#projectTitleEditor');
    await expect(title).toHaveAttribute('data-state', 'expanded');
    await expect(editor).toHaveAttribute('data-placeholder', '企画名を入力');
    await expect(title.locator('.carbon-icon,[data-carbon-icon]')).toHaveCount(0);
    expect((await editor.textContent())?.trim()).toBe('');

    await editor.click();
    await page.keyboard.type('紅葉ハイク');
    await expect.poll(() => page.locator('#roomNameInput').evaluate(node => node.value)).toBe('紅葉ハイク');
    expect((await editor.textContent())?.trim()).toBe('紅葉ハイク');

    await page.locator('#top-area').evaluate(node => {
      node.scrollTop = 80;
      node.dispatchEvent(new Event('scroll'));
    });
    await expect(title).toHaveAttribute('data-state', 'collapsed');
    expect(await title.evaluate(node => node.getBoundingClientRect().height)).toBeLessThanOrEqual(1);

    await page.locator('#top-area').evaluate(node => {
      node.scrollTop = 0;
      node.dispatchEvent(new Event('scroll'));
    });
    await expect(title).toHaveAttribute('data-state', 'collapsed');

    if (viewport.width <= 390) {
      await page.dispatchEvent('#top-area', 'pointerdown', { pointerType: 'touch', clientY: 120, pointerId: 1, isPrimary: true });
      await page.dispatchEvent('#top-area', 'pointermove', { pointerType: 'touch', clientY: 152, pointerId: 1, isPrimary: true });
      await page.dispatchEvent('#top-area', 'pointerup', { pointerType: 'touch', clientY: 152, pointerId: 1, isPrimary: true });
    } else {
      await page.dispatchEvent('#top-area', 'wheel', { deltaY: -120 });
    }
    await expect(title).toHaveAttribute('data-state', 'expanded');

    const menu = page.locator('#overviewMenuBtn');
    await menu.click();
    const drawer = page.locator('#overviewDrawer');
    await expect(drawer).toHaveAttribute('aria-hidden', 'false');
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#overviewMemoInput')).toHaveCount(0);
    await expect(page.locator('#overviewTimetableRows')).toHaveCount(0);
    const actualLinks = await drawer.locator('.app-nav-link').evaluateAll(links => links.map(link => [link.textContent.trim(), link.href, link.target, link.rel]));
    expect(actualLinks).toEqual(expectedLinks.map(([label, href]) => [label, href, '_blank', 'noopener noreferrer']));
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');

    for (const theme of ['light', 'dark']) {
      await page.evaluate(next => window.SanpoTheme.applyTheme(next), theme);
      await expect(editor).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy();
    }
    expect(errors).toEqual([]);
  });
}
`);

replaceOnce('package.json', 'node tests/shared-touch-scroll-v72-contract.mjs && node tests/five-device-domain-sync-v46.mjs', 'node tests/shared-touch-scroll-v72-contract.mjs && node tests/shell-project-title-navigation-v73-contract.mjs && node tests/five-device-domain-sync-v46.mjs');
replaceOnce('package.json', '    \"test:ui\": \"playwright test tests/carbon-complete.spec.js tests/shared-touch-scroll-v72.spec.js\",', '    \"test:ui\": \"playwright test tests/carbon-complete.spec.js tests/shared-touch-scroll-v72.spec.js tests/shell-project-title-navigation-v73.spec.js\",');

console.log('Applied Carbon project-title reveal and application-navigation v73 changes.');
