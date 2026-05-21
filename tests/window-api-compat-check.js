const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'assets/js/core/app-status.js'), 'utf8');
const storage = fs.readFileSync(path.join(root, 'assets/js/core/storage.js'), 'utf8');
const remote = fs.readFileSync(path.join(root, 'assets/js/core/remote-guard.js'), 'utf8');

if ((storage + remote).includes('window.showSaveStatus?.') && !app.includes('window.showSaveStatus = function showSaveStatus')) {
  console.error('Extracted core modules call window.showSaveStatus, but app.js does not expose the compatibility API');
  process.exit(1);
}

console.log('Window API compatibility check OK');
