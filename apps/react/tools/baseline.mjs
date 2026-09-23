import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = process.env.MIGRATION_EVIDENCE_DIR || join(tmpdir(), 'circle-react-migration-evidence');
mkdirSync(output, { recursive: true });
const pkg = JSON.parse(readFileSync(join(root, 'package.json')));
const tests = [...new Set([...pkg.scripts.test.matchAll(/node\s+(tests\/\S+?\.mjs)/g)].map(match => match[1]).concat([
  'tests/google-route-planner-contract.mjs', 'tests/share-links-contract.mjs', 'tests/driver-reward-policy-contract.mjs',
  'tests/five-device-chaos-v42.mjs', 'tests/deep-five-device-suite.mjs', 'tests/five-device-network-soak-v46.mjs', 'tests/sync-protocol-chaos-v68.mjs',
]))];
const results = [];
for (const path of tests) {
  const result = spawnSync(process.execPath, [path], { cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
  const log = `${result.stdout || ''}\n${result.stderr || ''}`;
  const name = path.split('/').at(-1);
  writeFileSync(join(output, name + '.log'), log);
  const item = { path, exitCode: result.status, error: result.error?.message, failures: log.split('\n').filter(line => /^(FAIL|AssertionError|Error:)/.test(line)) };
  results.push(item);
  console.log(`${result.status === 0 ? 'PASS' : 'FAIL'} ${path}`);
}
writeFileSync(join(output, 'legacy-static-baseline.json'), JSON.stringify({ referenceCommit: 'e37b8651eeba1cb52d2b7a98bc05674bb63591a8', results }, null, 2));
console.log(`Evidence: ${output}`);
