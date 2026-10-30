const JOB_ID = /^handoff_[A-Za-z0-9_-]{16,80}$/;

export function assertHandoffAdmission(status, testOwner = false) {
  if (!status || status.accepting !== true) throw new Error('学務書類用CSVの作成は現在利用できません。時間をおいて、もう一度お試しください。');
  const mode = status.acceptanceMode == null ? 'open' : status.acceptanceMode;
  if (mode !== 'open' && mode !== 'test') throw new Error('学務書類用CSVを作成できるか確認できません。時間をおいて、もう一度お試しください。');
  if (mode === 'test' && testOwner !== true) throw new Error('学務書類用CSVの作成は現在利用できません。時間をおいて、もう一度お試しください。');
}

export function createHandoffClient({ transport, crypto, storage, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), maxWaitMs = 300_000, pollIntervalMs = 1_000 }) {
  if (!transport || typeof transport.enqueueHandoffExport !== 'function' || typeof transport.getHandoffExport !== 'function') {
    return async () => { throw new Error('CSVの作成先が設定されていません。管理者にお問い合わせください。'); };
  }
  return async function handoff(payload) {
    if (payload?.action !== 'handoff-export') throw new Error('学務書類用CSVの作成を開始できませんでした。企画画面を開き直してください。');
    const projectId = String(payload.projectId || '');
    const token = String(payload.token || '');
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(projectId) || !/^h_[A-Za-z0-9_-]{48,160}$/.test(token)) {
      throw new Error('この企画でCSVを作成できません。フォームメーカーの作成結果にある「企画ツールを開く」から企画を開き直してください。');
    }
    if (!crypto?.randomUUID || !crypto?.subtle?.digest) throw new Error('このブラウザーではCSV作成を開始できません。ブラウザーを更新して、もう一度お試しください。');
    const fingerprintSource = JSON.stringify([projectId, token, String(payload.responses || ''), Array.isArray(payload.manualParticipantIds) ? payload.manualParticipantIds : []]);
    const fingerprintBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprintSource));
    const fingerprint = Array.from(new Uint8Array(fingerprintBytes), byte => byte.toString(16).padStart(2, '0')).join('');
    const storageKey = `handoffJob:${fingerprint}`;
    let jobId = '';
    try { jobId = String(storage?.read(storageKey) || ''); } catch { /* request recovery can continue in memory */ }
    if (!JOB_ID.test(jobId)) jobId = `handoff_${crypto.randomUUID().replaceAll('-', '')}`;
    if (!JOB_ID.test(jobId)) throw new Error('CSV作成を開始できませんでした。ページを再読み込みして、もう一度お試しください。');
    try { storage?.write(storageKey, jobId); } catch { /* storage failure must not block a single attempt */ }

    try { await transport.enqueueHandoffExport({
      projectId,
      token,
      responseKeys: String(payload.responses || ''),
      manualParticipantIds: Array.isArray(payload.manualParticipantIds) ? payload.manualParticipantIds : [],
      jobId,
    }); } catch (error) {
      const message = String(error?.message || '');
      throw new Error(/[ぁ-んァ-ヶ一-龠]/.test(message) ? message : 'CSV作成を依頼できませんでした。通信状態を確認して、もう一度お試しください。');
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < maxWaitMs) {
      let job;
      try { job = await transport.getHandoffExport(jobId); } catch (error) {
        const message = String(error?.message || '');
        throw new Error(/[ぁ-んァ-ヶ一-龠]/.test(message) ? message : 'CSV作成の状況を確認できませんでした。通信状態を確認して、同じ画面からもう一度お試しください。');
      }
      if (job?.state === 'completed') {
        const result = job.result;
        if (!result || !/^https:\/\/drive\.google\.com\//.test(String(result.downloadUrl || '')) || !Number.isSafeInteger(Number(result.count)) || Number(result.count) < 1) {
          throw new Error('CSVを保存できませんでした。時間をおいて、もう一度お試しください。');
        }
        try { storage?.remove(storageKey); } catch { /* completed result remains usable */ }
        return { ok: true, downloadUrl: result.downloadUrl, count: Number(result.count), expiresAt: Number(result.expiresAt) || null };
      }
      if (job?.state === 'failed') {
        try { storage?.remove(storageKey); } catch { /* the worker has reached a terminal failure */ }
        throw new Error('CSVを作成できませんでした。応募フォームとの連携と参加者の選択を確認してください。');
      }
      if (job?.state === 'partial' || job?.state === 'unknown') throw new Error('CSV作成の結果を確認できませんでした。時間をおいて、同じ画面からもう一度お試しください。');
      await wait(Math.min(pollIntervalMs, Math.max(0, maxWaitMs - (Date.now() - startedAt))));
    }
    throw new Error('CSVの作成に時間がかかっています。時間をおいて、同じ画面からもう一度お試しください。');
  };
}
