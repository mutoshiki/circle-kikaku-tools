import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(process.cwd());
const outputDir = join(root, 'assets/images/ogp');
const shareActionsPath = join(root, 'assets/js/features/share-actions.js');
const pages = [
  {
    name: 'presentation',
    source: join(root, 'ogp/presentation/index.html'),
    sharePage: join(root, 'share/presentation/index.html')
  },
  {
    name: 'settlement',
    source: join(root, 'ogp/settlement/index.html'),
    sharePage: join(root, 'share/settlement/index.html')
  }
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

function shortHash(buffer) {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 12);
}

function replaceImageReference(html, name, filename) {
  const pattern = new RegExp(`/assets/images/ogp/${name}(?:\\.[a-f0-9]{12})?\\.png`, 'g');
  return html.replace(pattern, `/assets/images/ogp/${filename}`);
}

const temp = await mkdtemp(join(tmpdir(), 'circle-ogp-'));
const versions = {};

try {
  for (const page of pages) {
    const pdf = join(temp, `${page.name}.pdf`);
    const tempOutputBase = join(temp, page.name);
    await run('weasyprint', [page.source, pdf]);
    await run('pdftoppm', ['-png', '-r', '96', '-singlefile', pdf, tempOutputBase]);

    const capturedPath = `${tempOutputBase}.png`;
    const buffer = await readFile(capturedPath);
    const size = readPngSize(buffer);
    if (!size || size.width !== 1200 || size.height !== 630) {
      throw new Error(`${basename(capturedPath)} must be 1200x630, got ${size?.width}x${size?.height}`);
    }

    const hash = shortHash(buffer);
    const filename = `${page.name}.${hash}.png`;
    const hashedOutput = join(outputDir, filename);
    const stableOutput = join(outputDir, `${page.name}.png`);

    await copyFile(capturedPath, hashedOutput);
    await copyFile(capturedPath, stableOutput);

    const shareHtml = await readFile(page.sharePage, 'utf8');
    await writeFile(page.sharePage, replaceImageReference(shareHtml, page.name, filename));

    versions[page.name] = hash;
    console.log(`Captured ${page.name}: ${hashedOutput}`);
  }

  const previewVersion = `${versions.presentation}-${versions.settlement}`;
  let shareActions = await readFile(shareActionsPath, 'utf8');
  const versionDeclaration = `const SHARE_PREVIEW_VERSION = '${previewVersion}';`;
  if (/const SHARE_PREVIEW_VERSION = '[^']+';/.test(shareActions)) {
    shareActions = shareActions.replace(/const SHARE_PREVIEW_VERSION = '[^']+';/, versionDeclaration);
  } else {
    shareActions = shareActions.replace('const SHARE_LINK_TYPES = Object.freeze({', `${versionDeclaration}\n\nconst SHARE_LINK_TYPES = Object.freeze({`);
  }
  await writeFile(shareActionsPath, shareActions);
  console.log(`Updated share preview version: ${previewVersion}`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
