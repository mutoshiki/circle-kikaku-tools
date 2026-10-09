const allowedOrigin = 'https://mutoshiki.github.io';
const manifestPaths = ['/circle-kikaku-tools/release-build.json', '/circle-kikaku-tools/react/release-build.json'];

export async function verifyPublishedRouteManifests({ sourceSha, assetDigest, fetchImpl = fetch, cacheBuster = `${Date.now()}-${Math.random()}` }) {
  if (!/^[a-f0-9]{40}$/.test(sourceSha || '') || !/^[a-f0-9]{64}$/.test(assetDigest || '')) {
    throw new Error('expected published manifest identity is invalid');
  }
  const expected = { sourceSha, assetDigest };
  const manifests = [];
  for (const pathname of manifestPaths) {
    const url = new URL(pathname, allowedOrigin);
    url.searchParams.set('releaseCheck', cacheBuster);
    const response = await fetchImpl(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`published route manifest request failed: ${pathname} (${response.status})`);
    let manifest;
    try { manifest = await response.json(); }
    catch { throw new Error(`published route manifest is invalid JSON: ${pathname}`); }
    if (manifest?.sourceSha !== expected.sourceSha || manifest?.assetDigest !== expected.assetDigest) {
      throw new Error(`published route manifest does not match the verified successful archive: ${pathname}`);
    }
    manifests.push({ path: pathname, ...expected });
  }
  return manifests;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [sourceSha, assetDigest] = process.argv.slice(2);
  verifyPublishedRouteManifests({ sourceSha, assetDigest })
    .then(manifests => process.stdout.write(`Verified current root and /react/ manifests for ${sourceSha} (${assetDigest}).\n`))
    .catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
import path from 'node:path';
import { fileURLToPath } from 'node:url';
