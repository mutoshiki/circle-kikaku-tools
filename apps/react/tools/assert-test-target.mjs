import { assertTestFirebaseTarget } from '../../../tools/test-firebase-target.mjs';

const expected = process.argv[2];
const { mode } = assertTestFirebaseTarget({ allowed: expected ? [expected] : ['offline'] });
if (expected && mode !== expected) throw new Error(`This test command requires SANPO_TEST_FIREBASE_TARGET=${expected}`);
