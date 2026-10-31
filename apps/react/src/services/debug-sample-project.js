const SAMPLE_TITLE = 'デバッグ用サンプル企画';
const sampleEventDate = now => new Date(Number(now) + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Build one coherent, obviously synthetic project for safe cross-tool QA. */
export function createDebugSampleProject({ projectDomain, now = Date.now() } = {}) {
  if (!projectDomain?.createSampleAppData || !projectDomain?.createFormLinkedSampleData) {
    throw new TypeError('Sample project data source is unavailable');
  }
  const base = projectDomain.createSampleAppData({ carCount: 3 });
  const form = projectDomain.createFormLinkedSampleData();
  const names = new Map();
  const safeName = value => {
    const name = String(value || '').trim();
    if (!names.has(name)) names.set(name, `参加者${String(names.size + 1).padStart(2, '0')}`);
    return names.get(name);
  };
  const oldCarPlan = base.carPlans.find(plan => plan.templateType === 'car');
  const safeCars = new Map((oldCarPlan?.cars || []).map(car => [car.name, safeName(car.name)]));
  const renamePlan = plan => ({
    ...plan,
    waiting: (plan.waiting || []).map(person => ({ ...person, name: safeName(person.name) })),
    cars: (plan.cars || []).map((car, index) => ({
      ...car,
      name: safeName(car.name),
      members: (car.members || []).map(person => ({ ...person, name: safeName(person.name) })),
    })),
  });
  const carPlans = base.carPlans.map(renamePlan);
  const carPlan = carPlans.find(plan => plan.templateType === 'car');
  const settlementCars = Object.fromEntries(Object.entries(base.settlement.cars || {}).map(([name, value]) => [safeCars.get(name) || name, value]));
  const applicants = Object.fromEntries(Object.entries(form.meta.applicationSync.applicants).map(([key, applicant], index) => [
    key,
    { ...applicant, name: `応募者${String(index + 1).padStart(2, '0')}`, updatedAt: now + index },
  ]));
  const eventDate = sampleEventDate(now);
  return {
    ...base,
    roomName: SAMPLE_TITLE,
    eventDate,
    carPlans,
    waiting: carPlan?.waiting || [],
    cars: carPlan?.cars || [],
    settlement: { ...base.settlement, organizerName: '運営担当', cars: settlementCars, routeStops: ['登山口', '休憩地点', '山頂'] },
    lastUpdatedAt: now,
    lastUpdatedBy: 'debug-sample',
    overview: {
      ...base.overview,
      memo: '全ツールの表示・編集を試すための架空データです。',
      timetableItems: [
        { time: '07:00', title: '集合場所（サンプル）' },
        { time: '08:30', title: '登山開始' },
        { time: '12:00', title: '昼休憩' },
        { time: '15:00', title: '解散予定' },
      ],
    },
    meta: {
      ...(base.meta || {}),
      applicationSync: {
        ...form.meta.applicationSync,
        title: SAMPLE_TITLE,
        eventDate,
        date: eventDate,
        syncedAt: now,
        applicants,
        sample: true,
      },
    },
  };
}

export const DEBUG_SAMPLE_PROJECT_TITLE = SAMPLE_TITLE;
