import { readFileSync } from 'node:fs';
const [basePath, headPath] = process.argv.slice(2);
if (!basePath || !headPath) throw new Error('Usage: node tools/compare-browser-baseline.mjs <base-report> <head-report>');
const normalizeFile = file => String(file || '').replaceAll('\\', '/').replace(/^.*?(?=(?:apps\/react\/migration\/)?tests\/)/, '').replace(/^apps\/react\/migration\//, '');
const failures = path => {
  const report = JSON.parse(readFileSync(path, 'utf8'));
  const result = [];
  const visit = (suite, parents = []) => {
    const titles = suite.title ? [...parents, suite.title] : parents;
    for (const spec of suite.specs || []) for (const test of spec.tests || []) {
      if ((test.results || []).some(item => !['passed', 'skipped', 'expected'].includes(item.status)) || ['unexpected', 'flaky'].includes(test.outcome)) {
        result.push(`${normalizeFile(spec.file || suite.file)} :: ${[...titles, spec.title].filter(Boolean).join(' > ')} :: ${test.projectName || test.projectId || ''}`);
      }
    }
    for (const child of suite.suites || []) visit(child, titles);
  };
  for (const suite of report.suites || []) visit(suite);
  return result;
};
const base = failures(basePath);
const head = failures(headPath);
const baseSet = new Set(base);
const headSet = new Set(head);
const added = [...headSet].filter(value => !baseSet.has(value));
const resolved = [...baseSet].filter(value => !headSet.has(value));
process.stdout.write(JSON.stringify({ baseFailureIds: [...baseSet], headFailureIds: [...headSet], newFailureIds: added, resolvedFailureIds: resolved }, null, 2) + '\n');
if (added.length) process.exitCode = 1;
