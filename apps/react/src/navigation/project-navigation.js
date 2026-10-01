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
const ALLOCATION_TASKS = new Set(['', 'group', 'assign', 'unassigned', 'presentation']);
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
  url.searchParams.delete('group');
  url.hash = '';
  return url.toString();
}

export function readAllocationTask(href) {
  const section = readProjectSection(href);
  const type = section === 'organization-car' ? 'car' : section === 'organization-team' ? 'team' : '';
  if (!type) return { type: '', task: '', groupId: '', invalid: false };
  const url = new URL(href);
  const task = url.searchParams.get('task') || '';
  const groupId = url.searchParams.get('group') || '';
  const needsGroup = task === 'group' || task === 'assign';
  if (!ALLOCATION_TASKS.has(task) || needsGroup && !groupId || !needsGroup && url.searchParams.has('group')) {
    return { type, task: '', groupId: '', invalid: true };
  }
  return { type, task, groupId: needsGroup ? groupId : '', invalid: false };
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
    getAllocationTaskSnapshot: () => JSON.stringify(readAllocationTask(location.href)),
    hrefFor(section) {
      const url = new URL(createProjectSectionUrl(location.href, section));
      return `${url.pathname}${url.search}${url.hash}`;
    },
    navigate(section) {
      const href = this.hrefFor(section);
      if (section === getSnapshot() && !new URL(location.href).searchParams.has('task') && !new URL(location.href).searchParams.has('group')) return false;
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
    allocationTaskHrefFor(type, task, groupId = '') {
      if (!['car', 'team'].includes(type) || !ALLOCATION_TASKS.has(task)) throw new Error('Unknown allocation destination');
      if (['group', 'assign'].includes(task) && !groupId) throw new Error('Allocation group is required');
      const url = new URL(createProjectSectionUrl(location.href, `organization-${type}`));
      if (task) url.searchParams.set('task', task);
      if (['group', 'assign'].includes(task)) url.searchParams.set('group', groupId);
      return `${url.pathname}${url.search}${url.hash}`;
    },
    navigateAllocationTask(type, task, groupId = '') {
      return push(this.allocationTaskHrefFor(type, task, groupId), `organization-${type}`);
    },
    replaceAllocationTask(type, task, groupId = '') {
      const href = this.allocationTaskHrefFor(type, task, groupId);
      const current = new URL(location.href);
      if (`${current.pathname}${current.search}${current.hash}` === href) return false;
      history.replaceState(history.state || null, '', href);
      eventTarget?.dispatchEvent(new Event('sanpo:sectionchange'));
      return true;
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
