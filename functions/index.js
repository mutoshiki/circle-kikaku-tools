const { randomUUID } = require('node:crypto');
const { onValueCreated } = require('firebase-functions/database');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const {
  SEND_LEASE_MS,
  acquireLeaseState,
  sentState,
  failedState
} = require('./notification-state');

initializeApp();

const BUG_REPORT_MAIL_WEBHOOK_URL = defineSecret('BUG_REPORT_MAIL_WEBHOOK_URL');
const BUG_REPORT_MAIL_WEBHOOK_SECRET = defineSecret('BUG_REPORT_MAIL_WEBHOOK_SECRET');

const SUBJECT = '【サークル企画ツール】新しいバグ報告';

function clean(value, max = 2048) {
  return String(value ?? '').slice(0, max);
}

function formatCreatedAt(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '不明';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date(timestamp));
}

function buildMailBody(report) {
  const lines = [
    `バグ内容: ${clean(report.message, 2000)}`,
    `送信日時: ${formatCreatedAt(report.createdAt)}`,
    `room ID: ${clean(report.roomId, 80) || 'なし'}`,
    `URL: ${clean(report.pageUrl, 2048) || '不明'}`,
    `build ID: ${clean(report.buildId, 120) || '不明'}`
  ];

  if (clean(report.projectTitle, 200)) lines.push(`企画名: ${clean(report.projectTitle, 200)}`);
  if (clean(report.currentView, 40)) lines.push(`現在の画面: ${clean(report.currentView, 40)}`);

  const device = [clean(report.platform, 160), clean(report.userAgent, 512)].filter(Boolean).join(' / ');
  if (device) lines.push(`端末/ブラウザ: ${device}`);

  return lines.join('\n');
}

async function acquireSendLease(statusRef, eventId) {
  const now = Date.now();
  const leaseToken = `${clean(eventId, 160)}:${randomUUID()}`;
  const result = await statusRef.transaction(current => acquireLeaseState(current, {
    now,
    leaseToken,
    eventId: clean(eventId, 200)
  }), undefined, false);
  const state = result.snapshot.val();
  return {
    acquired: result.committed === true && state?.leaseToken === leaseToken,
    leaseToken,
    state
  };
}

async function callMailWebhook({ reportId, report, secret, url }) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret,
      reportId,
      subject: SUBJECT,
      body: buildMailBody(report)
    })
  });

  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  if (!response.ok || payload.ok !== true) {
    throw new Error(`Mail webhook failed: ${clean(payload.error || text || response.statusText, 500)}`);
  }
  return payload;
}

exports.notifyBugReport = onValueCreated({
  ref: '/bugReports/{reportId}',
  region: 'us-central1',
  retry: true,
  timeoutSeconds: 120,
  secrets: [BUG_REPORT_MAIL_WEBHOOK_URL, BUG_REPORT_MAIL_WEBHOOK_SECRET]
}, async (event) => {
  const reportId = clean(event.params.reportId, 160);
  const report = event.data.val() || {};
  const statusRef = event.data.ref.root.child('bugReportNotifications').child(reportId);

  if (!reportId || !clean(report.message, 2000)) {
    logger.warn('Ignoring malformed bug report event', { reportId, eventId: event.id });
    await statusRef.transaction(current => {
      if (current?.status === 'sent') return;
      return {
        status: 'invalid',
        eventId: clean(event.id, 200),
        updatedAt: Date.now()
      };
    }, undefined, false);
    return;
  }

  const lease = await acquireSendLease(statusRef, event.id);
  if (!lease.acquired) {
    logger.info('Bug report notification lease not acquired', {
      reportId,
      eventId: event.id,
      status: lease.state?.status || null,
      leaseExpiresAt: lease.state?.leaseExpiresAt || null
    });
    return;
  }

  logger.info('Bug report notification lease acquired', {
    reportId,
    eventId: event.id,
    leaseMs: SEND_LEASE_MS
  });

  try {
    const result = await callMailWebhook({
      reportId,
      report,
      url: BUG_REPORT_MAIL_WEBHOOK_URL.value(),
      secret: BUG_REPORT_MAIL_WEBHOOK_SECRET.value()
    });

    const now = Date.now();
    const sentResult = await statusRef.transaction(current => sentState(current, {
      now,
      leaseToken: lease.leaseToken,
      eventId: clean(event.id, 200),
      duplicate: result.duplicate === true
    }), undefined, false);

    if (!sentResult.committed && sentResult.snapshot.val()?.status !== 'sent') {
      throw new Error('Notification lease was lost before sent acknowledgement');
    }

    logger.info('Bug report notification sent', {
      reportId,
      eventId: event.id,
      duplicateRecovered: result.duplicate === true
    });
  } catch (error) {
    const now = Date.now();
    await statusRef.transaction(current => failedState(current, {
      now,
      leaseToken: lease.leaseToken,
      eventId: clean(event.id, 200),
      error: clean(error?.message || error, 500)
    }), undefined, false);
    logger.error('Bug report notification failed', { reportId, eventId: event.id, error });
    throw error;
  }
});
