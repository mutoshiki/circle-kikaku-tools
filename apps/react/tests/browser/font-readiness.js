import { expect } from '@playwright/test';

const samples = [
  { font: '400 16px "IBM Plex Sans JP"', text: '参加者車割班割精算日本語のメモ' },
  { font: '600 16px "IBM Plex Sans JP"', text: '参加者車割班割精算' },
];

// Windows WebKit keeps unused unicode-range faces in `loading` without ever
// requesting them. Assert only faces selected for the Japanese UI samples, then
// prove the rendered family is not falling back to the platform sans-serif.
export async function expectFontsLoaded(page) {
  const result = await page.evaluate(async samples => {
    const loaded = await Promise.all(samples.map(async sample => {
      const faces = await document.fonts.load(sample.font, sample.text);
      return {
        checked: document.fonts.check(sample.font, sample.text),
        faceCount: faces.length,
        statuses: faces.map(face => face.status),
      };
    }));
    const render = family => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 80;
      const context = canvas.getContext('2d');
      context.font = `400 48px ${family}`;
      context.textBaseline = 'top';
      context.fillText(samples[0].text, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const targetPixels = render('"IBM Plex Sans JP"');
    const fallbackPixels = render('sans-serif');
    return {
      loaded,
      bodyText: document.body.innerText,
      computedFamily: getComputedStyle(document.querySelector('.application')).fontFamily,
      glyphPixelDifference: targetPixels.reduce((count, value, index) => count + (value !== fallbackPixels[index] ? 1 : 0), 0),
    };
  }, samples);

  expect(result.bodyText).toContain('参加者');
  expect(result.computedFamily).toMatch(/^"?IBM Plex Sans JP"?(?:,|$)/);
  for (const loaded of result.loaded) {
    expect(loaded.checked).toBe(true);
    expect(loaded.faceCount).toBeGreaterThan(0);
    expect(loaded.statuses).toEqual(loaded.statuses.map(() => 'loaded'));
  }
  expect(result.glyphPixelDifference).toBeGreaterThan(0);
}
