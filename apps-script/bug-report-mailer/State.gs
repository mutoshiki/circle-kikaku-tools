var BUG_REPORT_SEND_LEASE_MS = 15 * 60 * 1000;

function normalizeBugReportNotificationState_(current) {
  return current && typeof current === 'object' ? current : {};
}

function acquireBugReportLeaseState_(current, now, leaseToken, eventId) {
  var previous = normalizeBugReportNotificationState_(current);
  if (previous.status === 'sent') return null;

  var leaseExpiresAt = Number(previous.leaseExpiresAt || 0);
  if (previous.status === 'sending' && leaseExpiresAt > now) return null;

  return {
    status: 'sending',
    eventId: eventId,
    leaseToken: leaseToken,
    leaseStartedAt: now,
    leaseExpiresAt: now + BUG_REPORT_SEND_LEASE_MS,
    attemptCount: Math.max(0, Number(previous.attemptCount || 0)) + 1,
    updatedAt: now
  };
}

function sentBugReportNotificationState_(current, now, leaseToken, eventId, duplicateRecovered) {
  var previous = normalizeBugReportNotificationState_(current);
  if (previous.status === 'sent') return null;
  if (previous.leaseToken !== leaseToken) return null;

  return {
    status: 'sent',
    eventId: eventId,
    attemptCount: Math.max(1, Number(previous.attemptCount || 1)),
    provider: 'google-apps-script-mailapp',
    duplicateRecovered: duplicateRecovered === true,
    sentAt: now,
    updatedAt: now
  };
}

function failedBugReportNotificationState_(current, now, leaseToken, eventId, errorMessage) {
  var previous = normalizeBugReportNotificationState_(current);
  if (previous.status === 'sent') return null;
  if (previous.leaseToken !== leaseToken) return null;

  return {
    status: 'failed',
    eventId: eventId,
    attemptCount: Math.max(1, Number(previous.attemptCount || 1)),
    failedAt: now,
    updatedAt: now,
    error: String(errorMessage || '').slice(0, 500)
  };
}
