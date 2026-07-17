const assert = require('assert');
const { readText } = require('./helpers/read-project');

const debug = readText('assets/js/features/sample-data-history.js');

assert(debug.includes('function createSampleTimetableItems()'), 'sample data should include timetable helper');
assert(debug.includes("{ time: '08:00', title: '秋名山麓 集合 https://maps.google.com' }"), 'Initial D sample timetable should include visible start time');
assert(debug.includes('https://maps.google.com'), 'sample timetable should include a URL for link testing');
assert(debug.includes('function createSampleTeamPlan'), 'sample data should include a team plan helper');
assert(debug.includes("id: typeof SINGLE_TEAM_PLAN_ID !== 'undefined' ? SINGLE_TEAM_PLAN_ID : 'plan-team'"), 'sample team plan should use the fixed team plan id');
assert(debug.includes("templateType: 'team'"), 'sample team plan should be typed as team');
assert(debug.includes("function createSampleCarPlan"), 'sample data should build a complete car plan');
assert(debug.includes("lastAutoAssignLabel: 'サンプル配置'"), 'sample car plan should make the seeded layout explicit');
assert(debug.includes("driverReward: '1000'"), 'Initial D sample should set the requested driver reward');
assert(debug.includes("{ name: '駐車場', amount: '200', type: 'split' }"), 'every Initial D sample car should include the requested parking cost');
assert(debug.includes("rentalType: 'times'"), 'Initial D sample should include rental cars');
assert(!debug.includes("{ name: idx === 0 ? 'レンタカー代'"), 'normal sample car extras should not include old rental fee sample');
assert(debug.includes("routeStops: ['秋名山', '赤城山', '榛名湖']"), 'Initial D sample should seed themed route candidates');
assert(debug.includes("organizerName: '高橋 涼介'"), 'Initial D sample should use Ryosuke Takahashi as organizer');
assert(debug.includes('timetableItems: createSampleTimetableItems()'), 'sample data should apply timetable data to overview');
assert(debug.includes('carPlans: [carPlan, teamPlan]'), 'sample data should seed both car and team plans');
assert(debug.includes('restore(migrateAppData(sampleData))'), 'sample data should restore one complete snapshot instead of partial DOM edits');
assert(debug.includes('window.__suspendActiveDomPlanSync = true'), 'sample data should prevent partial DOM sync while restoring');

console.log('Sample data timetable/team check OK');
