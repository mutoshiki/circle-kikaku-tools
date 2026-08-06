import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const errors = [];

async function text(path) {
  return readFile(resolve(root, path), 'utf8');
}

function expect(condition, message) {
  if (!condition) errors.push(message);
}

function pngSize(buffer) {
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function referencedImage(html, name) {
  return html.match(new RegExp(`/assets/images/ogp/(${name}\\.[a-f0-9]{12}\\.png)`))?.[1] ?? null;
}

const presentationShare = await text('share/presentation/index.html');
const settlementShare = await text('share/settlement/index.html');
const shareActions = await text('assets/js/features/share-actions.js');
const sheetView = await text('assets/js/features/sheet-view.js');
const presentationSource = await text('ogp/presentation/index.html');
const settlementSource = await text('ogp/settlement/index.html');

expect(presentationShare.includes('og:title" content="車割・班割｜サークル企画ツール'), '発表用OGタイトルがありません');
expect(presentationShare.includes("target.searchParams.set('view', 'sheet')"), '発表用リンクがsheetへ遷移しません');
expect(settlementShare.includes('og:title" content="精算｜サークル企画ツール'), '精算用OGタイトルがありません');
expect(settlementShare.includes("target.searchParams.set('view', 'seisan')"), '精算用リンクがseisanへ遷移しません');
expect(shareActions.includes('車割・班割（発表用リンク）'), '共有モーダルの発表用文言がありません');
expect(shareActions.includes('精算用リンク'), '共有モーダルの精算用文言がありません');
expect(shareActions.includes("path: 'share/presentation/'"), '発表用リンクパスがありません');
expect(shareActions.includes("path: 'share/settlement/'"), '精算用リンクパスがありません');
expect(/const SHARE_PREVIEW_VERSION = '[a-f0-9]{12}-[a-f0-9]{12}';/.test(shareActions), '共有プレビューのバージョンがありません');
expect(shareActions.includes("url.searchParams.set('preview', SHARE_PREVIEW_VERSION)"), '共有URLにキャッシュ更新用パラメータがありません');
expect(sheetView.includes("['list', 'sheet', 'seisan'].includes(requestedInitialView)"), 'viewクエリの初期画面処理がありません');
expect(presentationSource.includes('<h1 class="ogp-title">車割・班割</h1>'), '発表用サムネイルのタイトルがありません');
expect(settlementSource.includes('<h1 class="ogp-title">精算</h1>'), '精算用サムネイルのタイトルがありません');

for (const [name, html] of [['presentation', presentationShare], ['settlement', settlementShare]]) {
  const hashedName = referencedImage(html, name);
  expect(Boolean(hashedName), `${name} のハッシュ付きOG画像参照がありません`);
  if (!hashedName) continue;

  const path = resolve(root, `assets/images/ogp/${hashedName}`);
  try {
    await stat(path);
    const size = pngSize(await readFile(path));
    expect(size?.width === 1200 && size?.height === 630, `${hashedName} は1200x630ではありません`);
    expect(html.includes(`/assets/images/ogp/${hashedName}`), `${name} のOG画像参照が不正です`);
  } catch (_) {
    errors.push(`${hashedName} がありません`);
  }
}

if (errors.length) {
  console.error(errors.map(error => `FAIL: ${error}`).join('\n'));
  process.exit(1);
}
console.log('PASS: share links, cache-busting URLs, and OGP thumbnails contract');
