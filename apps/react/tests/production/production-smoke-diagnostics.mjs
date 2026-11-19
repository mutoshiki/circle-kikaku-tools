import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const identityHost = 'identitytoolkit.googleapis.com';
const pagesHost = 'mutoshiki.github.io';
const safeOrigin = value => value === '*' || value === 'null'
  ? value
  : typeof value === 'string' && /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(value) ? value : undefined;
const boundedText = (value, limit = 240) => String(value || '').replace(/[\r\n\t]+/g, ' ').slice(0, limit);
const safeUrl = value => {
  try {
    const url = new URL(value);
    return { origin: url.origin, path: url.pathname };
  } catch {
    return undefined;
  }
};
const safeErrorText = value => boundedText(value, 320).replace(/https?:\/\/[^\s"'<>]+/gi, raw => {
  const url = safeUrl(raw);
  return url ? `${url.origin}${url.path}` : '[url omitted]';
}).replace(/((?:key|auth|token|access_token|idToken)=)[^&\s"'<>]+/gi, '$1[redacted]');
const consoleCategory = text => /cors|access control|cross-origin/i.test(text) ? 'cors'
  : /identitytoolkit|firebase|accounts:/i.test(text) ? 'firebase'
    : /failed to load|net::err/i.test(text) ? 'resource-load' : 'other';

export function createSmokeDiagnostics(context, { browserName, maxRequests = 200, maxConsoleErrors = 100 } = {}) {
  const started = Date.now();
  const active = new Map();
  const requests = [];
  const assetRequests = [];
  const consoleErrors = [];
  const responseTasks = new Set();
  const trackedPages = new Set();
  let droppedRequests = 0;
  let droppedAssetRequests = 0;
  let droppedConsoleErrors = 0;
  let sequence = 0;
  let phase = 'initial app load';
  let disposed = false;

  const entryFor = request => active.get(request);
  const onRequest = request => {
    let url;
    try { url = new URL(request.url()); } catch { return; }
    let entry;
    if (url.hostname === identityHost) {
      if (requests.length >= maxRequests) { droppedRequests += 1; return; }
      entry = {
        id: ++sequence,
        phase,
        elapsedMs: Date.now() - started,
        method: boundedText(request.method(), 12),
        origin: url.origin,
        path: /^\/v\d+\/accounts:[A-Za-z]+$/.test(url.pathname) ? url.pathname : '/[other]',
        outcome: 'pending',
      };
      requests.push(entry);
    } else if (url.hostname === pagesHost) {
      if (assetRequests.length >= maxRequests) { droppedAssetRequests += 1; return; }
      entry = {
        id: ++sequence,
        phase,
        elapsedMs: Date.now() - started,
        method: boundedText(request.method(), 12),
        origin: url.origin,
        path: url.pathname,
        resourceType: typeof request.resourceType === 'function' ? boundedText(request.resourceType(), 24) : 'unknown',
        outcome: 'pending',
      };
      assetRequests.push(entry);
    } else return;
    active.set(request, entry);
  };
  const onResponse = async response => {
    const entry = entryFor(response.request());
    if (!entry) return;
    entry.status = response.status();
    try {
      const headers = await response.headers();
      if (entry.origin === `https://${identityHost}`) {
        entry.accessControlAllowOrigin = safeOrigin(headers['access-control-allow-origin']);
        const allowCredentials = headers['access-control-allow-credentials'];
        entry.accessControlAllowCredentials = allowCredentials === 'true' || allowCredentials === 'false' ? allowCredentials : undefined;
        entry.accessControlAllowMethods = boundedText(headers['access-control-allow-methods'], 120) || undefined;
        entry.accessControlAllowHeaders = boundedText(headers['access-control-allow-headers'], 160) || undefined;
        entry.vary = boundedText(headers.vary, 120) || undefined;
      } else {
        entry.contentType = boundedText(headers['content-type'], 100) || undefined;
      }
    } catch {
      entry.responseHeadersUnavailable = true;
    }
  };
  const onResponseEvent = response => {
    const task = onResponse(response).finally(() => responseTasks.delete(task));
    responseTasks.add(task);
  };
  const onFinished = request => {
    const entry = entryFor(request);
    if (entry) entry.outcome = 'finished';
    active.delete(request);
  };
  const onFailed = request => {
    const entry = entryFor(request);
    if (!entry) return;
    const errorText = safeErrorText(request.failure()?.errorText);
    entry.outcome = 'failed';
    entry.failure = /cors|access control|blocked/i.test(errorText) ? 'cors-blocked'
      : /abort|cancel/i.test(errorText) ? 'aborted' : 'network-failed';
    if (entry.resourceType) entry.failureDetail = errorText;
    active.delete(request);
  };
  const trackPage = page => {
    if (trackedPages.has(page)) return;
    trackedPages.add(page);
    page.on('console', message => {
      if (message.type() !== 'error') return;
      if (consoleErrors.length >= maxConsoleErrors) { droppedConsoleErrors += 1; return; }
      consoleErrors.push({
        phase,
        elapsedMs: Date.now() - started,
        category: consoleCategory(message.text()),
        detail: safeErrorText(message.text()),
      });
    });
    page.on('pageerror', error => {
      if (consoleErrors.length >= maxConsoleErrors) { droppedConsoleErrors += 1; return; }
      consoleErrors.push({
        phase,
        elapsedMs: Date.now() - started,
        category: 'page-error',
        name: boundedText(error.name, 80),
        detail: safeErrorText(error.message),
      });
    });
  };

  context.on('request', onRequest);
  context.on('response', onResponseEvent);
  context.on('requestfinished', onFinished);
  context.on('requestfailed', onFailed);
  context.on('page', trackPage);

  const snapshot = () => ({
    schemaVersion: 1,
    browser: boundedText(browserName || 'unknown', 40),
    durationMs: Date.now() - started,
    requests: requests.map(item => ({ ...item })),
    assetRequests: assetRequests.map(item => ({ ...item })),
    pendingRequests: [...active.values()].map(item => ({ ...item })),
    consoleErrors: consoleErrors.map(item => ({ ...item })),
    droppedRequests,
    droppedAssetRequests,
    droppedConsoleErrors,
  });
  const inspectPage = async page => {
    const location = safeUrl(typeof page.url === 'function' ? page.url() : '');
    let state = { closed: typeof page.isClosed === 'function' ? page.isClosed() : false };
    if (!state.closed && typeof page.evaluate === 'function') {
      try {
        state = {
          closed: false,
          ...await page.evaluate(async () => ({
            title: document.title.slice(0, 120),
            readyState: document.readyState,
            rootChildCount: document.getElementById('root')?.childElementCount ?? null,
            applicationPresent: Boolean(document.querySelector('.application')),
            scripts: [...document.scripts].filter(script => script.src).slice(0, 30).map(script => {
              const url = new URL(script.src);
              return `${url.origin}${url.pathname}`;
            }),
            stylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].slice(0, 30).map(link => {
              const url = new URL(link.href);
              return `${url.origin}${url.pathname}`;
            }),
            manifest: await (async () => {
              try {
                const response = await fetch(new URL('release-build.json', window.location.href), { cache: 'no-store' });
                if (!response.ok) return { status: response.status };
                const value = await response.json();
                return { status: response.status, sourceSha: value.sourceSha || null, assetDigest: value.assetDigest || null };
              } catch {
                return { unavailable: true };
              }
            })(),
          })),
        };
      } catch (error) {
        state = { closed: false, inspectionFailure: safeErrorText(error.message) };
      }
    }
    return { url: location, ...state };
  };
  const capturedPageStates = new Map();
  const capturePage = async page => {
    const state = await inspectPage(page);
    capturedPageStates.set(page, state);
    return state;
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    context.off('request', onRequest);
    context.off('response', onResponseEvent);
    context.off('requestfinished', onFinished);
    context.off('requestfailed', onFailed);
    context.off('page', trackPage);
  };
  const flush = async outputPath => {
    await Promise.all(responseTasks);
    if (!outputPath) return;
    const absolute = path.resolve(outputPath);
    await mkdir(path.dirname(absolute), { recursive: true });
    const pages = await Promise.all([...trackedPages].map(page => capturedPageStates.get(page) || inspectPage(page)));
    const output = { ...snapshot(), pages };
    await writeFile(absolute, `${JSON.stringify(output, null, 2)}\n`, { flag: 'w' });
  };

  return { setPhase(value) { phase = boundedText(value, 100); }, trackPage, snapshot, capturePage, flush, dispose };
}
