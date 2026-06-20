// Register split settlement templates under the legacy public API.
(function () {
  'use strict';

  const parts = window.SanpoApp?.settlementTemplateParts || {};
  const publicTemplateNames = [
    'summary',
    'settingSummary',
    'renderIssues',
    'carRow',
    'cars',
    'extraRow',
    'collection',
    'driverPay',
    'breakdown',
    'emptyState',
    'routeStopRow',
    'routeCandidateButton'
  ];

  function registerSettlementTemplates() {
    const missing = publicTemplateNames.filter(name => typeof parts[name] !== 'function');
    if (missing.length) {
      console.warn(`Settlement template split is incomplete: ${missing.join(', ')}`);
    }
    const publicTemplates = publicTemplateNames.reduce((api, name) => {
      api[name] = parts[name];
      return api;
    }, {});
    window.SanpoApp?.registerTemplates?.('settlement', publicTemplates);
    return publicTemplates;
  }

  parts.registerSettlementTemplates = registerSettlementTemplates;
  registerSettlementTemplates();
})();
