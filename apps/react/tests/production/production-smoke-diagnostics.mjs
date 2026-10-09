import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const identityHost = 'identitytoolkit.googleapis.com';
const safeOrigin = value => value === '*' || value === 'null'
  ? value
  : typeof value === 'string' && /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(value) ? value : undefined;
const boundedText = (value, limit = 240) => String(value || '').replace(/[\r\n\t]+/g, ' ').slice(0, limit);
const consoleCategory = text => /cors|access control|cross-origin/i.test(text) ? 'cors'
  : /identitytoolkit|firebase|accounts:/i.test(text) ? 'firebase'
    : /failed to load|net::err/i.test(text) ? 'resource-load' : 'other';

export function createSmokeDiagnostics(context, { browserName, maxRequests = 200, maxConsoleErrors = 100 } = {}) {
  const started = Date.now();
  const active = new Map();
  const requests = [];
  const consoleErrors = [];
  const responseTasks = new Set();
  const trackedPages = new WeakSet();
  let droppedRequests = 0;
  let droppedConsoleErrors = 0;
  let sequence = 0;
  let phase = 'initial app load';
  let disposed = false;

  const entryFor = request => active.get(request);
  const onRequest = request => {
    let url;
    try { url = new URL(request.url()); } catch { return; }
    if (url.hostname !== identityHost) return;
    if (requests.length >= maxRequests) { droppedRequests += 1; return; }
    const entry = {
      id: ++sequence,
      phase,
      elapsedMs: Date.now() - started,
      method: boundedText(request.method(), 12),
      origin: url.origin,
      path: /^\/v\d+\/accounts:[A-Za-z]+$/.test(url.pathname) ? url.pathname : '/[other]',
      outcome: 'pending',
    };
    requests.push(entry);
    active.set(request, entry);
  };
  const onResponse = async response => {
    const entry = entryFor(response.request());
    if (!entry) return;
    entry.status = response.status();
    try {
      const headers = await response.headers();
      entry.accessControlAllowOrigin = safeOrigin(headers['access-control-allow-origin']);
      const allowCredentials = headers['access-control-allow-credentials'];
      entry.accessControlAllowCredentials = allowCredentials === 'true' || allowCredentials === 'false' ? allowCredentials : undefined;
      entry.accessControlAllowMethods = boundedText(headers['access-control-allow-methods'], 120) || undefined;
      entry.accessControlAllowHeaders = boundedText(headers['access-control-allow-headers'], 160) || undefined;
      entry.vary = boundedText(headers.vary, 120) || undefined;
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
    const errorText = boundedText(request.failure()?.errorText, 200);
    entry.outcome = 'failed';
    entry.failure = /cors|access control|blocked/i.test(errorText) ? 'cors-blocked'
      : /abort|cancel/i.test(errorText) ? 'aborted' : 'network-failed';
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
      });
    });
    page.on('pageerror', error => {
      if (consoleErrors.length >= maxConsoleErrors) { droppedConsoleErrors += 1; return; }
      consoleErrors.push({ phase, elapsedMs: Date.now() - started, category: 'page-error', name: boundedText(error.name, 80) });
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
    pendingRequests: [...active.values()].map(item => ({ ...item })),
    consoleErrors: consoleErrors.map(item => ({ ...item })),
    droppedRequests,
    droppedConsoleErrors,
  });
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
    await writeFile(absolute, `${JSON.stringify(snapshot(), null, 2)}\n`, { flag: 'w' });
  };

  return { setPhase(value) { phase = boundedText(value, 100); }, trackPage, snapshot, flush, dispose };
}
