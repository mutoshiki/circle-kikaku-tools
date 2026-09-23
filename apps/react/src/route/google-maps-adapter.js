import { createRouteService } from './service.js';

const CALLBACK_NAME = '__sanpoReactGoogleMapsReady';
let loadPromise = null;

function loadGoogleMaps({ apiKey, version = 'weekly', language = 'ja', region = 'JP', browser, document }) {
  if (browser.google?.maps?.importLibrary) return Promise.resolve(browser.google.maps);
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    let script = document.querySelector('script[data-sanpo-react-google-maps]');
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      delete browser[CALLBACK_NAME];
      if (error) {
        script?.remove?.();
        loadPromise = null;
        reject(error);
      } else if (browser.google?.maps?.importLibrary) resolve(browser.google.maps);
      else {
        loadPromise = null;
        reject(new Error('Google Mapsの初期化に失敗しました。'));
      }
    };
    browser[CALLBACK_NAME] = () => finish();
    const onError = () => finish(new Error('Google Mapsを読み込めませんでした。通信状態またはAPI制限を確認してください。'));
    if (script) {
      script.addEventListener('error', onError, { once: true });
      return;
    }
    const params = new URLSearchParams({ key: apiKey, v: version, loading: 'async', language, region, callback: CALLBACK_NAME });
    script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.defer = true;
    script.dataset.sanpoReactGoogleMaps = 'true';
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    script.addEventListener('error', onError, { once: true });
    document.head.appendChild(script);
  });
  return loadPromise;
}

export function createConfiguredRouteService(env = {}, { browser = globalThis, document = globalThis.document } = {}) {
  const apiKey = String(env.VITE_REACT_MAPS_API_KEY || '').trim();
  if (!apiKey) return null;
  const loadLibraries = async () => {
    const maps = await loadGoogleMaps({
      apiKey,
      version: String(env.VITE_REACT_MAPS_VERSION || 'weekly'),
      language: 'ja',
      region: 'JP',
      browser,
      document,
    });
    const [routes, places, mapLibrary, core] = await Promise.all([maps.importLibrary('routes'), maps.importLibrary('places'), maps.importLibrary('maps'), maps.importLibrary('core')]);
    return { routes, places, maps: mapLibrary, core };
  };
  return createRouteService({ loadLibraries });
}
