const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'assets/css/cars-members-tray/waiting-tray/06-action-and-list-layout.css'), 'utf8');

function assertIncludes(fragment, message) {
  if (!css.includes(fragment)) {
    throw new Error(message);
  }
}

assertIncludes('#waiting-list {', 'waiting-list override is missing');
assertIncludes('grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));', 'waiting list should avoid three narrow columns on Pro Max width');
assertIncludes('#waiting-list .member-main-line', 'waiting member line spacing override is missing');
assertIncludes('grid-template-columns: minmax(0, 1fr) auto 48px;', 'waiting member badge/menu columns should reserve a 48px mobile touch target');
assertIncludes('#waiting-list .member-name-text', 'waiting member name override is missing');
assertIncludes('text-overflow: clip;', 'waiting member name should not use ellipsis');
assertIncludes('white-space: normal;', 'waiting member full name should be allowed to wrap instead of truncating');
assertIncludes('#waiting-list .member-menu-btn', 'waiting member menu button sizing override is missing');
assertIncludes('minmax(158px, 1fr)', 'small iPhone fallback column width is missing');

console.log('waiting-member-fullname-layout-check OK');
