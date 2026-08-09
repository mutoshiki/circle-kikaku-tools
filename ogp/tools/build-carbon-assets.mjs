import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const versions = Object.freeze({
  webComponents: '2.60.0',
  icons: '11.85.0',
  plexSans: '1.1.0',
  plexSansJp: '3.0.0'
});
const outfile = resolve(root, 'assets/vendor/carbon/carbon-entry.min.js');
await mkdir(dirname(outfile), { recursive: true });
await build({
  entryPoints: [resolve(root, 'assets/js/carbon-entry.js')],
  outfile,
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2020'],
  legalComments: 'none',
  define: {
    __CARBON_WEB_COMPONENTS_VERSION__: JSON.stringify(versions.webComponents),
    __CARBON_ICONS_VERSION__: JSON.stringify(versions.icons),
    __IBM_PLEX_SANS_VERSION__: JSON.stringify(versions.plexSans),
    __IBM_PLEX_SANS_JP_VERSION__: JSON.stringify(versions.plexSansJp)
  }
});

const licenseCopies = [
  ['node_modules/@carbon/web-components/LICENSE', 'assets/vendor/carbon/LICENSE-web-components.txt'],
  ['node_modules/@carbon/icons/LICENSE', 'assets/vendor/carbon/LICENSE-icons.txt'],
  ['node_modules/@ibm/plex-sans/LICENSE.txt', 'assets/vendor/ibm-plex/LICENSE.txt'],
  ['node_modules/@ibm/plex-sans-jp/LICENSE.txt', 'assets/vendor/ibm-plex/LICENSE-jp.txt']
];
for (const [source, target] of licenseCopies) {
  await copyFile(resolve(root, source), resolve(root, target));
}
const manifest = { versions, entry: 'assets/js/carbon-entry.js', output: 'assets/vendor/carbon/carbon-entry.min.js' };
await writeFile(resolve(root, 'assets/vendor/carbon/build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built Carbon assets: ${JSON.stringify(versions)}`);
