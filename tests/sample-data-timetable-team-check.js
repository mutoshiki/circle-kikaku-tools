const assert = require('assert');
const { readText } = require('./helpers/read-project');

const debug = readText('assets/js/features/sample-data-history.js');

assert(debug.includes('function createSampleTimetableItems()'), 'sample data should include timetable helper');
assert(debug.includes("{ time: '08:00', title: '大学集合・受付' }"), 'sample timetable should include visible start time');
assert(debug.includes('https://maps.google.com'), 'sample timetable should include a URL for link testing');
assert(debug.includes('function createSampleTeamPlan'), 'sample data should include a team plan helper');
assert(debug.includes("id: typeof SINGLE_TEAM_PLAN_ID !== 'undefined' ? SINGLE_TEAM_PLAN_ID : 'plan-team'"), 'sample team plan should use the fixed team plan id');
assert(debug.includes("templateType: 'team'"), 'sample team plan should be typed as team');
assert(debug.includes("function createSampleCarPlan"), 'sample data should build a complete car plan');
assert(debug.includes("lastAutoAssignLabel: 'サンプル配置'"), 'sample car plan should make the seeded layout explicit');
assert(debug.includes("driverReward: '0'"), 'sample data should not auto-add driver reward as an extra expense');
assert(debug.includes("{ name: '駐車場', amount: '400', type: 'split' }"), 'normal sample car extras should include realistic parking cost');
assert(debug.includes("{ name: '有料道路', amount: '300', type: 'split' }"), 'normal sample car extras should include one varied split expense');
assert(debug.includes("{ name: '部費補助', amount: '500', type: 'club' }"), 'normal sample car extras should include one club expense for display testing');
assert(!debug.includes("{ name: idx === 0 ? 'レンタカー代'"), 'normal sample car extras should not include old rental fee sample');
assert(debug.includes("routeStops: ['信州大学工学部', '飯綱高原キャンプ場', 'むれ温泉 天狗の館']"), 'sample data should seed route candidates');
assert(debug.includes('timetableItems: createSampleTimetableItems()'), 'sample data should apply timetable data to overview');
assert(debug.includes('carPlans: [carPlan, teamPlan]'), 'sample data should seed both car and team plans');
assert(debug.includes('restore(migrateAppData(sampleData))'), 'sample data should restore one complete snapshot instead of partial DOM edits');
assert(debug.includes('window.__suspendActiveDomPlanSync = true'), 'sample data should prevent partial DOM sync while restoring');

console.log('Sample data timetable/team check OK');
