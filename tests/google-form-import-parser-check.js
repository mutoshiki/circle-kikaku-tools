const fs = require('fs');
const path = require('path');
const vm = require('vm');

const parserPath = path.join(__dirname, '..', 'assets/js/features/google-form-import-parser.js');
const code = fs.readFileSync(parserPath, 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const parser = sandbox.window.SanpoFormImportParser;

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const date = new Date('2026-05-11T00:00:00+09:00');

const studentIdOnly = parser.parseSpreadsheetImport([
  'タイムスタンプ\t名前\t学籍番号\t車出し',
  '5/11\t山田太郎\t24T1234A\tする',
  '5/11\t佐藤 花子\t２５Ａ１２３４\tしない',
  '5/11\t山田 太郎\t24t1234a\t出せる'
].join('\n'), { currentDate: date });
assert(studentIdOnly.ok, 'studentIdOnly should parse');
assert(studentIdOnly.counts.total === 2, 'normalized duplicate names should be merged');
assert(studentIdOnly.counts.grade3 === 1, '24 student id should infer grade 3 in FY2026');
assert(studentIdOnly.counts.grade2 === 1, '25 student id should infer grade 2 in FY2026');
assert(studentIdOnly.groups.drivers.length === 1 && studentIdOnly.groups.drivers[0] === '山田太郎', 'driver should use first display name');
assert(studentIdOnly.warnings.some(w => w.includes('表記ゆれ')), 'name spacing variants should warn');
assert(studentIdOnly.gradeSource === 'studentId', 'student id should be grade source when grade column is absent');

const gradeAndId = parser.parseSpreadsheetImport([
  '名前\t学年\t学籍番号\t車出し',
  '山田太郎\t2年\t24T1234A\tできます',
  '田中花子\t三年\tbad\tできません',
  '鈴木一郎\t\t25A1234\t不明'
].join('\n'), { currentDate: date });
assert(gradeAndId.counts.grade2 === 1, 'grade column should win over student id inference');
assert(gradeAndId.counts.noGrade === 1, 'invalid grade column value should stay no-grade even if id exists');
assert(gradeAndId.warnings.some(w => w.includes('学年列は2年') && w.includes('3年')), 'mismatch warning should be shown');
assert(gradeAndId.warnings.some(w => w.includes('車出しの値を判定できません')), 'unknown driver value should warn');

const driverCases = new Map([
  ['する', true], ['しない', false], ['出せる', true], ['出せない', false],
  ['できます', true], ['できません', false], ['車は出せない', false], ['運転できません', false],
  ['車を出せます', true], ['YES', true], ['NO', false], ['1', true], ['0', false]
]);
for (const [input, expected] of driverCases) {
  assert(parser.parseDriverValue(input) === expected, `driver value failed: ${input}`);
}

const gradeCases = new Map([['1', 1], ['１年', 1], ['一年', 1], ['B1', 1], ['学部2年', 2], ['四年', 4]]);
for (const [input, expected] of gradeCases) {
  assert(parser.parseGradeValue(input) === expected, `grade value failed: ${input}`);
}

const idCases = new Map([['24T1234A', 3], ['24t1234a', 3], ['２４Ｔ１２３４Ａ', 3], ['25A1234', 2], ['26M0001', 1]]);
for (const [input, expected] of idCases) {
  assert(parser.inferGradeFromStudentId(input, { currentDate: date }) === expected, `student id failed: ${input}`);
}

console.log('Google Form import parser check OK');
