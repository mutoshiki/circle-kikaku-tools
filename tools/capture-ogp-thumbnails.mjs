import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(process.cwd());
const outputDir = join(root, 'assets/images/ogp');
const pages = [
  { name: 'presentation', source: join(root, 'ogp/presentation/index.html') },
  { name: 'settlement', source: join(root, 'ogp/settlement/index.html') }
];

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function readPngSize(buffer) {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const temp = await mkdtemp(join(tmpdir(), 'circle-ogp-'));
try {
  for (const page of pages) {
    const pdf = join(temp, `${page.name}.pdf`);
    const outputBase = join(outputDir, page.name);
    await run('weasyprint', [page.source, pdf]);
    await run('pdftoppm', ['-png', '-r', '96', '-singlefile', pdf, outputBase]);

    const output = `${outputBase}.png`;
    const size = readPngSize(await readFile(output));
    if (!size || size.width !== 1200 || size.height !== 630) {
      throw new Error(`${basename(output)} must be 1200x630, got ${size?.width}x${size?.height}`);
    }
    console.log(`Captured ${page.name}: ${output}`);
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}
