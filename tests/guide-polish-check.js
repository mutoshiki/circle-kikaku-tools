const { readText, readCssBundle } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const guide = readText('assets/js/templates/guide-content.js');
const guideCss = readCssBundle();
const trayCss = guideCss;
const html = readText('index.html');

assert(guide.includes('フォーム回答を読み込み'), 'requested import mock title missing');
assert(guide.includes('名前&nbsp;&nbsp;学籍番号もしくは学年&nbsp;&nbsp;(車出し)'), 'requested pasted table header missing');
assert(guide.includes('藤田 陽斗&nbsp;&nbsp;24T1234A&nbsp;&nbsp;Yes'), 'mixed pasted table first sample missing');
assert(guide.includes('田中太郎&nbsp;&nbsp;1年&nbsp;&nbsp;No'), 'mixed pasted table second sample missing');
assert(guide.includes('前田 航平&nbsp;&nbsp;23T9081A&nbsp;&nbsp;Yes'), 'mixed pasted table third sample missing');
assert(!guide.includes(`1&nbsp;&nbsp;田中太郎&nbsp;&nbsp;No</div>
                        <div>1&nbsp;&nbsp;山田 美咲&nbsp;&nbsp;No</div>
                        <div>2&nbsp;&nbsp;中村 海斗&nbsp;&nbsp;No</div>`), 'old grade-grouped pasted table sample remains');
assert(guide.includes('登録欄に読み込む'), 'requested import mock button missing');
assert(guide.includes('スプレッドシート全体をそのまま貼り付けるだけで、名前・学籍番号/学年・車出しをまとめて読み込めます。'), 'requested spreadsheet explanation missing');
assert(guide.includes('見出し行も一緒にコピーすると判定しやすくなります。'), 'requested heading-row note missing');
assert(!guide.includes('見出し付きで貼り付け'), 'old guide helper wording remains');
assert(!guide.includes('車出しの有無'), 'old guide spreadsheet heading remains');

assert(guideCss.includes('--guide-external-blue: var(--palette-blue-600)'), 'fixed light blue selection token missing');
assert(guideCss.includes('--guide-external-blue: var(--palette-blue-400)'), 'fixed dark blue selection token missing');
assert(guideCss.includes('margin: 0 auto;'), 'centered spreadsheet selection override missing');
assert(guideCss.includes('Participant registration mock: calm'), 'calm participant registration mock rule missing');
assert(trayCss.includes('fill-empty is secondary'), 'tray button priority rule missing');
assert(html.includes('名前&#9;学籍番号もしくは学年&#9;(車出し)'), 'actual import placeholder should show mixed spreadsheet rows');
assert(html.includes('全員の名前・学年・車出しをまとめて読み込めます。'), 'actual import modal wording not aligned');
assert(!html.includes('btn btn-success btn-sm flex-grow-1'), 'green guide close buttons remain');

console.log('Guide polish check OK');
