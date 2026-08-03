// Google Maps JavaScript API loader.
// The runtime key is owned only by maps-config.js.
(function (global) {
  'use strict';

  let loadPromise = null;
  let callbackSequence = 0;

  function getConfig() {
    return global.SANPO_GOOGLE_MAPS_CONFIG || {};
  }

  function isConfigured() {
    return Boolean(String(getConfig().apiKey || '').trim());
  }

  function classifyError(error) {
    const text = String(error?.message || error || '');
    if (/ApiNotActivated|REQUEST_DENIED|PERMISSION_DENIED|InvalidKey|RefererNotAllowed/i.test(text)) {
      return { kind: 'permission', title: 'Google Maps APIを利用できません', message: 'APIの有効化、キー、HTTPリファラー制限を確認してください。' };
    }
    if (/RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT|quota/i.test(text)) {
      return { kind: 'quota', title: 'Google Maps APIの利用上限に達しました', message: '時間をおいて再試行してください。' };
    }
    if (/timeout|network|Failed to fetch|ERR_/i.test(text)) {
      return { kind: 'network', title: 'Google Mapsへ接続できません', message: '通信状態を確認して再試行してください。' };
    }
    return { kind: 'unknown', title: 'Google Mapsを読み込めませんでした', message: text || '時間をおいて再試行してください。' };
  }

  function removeFailedScript() {
    document.querySelectorAll('script[data-sanpo-google-maps]').forEach(script => script.remove());
  }

  function load({ timeoutMs = 20000, force = false } = {}) {
    if (global.google?.maps?.importLibrary) return Promise.resolve(global.google.maps);
    if (!isConfigured()) return Promise.reject(new Error('Google Maps API key is not configured.'));
    if (force) {
      loadPromise = null;
      removeFailedScript();
    }
    if (loadPromise) return loadPromise;

    const config = getConfig();
    loadPromise = new Promise((resolve, reject) => {
      const callbackName = `__sanpoGoogleMapsReady${++callbackSequence}`;
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        try { delete global[callbackName]; } catch (error) { global[callbackName] = undefined; }
      };
      const fail = error => {
        if (settled) return;
        settled = true;
        cleanup();
        loadPromise = null;
        reject(error instanceof Error ? error : new Error(String(error || 'Google Maps load failed')));
      };
      global[callbackName] = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(global.google.maps);
      };
      const params = new URLSearchParams({
        key: String(config.apiKey || ''),
        v: String(config.version || 'weekly'),
        language: String(config.language || 'ja'),
        region: String(config.region || 'JP'),
        loading: 'async',
        callback: callbackName
      });
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
      script.async = true;
      script.defer = true;
      script.dataset.sanpoGoogleMaps = 'true';
      script.onerror = () => fail(new Error('Google Maps JavaScript API network error'));
      const timer = setTimeout(() => fail(new Error('Google Maps JavaScript API timeout')), timeoutMs);
      document.head.appendChild(script);
    });
    return loadPromise;
  }

  async function importLibraries(names = []) {
    await load();
    const unique = [...new Set(names)];
    const entries = await Promise.all(unique.map(async name => [name, await global.google.maps.importLibrary(name)]));
    return Object.fromEntries(entries);
  }

  global.SanpoGoogleMaps = Object.freeze({ getConfig, isConfigured, classifyError, load, importLibraries });
})(window);
