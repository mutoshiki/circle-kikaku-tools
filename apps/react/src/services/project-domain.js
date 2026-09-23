// Legacy pure functions extracted verbatim; adapters inject state rather than DOM.
// Tests verify each declaration against its source. No classic script startup runs.
export function createProjectDomain({ getRoom = () => ({}), getAnnouncement = () => ({}), settlement, clock = { now: () => Date.now() } } = {}) {
const canonical = getRoom;
const APPLICATION_KIND = 'formApplicationSync';
const APPLICATION_VERSION = 2;
const FIXED_MEETING_PLACE = 'サークルボックス前';
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const window = { SanpoClock: clock };
const APP_SCHEMA_VERSION = 6;
const SINGLE_CAR_PLAN_ID = 'plan-car';
const SINGLE_TEAM_PLAN_ID = 'plan-team';
const normalizeCarSettlementState = value => settlement.normalizeCarSettlementState(value);
const normalizeSettlementState = value => settlement.normalizeSettlementState(value);
const fieldValue = id => String(getAnnouncement()[id.replace(/^announcement/, '').replace(/^./, c => c.toLowerCase())] || '').trim();
const selectedEventDate = (sync, room) => getAnnouncement().eventDate ?? sourceEventDate(sync, room);
const itineraryEntries = () => (getAnnouncement().itinerary || []).map(item => ({time:String(item.time || '').trim(),step:String(item.step || '').trim()})).filter(item => item.time || item.step);
const loadOverviewDraft = () => getRoom().overview || {};

// Source: assets/js/features/events/02-static-header-events.js; SHA-256 7eaf4571883858b0c2533bcb46c37a1b732e2f15b36e151b771871ae7ad7d27f
function getTimetableItems(draft) {
        if (Array.isArray(draft.timetableItems)) return draft.timetableItems;
        if (typeof draft.timetable === 'string' && draft.timetable.trim()) {
            return draft.timetable.split('\n').map(line => {
                const match = line.trim().match(/^([0-2]?\d:[0-5]\d)\s*(.*)$/);
                return match ? { time: match[1], title: match[2] || '' } : { time: '', title: line.trim() };
            });
        }
        return [{ time: '', title: '' }];
    }

function normalizeOverviewSnapshot(value = {}) {
        const source = value && typeof value === 'object' ? value : {};
        return {
            memo: String(source.memo || ''),
            timetableItems: getTimetableItems(source)
                .map(item => ({
                    time: String(item.time || '').slice(0, 5),
                    title: String(item.title || '').trim()
                }))
                .filter(item => item.time || item.title)
        };
    }

function buildTimetableText(items = getTimetableItems(loadOverviewDraft())) {
        return items
            .filter(item => item.time || item.title)
            .map(item => [item.time, item.title].filter(Boolean).join(' '))
            .join('\n');
    }


// Source: assets/js/features/participant-announcement.js; SHA-256 9f80c52fada3c5078b797dc2a77624ed4e1905285d2b5dbc849ced5873f34613
function applicationSync(room = canonical()) {
    const sync = room?.meta?.applicationSync;
    return sync?.kind === APPLICATION_KIND && Number(sync.version || 0) === APPLICATION_VERSION ? sync : null;
  }

function normalizedName(value) {
    return String(value || '').normalize('NFKC').replace(/[\s\u3000]+/g, '').toLocaleLowerCase('ja');
  }

function committedParticipants(room = canonical(), sync = applicationSync(room)) {
    if (!room || !sync) return [];
    const applicantsByName = new Map();
    Object.values(sync.applicants || {}).forEach(applicant => {
      const key = normalizedName(applicant?.name);
      if (!key) return;
      const entries = applicantsByName.get(key) || [];
      entries.push(applicant);
      applicantsByName.set(key, entries);
    });

    return Object.values(room.participants || {})
      .filter(person => String(person?.name || '').trim())
      .map(person => {
        const matches = applicantsByName.get(normalizedName(person.name)) || [];
        const applicant = matches.length === 1 ? matches[0] : null;
        return {
          name: String(person.name || '').trim(),
          grade: Math.max(0, Math.min(4, parseInt(person.grade ?? applicant?.grade, 10) || 0)),
          canDrive: Boolean(applicant?.canDrive)
        };
      })
      .sort((a, b) => (b.grade - a.grade) || a.name.localeCompare(b.name, 'ja'));
  }

function formatEventDate(value) {
    const raw = String(value || '').trim();
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
    if (!match) return '';
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0);
    if (Number.isNaN(date.getTime())) return '';
    return `${month}月${day}日(${WEEKDAYS[date.getDay()]})`;
  }

