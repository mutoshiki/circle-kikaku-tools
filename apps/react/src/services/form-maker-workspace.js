export const offlineFormMakerSession = Object.freeze({
  async prepare() { return { accepting: false, acceptanceMode: 'paused' }; },
  async listJobs() { return []; },
  async getJob() { return null; },
  async enqueue() { throw new Error('オフラインの確認画面ではフォームを作成できません。'); },
  getHandoffToken() { return ''; },
});

export function createFormMakerWorkspaceProps({ runtime, room, active = true, onNotice = () => {} }) {
  const reservation = runtime.storage.read('applicationFormReservation');
  const project = Object.freeze({
    roomId: runtime.roomId,
    projectName: String(room?.roomName || '').trim() || '新しい企画',
    eventDate: String(room?.meta?.eventDate || room?.eventDate || ''),
    ...(room?.meta?.applicationSync ? {} : reservation?.roomId === runtime.roomId && /^[a-f0-9]{32}$/.test(String(reservation.jobId || '')) ? { jobId: reservation.jobId } : {}),
  });
  return {
    project,
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
