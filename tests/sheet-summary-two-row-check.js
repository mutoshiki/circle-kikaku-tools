const assert = require('assert');
const { readText } = require('./helpers/read-project');

const render = readText('assets/js/core/render-controller.js');
const css = readText('assets/css/06-sheet-view.css');
const html = readText('index.html');

assert(render.includes('function buildSheetPlanSummaryRow'), 'sheet summary rows should be built by a dedicated helper');
assert(render.includes("buildSheetPlanSummaryRow(carPlan)") && render.includes("buildSheetPlanSummaryRow(teamPlan, updated)"), 'sheet summary should render car and team rows');
assert(render.includes("planLabel.textContent = template.type === 'team' ? '班割' : '車割'"), 'summary row labels should be 車割 and 班割');
assert(render.includes("const memberSummaryLabel = template.type === 'team' ? 'メンバー' : '同乗者'"), 'team member summary label should be メンバー');
assert(!render.includes("...(activePlan?.name ? [['表示', activePlan.name]] : [])"), 'summary should not use the old active-plan-only 表示 row');
assert(css.includes('sheet summary: compact two-line car/team counts'), 'two-line sheet summary CSS should be documented');
assert(/#sheet-summary\s*\{[\s\S]*?flex-direction:\s*column;[\s\S]*?\}/.test(css), 'sheet summary should stack rows vertically');
assert(css.includes('.sheet-summary-row') && css.includes('.sheet-summary-plan-label'), 'sheet summary row and label styles should exist');
assert(html.includes('aria-label="車割と班割の集計"'), 'sheet summary should keep an accessible label');

console.log('Sheet summary two-row check OK');
