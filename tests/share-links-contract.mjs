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

const presentationShare = await text('share/presentation/index.html');
const settlementShare = await text('share/settlement/index.html');
const shareActions = await text('assets/js/features/share-actions.js');
const sheetView = await text('assets/js/features/sheet-view.js');
const presentationSource = await text('ogp/presentation/index.html');
const settlementSource = await text('ogp/settlement/index.html');

expect(presentationShare.includes('og:title" content="車割・班割｜サークル企画ツール'), '発表用OGタイトルがありません');
expect(presentationShare.includes('/assets/images/ogp/presentation.png'), '発表用OG画像がありません');
expect(presentationShare.includes("target.searchParams.set('view', 'sheet')"), '発表用リンクがsheetへ遷移しません');
expect(settlementShare.includes('og:title" content="精算入力｜サークル企画ツール'), '精算用OGタイトルがありません');
expect(settlementShare.includes('/assets/images/ogp/settlement.png'), '精算用OG画像がありません');
expect(settlementShare.includes("target.searchParams.set('view', 'seisan')"), '精算用リンクがseisanへ遷移しません');
expect(shareActions.includes('車割・班割（発表用リンク）'), '共有モーダルの発表用文言がありません');
expect(shareActions.includes('精算入力用リンク'), '共有モーダルの精算用文言がありません');
expect(shareActions.includes("path: 'share/presentation/'"), '発表用リンクパスがありません');
expect(shareActions.includes("path: 'share/settlement/'"), '精算用リンクパスがありません');
expect(sheetView.includes("['list', 'sheet', 'seisan'].includes(requestedInitialView)"), 'viewクエリの初期画面処理がありません');
expect(presentationSource.includes('決定した車・班を'), '発表用サムネイルの本文がありません');
expect(settlementSource.includes('徴収額を決定'), '精算用サムネイルの本文がありません');

for (const name of ['presentation', 'settlement']) {
  const path = resolve(root, `assets/images/ogp/${name}.png`);
  try {
    await stat(path);
    const size = pngSize(await readFile(path));
    expect(size?.width === 1200 && size?.height === 630, `${name}.png は1200x630ではありません`);
  } catch (_) {
    errors.push(`${name}.png がありません`);
  }
}

if (errors.length) {
  console.error(errors.map(error => `FAIL: ${error}`).join('\n'));
  process.exit(1);
}
console.log('PASS: share links and OGP thumbnails contract');
