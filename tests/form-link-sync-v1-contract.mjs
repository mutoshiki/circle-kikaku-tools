import fs from 'node:fs';
import assert from 'node:assert/strict';

const feature = fs.readFileSync(new URL('../assets/js/features/form-link-sync.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../firebase-config.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../assets/css/guides-modals/import-guide/06-form-auto-link.css', import.meta.url), 'utf8');

assert.match(loader, /form-link-sync\.js\?v=automatic-form-sync-v1/);
assert.match(loader, /06-form-auto-link\.css\?v=automatic-form-sync-v1/);

assert.match(feature, /SOURCE_ROOM_PREFIX\s*=\s*['"]FORM_['"]/);
assert.match(feature, /\/spreadsheets\\?\/d\\?\//);
assert.match(feature, /docs\\\.google\\\.com\\\/forms|docs\.google\.com\\\/forms/);
assert.match(feature, /source\.meta\?\.kind\s*!==\s*SOURCE_KIND/);
assert.match(feature, /source\.meta\?\.spreadsheetId/);
assert.match(feature, /meta\.formImport/);
assert.match(feature, /importedResponses/);

assert.match(feature, /SanpoCanonicalState\.ensureParticipant/);
assert.match(feature, /SanpoCanonicalState\.ensureAllParticipantsPlaced/);
assert.match(feature, /sourceParticipant\?\.canDrive/);
assert.match(feature, /g_car_/);
assert.match(feature, /persistCanonicalImport/);
assert.match(feature, /save\(\)/);

// Import is intentionally additive. Removing a Google Form response or unlinking must
// never delete a participant that an organizer may already have allocated manually.
assert.doesNotMatch(feature, /deleteParticipant\s*\(/);
assert.match(feature, /すでに取り込んだ参加者は削除されません/);

// Dynamic UI must stay on Carbon controls; the static app contract forbids native form
// controls outside the navigation shell.
assert.match(feature, /<cds-text-input/);
assert.match(feature, /<cds-button/);
assert.doesNotMatch(feature, /<(?:input|textarea|select|button)\b/i);
assert.doesNotMatch(feature, /createElement\(['"](?:input|textarea|select|button)['"]\)/i);

assert.match(css, /\.form-auto-link/);
assert.match(css, /var\(--cds-/);

console.log('PASS automatic form response link contract');
