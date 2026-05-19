const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('assets/js/features/person-menu.js', 'utf8');

if (!html.includes('id="commonEditModalTitle"')) {
  throw new Error('common edit modal title id is missing from index.html');
}

if (!app.includes("$('#commonEditModalTitle')")) {
  throw new Error('handleEdit must write to #commonEditModalTitle');
}

if (app.includes("$('#editModalTitle')")) {
  throw new Error('stale #editModalTitle selector remains in app.js');
}

if (!app.includes("action === 'memo'") || !app.includes("action === 'name'")) {
  throw new Error('person menu memo/name handlers are missing');
}

console.log('Common edit modal id check OK');
