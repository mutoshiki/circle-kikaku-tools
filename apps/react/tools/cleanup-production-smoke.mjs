import { chromium } from '@playwright/test';
import { cleanupProductionSmokeRoom } from '../tests/production/firebase-smoke-room.mjs';

const roomId = process.env.REACT_PRODUCTION_SMOKE_ROOM || '';
const marker = process.env.REACT_PRODUCTION_SMOKE_MARKER || '';
const config = {
  apiKey: process.env.REACT_FIREBASE_API_KEY || '',
  projectId: 'sanpokai-tool',
  databaseURL: 'https://sanpokai-tool-default-rtdb.firebaseio.com',
};
if (process.env.REACT_PRODUCTION_RELEASE !== 'true'
  || roomId !== 'P9A93LMQ'
  || !/^react-release-\d+-\d+$/.test(marker)
  || config.projectId !== 'sanpokai-tool'
  || config.databaseURL !== 'https://sanpokai-tool-default-rtdb.firebaseio.com'
  || !config.apiKey) {
  throw new Error('Production smoke cleanup target guard rejected this run.');
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto('https://mutoshiki.github.io/circle-kikaku-tools/', { waitUntil: 'domcontentloaded' });
  await cleanupProductionSmokeRoom(page, { config, roomId, marker, allowPriorReleaseMarker: true });
  process.stdout.write('Reserved smoke room cleanup verified through the production browser origin.\n');
} finally {
  await browser.close();
}
