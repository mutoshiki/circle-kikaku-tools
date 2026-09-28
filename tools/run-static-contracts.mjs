import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(process.argv[2] || fileURLToPath(new URL('..', import.meta.url)));
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const contractScript = packageJson.scripts['test:legacy:contracts'] || packageJson.scripts.test;
const commands = contractScript.split(/\s+&&\s+/);
const results = [];
for (const command of commands) {
  const match = command.match(/^node\s+(.+)$/);
  if (!match) throw new Error(`Unsupported static contract command: ${command}`);
  const script = match[1].trim();
  const run = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
  const output = `${run.stdout || ''}${run.stderr || ''}`;
  const failures = output.split(/\r?\n/).filter(line => /^(?:FAIL\s|Error:|AssertionError|not ok\s)/.test(line.trim()));
  results.push({ script, exitCode: run.status ?? 1, failures, output });
  process.stdout.write(`${run.status === 0 ? 'PASS' : 'FAIL'} ${script}\n`);
  if (run.status !== 0 && failures.length) process.stdout.write(`  ${failures.join('\n  ')}\n`);
}
const outputPath = process.env.STATIC_CONTRACT_REPORT;
if (outputPath) writeFileSync(outputPath, JSON.stringify(results, null, 2));
if (results.some(result => result.exitCode !== 0)) process.exitCode = 1;
