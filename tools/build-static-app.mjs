import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'dist');
const runtimeFiles = ['index.html', 'firebase-config.js', 'maps-config.js', 'ogp-thumbnail.png'];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

function copyTree(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else fs.copyFileSync(from, to);
  }
}

for (const file of runtimeFiles) {
  const source = path.join(root, file);
  if (!fs.existsSync(source)) throw new Error(`Static runtime file is missing: ${file}`);
  fs.copyFileSync(source, path.join(output, file));
}
copyTree(path.join(root, 'assets'), path.join(output, 'assets'));

const index = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
const refs = [...index.matchAll(/(?:src|href)="(\.\/[^"?#]+)/g)].map(match => match[1].slice(2));
const missing = refs.filter(ref => !fs.existsSync(path.join(output, ref)));
if (missing.length) throw new Error(`Static build has missing references: ${missing.join(', ')}`);

const forbidden = ['tests', 'tools', 'types', 'node_modules', 'playwright-report', 'test-results'];
const leaked = forbidden.filter(name => fs.existsSync(path.join(output, name)));
if (leaked.length) throw new Error(`Development-only paths leaked into dist: ${leaked.join(', ')}`);

console.log(`Static app build: PASS (${refs.length} local references, 0 missing, runtime-only dist)`);
