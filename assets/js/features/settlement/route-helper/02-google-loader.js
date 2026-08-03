// Lazy Google Maps JavaScript API loader. The restricted browser key lives only in maps-config.js.
(function (global) {
  'use strict';

  let loadPromise = null;
  let libraryPromise = null;

  function getMapsConfig() {
    const config = /** @type {SanpoGoogleMapsConfig} */ (global.SANPO_GOOGLE_MAPS_CONFIG || { apiKey: '', language: 'ja', region: 'JP', version: 'weekly' });
    return {
      apiKey: String(config.apiKey || '').trim(),
      language: String(config.language || 'ja'),
      region: String(config.region || 'JP'),
      version: String(config.version || 'weekly')
    };
  }

  function loadGoogleMapsScript() {
    if (global.google?.maps?.importLibrary) return Promise.resolve(global.google.maps);
    if (loadPromise) return loadPromise;

    const existing = document.querySelector('script[data-sanpo-google-maps="true"]');
    if (existing) {
      loadPromise = new Promise((resolve, reject) => {
        const started = Date.now();
        const poll = () => {
          if (global.google?.maps?.importLibrary) return resolve(global.google.maps);
          if (Date.now() - started > 15000) {
            loadPromise = null;
            return reject(new Error('Google Maps JavaScript APIの読み込みがタイムアウトしました。'));
          }
          setTimeout(poll, 50);
        };
        existing.addEventListener('error', () => {
          loadPromise = null;
          reject(new Error('Google Maps JavaScript APIを読み込めませんでした。'));
        }, { once: true });
        poll();
      });
      return loadPromise;
    }

    const config = getMapsConfig();
    if (!config.apiKey) return Promise.reject(new Error('Google Maps APIキーが設定されていません。'));

    loadPromise = new Promise((resolve, reject) => {
      const callbackName = `__sanpoGoogleMapsReady_${Date.now()}`;
      let timeoutId = 0;
      const cleanup = () => {
        if (timeoutId) global.clearTimeout(timeoutId);
        timeoutId = 0;
        try { delete global[callbackName]; } catch (_) { global[callbackName] = undefined; }
      };
      const fail = message => {
        cleanup();
        loadPromise = null;
        script.remove();
        reject(new Error(message));
      };
      global[callbackName] = () => {
        cleanup();
        if (global.google?.maps?.importLibrary) resolve(global.google.maps);
        else fail('Google Maps JavaScript APIの初期化に失敗しました。');
      };
      const script = document.createElement('script');
      const params = new URLSearchParams({
        key: config.apiKey,
        v: config.version,
        language: config.language,
        region: config.region,
        loading: 'async',
        callback: callbackName,
        auth_referrer_policy: 'origin'
      });
      script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
      script.async = true;
      script.defer = true;
      script.dataset.sanpoGoogleMaps = 'true';
      script.onerror = () => fail('Google Maps JavaScript APIを読み込めませんでした。通信状態とAPI制限を確認してください。');
      timeoutId = global.setTimeout(() => fail('Google Maps JavaScript APIの読み込みがタイムアウトしました。'), 15000);
      document.head.appendChild(script);
    });
    return loadPromise;
  }

  async function loadSanpoGoogleMapsLibraries() {
    // Explicit injection seam for deterministic tests. Production never defines this value.
    if (global.__SANPO_GOOGLE_MAPS_TEST_LIBRARIES__) return global.__SANPO_GOOGLE_MAPS_TEST_LIBRARIES__;
    if (libraryPromise) return libraryPromise;
    libraryPromise = (async () => {
      await loadGoogleMapsScript();
      const [maps, places, routes, geometry] = await Promise.all([
        global.google.maps.importLibrary('maps'),
        global.google.maps.importLibrary('places'),
        global.google.maps.importLibrary('routes'),
        global.google.maps.importLibrary('geometry')
      ]);
      return { maps, places, routes, geometry, google: global.google };
    })().catch(error => {
      libraryPromise = null;
      throw error;
    });
    return libraryPromise;
  }

  function resetSanpoGoogleMapsLoaderForTests() {
    loadPromise = null;
    libraryPromise = null;
  }

  Object.assign(global, { loadGoogleMapsScript, loadSanpoGoogleMapsLibraries, resetSanpoGoogleMapsLoaderForTests });
})(window);
