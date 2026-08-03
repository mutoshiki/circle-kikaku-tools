import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const versions = packageJson.devDependencies || {};
const outputDir = path.join(root, 'assets', 'vendor', 'carbon');
const outputFile = path.join(outputDir, 'carbon-entry.min.js');

const requiredVersions = {
  webComponents: versions['@carbon/web-components'],
  icons: versions['@carbon/icons'],
  plexSans: versions['@ibm/plex-sans'],
  plexSansJp: versions['@ibm/plex-sans-jp']
};

for (const [name, version] of Object.entries(requiredVersions)) {
  if (!version) throw new Error(`Required Carbon vendor version is missing from package.json: ${name}`);
}

function findPackageRoot(packageName, probeModule) {
  const candidates = [];
  try {
    candidates.push(require.resolve(`${packageName}/package.json`));
  } catch {
    // Some packages do not export package.json. Resolve a public module and walk upward.
  }
  try {
    candidates.push(require.resolve(probeModule || packageName));
  } catch (error) {
    throw new Error(`Unable to resolve ${packageName}. Run npm ci before npm run build:carbon.\n${error.message}`);
  }

  for (const candidate of candidates) {
    let current = fs.statSync(candidate).isDirectory() ? candidate : path.dirname(candidate);
    while (current !== path.dirname(current)) {
      const manifest = path.join(current, 'package.json');
      if (fs.existsSync(manifest)) {
        const parsed = JSON.parse(fs.readFileSync(manifest, 'utf8'));
        if (parsed.name === packageName) return current;
      }
      current = path.dirname(current);
    }
  }
  throw new Error(`Could not locate package root for ${packageName}`);
}

function copyLicense(packageName, probeModule, destinationName) {
  const packageRoot = findPackageRoot(packageName, probeModule);
  const license = ['LICENSE', 'LICENSE.txt', 'LICENSE.md'].map(name => path.join(packageRoot, name)).find(fs.existsSync);
  if (!license) throw new Error(`License file was not found for ${packageName}`);
  fs.copyFileSync(license, path.join(outputDir, destinationName));
}

fs.mkdirSync(outputDir, { recursive: true });

await build({
  entryPoints: [path.join(root, 'assets', 'js', 'carbon-entry.js')],
  outfile: outputFile,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  sourcemap: false,
  charset: 'utf8',
  legalComments: 'eof',
  define: {
    __CARBON_WEB_COMPONENTS_VERSION__: JSON.stringify(requiredVersions.webComponents),
    __CARBON_ICONS_VERSION__: JSON.stringify(requiredVersions.icons),
    __IBM_PLEX_SANS_VERSION__: JSON.stringify(requiredVersions.plexSans),
    __IBM_PLEX_SANS_JP_VERSION__: JSON.stringify(requiredVersions.plexSansJp)
  }
});

copyLicense('@carbon/web-components', '@carbon/web-components/es/components/button/index.js', 'LICENSE-web-components.txt');
copyLicense('@carbon/icons', '@carbon/icons/es/add/20.js', 'LICENSE-icons.txt');

const bytes = fs.statSync(outputFile).size;
console.log(`Carbon vendor build: PASS (${bytes} bytes, Web Components ${requiredVersions.webComponents}, Icons ${requiredVersions.icons})`);
