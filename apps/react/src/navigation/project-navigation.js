import { prepareCompatibleUrl } from '../services/url-compat.js';

export const PROJECT_SECTIONS = Object.freeze([
  'overview',
  'participants',
  'organization-car',
  'organization-team',
  'vehicle-costs',
  'settlement',
  'history-settings',
]);

const SECTION_SET = new Set(PROJECT_SECTIONS);
const ALLOCATION_TASKS = new Set(['', 'group', 'assign', 'unassigned', 'presentation']);
const VEHICLE_COST_TASKS = new Set(['', 'expense', 'route', 'route-search']);
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
  for (const key of ['view', 'allocation', 'task', 'group', 'car', 'expense', 'stop', 'return', 'returnGroup']) url.searchParams.delete(key);
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

export function readVehicleCostTask(href) {
  const empty = { carKey: '', task: '', expenseKey: '', stopKey: '', returnTo: null, invalid: false };
  if (readProjectSection(href) !== 'vehicle-costs') return empty;
  const params = new URL(href).searchParams;
  const carKey = params.get('car') || '', task = params.get('task') || '';
  const expenseKey = params.get('expense') || '', stopKey = params.get('stop') || '';
  const caller = params.get('return') || '', groupId = params.get('returnGroup') || '';
  const returnTo = caller === 'settlement' && !groupId ? { section: caller } : caller === 'organization-car' && groupId ? { section: caller, groupId } : null;
  const invalid = !VEHICLE_COST_TASKS.has(task) || Boolean(carKey && !/^(participant|name):.+$/s.test(carKey)) || Boolean(task && !carKey)
    || (task === 'expense' ? !expenseKey || !!stopKey : !!expenseKey)
    || (task === 'route-search' ? !stopKey : !!stopKey)
    || Boolean((caller || groupId) && !returnTo) || Boolean(!carKey && (expenseKey || stopKey || caller || groupId));
  return { carKey, task, expenseKey, stopKey, returnTo, invalid };
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
    getVehicleCostTaskSnapshot: () => JSON.stringify(readVehicleCostTask(location.href)),
    hrefFor(section) {
      const url = new URL(createProjectSectionUrl(location.href, section));
      return `${url.pathname}${url.search}${url.hash}`;
    },
    navigate(section) {
      const href = this.hrefFor(section);
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
    vehicleCostTaskHrefFor({ carKey = '', task = '', expenseKey = '', stopKey = '', returnTo = null } = {}) {
      const url = new URL(createProjectSectionUrl(location.href, 'vehicle-costs'));
      if (carKey) url.searchParams.set('car', carKey);
      if (task) url.searchParams.set('task', task);
      if (task === 'expense' && expenseKey) url.searchParams.set('expense', expenseKey);
      if (task === 'route-search' && stopKey) url.searchParams.set('stop', stopKey);
      if (returnTo?.section) url.searchParams.set('return', returnTo.section);
      if (returnTo?.section === 'organization-car' && returnTo.groupId) url.searchParams.set('returnGroup', returnTo.groupId);
      if (readVehicleCostTask(url.href).invalid) throw new Error('Unknown vehicle cost destination');
      return `${url.pathname}${url.search}${url.hash}`;
    },
    navigateVehicleCostTask(destination) { return push(this.vehicleCostTaskHrefFor(destination), 'vehicle-costs'); },
    replaceVehicleCostTask(destination) {
      const href = this.vehicleCostTaskHrefFor(destination);
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
