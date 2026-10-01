import { formParser } from '../domain/index.js';

// UI input adapter only. The parser, canonical identity and registration command
// continue to own normalization, duplicate merging and placement side effects.
export function registrationPeople(draft) {
  let result;
  if (draft.source === 'paste') {
    result = formParser.parseSpreadsheetImport(String(draft.sheet || ''));
    if (!result.ok) return result;
    result = { ...result, people: result.people.map((person, index) => ({ ...person, ...draft.corrections?.[index] })) };
  } else {
    const split = value => String(value || '').split(/\r?\n/).map(name => name.trim()).filter(Boolean);
    const drivers = new Set(split(draft.drivers).map(formParser.normalizeNameForCompare));
    const grades = (draft.grades || ['', '', '', '']).map(value => new Set(split(value).map(formParser.normalizeNameForCompare)));
    const names = new Map();
    for (const name of [...split(draft.members), ...split(draft.drivers), ...(draft.grades || []).flatMap(split)]) {
      const key = formParser.normalizeNameForCompare(name);
      if (key && !names.has(key)) names.set(key, name);
    }
    result = { ok: true, warnings: [], people: [...names].map(([key, name]) => ({ name, grade: Math.max(0, grades.findIndex(keys => keys.has(key)) + 1), driver: drivers.has(key) })) };
  }
  const invalidIndex = result.people.findIndex(person => !String(person.name || '').trim());
  return { ...result, ok: !!result.people.length && invalidIndex === -1, invalidIndex,
    errors: invalidIndex >= 0 ? ['名前を入力してください。'] : result.people.length ? [] : ['参加者を入力してください。'] };
}
