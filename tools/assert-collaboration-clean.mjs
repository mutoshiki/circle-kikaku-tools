import { readFileSync } from 'node:fs';
const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const failed = report.filter(result => result.exitCode !== 0).flatMap(result => result.failures?.length
  ? result.failures
  : [`${result.script} :: unreported failing case (exit ${result.exitCode})`]);
if (failed.length) {
  process.stderr.write(`Collaboration tests failed after legacy/shared source changes:\n${failed.join('\n')}\n`);
  process.exitCode = 1;
}
