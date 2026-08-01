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

  function resolve(group, value, fallback = 'gray') {
    return mappings[group]?.[value] || fallback;
  }

  function attributes(group, value, size = 'sm') {
    return `type="${resolve(group, value)}" size="${size}" data-tag-group="${group}" data-tag-value="${value}"`;
  }

  window.SanpoTagTypes = Object.freeze({ mappings, resolve, attributes });
})();
