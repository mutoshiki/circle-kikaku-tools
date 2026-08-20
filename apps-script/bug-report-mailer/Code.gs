const BUG_REPORT_SUBJECT = '【サークル企画ツール】新しいバグ報告';
const PROP_DATABASE_URL = 'FIREBASE_DATABASE_URL';
const PROP_SERVICE_ACCOUNT_JSON = 'FIREBASE_SERVICE_ACCOUNT_JSON';
const PROP_NOTIFY_TO = 'BUG_REPORT_NOTIFY_TO';
const SENT_PROPERTY_PREFIX = 'BUG_SENT_';
const RECENT_REPORT_LIMIT = 100;
const FIREBASE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/firebase.database'
].join(' ');

function clean_(value, maxLength) {
  return String(value == null ? '' : value).slice(0, maxLength);
}

function base64Url_(value) {
  var bytes = typeof value === 'string' ? value : value;
  var encoded = typeof bytes === 'string'
    ? Utilities.base64EncodeWebSafe(bytes, Utilities.Charset.UTF_8)
    : Utilities.base64EncodeWebSafe(bytes);
  return encoded.replace(/=+$/g, '');
}

function scriptProperties_() {
  return PropertiesService.getScriptProperties();
}

function firebaseDatabaseUrl_() {
  var value = clean_(scriptProperties_().getProperty(PROP_DATABASE_URL), 500).replace(/\/+$/g, '');
  if (!/^https:\/\//.test(value)) throw new Error('FIREBASE_DATABASE_URL is not configured');
  return value;
}

function serviceAccount_() {
  var raw = scriptProperties_().getProperty(PROP_SERVICE_ACCOUNT_JSON) || '';
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
  var account = JSON.parse(raw);
  if (!account.client_email || !account.private_key) throw new Error('Invalid Firebase service account JSON');
  return account;
}

function firebaseAccessToken_() {
  var account = serviceAccount_();
  var now = Math.floor(Date.now() / 1000);
  var header = base64Url_(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  var claim = base64Url_(JSON.stringify({
    iss: account.client_email,
    scope: FIREBASE_SCOPES,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  var unsigned = header + '.' + claim;
  var signature = Utilities.computeRsaSha256Signature(unsigned, account.private_key);
  var assertion = unsigned + '.' + base64Url_(signature);

  var response = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: assertion
    },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('Failed to obtain Firebase OAuth token');
  }
  var payload = JSON.parse(response.getContentText() || '{}');
  if (!payload.access_token) throw new Error('Firebase OAuth token was empty');
  return payload.access_token;
}

function firebaseHeaders_(token, extra) {
  var headers = { Authorization: 'Bearer ' + token };
  Object.keys(extra || {}).forEach(function (key) { headers[key] = extra[key]; });
  return headers;
}

function firebasePathUrl_(path, query) {
  return firebaseDatabaseUrl_() + '/' + String(path || '').replace(/^\/+|\/+$/g, '') + '.json' + (query || '');
}

function responseHeader_(response, wanted) {
  var headers = response.getAllHeaders();
  var target = String(wanted).toLowerCase();
  var keys = Object.keys(headers || {});
  for (var i = 0; i < keys.length; i += 1) {
    if (String(keys[i]).toLowerCase() === target) {
      var value = headers[keys[i]];
      return Array.isArray(value) ? String(value[0] || '') : String(value || '');
    }
  }
  return '';
}

function firebaseReadRecentReports_(token) {
  var query = '?orderBy=' + encodeURIComponent('"$key"') + '&limitToLast=' + RECENT_REPORT_LIMIT;
  var response = UrlFetchApp.fetch(firebasePathUrl_('bugReports', query), {
    method: 'get',
    headers: firebaseHeaders_(token),
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error('Failed to read bugReports');
  return JSON.parse(response.getContentText() || 'null') || {};
}

function notificationPath_(reportId) {
  return 'bugReportNotifications/' + encodeURIComponent(clean_(reportId, 160));
}

function readNotificationWithEtag_(reportId, token) {
  var response = UrlFetchApp.fetch(firebasePathUrl_(notificationPath_(reportId)), {
    method: 'get',
    headers: firebaseHeaders_(token, { 'X-Firebase-ETag': 'true' }),
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error('Failed to read notification state');
  var etag = responseHeader_(response, 'ETag');
  if (!etag) throw new Error('Firebase ETag was missing');
  return {
    state: JSON.parse(response.getContentText() || 'null'),
    etag: etag
  };
}

function putNotificationIfMatch_(reportId, token, etag, value) {
  var response = UrlFetchApp.fetch(firebasePathUrl_(notificationPath_(reportId)), {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify(value),
    headers: firebaseHeaders_(token, { 'if-match': etag }),
    muteHttpExceptions: true
  });
  var code = response.getResponseCode();
  if (code === 200) return true;
  if (code === 412) return false;
  throw new Error('Failed to update notification state: HTTP ' + code);
}

function notificationTransaction_(reportId, token, updater) {
  for (var attempt = 0; attempt < 8; attempt += 1) {
    var current = readNotificationWithEtag_(reportId, token);
    var next = updater(current.state);
    if (next == null) return { committed: false, state: current.state };
    if (putNotificationIfMatch_(reportId, token, current.etag, next)) {
      return { committed: true, state: next };
    }
  }
  throw new Error('Notification state transaction contention');
}

function markerForReport_(reportId) {
  return 'circle-kikaku-bug-report-' + clean_(reportId, 160);
}

function sentPropertyKey_(reportId) {
  return SENT_PROPERTY_PREFIX + clean_(reportId, 160);
}

function wasAlreadySent_(reportId, marker) {
  var properties = scriptProperties_();
  if (properties.getProperty(sentPropertyKey_(reportId))) return true;
  var escaped = String(marker).replace(/"/g, '');
  var found = GmailApp.search('in:sent "' + escaped + '"', 0, 1).length > 0;
  if (found) properties.setProperty(sentPropertyKey_(reportId), String(Date.now()));
  return found;
}

function formatCreatedAt_(value) {
  var timestamp = Number(value);
  if (!isFinite(timestamp) || timestamp <= 0) return '不明';
  return Utilities.formatDate(new Date(timestamp), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
}

function buildMailBody_(report) {
  var lines = [
    'バグ内容: ' + clean_(report.message, 2000),
    '送信日時: ' + formatCreatedAt_(report.createdAt),
    'room ID: ' + (clean_(report.roomId, 80) || 'なし'),
    'URL: ' + (clean_(report.pageUrl, 2048) || '不明'),
    'build ID: ' + (clean_(report.buildId, 120) || '不明')
  ];
  if (clean_(report.projectTitle, 200)) lines.push('企画名: ' + clean_(report.projectTitle, 200));
  if (clean_(report.currentView, 40)) lines.push('現在の画面: ' + clean_(report.currentView, 40));
  var device = [clean_(report.platform, 160), clean_(report.userAgent, 512)].filter(Boolean).join(' / ');
  if (device) lines.push('端末/ブラウザ: ' + device);
  return lines.join('\n');
}

function sendBugReportMail_(reportId, report) {
  var notifyTo = clean_(scriptProperties_().getProperty(PROP_NOTIFY_TO), 320);
  if (!notifyTo) throw new Error('BUG_REPORT_NOTIFY_TO is not configured');
  var marker = markerForReport_(reportId);
  if (wasAlreadySent_(reportId, marker)) return true;

  MailApp.sendEmail({
    to: notifyTo,
    subject: BUG_REPORT_SUBJECT,
    body: buildMailBody_(report) + '\n\n報告ID: ' + marker,
    name: 'サークル企画ツール'
  });
  scriptProperties_().setProperty(sentPropertyKey_(reportId), String(Date.now()));
  return false;
}

function processOneBugReport_(reportId, report, token) {
  if (!report || !clean_(report.message, 2000)) return;
  var now = Date.now();
  var eventId = 'apps-script-' + Utilities.getUuid();
  var leaseToken = Utilities.getUuid();
  var lease = notificationTransaction_(reportId, token, function (current) {
    return acquireBugReportLeaseState_(current, now, leaseToken, eventId);
  });
  if (!lease.committed) return;

  try {
    var duplicateRecovered = sendBugReportMail_(reportId, report);
    var sentAt = Date.now();
    var sent = notificationTransaction_(reportId, token, function (current) {
      return sentBugReportNotificationState_(current, sentAt, leaseToken, eventId, duplicateRecovered);
    });
    if (!sent.committed && !(sent.state && sent.state.status === 'sent')) {
      throw new Error('Notification lease was lost before sent acknowledgement');
    }
  } catch (error) {
    try {
      notificationTransaction_(reportId, token, function (current) {
        return failedBugReportNotificationState_(current, Date.now(), leaseToken, eventId, error && error.message ? error.message : error);
      });
    } catch (stateError) {
      console.error(stateError);
    }
    console.error(error);
  }
}

function processBugReports() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var token = firebaseAccessToken_();
    var reports = firebaseReadRecentReports_(token);
    Object.keys(reports).sort().forEach(function (reportId) {
      processOneBugReport_(reportId, reports[reportId], token);
    });
  } finally {
    lock.releaseLock();
  }
}

function installBugReportTrigger() {
  ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, [
    'https://www.googleapis.com/auth/script.scriptapp',
    'https://www.googleapis.com/auth/script.external_request',
    'https://www.googleapis.com/auth/script.send_mail',
    'https://mail.google.com/'
  ]);
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'processBugReports') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('processBugReports').timeBased().everyMinutes(1).create();
}

function verifyBugReportMailerSetup() {
  var token = firebaseAccessToken_();
  firebaseReadRecentReports_(token);
  var remaining = MailApp.getRemainingDailyQuota();
  console.log('Bug report mailer configuration OK. Remaining recipient quota: ' + remaining);
}
