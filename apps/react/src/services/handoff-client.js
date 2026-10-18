const JOB_ID = /^handoff_[A-Za-z0-9_-]{16,80}$/;

export function assertHandoffAdmission(status, testOwner = false) {
  if (!status || status.accepting !== true) throw new Error('引き継ぎ処理の受付を停止しています。時間をおいてください。');
  const mode = status.acceptanceMode == null ? 'open' : status.acceptanceMode;
  if (mode !== 'open' && mode !== 'test') throw new Error('引き継ぎ処理の受付状態を確認できません。');
  if (mode === 'test' && testOwner !== true) throw new Error('ただいま限定確認中です。しばらくしてからお試しください。');
}

export function createHandoffClient({ transport, crypto, storage, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), maxWaitMs = 300_000, pollIntervalMs = 1_000 }) {
  if (!transport || typeof transport.enqueueHandoffExport !== 'function' || typeof transport.getHandoffExport !== 'function') {
    return async () => { throw new Error('引き継ぎデータ作成先が設定されていません。'); };
  }
  return async function handoff(payload) {
    if (payload?.action !== 'handoff-export') throw new Error('引き継ぎ要求を確認できません。');
    const projectId = String(payload.projectId || '');
    const token = String(payload.token || '');
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(projectId) || !/^h_[A-Za-z0-9_-]{48,160}$/.test(token)) {
      throw new Error('引き継ぎ権限を確認できません。企画を開き直してください。');
    }
    if (!crypto?.randomUUID || !crypto?.subtle?.digest) throw new Error('安全な引き継ぎ要求を作成できません。');
    const fingerprintSource = JSON.stringify([projectId, token, String(payload.responses || ''), Array.isArray(payload.manualParticipantIds) ? payload.manualParticipantIds : []]);
    const fingerprintBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprintSource));
    const fingerprint = Array.from(new Uint8Array(fingerprintBytes), byte => byte.toString(16).padStart(2, '0')).join('');
    const storageKey = `handoffJob:${fingerprint}`;
    let jobId = '';
    try { jobId = String(storage?.read(storageKey) || ''); } catch { /* request recovery can continue in memory */ }
    if (!JOB_ID.test(jobId)) jobId = `handoff_${crypto.randomUUID().replaceAll('-', '')}`;
    if (!JOB_ID.test(jobId)) throw new Error('引き継ぎ要求IDを作成できません。');
    try { storage?.write(storageKey, jobId); } catch { /* storage failure must not block a single attempt */ }

    await transport.enqueueHandoffExport({
      projectId,
      token,
      responseKeys: String(payload.responses || ''),
      manualParticipantIds: Array.isArray(payload.manualParticipantIds) ? payload.manualParticipantIds : [],
      jobId,
    });

    const startedAt = Date.now();
    while (Date.now() - startedAt < maxWaitMs) {
      const job = await transport.getHandoffExport(jobId);
      if (job?.state === 'completed') {
        const result = job.result;
        if (!result || !/^https:\/\/drive\.google\.com\//.test(String(result.downloadUrl || '')) || !Number.isSafeInteger(Number(result.count)) || Number(result.count) < 1) {
          throw new Error('CSVの保存結果を確認できませんでした。受付窓口へ連絡してください。');
        }
        try { storage?.remove(storageKey); } catch { /* completed result remains usable */ }
        return { ok: true, downloadUrl: result.downloadUrl, count: Number(result.count), expiresAt: Number(result.expiresAt) || null };
      }
      if (job?.state === 'failed') {
        try { storage?.remove(storageKey); } catch { /* the worker has reached a terminal failure */ }
        throw new Error('CSVを準備できませんでした。企画の権限と参加者の選択を確認してください。');
      }
      if (job?.state === 'partial' || job?.state === 'unknown') throw new Error('処理結果を確認できません。時間をおいて、同じ画面からもう一度お試しください。');
      await wait(Math.min(pollIntervalMs, Math.max(0, maxWaitMs - (Date.now() - startedAt))));
    }
    throw new Error('CSVの準備に時間がかかっています。時間をおいて、同じ画面からもう一度お試しください。');
  };
}
