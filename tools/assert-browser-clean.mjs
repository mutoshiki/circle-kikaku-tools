import { appendFileSync, readFileSync } from 'node:fs';

const [reportPath, ...args] = process.argv.slice(2);
if (!reportPath) throw new Error('Usage: node tools/assert-browser-clean.mjs <report.json> [--projects=name,name]');

const projectArgument = args.find(argument => argument.startsWith('--projects='));
const requiredProjects = new Set((projectArgument?.slice('--projects='.length) || '')
  .split(',').map(project => project.trim()).filter(Boolean));
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const failed = [];
const seenProjects = new Set();
let passedCount = 0;
let skippedCount = 0;
let observedCount = 0;

const visit = suite => {
  for (const spec of suite.specs || []) for (const test of spec.tests || []) {
    const project = test.projectName || test.projectId || '';
    if (project) seenProjects.add(project);
    for (const result of test.results || []) {
      if (result.status === 'passed') passedCount++;
      else if (result.status === 'skipped') skippedCount++;
      else if (!['expected'].includes(result.status)) failed.push(`${spec.file || suite.file || ''} :: ${spec.title} (${result.status})`);
      observedCount++;
    }
    if ((test.results || []).length === 0) failed.push(`${spec.file || suite.file || ''} :: ${spec.title} (no results)`);
    if (['unexpected', 'flaky'].includes(test.outcome)) failed.push(`${spec.file || suite.file || ''} :: ${spec.title} (${test.outcome})`);
  }
  for (const child of suite.suites || []) visit(child);
};

for (const suite of report.suites || []) visit(suite);
const stats = report.stats || {};
if (!Number.isFinite(stats.expected) || stats.expected <= 0 || observedCount === 0) failed.push('Report contains no executed tests');
if (passedCount === 0) failed.push('Report contains no passing tests; an empty or fully skipped selection is not valid');
if (Number(stats.expected) !== passedCount || Number(stats.skipped || 0) !== skippedCount) {
  failed.push(`Executed result counts do not match the report statistics (passed=${passedCount}/${stats.expected ?? 'missing'}, skipped=${skippedCount}/${stats.skipped ?? 0})`);
}
for (const project of requiredProjects) if (!seenProjects.has(project)) failed.push(`Required project was not executed: ${project}`);
if (Number(stats.unexpected) > 0 || Number(stats.flaky) > 0) failed.push(`Report summary has unexpected=${stats.unexpected || 0} flaky=${stats.flaky || 0}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `\n### Browser report\n\n- Passed: ${passedCount}\n- Explicitly skipped: ${skippedCount}\n- Required projects: ${[...requiredProjects].join(', ') || 'not specified'}\n- Observed projects: ${[...seenProjects].sort().join(', ') || 'none'}\n- Unexpected/flaky: ${Number(stats.unexpected) || 0}/${Number(stats.flaky) || 0}\n- Result: ${failed.length ? 'failed' : 'passed'}\n`);
}

if (failed.length) {
  process.stderr.write(`Browser tests failed or report is incomplete:\n${[...new Set(failed)].join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Browser report clean: passed=${passedCount} skipped=${skippedCount} projects=${[...seenProjects].sort().join(',')}\n`);
}
