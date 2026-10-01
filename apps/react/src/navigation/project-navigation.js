import { prepareCompatibleUrl } from '../services/url-compat.js';

export const PROJECT_SECTIONS = Object.freeze([
  'overview',
  'participants',
  'organization-car',
  'organization-team',
  'settlement',
  'history-settings',
]);

const SECTION_SET = new Set(PROJECT_SECTIONS);
export const DEFAULT_PROJECT_SECTION = 'participants';

export function readProjectSection(href) {
  const url = new URL(href);
  const requested = String(url.searchParams.get('section') || '');
  if (SECTION_SET.has(requested)) return requested;

  const legacyView = url.searchParams.get('view');
  if (legacyView === 'participants') return 'participants';
  if (legacyView === 'seisan') return 'settlement';
  if (legacyView === 'sheet') {
    return url.searchParams.get('allocation') === 'team' ? 'organization-team' : 'organization-car';
  }
  return DEFAULT_PROJECT_SECTION;
}

export function createProjectSectionUrl(href, section) {
  if (!SECTION_SET.has(section)) throw new Error(`Unknown project section: ${section}`);
  const url = new URL(href);
  url.searchParams.set('section', section);
  url.searchParams.delete('view');
  url.searchParams.delete('allocation');
  url.searchParams.delete('task');
  url.hash = '';
  return url.toString();
}

export function prepareProjectLaunch(options) {
  const requestedUrl = new URL(options.location.href);
  const initialSection = readProjectSection(requestedUrl.href);
  const launch = prepareCompatibleUrl(options);
  const removedLegacySection = requestedUrl.searchParams.get('view') === 'sheet' || requestedUrl.searchParams.has('allocation');
  if (!removedLegacySection) return { ...launch, initialSection };

  const href = createProjectSectionUrl(launch.href, initialSection);
  const canonical = new URL(href);
  const next = `${canonical.pathname}${canonical.search}${canonical.hash}`;
  const current = new URL(options.location.href);
  if (`${current.pathname}${current.search}${current.hash}` !== next) {
    options.history.replaceState(options.history.state || null, '', next);
  }
  return { ...launch, href, initialSection };
}

export function createProjectNavigation({ location, history, eventTarget }) {
  const getSnapshot = () => readProjectSection(location.href);
  const getTaskSnapshot = () => {
    const task = new URL(location.href).searchParams.get('task');
    return getSnapshot() === 'participants' && ['import', 'announcement'].includes(task) ? task : '';
  };
  function push(href, section) {
    const current = new URL(location.href);
    if (`${current.pathname}${current.search}${current.hash}` === href) return false;
    history.pushState({ ...(history.state || {}), projectSection: section }, '', href);
    eventTarget?.dispatchEvent(new Event('sanpo:sectionchange'));
    return true;
  }
  return Object.freeze({
    getSnapshot,
    getTaskSnapshot,
    hrefFor(section) {
      const url = new URL(createProjectSectionUrl(location.href, section));
      return `${url.pathname}${url.search}${url.hash}`;
    },
    navigate(section) {
      const href = this.hrefFor(section);
      if (section === getSnapshot() && !new URL(location.href).searchParams.has('task')) return false;
      return push(href, section);
    },
    taskHrefFor(task) {
      if (!['', 'import', 'announcement'].includes(task)) throw new Error(`Unknown participant task: ${task}`);
      const url = new URL(createProjectSectionUrl(location.href, 'participants'));
      if (task) url.searchParams.set('task', task);
      return `${url.pathname}${url.search}${url.hash}`;
    },
    navigateTask(task) {
      return push(this.taskHrefFor(task), 'participants');
    },
    subscribe(listener) {
      eventTarget?.addEventListener('popstate', listener);
      eventTarget?.addEventListener('sanpo:sectionchange', listener);
      return () => {
        eventTarget?.removeEventListener('popstate', listener);
        eventTarget?.removeEventListener('sanpo:sectionchange', listener);
      };
    },
  });
}
