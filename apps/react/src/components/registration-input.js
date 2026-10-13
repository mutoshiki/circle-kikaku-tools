import { formParser } from '../domain/index.js';

export function parseManualNames(text) {
  const names = new Map();
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const name = line.trim();
    const key = formParser.normalizeNameForCompare(name);
    if (key && !names.has(key)) names.set(key, { key, name });
  }
  return [...names.values()];
}

export function buildManualPeople(names, attributesByKey = {}) {
  return names.map(({ key, name }) => {
    const attributes = attributesByKey[key] || {};
    return {
      name,
      grade: Math.max(0, Math.min(4, Number.parseInt(attributes.grade, 10) || 0)),
      driver: attributes.driver === true,
    };
  });
}

export function summarizePeople(people) {
  return {
    total: people.length,
    drivers: people.filter(person => person.driver === true).length,
    unknownGrades: people.filter(person => !(Number(person.grade) > 0)).length,
  };
}
