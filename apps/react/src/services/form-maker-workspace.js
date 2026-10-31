export const offlineFormMakerSession = Object.freeze({
  async prepare() { return { accepting: false, acceptanceMode: 'paused' }; },
  async listJobs() { return []; },
  async getJob() { return null; },
  async enqueue() { throw new Error('オフラインの確認画面ではフォームを作成できません。'); },
  getHandoffToken() { return ''; },
});

function subtractDays(value, days) {
  const date = new Date(`${String(value || '')}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function createFormMakerWorkspaceProps({ runtime, room, active = true, onNotice = () => {} }) {
  const reservation = runtime.storage.read('applicationFormReservation');
  const debugSample = runtime.debugSample === true;
  const eventDate = String(room?.meta?.eventDate || room?.meta?.applicationSync?.eventDate || room?.eventDate || '');
  const project = Object.freeze({
    roomId: runtime.roomId,
    projectName: String(room?.roomName || '').trim() || '新しい企画',
    eventDate,
    ...(debugSample ? {
      debugSample: true,
      sampleInput: {
        planName: String(room?.roomName || '').trim() || 'デバッグ用サンプル企画',
        editorEmail: 'sample-editor@example.invalid',
        eventDate,
        deadline: subtractDays(eventDate, 2),
        description: '集合場所：新宿駅西口。集合時刻：7:00。持ち物：雨具・飲料・昼食。雨天時は前日18時までに連絡します。',
      },
    } : {}),
    ...(room?.meta?.applicationSync ? {} : reservation?.roomId === runtime.roomId && /^[a-f0-9]{32}$/.test(String(reservation.jobId || '')) ? { jobId: reservation.jobId } : {}),
  });
  return {
    project,
    sampleMode: debugSample,
    session: runtime.external.formMakerSession || offlineFormMakerSession,
    active,
    onNotice,
    createProjectLink: () => runtime.external.prepareApplicationForm({ room }),
    onHandoffReady: result => runtime.external.acceptApplicationFormHandoff(result),
  };
}

export async function loadFormMakerWorkspace() {
  const module = await import('@sanpokai/form-maker-workspace');
  return { default: module.FormMakerWorkspace };
}
