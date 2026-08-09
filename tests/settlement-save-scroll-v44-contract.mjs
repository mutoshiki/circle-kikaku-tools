import fs from 'node:fs';

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const html = fs.readFileSync('index.html', 'utf8');
const modal = fs.readFileSync('assets/js/core/modal-controller.js', 'utf8');
const state = fs.readFileSync('assets/js/features/settlement/01-state.js', 'utf8');
const render = fs.readFileSync('assets/js/features/settlement/03-render.js', 'utf8');
const tray = fs.readFileSync('assets/js/features/waiting-tray.js', 'utf8');
const drag = fs.readFileSync('assets/js/features/drag-edit-view.js', 'utf8');
const batch = fs.readFileSync('assets/js/features/batch-import.js', 'utf8');

expect(html.includes('id="saveSettlementCarEditBtn"'), 'car settlement modal has a stable static save id');
expect(!/id="saveSettlementSettingsBtn"[^>]*data-action=/.test(html), 'settings save is not delegated as generated HTML');
expect(!/id="saveSettlementCarEditBtn"[^>]*data-action=/.test(html), 'car save is not delegated as generated HTML');
expect(modal.includes("bindStaticSettlementSave('saveSettlementSettingsBtn', 'saveSettlementSettings')"), 'settings save is directly bound');
expect(modal.includes("bindStaticSettlementSave('saveSettlementCarEditBtn', 'saveSettlementCarEdit')"), 'car save is directly bound');
expect(state.includes('function readSettlementSelectValue'), 'Carbon select state has an upgrade-safe reader');
expect(state.includes("cds-select-item[selected]"), 'selected Carbon item is the fallback source of truth');
expect(render.includes('if (!valid) {\n        refreshSettlementCarEditor'), 'valid car editor is not reconstructed before persistence');
expect(render.indexOf('const saved = persistSettlementEditLocallyAndQueueSync();') < render.indexOf('if (saved && renderAfter) renderSettlementView'), 'settings persists before render');
expect(render.includes("saveSettlementCarEditDraft({ renderAfter: false, refreshRenamedEditor: false })"), 'car Save commits live fields before modal/render teardown');
expect(tray.includes('captureTopAreaViewportForCardMutation'), 'drag captures the scroll viewport before DOM mutation');
expect(tray.includes('restoreTopAreaViewportAfterCardMutation'), 'drag restores scroll after layout settles');
const finishStart = drag.indexOf('function finishManualCardDrag');
const finishEnd = drag.indexOf('function startManualCardDrag', finishStart);
const finishBody = drag.slice(finishStart, finishEnd);
expect(finishBody.indexOf('const viewport = captureTopAreaViewportForCardMutation') < finishBody.indexOf('commitManualCardDrop()'), 'viewport is captured before reparenting');
expect(finishBody.indexOf('updateUI();') < finishBody.indexOf('restoreTopAreaViewportAfterCardMutation?.(viewport)'), 'viewport restoration spans updateUI');
expect(batch.includes('const tombstones = canonical.participantTombstones'), 'participant registration reserves canonical deletion tombstones');
expect(batch.includes("if (!newParticipants[id]) tombstones[id] = { deletedAt: deletionTime };"), 'participant registration records authoritative roster deletions');

console.log('Settlement modal save + signed expense + drag scroll v44 contract: PASS');
