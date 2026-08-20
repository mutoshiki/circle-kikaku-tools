const { onValueCreated } = require('firebase-functions/database');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');

initializeApp();

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const BUG_REPORT_NOTIFY_TO = defineSecret('BUG_REPORT_NOTIFY_TO');
const BUG_REPORT_NOTIFY_FROM = defineSecret('BUG_REPORT_NOTIFY_FROM');

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

exports.notifyBugReport = onValueCreated({
  ref: '/bugReports/{reportId}',
  region: 'us-central1',
  retry: true,
  secrets: [RESEND_API_KEY, BUG_REPORT_NOTIFY_TO, BUG_REPORT_NOTIFY_FROM]
}, async (event) => {
  const reportId = clean(event.params.reportId, 160);
  const report = event.data.val() || {};
  const statusRef = event.data.ref.root.child('bugReportNotifications').child(reportId);

  if (!reportId || !clean(report.message, 2000)) {
    logger.warn('Ignoring malformed bug report event', { reportId, eventId: event.id });
    await statusRef.set({
      status: 'invalid',
      eventId: clean(event.id, 200),
      updatedAt: Date.now()
    });
    return;
  }

  const existing = (await statusRef.get()).val();
  if (existing?.status === 'sent') {
    logger.info('Bug report email already sent', { reportId, eventId: event.id });
    return;
  }

  const apiKey = RESEND_API_KEY.value();
  const to = BUG_REPORT_NOTIFY_TO.value();
  const from = BUG_REPORT_NOTIFY_FROM.value();
  const mail = {
    from,
    to: [to],
    subject: SUBJECT,
    text: buildMailBody(report)
  };
  const idempotencyKey = `circle-kikaku-bug-report/${reportId}`;

  await statusRef.set({
    status: 'sending',
    eventId: clean(event.id, 200),
    updatedAt: Date.now()
  });

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(mail)
    });

    const responseText = await response.text();
    let payload = {};
    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch {
      payload = {};
    }

    if (!response.ok) {
      throw new Error(`Resend ${response.status}: ${clean(payload.message || responseText || response.statusText, 500)}`);
    }

    await statusRef.set({
      status: 'sent',
      eventId: clean(event.id, 200),
      provider: 'resend',
      providerMessageId: clean(payload.id, 200),
      idempotencyKey,
      sentAt: Date.now(),
      updatedAt: Date.now()
    });
    logger.info('Bug report notification sent', { reportId, eventId: event.id, providerMessageId: payload.id || null });
  } catch (error) {
    await statusRef.set({
      status: 'failed',
      eventId: clean(event.id, 200),
      idempotencyKey,
      failedAt: Date.now(),
      updatedAt: Date.now(),
      error: clean(error?.message || error, 500)
    });
    logger.error('Bug report notification failed', { reportId, eventId: event.id, error });
    throw error;
  }
});
