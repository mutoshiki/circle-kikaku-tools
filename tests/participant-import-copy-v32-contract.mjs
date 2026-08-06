import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../assets/css/guides-modals/import-guide/01-import-shell.css', import.meta.url), 'utf8');

const lead = '回答全体を貼り付けると、全員の名前・学年・車出しをまとめて読み込めます。';
const instruction = 'スプレッドシートの各項目の見出しの行も一緒にコピーしてください。';
const oldCopy = '各項目の見出し行も一緒にコピーすると、読み取りやすくなります。';

const leadIndex = html.indexOf(lead);
const instructionIndex = html.indexOf(instruction);
const textareaIndex = html.indexOf('id="googleFormPasteArea"');
const accordionIndex = html.indexOf('<cds-accordion class="batch-import-help-accordion"');

if (leadIndex < 0) throw new Error('Lead help copy is missing.');
if (instructionIndex < 0) throw new Error('Required spreadsheet-heading instruction is missing.');
if (html.includes(oldCopy)) throw new Error('Obsolete inaccurate help copy remains.');
if (!(leadIndex < instructionIndex && instructionIndex < textareaIndex)) {
  throw new Error('The instruction must be directly below the lead copy and before the spreadsheet textarea.');
}
if (!(instructionIndex < accordionIndex)) {
  throw new Error('The instruction must remain above the Carbon Accordion help content.');
}
if (!html.includes('class="batch-import-help-copy"')) {
  throw new Error('The paired helper copy wrapper is missing.');
}
if (!css.includes('.batch-import-help-text--instruction')) {
  throw new Error('Instruction text styling is missing from its owner stylesheet.');
}

console.log('PASS participant import helper copy v32 contract');
