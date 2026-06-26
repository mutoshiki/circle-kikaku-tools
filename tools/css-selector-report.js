const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cssRoot = path.join(root, 'assets', 'css');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function findClosingBrace(css, open, end = css.length) {
  let depth = 1;
  for (let i = open + 1; i < end; i += 1) {
    const char = css[i];
    if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) return i;
  }
  throw new Error(`Unclosed CSS block near offset ${open}`);
}

function splitSelectors(prelude) {
  const selectors = [];
  let start = 0;
  let depth = 0;
  let quote = '';
  for (let i = 0; i < prelude.length; i += 1) {
    const char = prelude[i];
    if (quote) {
      if (char === '\\') i += 1;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth -= 1;
    else if (char === ',' && depth === 0) {
      selectors.push(prelude.slice(start, i));
      start = i + 1;
    }
  }
  selectors.push(prelude.slice(start));
  return selectors.map(value => value.trim().replace(/\s+/g, ' ')).filter(Boolean);
}

function parseRules(css, file, records, context = [], start = 0, end = css.length) {
  let cursor = start;
  while (cursor < end) {
    const open = css.indexOf('{', cursor);
    if (open === -1 || open >= end) return;
    const close = findClosingBrace(css, open, end);
    const prelude = css.slice(cursor, open).trim();
    cursor = close + 1;
    if (!prelude) continue;

    if (prelude.startsWith('@media') || prelude.startsWith('@supports') || prelude.startsWith('@container') || prelude.startsWith('@layer')) {
      parseRules(css, file, records, [...context, prelude.replace(/\s+/g, ' ')], open + 1, close);
      continue;
    }
    if (prelude.startsWith('@')) continue;

    for (const selector of splitSelectors(prelude)) {
      records.push({
        selector,
        file,
        context,
        responsive: context.some(item => item.startsWith('@media'))
      });
    }
  }
}

function collectRecords() {
  const records = [];
  for (const file of walk(cssRoot).filter(file => file.endsWith('.css')).sort()) {
    const relative = path.relative(cssRoot, file).replace(/\\/g, '/');
    const css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    try {
      parseRules(css, relative, records);
    } catch (error) {
      throw new Error(`${relative}: ${error.message}`);
    }
  }
  return records;
}

function buildReport(records = collectRecords()) {
  const grouped = new Map();
  for (const record of records) {
    if (!grouped.has(record.selector)) grouped.set(record.selector, []);
    grouped.get(record.selector).push(record);
  }
  const selectors = [...grouped.entries()].map(([selector, matches]) => ({
    selector,
    definitions: matches.length,
    baseDefinitions: matches.filter(match => !match.responsive).length,
    responsiveDefinitions: matches.filter(match => match.responsive).length,
    files: [...new Set(matches.map(match => match.file))].sort()
  })).sort((a, b) => b.definitions - a.definitions || a.selector.localeCompare(b.selector));

  return {
    generatedAt: new Date().toISOString(),
    cssFiles: walk(cssRoot).filter(file => file.endsWith('.css')).length,
    selectorCount: selectors.length,
    duplicateSelectorCount: selectors.filter(item => item.definitions > 1).length,
    selectors
  };
}

if (require.main === module) {
  const report = buildReport();
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : 10;
  const output = {
    ...report,
    selectors: report.selectors.filter(item => item.definitions > 1).slice(0, limit)
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

module.exports = { buildReport, collectRecords };
