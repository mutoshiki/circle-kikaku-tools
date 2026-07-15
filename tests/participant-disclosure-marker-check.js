const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const index = read('index.html');
const css = read('assets/css/guides-modals/import-guide/01-import-shell.css');

assert((index.match(/<details class="batch-import-help-details/g) || []).length === 2, 'participant registration must keep both help disclosure sections');
assert(index.includes('<summary>貼り付け方を見る</summary>') && index.includes('<summary>自動判定の仕組み</summary>'), 'participant registration help labels must remain unchanged');
assert(/\.batch-import-help-details > summary::before\s*\{[\s\S]*border-left:\s*7px solid currentColor;/.test(css), 'both help summaries must restore a visible left disclosure triangle');
assert(/\.batch-import-help-details\[open\] > summary::before\s*\{[\s\S]*transform:\s*rotate\(90deg\);/.test(css), 'the disclosure triangle must turn downward when opened');
assert(css.includes('.batch-import-help-details > summary::-webkit-details-marker'), 'native WebKit marker must be intentionally replaced rather than accidentally hidden');
console.log('Participant disclosure marker check OK');