function projectName(sync = applicationSync(), room = canonical()) {
    const raw = String(sync?.title || room?.roomName || '').trim() || '企画';
    return raw.includes('企画') ? raw : `${raw}企画`;
  }

function sourceEventDate(sync = applicationSync(), room = canonical()) {
    return String(sync?.eventDate || sync?.date || room?.eventDate || room?.date || '').trim();
  }

function eventDateLabel(sync = applicationSync(), room = canonical()) {
    return formatEventDate(selectedEventDate(sync, room));
  }

function announcementTitle() {
    const sync = applicationSync();
    return `【参加者発表】${eventDateLabel(sync)}${projectName(sync)}`;
  }

function announcementSubject(sync = applicationSync(), room = canonical()) {
    return `${eventDateLabel(sync, room)}${projectName(sync, room)}`;
  }

function participantLines(participants) {
    const sections = [];
    [4, 3, 2, 1].forEach(grade => {
      const people = participants.filter(person => person.grade === grade);
      if (!people.length) return;
      sections.push(`${grade}年\n${people.map(person => `${person.canDrive ? '○' : ''}${person.name}`).join('   ')}`);
    });
    const unknown = participants.filter(person => ![1, 2, 3, 4].includes(person.grade));
    if (unknown.length) {
      sections.push(`学年未設定\n${unknown.map(person => `${person.canDrive ? '○' : ''}${person.name}`).join('   ')}`);
    }
    return sections.join('\n\n');
  }

function participantCountMatchesApplicants(participantCount, applicantCount, responseCount) {
    const total = applicantCount || Number(responseCount || 0);
    return participantCount > 0 && total > 0 && participantCount === total;
  }

function defaultApplicationMessage(room = canonical(), sync = applicationSync(room)) {
    const participants = committedParticipants(room, sync);
    const applicantCount = Object.keys(sync?.applicants || {}).length;
    const allAccepted = participantCountMatchesApplicants(participants.length, applicantCount, sync?.responseCount);
    return allAccepted
      ? '今回は応募してくださった方全員が参加できることになりました。\nご応募ありがとうございました！'
      : 'たくさんのご応募ありがとうございました！';
  }

function hasDrivers(participants) {
    return participants.some(person => person.canDrive);
  }

function itineraryLine(entry) {
    return [entry.time, entry.step].filter(Boolean).join(' ');
  }

function bodyText({ allowPlaceholder = false } = {}) {
    const room = canonical();
    const sync = applicationSync(room);
    const participants = committedParticipants(room, sync);
    if (!sync || !participants.length) return '';

    const time = fieldValue('announcementMeetingTime');
    const opening = fieldValue('announcementOpening');
    const supplement = fieldValue('announcementSupplement');
    const itinerary = itineraryEntries();
    const contact = fieldValue('announcementContact');
    const closing = fieldValue('announcementClosing');
    const meetingTime = time || (allowPlaceholder ? '［集合時間］' : '');
    const lines = [];

    if (opening) lines.push(opening, '');
    lines.push(`${announcementSubject(sync, room)}の参加者を発表します。`);
    lines.push(defaultApplicationMessage(room, sync));
    if (supplement) lines.push(supplement);

    lines.push('', '【参加者】');
    if (hasDrivers(participants)) lines.push('○は車出し');
    lines.push('', participantLines(participants), '', `以上${participants.length}人です。`);
    lines.push('', `当日は${meetingTime}に${FIXED_MEETING_PLACE}に集合してください。`);

    if (itinerary.length) {
      lines.push('', '～大まかな予定～');
      itinerary.forEach((entry, index) => {
        const line = itineraryLine(entry);
        if (!line) return;
        if (index > 0) lines.push('  ↓');
        lines.push(line);
      });
    }
    if (contact) lines.push('', '質問がありましたら', `${contact} までお願いします。`);
    if (closing) lines.push('', closing);
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }


// Source: assets/js/features/handoff-export.js; SHA-256 1e86395cbce6aaa9e717fc3b092bdbf6e6ee9c2bd8de99d724e1f7f9b5659433
function validToken(value) {
    return /^h_[A-Za-z0-9_-]{48,160}$/.test(String(value || ''));
  }

