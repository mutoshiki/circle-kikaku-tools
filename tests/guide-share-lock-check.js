const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const guide = fs.readFileSync(path.join(root, 'assets/js/templates/guide-content.js'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

assert(guide.includes('グループに貼るための見やすい一覧です。余計な編集情報は出しません。'), 'announcement view purpose text is missing');
assert(guide.includes('メモなどに個人情報がある場合はロックします。参加者は車割メーカーと精算ツールを見られません。'), 'lock privacy explanation is missing');
assert(guide.includes('共有リンクをコピーして企画グループに貼ります。リンクを開くと自動で発表ビューが開きます。'), 'share link auto announcement view explanation is missing');
assert(guide.includes('車割ができたらリンクをコピーし、企画グループに貼り付けます。'), 'group paste sharing instruction is missing');
assert(!guide.includes('未配置や定員超過がないか確認します。'), 'old announcement view explanation remains');
assert(!guide.includes('発表ビューで、未配置・定員超過がないか確認します。'), 'old car guide announcement view explanation remains');
