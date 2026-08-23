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

// Managed forms sync directly into the project room as applicants. Participant selection
// is owned by the dedicated Participants tab; no spreadsheet-URL linking UI is loaded.
(function loadApplicantSyncFeature() {
  function load() {
    if (!document.querySelector('link[data-sanpo-applicant-sync]')) {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = './assets/css/guides-modals/import-guide/07-form-applicant-sync.css?v=participants-carbon-v89';
      stylesheet.dataset.sanpoApplicantSync = 'true';
      document.head.appendChild(stylesheet);
    }
    if (!document.querySelector('script[data-sanpo-applicant-sync]')) {
      const script = document.createElement('script');
      script.src = './assets/js/features/form-applicant-sync-v2.js?v=participants-carbon-v89';
      script.dataset.sanpoApplicantSync = 'true';
      document.head.appendChild(script);
    }
    if (!document.querySelector('script[data-sanpo-participants-ui]')) {
      const script = document.createElement('script');
      script.src = './assets/js/features/participants-ui.js?v=participants-carbon-v89';
      script.dataset.sanpoParticipantsUi = 'true';
      document.head.appendChild(script);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
})();
