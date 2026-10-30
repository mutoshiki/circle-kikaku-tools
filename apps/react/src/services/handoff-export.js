const RESPONSE_KEY = /^r_[A-Za-z0-9_-]{12,40}$/;
const HANDOFF_TOKEN = /^h_[A-Za-z0-9_-]{48,160}$/;
const JOB_ID = /^[A-Za-z0-9_-]{16,80}$/;

export async function buildHandoffRequest({ projectId, token, responseKeys, manualParticipantIds = [], jobId, requestedAt = Date.now(), cryptoApi = globalThis.crypto }) {
  const normalizedProjectId = String(projectId || '');
  const capability = String(token || '');
  const keyList = String(responseKeys || '').split(',').filter(Boolean);
  const participantIds = Array.isArray(manualParticipantIds) ? manualParticipantIds.map(value => String(value || '')) : [];
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(normalizedProjectId)) throw new Error('企画IDを確認できません。');
  if (!HANDOFF_TOKEN.test(capability)) throw new Error('この企画で学務書類用CSVを作成できません。企画を開き直してください。');
  if (!JOB_ID.test(String(jobId || ''))) throw new Error('CSV作成を開始できませんでした。ページを再読み込みしてください。');
  if (keyList.length + participantIds.length < 1 || keyList.length + participantIds.length > 200 || keyList.some(key => !RESPONSE_KEY.test(key)) || new Set(keyList).size !== keyList.length || participantIds.some(id => !id || id.length > 200 || /[\u0000-\u001f]/.test(id)) || new Set(participantIds).size !== participantIds.length) {
    throw new Error('参加者の選択を確認してください。');
  }
  if (!Number.isSafeInteger(Number(requestedAt)) || Number(requestedAt) <= 0) throw new Error('CSV作成を開始できませんでした。ページを再読み込みしてください。');
  if (!cryptoApi?.subtle || typeof cryptoApi.subtle.digest !== 'function') throw new Error('このブラウザーではCSV作成を開始できません。ブラウザーを更新して、もう一度お試しください。');
  const digest = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(capability));
  const tokenHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  // Bind each digest to one request so the same participant cannot be correlated
  // across exports. Firebase rules keep the digest visible only to the owner and worker.
  const manualHashes = await Promise.all(participantIds.map(async id => {
    const participantDigest = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(`${jobId}:${id}`));
    return Array.from(new Uint8Array(participantDigest), byte => byte.toString(16).padStart(2, '0')).join('');
  }));
  return {
    jobId: String(jobId),
    protocolVersion: 1,
    input: { projectId: normalizedProjectId, tokenHash, responseKeys: keyList.join(','), manualParticipantHashes: manualHashes.join(',') },
    requestedAt: Number(requestedAt),
    state: 'queued',
  };
}