function committedExportSelection() {
    const room = canonical();
    const sync = applicationSync(room);
    if (!room || !sync) return { responseKeys: [], manualNames: [], ambiguousNames: [] };

    const applicantsByName = new Map();
    Object.entries(sync.applicants || {}).forEach(([responseKey, applicant]) => {
      const key = normalizedName(applicant?.name);
      if (!key) return;
      const entries = applicantsByName.get(key) || [];
      entries.push({ responseKey, applicant });
      applicantsByName.set(key, entries);
    });

    const responseKeys = [];
    const manualNames = [];
    const ambiguousNames = [];
    Object.values(room.participants || {}).forEach(participant => {
      const name = String(participant?.name || '').trim();
      if (!name) return;
      const candidates = applicantsByName.get(normalizedName(name)) || [];
      if (candidates.length === 1) {
        responseKeys.push(candidates[0].responseKey);
      } else if (candidates.length > 1) {
        // The current planning state intentionally contains no student number or response
        // identity. Never guess which same-name applicant was accepted: exporting both
        // could disclose another applicant's student number.
        ambiguousNames.push(name);
      } else {
        manualNames.push(name);
      }
    });

    return { responseKeys, manualNames, ambiguousNames };
  }

function csvCell(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

function buildParticipantCsv(participants = []) {
    const rows = [['学籍番号', '氏名']].concat(participants.map(person => [String(person?.studentId || ''), String(person?.name || '')]));
    return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }


// Source: assets/js/features/sample-data-history.js; SHA-256 43d62fd499bdaa965bc3dafdd947b67064f1b71cc164299ec6ad9f2524064f86
function createSampleTimetableItems() {
    return [
        { time: '08:00', title: '秋名山登山口 集合 https://maps.google.com' },
        { time: '08:15', title: '点呼・装備確認' },
        { time: '08:30', title: '登山開始' },
        { time: '10:30', title: '山頂到着・休憩' },
        { time: '11:30', title: '昼食' },
        { time: '12:30', title: '下山開始' },
        { time: '14:30', title: '登山口到着' },
        { time: '15:00', title: '解散' }
    ];
}

function createSampleTeamPlan(participants = []) {
    const people = participants.map(member => ({
        name: member.name,
        memo: member.memo || '',
        gender: member.gender || 'unknown',
        grade: parseInt(member.grade) || 0,
        locked: false
    })).filter(member => member.name);

    const firstLeader = people[0] || { name: '田中 太郎', gender: 'male', grade: 1, memo: '' };
    const secondLeader = people[4] || people[1] || { name: '伊藤 美月', gender: 'female', grade: 1, memo: '' };
    const thirdLeader = people[8] || people[2] || { name: '石井 拓海', gender: 'male', grade: 2, memo: '' };
    const firstMembers = people.slice(1, 4);
    const secondMembers = people.slice(5, 8);
    const thirdMembers = people.slice(9, 12);
    const usedNames = new Set([
        firstLeader.name,
        secondLeader.name,
        thirdLeader.name,
        ...firstMembers.map(m => m.name),
        ...secondMembers.map(m => m.name),
        ...thirdMembers.map(m => m.name)
    ]);

    return {
        id: typeof SINGLE_TEAM_PLAN_ID !== 'undefined' ? SINGLE_TEAM_PLAN_ID : 'plan-team',
        name: '班',
        templateType: 'team',
        lastAutoAssignLabel: '',
        waiting: people.filter(member => !usedNames.has(member.name)),
        cars: [
            {
                name: firstLeader.name,
                capacity: 5,
                driverMemo: firstLeader.memo || '',
                driverGender: firstLeader.gender || 'unknown',
                driverGrade: firstLeader.grade || 0,
                members: firstMembers
            },
            {
                name: secondLeader.name,
                capacity: 5,
                driverMemo: secondLeader.memo || '',
                driverGender: secondLeader.gender || 'unknown',
                driverGrade: secondLeader.grade || 0,
                members: secondMembers
            },
            {
                name: thirdLeader.name,
                capacity: 5,
                driverMemo: thirdLeader.memo || '',
                driverGender: thirdLeader.gender || 'unknown',
                driverGrade: thirdLeader.grade || 0,
                members: thirdMembers
            }
        ]
    };
}

function getSampleDrivers() {
    return [
        { name: '藤原 拓海', capacity: 3, gender: 'male', grade: 3, memo: '' },
        { name: '高橋 啓介', capacity: 3, gender: 'male', grade: 4, memo: '' },
        { name: '高橋 涼介', capacity: 4, gender: 'male', grade: 4, memo: '' },
        { name: '須藤 京一', capacity: 3, gender: 'male', grade: 4, memo: '' },
        { name: '小柏 カイ', capacity: 3, gender: 'male', grade: 3, memo: '' }
    ];
}

function getSampleMembers() {
    return [
        { name: '武内 樹', grade: 3, gender: 'male' },
        { name: '茂木 なつき', grade: 3, gender: 'female' },
        { name: '池谷 浩一郎', grade: 4, gender: 'male' },
        { name: '健二', grade: 4, gender: 'male' },
        { name: '中村 賢太', grade: 3, gender: 'male' },
        { name: '佐藤 真子', grade: 4, gender: 'female' },
        { name: '沙雪', grade: 4, gender: 'female' },
        { name: '秋山 渉', grade: 4, gender: 'male' },
        { name: '秋山 和美', grade: 3, gender: 'female' },
        { name: '岩城 清次', grade: 4, gender: 'male' },
        { name: '立花 祐一', grade: 4, gender: 'male' },
        { name: '藤原 文太', grade: 4, gender: 'male' },
        { name: '庄司 慎吾', grade: 4, gender: 'male' },
        { name: '小柏 健', grade: 4, gender: 'male' },
        { name: '北条 凛', grade: 4, gender: 'male' },
        { name: '北条 豪', grade: 4, gender: 'male' },
        { name: '皆川 英雄', grade: 4, gender: 'male' },
        { name: '乾 信司', grade: 2, gender: 'male' }
    ];
}

function cloneSampleMember(member = {}) {
    return {
        name: member.name,
        memo: member.memo || '',
        gender: member.gender || 'unknown',
        grade: parseInt(member.grade) || 0,
        locked: !!member.locked
    };
}

function getSampleMemberLimitForCars(drivers = []) {
    return drivers.reduce((total, driver) => {
        const capacity = Math.max(0, Number(driver.capacity) || 0);
        return total + capacity;
    }, 0);
}

function createSampleCarPlan(carCount = 3) {
    const drivers = getSampleDrivers().slice(0, Math.max(2, Math.min(5, Number(carCount) || 3)));
    const seatCount = getSampleMemberLimitForCars(drivers);
    // サンプル投入直後に「入りきらない人」が出ないよう、車の席数ぶんだけ参加者を使う。
    const members = getSampleMembers().slice(0, seatCount).map(cloneSampleMember);
    let cursor = 0;
    const cars = drivers.map((driver) => {
        const count = Math.max(0, Number(driver.capacity) || 3);
        const assigned = members.slice(cursor, cursor + count);
        cursor += count;
        return {
            name: driver.name,
            capacity: driver.capacity,
            driverMemo: driver.memo || '',
            driverGender: driver.gender || 'unknown',
            driverGrade: driver.grade || 0,
            members: assigned
        };
    });

    return {
        id: typeof SINGLE_CAR_PLAN_ID !== 'undefined' ? SINGLE_CAR_PLAN_ID : 'plan-car',
        name: '車割',
        templateType: 'car',
        lastAutoAssignLabel: 'サンプル配置',
        waiting: [],
        cars
    };
}

function createSampleSettlementState(carPlan, { missing = false } = {}) {
    const normalCars = {
        '藤原 拓海': { dist: '186', eco: '18', price: '158', rentalType: 'private', extras: [{ name: '駐車場', amount: '200', type: 'split' }] },
        '高橋 啓介': { dist: '242', eco: '14', price: '162', rentalType: 'times', extras: [{ name: '駐車場', amount: '200', type: 'split' }] },
        '高橋 涼介': { dist: '218', eco: '16.5', price: '160', rentalType: 'private', extras: [{ name: '駐車場', amount: '200', type: 'split' }] },
        '須藤 京一': { dist: '295', eco: '12.5', price: '165', rentalType: 'times', extras: [{ name: '駐車場', amount: '200', type: 'split' }] },
        '小柏 カイ': { dist: '134', eco: '20', price: '155', rentalType: 'private', extras: [{ name: '駐車場', amount: '200', type: 'split' }] }
    };
    const missingCars = {
        ...normalCars,
        '藤原 拓海': { ...normalCars['藤原 拓海'], eco: '' },
        '高橋 啓介': { ...normalCars['高橋 啓介'], dist: '' },
        '高橋 涼介': { ...normalCars['高橋 涼介'], price: '' }
    };
    const source = missing ? missingCars : normalCars;
    const cars = {};
    (carPlan.cars || []).forEach(car => {
        cars[car.name] = normalizeCarSettlementState(source[car.name] || { dist: '180', eco: '15', price: '160', extras: [{ name: '駐車場', amount: '200', type: 'split' }] });
    });
    return normalizeSettlementState({
        rounding: '100',
        organizerFree: true,
        organizerName: '高橋 涼介',
        driverCollectionOffset: true,
        driverReward: '1000',
        cars,
        routeStops: ['秋名山', '赤城山', '榛名湖'],
        paid: {},
        driverPaid: {}
    });
}

function createSampleAppData({ missing = false, carCount = 3 } = {}) {
    const safeCarCount = Math.max(2, Math.min(5, Number(carCount) || 3));
    const carPlan = createSampleCarPlan(safeCarCount);
    const allParticipants = [
        ...(carPlan.cars || []).flatMap(car => [
            { name: car.name, memo: car.driverMemo || '', gender: car.driverGender || 'unknown', grade: car.driverGrade || 0 },
            ...(car.members || [])
        ]),
        ...(carPlan.waiting || [])
    ].map(cloneSampleMember);
    const teamPlan = createSampleTeamPlan(allParticipants);

    return {
        schemaVersion: typeof APP_SCHEMA_VERSION !== 'undefined' ? APP_SCHEMA_VERSION : 3,
        roomName: missing ? '入力漏れチェック用サンプル' : '秋名山登山企画',
        trayMinimized: false,
        editLockEnabled: false,
        editLockPassphrase: '',
        editLockScopes: { allocation: false, settlement: false },
        activeCarPlanId: carPlan.id,
        carPlans: [carPlan, teamPlan],
        lastAutoAssignLabel: carPlan.lastAutoAssignLabel || '',
        waiting: carPlan.waiting,
        cars: carPlan.cars,
        settlement: createSampleSettlementState(carPlan, { missing }),
        overview: {
            memo: missing
                ? '入力漏れや未入力欄の見え方を確認するためのサンプルです。'
                : 'サンプルデータ',
            timetableItems: createSampleTimetableItems()
        },
        lastUpdatedAt: (window.SanpoClock?.now?.() ?? Date.now())
    };
}

function createFormLinkedSampleData() {
    const now = window.SanpoClock?.now?.() ?? Date.now();
    const applicants = [
        { key: 'sample-a1', name: '松本 結月', grade: 4, canDrive: true, capacity: 4 },
        { key: 'sample-a2', name: '佐々木 陽菜', grade: 3, canDrive: false, capacity: 0 },
        { key: 'sample-a3', name: '小林 海斗', grade: 2, canDrive: true, capacity: 3 },
        { key: 'sample-a4', name: '山本 陽翔', grade: 1, canDrive: false, capacity: 0 },
        { key: 'sample-a5', name: '田中 結衣', grade: 1, canDrive: false, capacity: 0 }
    ];
    const members = applicants.map(({ name, grade }) => ({ name, memo: '', gender: 'unknown', grade, locked: false, flag: 'none' }));
    return {
        schemaVersion: typeof APP_SCHEMA_VERSION !== 'undefined' ? APP_SCHEMA_VERSION : 6,
        roomName: 'フォーム連携テスト企画', trayMinimized: false, editLockEnabled: false, editLockPassphrase: '',
        editLockScopes: { allocation: false, settlement: false }, activeCarPlanId: 'plan-car',
        carPlans: [
            { id: 'plan-car', name: '車割', templateType: 'car', waiting: members, cars: [], lastAutoAssignLabel: '' },
            { id: 'plan-team', name: '班割', templateType: 'team', waiting: members, cars: [], lastAutoAssignLabel: '' }
        ],
        lastAutoAssignLabel: '', waiting: members, cars: [], settlement: {},
        overview: { memo: 'フォーム連携機能の確認用サンプルです。', timetableItems: [] },
        meta: { applicationSync: {
            kind: 'formApplicationSync', version: 2, title: 'フォーム連携テスト企画', eventDate: '2026-09-24',
            responseCount: applicants.length, syncedAt: now,
            applicants: Object.fromEntries(applicants.map(({ key, name, grade, canDrive, capacity }, index) => [key, { name, grade, canDrive, capacity, updatedAt: now + index }]))
        } },
        lastUpdatedAt: now, lastUpdatedBy: 'debug-sample'
    };
}

return { getTimetableItems, normalizeOverviewSnapshot, buildTimetableText, applicationSync, normalizedName, committedParticipants, formatEventDate, projectName, sourceEventDate, eventDateLabel, announcementTitle, announcementSubject, participantLines, participantCountMatchesApplicants, defaultApplicationMessage, hasDrivers, itineraryLine, bodyText, validToken, committedExportSelection, csvCell, buildParticipantCsv, createSampleTimetableItems, createSampleTeamPlan, getSampleDrivers, getSampleMembers, cloneSampleMember, getSampleMemberLimitForCars, createSampleCarPlan, createSampleSettlementState, createSampleAppData, createFormLinkedSampleData };
}
