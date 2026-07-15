const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'assets/css/settlement/checklists/06-club-expense-list.css'), 'utf8');
const template = fs.readFileSync(path.join(__dirname, '..', 'assets/js/templates/settlement/02-summary-templates.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(html.includes('部費</em>の収支'), 'the section must be named as a balance, not only usage');
assert(!html.includes('部費負担を減らす'), 'the ledger must not show a redundant sign-explanation memo');
assert(template.includes("'支払い額の切り上げ'"), 'payment rounding must explain why the amount exists');
assert(template.includes("'ドライバー分の集金控除'"), 'driver collection offset must be labeled as a deduction');
assert(template.includes('money(Math.abs(row.amount), helpers)'), 'row currency must use an absolute amount with a separate leading sign');
assert(css.includes('border-top: 2px solid var(--border-strong);'), 'club total divider must match the driver payment total divider');
console.log('Settlement club ledger contract check OK');
