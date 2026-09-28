import { readFileSync } from 'node:fs';

const [baseStaticPath, headStaticPath, baseBrowserPath, headBrowserPath] = process.argv.slice(2);
if (![baseStaticPath, headStaticPath, baseBrowserPath, headBrowserPath].every(Boolean)) {
  throw new Error('Usage: node tools/compare-baseline-reports.mjs <base-static> <head-static> <base-browser> <head-browser>');
}
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const staticFailures = report => report.flatMap(result => result.exitCode === 0 ? [] : (result.failures.length ? result.failures : [`${result.script}:unreported failing contract`]).map(failure => `${result.script} :: ${failure}`));
const normalizeFile = file => String(file || '').replaceAll('\\', '/').replace(/^.*?(?=(?:apps\/react\/migration\/)?tests\/)/, '').replace(/^apps\/react\/migration\//, '');
function browserFailures(report) {
  const failed = [];
  const visit = (suite, parents = []) => {
    const path = suite.file || parents.at(-1) || '';
    const titles = suite.title ? [...parents, suite.title] : parents;
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const failedResult = (test.results || []).find(result => !['passed', 'skipped', 'expected'].includes(result.status));
        if (failedResult || ['unexpected', 'flaky'].includes(test.outcome)) {
          const project = test.projectName || test.projectId || '';
          failed.push(`${normalizeFile(spec.file || path)} :: ${[...titles, spec.title].filter(Boolean).join(' > ')} :: ${project}`);
        }
      }
    }
    for (const child of suite.suites || []) visit(child, titles);
  };
  for (const suite of report.suites || []) visit(suite);
  return failed;
}
const baseStatic = staticFailures(readJson(baseStaticPath));
const headStatic = staticFailures(readJson(headStaticPath));
const baseBrowser = browserFailures(readJson(baseBrowserPath));
const headBrowser = browserFailures(readJson(headBrowserPath));
const baseStaticSet = new Set(baseStatic);
const headStaticSet = new Set(headStatic);
const baseBrowserSet = new Set(baseBrowser);
const headBrowserSet = new Set(headBrowser);
const newStatic = [...headStaticSet].filter(failure => !baseStaticSet.has(failure));
const newBrowser = [...headBrowserSet].filter(failure => !baseBrowserSet.has(failure));
const summary = {
  baselineStaticFailureIds: [...baseStaticSet],
  headStaticFailureIds: [...headStaticSet],
  newStaticFailures: newStatic,
  baselineBrowserFailureIds: [...baseBrowserSet],
  headBrowserFailureIds: [...headBrowserSet],
  newBrowserFailures: newBrowser,
};
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (newStatic.length || newBrowser.length) process.exitCode = 1;
