// Google Forms response spreadsheet parser.
// Pure helpers are exposed for tests and used by the participant registration modal.
(function (global) {
    'use strict';

    const NAME_HEADERS = ['名前', '氏名', 'お名前', '参加者名', 'フルネーム', 'Name', 'name'];
    const GRADE_HEADERS = ['学年', '年', '年次', 'grade', 'Grade'];
    const STUDENT_ID_HEADERS = ['学籍番号', '学生番号', '学籍', '番号', 'student id', 'studentId', 'id'];
    const DRIVER_HEADERS = ['車出し', '車', '運転', '配車', '車を出せる', '車出し可', '自家用車', 'driver', 'car'];

    function toNfkc(value) {
        return String(value ?? '').normalize('NFKC');
    }

    function trimDisplay(value) {
        return String(value ?? '').trim();
    }

    function normalizeHeader(value) {
        return toNfkc(value)
            .toLowerCase()
            .replace(/[\s\u3000_\-－‐–—:：?？!！()（）\[\]【】「」『』]/g, '')
            .trim();
    }

    function normalizeNameForCompare(value) {
        return trimDisplay(value).replace(/[\s\u3000\t\r\n]+/g, '');
    }

    function parseDelimitedLine(line, delimiter) {
        if (delimiter === '\t') return String(line).split('\t');

        const cells = [];
        let current = '';
        let quoted = false;
        const text = String(line ?? '');
        for (let i = 0; i < text.length; i += 1) {
            const ch = text[i];
            const next = text[i + 1];
            if (ch === '"') {
                if (quoted && next === '"') {
                    current += '"';
                    i += 1;
                } else {
                    quoted = !quoted;
                }
                continue;
            }
            if (ch === delimiter && !quoted) {
                cells.push(current);
                current = '';
                continue;
            }
            current += ch;
        }
        cells.push(current);
        return cells;
    }

    function parseTable(raw) {
        const text = String(raw ?? '').replace(/\r\n?/g, '\n');
        const delimiter = text.includes('\t') ? '\t' : ',';
        return text
            .split('\n')
            .map(line => parseDelimitedLine(line, delimiter))
            .filter(row => row.some(cell => trimDisplay(cell)));
    }

    function candidateNorms(candidates) {
        return candidates.map(normalizeHeader);
    }

    function findColumn(headers, type) {
        const normalized = headers.map(normalizeHeader);
        const exactMap = {
            name: candidateNorms(NAME_HEADERS),
            grade: candidateNorms(GRADE_HEADERS),
            studentId: candidateNorms(STUDENT_ID_HEADERS),
            driver: candidateNorms(DRIVER_HEADERS)
        };
        const exactIndex = normalized.findIndex(header => exactMap[type].includes(header));
        if (exactIndex >= 0) return exactIndex;

        const containsMap = {
            name: ['名前', '氏名', 'お名前', '参加者名', 'フルネーム', 'name'].map(normalizeHeader),
            grade: ['学年', '年次', 'grade'].map(normalizeHeader),
            studentId: ['学籍番号', '学生番号', '学籍', 'studentid'].map(normalizeHeader),
            driver: ['車出し', '車を出せる', '車出し可', '自家用車', '運転', '配車', 'driver', 'car'].map(normalizeHeader)
        };
        return normalized.findIndex(header => containsMap[type].some(token => token && header.includes(token)));
    }

    function columnLabel(index) {
        let n = Number(index) + 1;
        let label = '';
        while (n > 0) {
            const rem = (n - 1) % 26;
            label = String.fromCharCode(65 + rem) + label;
            n = Math.floor((n - 1) / 26);
        }
        return label;
    }

    function parseGradeValue(value) {
        const raw = trimDisplay(value);
        if (!raw) return null;
        const text = toNfkc(raw)
            .toLowerCase()
            .replace(/[壱一]/g, '1')
            .replace(/[弐二]/g, '2')
            .replace(/[参三]/g, '3')
            .replace(/[四]/g, '4')
            .replace(/[\s\u3000]+/g, '');
        const match = text.match(/(?:^|[^0-9])([1-4])(?:年|$|[^0-9])/);
        return match ? Number(match[1]) : null;
    }

    function currentJapaneseAcademicYear(date = new Date()) {
        const d = date instanceof Date ? date : new Date(date);
        if (Number.isNaN(d.getTime())) return new Date().getFullYear();
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        return month >= 4 ? year : year - 1;
    }

    function inferGradeFromStudentId(value, options = {}) {
        const raw = trimDisplay(value);
        if (!raw) return null;
        const normalized = toNfkc(raw).toUpperCase().replace(/[\s\u3000]+/g, '');
        const match = normalized.match(/^(\d{2})/);
        if (!match) return null;
        const entranceYear = 2000 + Number(match[1]);
        const academicYear = Number(options.academicYear) || currentJapaneseAcademicYear(options.currentDate);
        const grade = academicYear - entranceYear + 1;
        if (grade < 1 || grade > 4) return null;
        return grade;
    }

    function parseDriverValue(value) {
        const raw = trimDisplay(value);
        if (!raw) return null;
        const text = toNfkc(raw)
            .toLowerCase()
            .replace(/[\s\u3000]+/g, '');

        const negativeExact = new Set(['false', '0', 'no', 'n', '×', '✕', 'x']);
        const positiveExact = new Set(['true', '1', 'yes', 'y', '○', '◯', '〇']);
        const negativeTokens = [
            'いいえ', 'しない', '出さない', '出せない', '出せません', 'できない', 'できません',
            '出来ない', '出来ません', '不可', '無理', '車出し不可', '運転不可',
            '自家用車なし', '車なし', 'なし', '無し', '無'
        ].map(token => toNfkc(token).toLowerCase().replace(/[\s\u3000]+/g, ''));
        const positiveTokens = [
            'はい', 'する', '出す', '出せる', '出せます', 'できます', '出来ます',
            '可能', '可', '車出し可', '運転可', '自家用車あり', '車あり', 'あり', '有'
        ].map(token => toNfkc(token).toLowerCase().replace(/[\s\u3000]+/g, ''));

        if (negativeExact.has(text)) return false;
        if (negativeTokens.some(token => token && text.includes(token))) return false;
        if (positiveExact.has(text)) return true;
        if (positiveTokens.some(token => token && text.includes(token))) return true;
        return null;
    }

    function makeColumnInfo(headers, index) {
        if (index < 0) return null;
        return {
            index,
            letter: columnLabel(index),
            header: trimDisplay(headers[index])
        };
    }

    function buildColumnLabel(info) {
        if (!info) return 'なし';
        return `${info.letter}列「${info.header || '無題'}」`;
    }

    function parseSpreadsheetImport(raw, options = {}) {
        const warnings = [];
        const errors = [];
        const warningSet = new Set();
        const addWarning = message => {
            if (!message || warningSet.has(message)) return;
            warningSet.add(message);
            warnings.push(message);
        };

        const rows = parseTable(raw);
        if (!rows.length) {
            return { ok: false, errors: ['貼り付け内容が空です。'], warnings, people: [], groups: buildEmptyGroups(), columns: {} };
        }
        if (rows.length < 2) {
            return { ok: false, errors: ['見出し行と回答行を含む表を貼り付けてください。'], warnings, people: [], groups: buildEmptyGroups(), columns: {} };
        }

        const headers = rows[0].map(trimDisplay);
        const nameIndex = findColumn(headers, 'name');
        const gradeIndex = findColumn(headers, 'grade');
        const studentIdIndex = findColumn(headers, 'studentId');
        const driverIndex = findColumn(headers, 'driver');

        const columns = {
            name: makeColumnInfo(headers, nameIndex),
            grade: makeColumnInfo(headers, gradeIndex),
            studentId: makeColumnInfo(headers, studentIdIndex),
            driver: makeColumnInfo(headers, driverIndex)
        };

        if (nameIndex < 0) {
            errors.push('名前列が見つかりません。見出しに「名前」「氏名」「お名前」などを含めてください。');
            return { ok: false, errors, warnings, people: [], groups: buildEmptyGroups(), columns };
        }

        const peopleMap = new Map();
        rows.slice(1).forEach((row, offset) => {
            const rowNumber = offset + 2;
            const displayName = trimDisplay(row[nameIndex]);
            if (!displayName) return;
            const normalizedName = normalizeNameForCompare(displayName);
            if (!normalizedName) return;

            let grade = null;
            const gradeValue = gradeIndex >= 0 ? row[gradeIndex] : '';
            const studentIdValue = studentIdIndex >= 0 ? row[studentIdIndex] : '';
            const parsedGrade = gradeIndex >= 0 ? parseGradeValue(gradeValue) : null;
            const inferredGrade = studentIdIndex >= 0 ? inferGradeFromStudentId(studentIdValue, options) : null;

            if (gradeIndex >= 0) {
                const gradeAndStudentIdShareColumn = gradeIndex === studentIdIndex;
                if (parsedGrade) {
                    grade = parsedGrade;
                } else if (gradeAndStudentIdShareColumn && inferredGrade) {
                    grade = inferredGrade;
                } else {
                    addWarning(`${displayName}：学年を判定できませんでした（${rowNumber}行目、値「${trimDisplay(gradeValue) || '空欄'}」）。`);
                }
                if (studentIdIndex >= 0 && trimDisplay(studentIdValue) && !inferredGrade && !parsedGrade) {
                    const label = gradeAndStudentIdShareColumn ? '学籍番号もしくは学年' : '学籍番号';
                    addWarning(`${displayName}：${label}から学年を判定できませんでした（${rowNumber}行目、値「${trimDisplay(studentIdValue)}」）。`);
                }
                if (!gradeAndStudentIdShareColumn && parsedGrade && inferredGrade && parsedGrade !== inferredGrade) {
                    addWarning(`${displayName}：学年列は${parsedGrade}年ですが、学籍番号からは${inferredGrade}年と推定されます。学年列の値を採用します。`);
                }
            } else if (studentIdIndex >= 0) {
                if (inferredGrade) {
                    grade = inferredGrade;
                } else {
                    addWarning(`${displayName}：学籍番号から学年を判定できませんでした（${rowNumber}行目、値「${trimDisplay(studentIdValue) || '空欄'}」）。`);
                }
            }

            let driver = null;
            if (driverIndex >= 0) {
                const driverValue = row[driverIndex];
                driver = parseDriverValue(driverValue);
                if (driver === null && trimDisplay(driverValue)) {
                    addWarning(`${displayName}：車出しの値を判定できませんでした（${rowNumber}行目、値「${trimDisplay(driverValue)}」）。`);
                }
            }

            const existing = peopleMap.get(normalizedName);
            if (!existing) {
                peopleMap.set(normalizedName, {
                    name: displayName,
                    normalizedName,
                    grade: grade || 0,
                    driver,
                    variants: new Set([displayName]),
                    rowNumbers: [rowNumber]
                });
                return;
            }

            existing.rowNumbers.push(rowNumber);
            existing.variants.add(displayName);
            if (grade && existing.grade && grade !== existing.grade) {
                addWarning(`${existing.name}：複数行で学年が一致しません（${existing.grade}年 / ${grade}年）。最初に判定した学年を採用します。`);
            } else if (grade && !existing.grade) {
                existing.grade = grade;
            }

            if (driver !== null) {
                if (existing.driver !== null && existing.driver !== undefined && existing.driver !== driver) {
                    addWarning(`${existing.name}：複数行で車出し回答が一致しません。車出しありを優先します。`);
                }
                if (driver === true || existing.driver === null || existing.driver === undefined) {
                    existing.driver = driver;
                }
            }
        });

        const people = Array.from(peopleMap.values()).map(entry => {
            if (entry.variants.size > 1) {
                addWarning(`${Array.from(entry.variants).join(' / ')}：表記ゆれの可能性があります。表示名は最初の「${entry.name}」を採用します。`);
            }
            if (entry.rowNumbers.length > 1) {
                addWarning(`${entry.name}：同じ人が複数行にある可能性があります（${entry.rowNumbers.join('・')}行目）。自動統合しました。`);
            }
            return {
                name: entry.name,
                normalizedName: entry.normalizedName,
                grade: entry.grade || 0,
                driver: entry.driver === true
            };
        });

        const groups = buildGroups(people);
        return {
            ok: errors.length === 0,
            errors,
            warnings,
            people,
            groups,
            counts: buildCounts(people),
            columns,
            gradeSource: gradeIndex >= 0 ? 'grade' : (studentIdIndex >= 0 ? 'studentId' : 'none'),
            columnText: {
                name: buildColumnLabel(columns.name),
                grade: gradeIndex >= 0 ? buildColumnLabel(columns.grade) : (studentIdIndex >= 0 ? `${buildColumnLabel(columns.studentId)}から推定` : 'なし'),
                studentId: buildColumnLabel(columns.studentId),
                driver: buildColumnLabel(columns.driver)
            }
        };
    }

    function buildEmptyGroups() {
        return { members: [], grade1: [], grade2: [], grade3: [], grade4: [], drivers: [] };
    }

    function buildGroups(people) {
        const groups = buildEmptyGroups();
        people.forEach(person => {
            if (person.grade >= 1 && person.grade <= 4) groups[`grade${person.grade}`].push(person.name);
            else groups.members.push(person.name);
            if (person.driver) groups.drivers.push(person.name);
        });
        return groups;
    }

    function buildCounts(people) {
        return {
            total: people.length,
            grade1: people.filter(person => person.grade === 1).length,
            grade2: people.filter(person => person.grade === 2).length,
            grade3: people.filter(person => person.grade === 3).length,
            grade4: people.filter(person => person.grade === 4).length,
            noGrade: people.filter(person => !person.grade).length,
            drivers: people.filter(person => person.driver).length
        };
    }

    global.SanpoFormImportParser = Object.freeze({
        parseSpreadsheetImport,
        normalizeNameForCompare,
        parseGradeValue,
        inferGradeFromStudentId,
        parseDriverValue,
        currentJapaneseAcademicYear,
        columnLabel,
        parseTable
    });
})(window);
