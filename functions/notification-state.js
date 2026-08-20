'use strict';

const SEND_LEASE_MS = 15 * 60 * 1000;

function normalizeState(current) {
  return current && typeof current === 'object' ? current : {};
}

function acquireLeaseState(current, { now, leaseToken, eventId }) {
  const previous = normalizeState(current);
  if (previous.status === 'sent') return undefined;

  const leaseExpiresAt = Number(previous.leaseExpiresAt || 0);
  if (previous.status === 'sending' && leaseExpiresAt > now) return undefined;

  return {
    status: 'sending',
    eventId,
    leaseToken,
    leaseStartedAt: now,
    leaseExpiresAt: now + SEND_LEASE_MS,
    attemptCount: Math.max(0, Number(previous.attemptCount || 0)) + 1,
    updatedAt: now
  };
}

function sentState(current, { now, leaseToken, eventId, duplicate = false }) {
  const previous = normalizeState(current);
  if (previous.status === 'sent') return previous;
  if (previous.leaseToken !== leaseToken) return undefined;

  return {
    status: 'sent',
    eventId,
    attemptCount: Math.max(1, Number(previous.attemptCount || 1)),
    provider: 'google-apps-script-mailapp',
    duplicateRecovered: duplicate === true,
    sentAt: now,
    updatedAt: now
  };
}

function failedState(current, { now, leaseToken, eventId, error }) {
  const previous = normalizeState(current);
  if (previous.status === 'sent') return previous;
  if (previous.leaseToken !== leaseToken) return undefined;

  return {
    status: 'failed',
    eventId,
    attemptCount: Math.max(1, Number(previous.attemptCount || 1)),
    failedAt: now,
    updatedAt: now,
    error: String(error || '').slice(0, 500)
  };
}

module.exports = {
  SEND_LEASE_MS,
  acquireLeaseState,
  sentState,
  failedState
};
