(function () {
  'use strict';

  const mappings = Object.freeze({
    grade: Object.freeze({
      male: 'blue',
      female: 'magenta',
      unknown: 'gray'
    }),
    cost: Object.freeze({
      split: 'blue',
      club: 'warm-gray',
      pay: 'magenta'
    }),
    sheetPlan: Object.freeze({
      car: 'blue',
      team: 'purple'
    }),
    capacity: Object.freeze({
      normal: 'gray',
      over: 'red'
    }),
    importSource: Object.freeze({
      studentId: 'cyan',
      grade: 'blue',
      none: 'gray'
    })
  });

  const assistiveLabels = Object.freeze({
    grade: Object.freeze({
      male: '男性',
      female: '女性',
      unknown: '性別不明'
    }),
    capacity: Object.freeze({
      normal: '定員',
      over: '定員超過'
    })
  });

  function resolve(group, value, fallback = 'gray') {
    return mappings[group]?.[value] || fallback;
  }

  function accessibleName(group, value, visibleText = '') {
    const text = String(visibleText).trim();
    const label = assistiveLabels[group]?.[value];
    if (!text || !label) return '';
    return group === 'grade' ? `${text}、${label}` : `${label}、${text}`;
  }

  function escapeAttribute(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  function attributes(group, value, size = 'sm', visibleText = '') {
    const name = accessibleName(group, value, visibleText);
    const ariaLabel = name ? ` aria-label="${escapeAttribute(name)}"` : '';
    return `type="${resolve(group, value)}" size="${size}" data-tag-group="${group}" data-tag-value="${value}"${ariaLabel}`;
  }

  window.SanpoTagTypes = Object.freeze({ mappings, assistiveLabels, resolve, accessibleName, attributes });
})();
