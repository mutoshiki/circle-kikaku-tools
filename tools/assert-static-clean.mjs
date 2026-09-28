import { readFileSync } from 'node:fs';
const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const failures = report.filter(result => result.exitCode !== 0).map(result => `${result.script}: ${result.failures.join(' | ')}`);
if (failures.length) {
  process.stderr.write(`Static contracts failed after legacy/shared source changes:\n${failures.join('\n')}\n`);
  process.exitCode = 1;
}
