const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'assets', 'js', 'features', 'auto-assign.js'), 'utf8');

const functionNames = [
  'normalizeNameForGenderHeuristic',
  'getGivenNameCandidate',
  'scoreLocalGenderName',
  'applyDetectedGenderToName'
];

const missing = functionNames.filter(name => !app.includes(`function ${name}`));
if (missing.length) {
  console.error('Missing gender heuristic functions:', missing.join(', '));
  process.exit(1);
}

const match = app.match(/function normalizeNameForGenderHeuristic[\s\S]*?function applyDetectedGenderToName\(name, gender\) \{[\s\S]*?\n\}/);
if (!match) {
  console.error('Could not extract gender heuristic block');
  process.exit(1);
}

const sandbox = {
  $$: () => [],
  updatePersonGenderBadge: () => {},
  gradeGenderClass: g => g
};
vm.createContext(sandbox);
vm.runInContext(`${match[0]}; this.scoreLocalGenderName = scoreLocalGenderName;`, sandbox);

const cases = [
  ['山田 花子', 'female'],
  ['佐藤 美咲', 'female'],
  ['田中 陽菜', 'female'],
  ['鈴木 太郎', 'male'],
  ['高橋 大輔', 'male'],
  ['山本 翔太', 'male'],
  ['佐々木 葵', 'female'],
  ['長野 蓮', 'male'],
  ['中村 ひろ', 'unknown']
];

const failed = cases.filter(([name, expected]) => sandbox.scoreLocalGenderName(name) !== expected);
if (failed.length) {
  console.error('Gender heuristic cases failed:', JSON.stringify(failed));
  process.exit(1);
}

console.log('Gender heuristic check OK');
