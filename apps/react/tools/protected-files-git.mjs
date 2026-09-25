export function sameCheckoutContent(left, right) {
  const normalize = input => {
    const bytes = Buffer.from(input);
    if (bytes.includes(0)) return bytes;
    const output = [];
    for (let i = 0; i < bytes.length; i += 1) {
      if (bytes[i] === 13 && bytes[i + 1] === 10) i += 1;
      output.push(bytes[i]);
    }
    return Buffer.from(output);
  };
  return normalize(left).equals(normalize(right));
}

export const PHASE9A_TEST_ISOLATION_OVERLAYS = Object.freeze([
  '.github/workflows/quality-guard.yml',
  'package.json',
  'playwright.config.js',
  'playwright.webkit.config.js',
  'tools/serve-static.mjs',
]);

export function isPhase9ATestIsolationOverlay(path) {
  return PHASE9A_TEST_ISOLATION_OVERLAYS.includes(path);
}
