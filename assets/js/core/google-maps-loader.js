// Single-owner Google Maps JavaScript API loader.
// Consumers must use window.SanpoGoogleMaps rather than creating script tags.
(function (global) {
  'use strict';

  const CALLBACK_NAME = '__sanpoGoogleMapsReady';
  const DEFAULT_TIMEOUT_MS = 20000;
  let loadPromise = null;
  const libraryPromises = new Map();

  function getConfig() {
    const raw = global.SANPO_GOOGLE_MAPS_CONFIG || {};
    return {
      apiKey: String(raw.apiKey || '').trim(),
      version: String(raw.version || 'weekly'),
      language: String(raw.language || 'ja'),
      region: String(raw.region || 'JP'),
      mapId: String(raw.mapId || '').trim()
    };
  }

  function isConfigured() {
    return Boolean(getConfig().apiKey);
  }

  function createLoadError(code, message, cause) {
    const error = new Error(message);
    error.name = 'GoogleMapsLoadError';
    Object.assign(error, { code });
    if (cause) error.cause = cause;
    return error;
  }

  function load(options = {}) {
    if (global.google?.maps?.importLibrary) return Promise.resolve(global.google.maps);
    if (loadPromise) return loadPromise;

    const config = getConfig();
    if (!config.apiKey) {
      return Promise.reject(createLoadError('MISSING_API_KEY', 'Google Maps APIキーが設定されていません。'));
    }

    loadPromise = new Promise((resolve, reject) => {
      const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
      /** @type {HTMLScriptElement | null} */
      let script = document.querySelector('script[data-sanpo-google-maps]');
      let settled = false;
      let timer = null;
      const previousAuthFailure = global.gm_authFailure;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        try { delete global[CALLBACK_NAME]; } catch (error) { global[CALLBACK_NAME] = undefined; }
        if (previousAuthFailure) global.gm_authFailure = previousAuthFailure;
        else {
          try { delete global.gm_authFailure; } catch (error) { global.gm_authFailure = undefined; }
        }
      };
      const succeed = () => {
        if (settled) return;
        if (!global.google?.maps?.importLibrary) {
          fail('INVALID_RESPONSE', 'Google Mapsの初期化に失敗しました。');
          return;
        }
        settled = true;
        cleanup();
        resolve(global.google.maps);
      };
      const fail = (code, message, cause) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (script?.dataset?.sanpoGoogleMaps === 'true') script.remove();
        script = null;
        loadPromise = null;
        libraryPromises.clear();
        reject(createLoadError(code, message, cause));
      };

      global[CALLBACK_NAME] = succeed;
      global.gm_authFailure = () => {
        try { previousAuthFailure?.(); } catch (error) {}
        fail('AUTH_FAILURE', 'Google Maps APIキーまたはAPI制限により読み込みが拒否されました。');
      };
      timer = setTimeout(() => fail('LOAD_TIMEOUT', 'Google Mapsの読み込みがタイムアウトしました。'), timeoutMs);

      if (script) {
        script.addEventListener('error', event => fail('NETWORK_ERROR', 'Google Mapsを読み込めませんでした。通信状態またはAPI制限を確認してください。', event), { once: true });
        return;
      }

      const params = new URLSearchParams({
        key: config.apiKey,
        v: config.version,
        loading: 'async',
        language: config.language,
        region: config.region,
        callback: CALLBACK_NAME
      });
      script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
      script.async = true;
      script.defer = true;
      script.dataset.sanpoGoogleMaps = 'true';
      script.referrerPolicy = 'strict-origin-when-cross-origin';
      script.addEventListener('error', event => fail('NETWORK_ERROR', 'Google Mapsを読み込めませんでした。通信状態またはAPI制限を確認してください。', event), { once: true });
      document.head.appendChild(script);
    });

    return loadPromise;
  }

  function importLibrary(name) {
    const key = String(name || '').trim();
    if (!key) return Promise.reject(new TypeError('Google Maps library name is required.'));
    if (!libraryPromises.has(key)) {
      libraryPromises.set(key, load().then(() => global.google.maps.importLibrary(key)).catch(error => {
        libraryPromises.delete(key);
        throw error;
      }));
    }
    return libraryPromises.get(key);
  }

  async function importLibraries(names = []) {
    const entries = await Promise.all(Array.from(new Set(names)).map(async name => [name, await importLibrary(name)]));
    return Object.fromEntries(entries);
  }

  global.SanpoGoogleMaps = Object.freeze({
    getConfig,
    isConfigured,
    load,
    importLibrary,
    importLibraries
  });
})(window);
