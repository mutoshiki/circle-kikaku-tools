const NOTICE_KINDS = new Set(['info', 'success', 'warning', 'error']);
const NOTICE_PLACEMENTS = new Set(['inline', 'toast']);

export function createNotice({ kind = 'info', title, subtitle = '', placement = 'inline', timeout } = {}) {
  const normalizedTitle = String(title || '').trim();
  if (!normalizedTitle) throw new TypeError('Notice title is required');
  const validKind = NOTICE_KINDS.has(kind);
  const validPlacement = NOTICE_PLACEMENTS.has(placement);
  const normalizedKind = validKind ? kind : 'error';
  const normalizedPlacement = validKind && validPlacement ? placement : 'inline';
  return Object.freeze({
    kind: normalizedKind,
    title: normalizedTitle,
    subtitle: String(subtitle || '').trim(),
    placement: normalizedPlacement,
    timeout: normalizedPlacement === 'toast' ? Math.max(1, Number(timeout) || 2600) : 0,
  });
}
function noticeFor(kind, title, options = {}) {
  return createNotice({ kind, title, ...options });
}

export const notice = Object.freeze({
  info: (title, options) => noticeFor('info', title, options),
  success: (title, options) => noticeFor('success', title, options),
  warning: (title, options) => noticeFor('warning', title, options),
  error: (title, options) => noticeFor('error', title, options),
});

export function isToastNotice(value) {
  return value?.placement === 'toast' && Number(value.timeout) > 0;
}

const MODAL_TASKS = Object.freeze({
  'help-guide': ['approved-brief', null, '現在のtaskに関する短い参照情報'],
  'sample-data': ['approved-brief', null, '確認用dataを選び1回適用する開発task'],
  'bug-report': ['approved-brief', null, '1つの報告内容を送信する短いtask'],
  'allocation-group-edit': ['approved-brief', null, 'ownerまたは定員を編集して1回保存する短いtask'],
  'allocation-group-confirm': ['approved-brief', null, '対象と影響を確認する単一判断'],
  'participant-edit': ['approved-brief', null, '少数項目を編集して1回保存する短いtask'],
  'participant-selection-remove': ['approved-brief', null, '下流影響を確認する単一判断'],
  'participant-delete': ['approved-brief', null, '対象と下流影響を確認するdanger task'],
  'participant-export': ['approved-brief', null, 'export可否を確認し1回生成する短いtask'],
  'history-management': ['legacy-migration', 'H', '反復操作とdurable historyを含むtask'],
  'history-restore-confirm': ['approved-brief', null, '対象と共有変更範囲を確認する単一danger判断'],
  'settlement-settings': ['legacy-migration', 'G', '複数stepの高影響form'],
  'settlement-car-cost': ['legacy-migration', 'F', '費用、移動、routeを往復する反復task'],
  'settlement-collector': ['approved-brief', null, '集金担当者を選び1回保存する短いtask'],
  'settlement-collection-review': ['legacy-migration', 'H', '多数rowの運用状態を継続確認するtask'],
});

export function modalTaskPolicy(id) {
  const key = String(id || '');
  const policy = MODAL_TASKS[key];
  if (!policy) return Object.freeze({ id: key, status: 'unregistered', targetPhase: null, reason: 'Modal task is not registered' });
  return Object.freeze({ id: key, status: policy[0], targetPhase: policy[1], reason: policy[2] });
}
