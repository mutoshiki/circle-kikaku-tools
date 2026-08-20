const BUG_REPORT_SUBJECT = '【サークル企画ツール】新しいバグ報告';
const PROP_WEBHOOK_SECRET = 'BUG_REPORT_WEBHOOK_SECRET';
const PROP_NOTIFY_TO = 'BUG_REPORT_NOTIFY_TO';
const SENT_PROPERTY_PREFIX = 'BUG_SENT_';

function json_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function digest_(value) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value || ''),
    Utilities.Charset.UTF_8
  );
}

function secretsEqual_(left, right) {
  const a = digest_(left);
  const b = digest_(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

function clean_(value, maxLength) {
  return String(value == null ? '' : value).slice(0, maxLength);
}

function markerForReport_(reportId) {
  return `circle-kikaku-bug-report-${clean_(reportId, 160)}`;
}

function sentPropertyKey_(reportId) {
  return `${SENT_PROPERTY_PREFIX}${clean_(reportId, 160)}`;
}

function wasAlreadySent_(properties, reportId, marker) {
  if (properties.getProperty(sentPropertyKey_(reportId))) return true;
  const escaped = String(marker).replace(/"/g, '');
  return GmailApp.search(`in:sent "${escaped}"`, 0, 1).length > 0;
}

function doPost(e) {
  const properties = PropertiesService.getScriptProperties();
  const expectedSecret = properties.getProperty(PROP_WEBHOOK_SECRET) || '';
  const notifyTo = properties.getProperty(PROP_NOTIFY_TO) || '';

  let payload = {};
  try {
    payload = JSON.parse(e && e.postData && e.postData.contents ? e.postData.contents : '{}');
  } catch (error) {
    return json_({ ok: false, error: 'invalid-json' });
  }

  if (!expectedSecret || !secretsEqual_(payload.secret, expectedSecret)) {
    return json_({ ok: false, error: 'unauthorized' });
  }
  if (!notifyTo) return json_({ ok: false, error: 'notify-address-not-configured' });

  const reportId = clean_(payload.reportId, 160);
  const body = clean_(payload.body, 8000);
  if (!reportId || !body) return json_({ ok: false, error: 'invalid-payload' });

  const marker = markerForReport_(reportId);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    // First use Script Properties for a fast durable acknowledgement. Gmail Sent
    // search is the recovery path for the narrow crash window after MailApp accepted
    // the message but before this script could persist that acknowledgement.
    if (wasAlreadySent_(properties, reportId, marker)) {
      properties.setProperty(sentPropertyKey_(reportId), String(Date.now()));
      return json_({ ok: true, duplicate: true });
    }

    MailApp.sendEmail({
      to: notifyTo,
      subject: BUG_REPORT_SUBJECT,
      body: `${body}\n\n報告ID: ${marker}`,
      name: 'サークル企画ツール'
    });
    properties.setProperty(sentPropertyKey_(reportId), String(Date.now()));

    return json_({ ok: true, duplicate: false });
  } catch (error) {
    console.error(error);
    return json_({ ok: false, error: 'mail-send-failed' });
  } finally {
    try {
      lock.releaseLock();
    } catch (_) {
      // No-op if the lock could not be acquired.
    }
  }
}
