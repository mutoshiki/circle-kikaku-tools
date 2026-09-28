import { readFileSync } from 'node:fs';
const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const failed = [];
const visit = suite => {
  for (const spec of suite.specs || []) for (const test of spec.tests || []) {
    if ((test.results || []).some(result => !['passed', 'skipped', 'expected'].includes(result.status)) || ['unexpected', 'flaky'].includes(test.outcome)) failed.push(`${spec.file || suite.file || ''} :: ${spec.title}`);
  }
  for (const child of suite.suites || []) visit(child);
};
for (const suite of report.suites || []) visit(suite);
if (failed.length) {
  process.stderr.write(`Browser tests failed:\n${failed.join('\n')}\n`);
  process.exitCode = 1;
}
