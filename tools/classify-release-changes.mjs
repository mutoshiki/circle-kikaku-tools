import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [base, head = 'HEAD'] = process.argv.slice(2);
if (!base) throw new Error('Usage: node tools/classify-release-changes.mjs <base-sha> [head-sha]');

const paths = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMRD', `${base}...${head}`], { encoding: 'utf8' })
  .split(/\r?\n/).filter(Boolean);
const matches = pattern => paths.some(path => pattern.test(path));
const react = matches(/^apps\/react\//);
const shared = matches(/^(firebase\/|firebase\.json$|apps\/react\/src\/(domain|sync|store|services)\/|assets\/js\/(core\/|features\/(application-sync-bridge|form-applicant-sync-v2|settlement(?:\/|\.js$)|assignment-workspace\.js$|auto-assign\.js$|google-form-import-parser\.js$|sheet\/00-data-sync\.js$)|modules\/settlement\.js$|templates\/settlement(?:\/|\.js$))|types\/)/);
const legacy = matches(/^(index\.html$|assets\/|apps-script\/|tests\/|tools\/|firebase-config\.js$|maps-config\.js$|playwright(?:\.webkit)?\.config\.js$)/);
const legacySource = matches(/^(index\.html$|assets\/|apps-script\/|tools\/[^/]+\.js$|firebase-config\.js$|maps-config\.js$)/);
const infrastructure = matches(/^\.github\//)
  || matches(/^(package(?:-lock)?\.json|pnpm(?:-lock)?\.yaml|stylelint\.config\.mjs|tsconfig\.maps\.json)$/)
  || matches(/^apps\/react\/(package(?:-lock)?\.json|playwright[^/]*|vite\.config\.)/);
const reactChecks = react || shared || infrastructure;
const legacyChecks = legacy || shared || infrastructure;

const result = {
  react,
  shared,
  legacy,
  infrastructure,
  reactChecks,
  legacyChecks,
  changedPaths: paths,
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, [
    `react=${reactChecks}`,
    `shared=${shared}`,
    `legacy=${legacyChecks}`,
    `source_legacy=${legacySource}`,
    `infrastructure=${infrastructure}`,
  ].join('\n') + '\n');
}
