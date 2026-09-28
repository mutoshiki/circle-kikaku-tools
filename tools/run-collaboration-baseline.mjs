import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.argv[2] || process.cwd());
const scripts = ['test:collab:chaos', 'test:collab:deep', 'test:collab:soak', 'test:collab:protocol'];
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
function failureIds(script, output, exitCode) {
  if (exitCode === 0) return [];
  // The deep suite emits named cases in JSON. Compare those stable case names,
  // not the number of accumulated invariant violations or the process exit code.
  const jsonStart = output.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const summary = JSON.parse(output.slice(jsonStart));
      if (Array.isArray(summary.issues)) return summary.issues.map(issue => `${script} :: ${issue.name}`);
    } catch { /* Other suites may print non-JSON diagnostics. */ }
  }
  const assertion = output.match(/AssertionError \[[^\]]+\]:\s*([^\r\n]+)/i);
  if (assertion) return [`${script} :: ${assertion[1].trim()}`];
  const named = output.split(/\r?\n/).map(line => line.trim())
    .filter(line => /^(?:FAIL\s|not ok\s|✖\s|Mismatch\s)/i.test(line))
    .map(line => `${script} :: ${line}`);
  return named.length ? named : [`${script} :: unreported failing case`];
}
const results = scripts.map(script => {
  if (!packageJson.scripts[script]) throw new Error(`Missing collaboration script: ${script}`);
  const run = spawnSync('npm', ['run', script], { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
  const output = `${run.stdout || ''}${run.stderr || ''}`;
  const exitCode = run.status ?? 1;
  const failures = failureIds(script, output, exitCode);
  return { script, exitCode, failures, output };
});
for (const result of results) {
  process.stdout.write(`${result.exitCode === 0 ? 'PASS' : 'FAIL'} ${result.script}${result.failures.length ? ` — ${result.failures.join(' | ')}` : ''}\n`);
}
if (process.env.COLLABORATION_REPORT) writeFileSync(process.env.COLLABORATION_REPORT, JSON.stringify(results, null, 2));
if (results.some(result => result.exitCode !== 0)) process.exitCode = 1;
