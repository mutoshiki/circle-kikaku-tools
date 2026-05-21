const assert = require('assert');
const { readText } = require('./helpers/read-project');

const debug = readText('assets/js/features/debug-history.js');

assert(debug.includes('function createSampleTimetableItems()'), 'sample data should include timetable helper');
assert(debug.includes("{ time: '08:00', title: '集合・受付' }"), 'sample timetable should include visible start time');
assert(debug.includes('https://maps.google.com'), 'sample timetable should include a URL for link testing');
assert(debug.includes('function createSampleTeamPlan'), 'sample data should include a two-team plan helper');
assert(debug.includes("id: typeof SINGLE_TEAM_PLAN_ID !== 'undefined' ? SINGLE_TEAM_PLAN_ID : 'plan-team'"), 'sample team plan should use the fixed team plan id');
assert(debug.includes("templateType: 'team'"), 'sample team plan should be typed as team');
assert(debug.includes("driverReward: '0'"), 'sample data should not auto-add driver reward as an extra expense');
assert(debug.includes("{ name: '駐車場', amount: '200', type: 'split' }"), 'normal sample car extras should only include parking 200 yen');
assert(!debug.includes("{ name: '高速代'"), 'normal sample car extras should not include expressway fees');
assert(!debug.includes("{ name: idx === 0 ? 'レンタカー代'"), 'normal sample car extras should not include old club/rental fee sample');
assert(debug.includes('timetableItems: createSampleTimetableItems()'), 'sample data should apply timetable data to overview');
assert(debug.includes('carPlans: [carPlan, teamPlan]'), 'sample data should seed both car and team plans');

console.log('Sample data timetable/team check OK');
