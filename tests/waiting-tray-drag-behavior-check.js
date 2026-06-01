const { readText } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const trayJs = readText('assets/js/features/waiting-tray.js');

assert(trayJs.includes('closedDuringDrag'), 'waiting tray should remember temporary close state during drag');
assert(trayJs.includes("tray.classList.add('minimized');") && trayJs.includes('ドラッグ中は待機欄を一時的に閉じ'), 'waiting tray should minimize at drag start');
assert(trayJs.includes("tray.dataset.closedByWaitingDrag === 'true'") && trayJs.includes("manualCardDrag.currentContainer?.id === 'waiting-list'"), 'waiting-origin drag should not auto reopen tray');
assert(trayJs.includes('droppedToWaiting') && trayJs.includes("tray.dataset.userMinimized = 'false'"), 'tray should restore/open after appropriate drop end');

console.log('Waiting tray drag behavior check OK');
