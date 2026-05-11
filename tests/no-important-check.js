const fs = require('fs');
const { listCssFiles } = require('./helpers/read-project');

const files = listCssFiles();
const offenders = [];

for (const filePath of files) {
  const css = fs.readFileSync(filePath, 'utf8');
  const importantCount = (css.match(/!important/g) || []).length;
  if (importantCount > 0) offenders.push(`${filePath}: ${importantCount}`);
}

if (offenders.length) {
  console.error('Avoid adding new !important rules. Existing offender files:', offenders.join(', '));
  process.exit(1);
}

console.log('No important check OK');
