import { readFile, writeFile } from 'node:fs/promises';

const patches = [
  {
    path: 'tests/carbon-complete.spec.js',
    before: "await hostClick(page, '#overviewMenuBtn');",
    after: "await page.locator('#overviewMenuBtn').click();",
    minimum: 2
  },
  {
    path: 'tests/shell-project-title-navigation-v73.spec.js',
    before: 'await menu.evaluate(node => node.click());',
    after: 'await menu.click();',
    minimum: 2
  }
];

for (const patch of patches) {
  const source = await readFile(patch.path, 'utf8');
  const count = source.split(patch.before).length - 1;
  if (count === 0 && source.includes(patch.after)) {
    console.log(`${patch.path}: already migrated`);
    continue;
  }
  if (count < patch.minimum) throw new Error(`${patch.path}: expected at least ${patch.minimum} old interactions, found ${count}`);
  await writeFile(patch.path, source.replaceAll(patch.before, patch.after));
  console.log(`${patch.path}: migrated ${count} hamburger interactions`);
}
