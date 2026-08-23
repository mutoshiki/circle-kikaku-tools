// Firebase config for this GitHub Pages app.
// GitHub Pages のリポジトリ名を変えても、この設定に GitHub Pages のURLを書く必要はありません。
// Do not use npm-style imports here.
// app.js loads Firebase SDK modules from the browser and reads this object.

window.SANPO_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBdgDzo6C7CG739XvqlD9RtKmiQvHuIXbY",
  authDomain: "sanpokai-tool.firebaseapp.com",
  databaseURL: "https://sanpokai-tool-default-rtdb.firebaseio.com",
  projectId: "sanpokai-tool",
  storageBucket: "sanpokai-tool.firebasestorage.app",
  messagingSenderId: "79505558920",
  appId: "1:79505558920:web:3f9a9a333fc77de7a7fe3d"
};

// Keep the large app shell stable: the optional form-link feature owns its own
// stylesheet/script and is attached after the existing application scripts have loaded.
(function loadFormLinkSyncFeature() {
  function load() {
    if (!document.querySelector('link[data-sanpo-form-link-sync]')) {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = './assets/css/guides-modals/import-guide/06-form-auto-link.css?v=automatic-form-sync-v1';
      stylesheet.dataset.sanpoFormLinkSync = 'true';
      document.head.appendChild(stylesheet);
    }
    if (!document.querySelector('script[data-sanpo-form-link-sync]')) {
      const script = document.createElement('script');
      script.src = './assets/js/features/form-link-sync.js?v=automatic-form-sync-v1';
      script.dataset.sanpoFormLinkSync = 'true';
      document.head.appendChild(script);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
})();
