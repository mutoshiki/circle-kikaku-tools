const SAMPLE_TITLE = '秋の登山企画（サンプル）';
const SAMPLE_PEOPLE = [
  '佐藤 花子', '鈴木 翔太', '田中 美咲', '伊藤 悠真', '渡辺 結衣',
  '山本 陽菜', '中村 大樹', '小林 莉子', '加藤 拓海', '吉田 葵',
  '山田 陸', '松本 彩花', '井上 颯太'
];
const SAMPLE_NON_PARTICIPANTS = ['森田 玲奈', '中島 悠'];
const sampleEventDate = now => new Date(Number(now) - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

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
    if (!names.has(name)) names.set(name, SAMPLE_PEOPLE[names.size] || `参加者${String(names.size + 1).padStart(2, '0')}`);
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
  const peopleByName = new Map((carPlan?.cars || []).flatMap(car => [
    [{ name: car.name, grade: car.driverGrade }],
    car.members || [],
  ].flat()).map(person => [person.name, person]));
  const driverCapacities = new Map((carPlan?.cars || []).map(car => [car.name, car.capacity]));
  const applicants = Object.fromEntries([
    ...[...peopleByName.values()].map((person, index) => [`sample-a${String(index + 1).padStart(2, '0')}`, {
      name: person.name,
      grade: person.grade,
      canDrive: driverCapacities.has(person.name),
      capacity: driverCapacities.get(person.name) || 0,
      updatedAt: now - 30 * 24 * 60 * 60 * 1000 + index * 60 * 1000,
    }]),
    ...SAMPLE_NON_PARTICIPANTS.map((name, index) => [`sample-a${String(peopleByName.size + index + 1).padStart(2, '0')}`, {
      name,
      grade: index === 0 ? 2 : 1,
      canDrive: false,
      capacity: 0,
      updatedAt: now - 29 * 24 * 60 * 60 * 1000 + index * 60 * 1000,
    }]),
  ]);
  const eventDate = sampleEventDate(now);
  const organizerName = carPlan?.cars?.[0]?.name || '';
  const participantNames = [...peopleByName.keys()];
  const driverNames = [...driverCapacities.keys()];
  const collectionNames = participantNames.filter(name => name !== organizerName);
  return {
    ...base,
    roomName: SAMPLE_TITLE,
    eventDate,
    carPlans,
    waiting: carPlan?.waiting || [],
    cars: carPlan?.cars || [],
    settlement: {
      ...base.settlement,
      organizerName,
      cars: settlementCars,
      routeStops: ['新宿駅西口', '高峰高原ビジターセンター'],
      paid: Object.fromEntries(collectionNames.map(name => [name, true])),
      paidBy: Object.fromEntries(collectionNames.map(name => [name, organizerName])),
      driverPaid: Object.fromEntries(driverNames.map(name => [name, true])),
    },
    lastUpdatedAt: now,
    lastUpdatedBy: 'debug-sample',
    overview: {
      ...base.overview,
      memo: '下山後に登山口で点呼し、忘れ物を確認してから解散しました。',
      timetableItems: [
        { time: '06:30', title: '新宿駅西口集合・点呼' },
        { time: '07:00', title: '新宿駅西口を出発' },
        { time: '09:30', title: '高峰高原ビジターセンター到着・準備' },
        { time: '10:00', title: '登山開始' },
        { time: '12:10', title: '黒斑山山頂・昼食' },
        { time: '12:30', title: '下山開始' },
        { time: '16:34', title: '高峰高原ビジターセンター到着・点呼' },
        { time: '17:00', title: '現地出発' },
        { time: '19:30', title: '新宿駅西口到着・解散' },
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
        responseCount: Object.keys(applicants).length,
        applicants,
        sample: true,
      },
    },
  };
}

export const DEBUG_SAMPLE_PROJECT_TITLE = SAMPLE_TITLE;
