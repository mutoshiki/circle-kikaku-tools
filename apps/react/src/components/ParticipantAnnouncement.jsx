import { useMemo, useState } from 'react';
import { Button, Form, InlineNotification, TextArea, TextInput } from '@carbon/react';
import { createProjectDomain } from '../services/project-domain.js';
import { createParticipantTaskDraft } from '../ui/participant-task-draft.js';
import { notice } from '../ui/task-contracts.js';

export default function ParticipantAnnouncement({ runtime, room, onNotice }) {
  const [cache] = useState(() => createParticipantTaskDraft({ storage: () => window.localStorage, roomId: runtime.roomId, task: 'announcement' }));
  const [fields, setFields] = useState(() => {
    const saved = cache.read();
    return { eventDate: String(saved?.eventDate ?? room.meta?.applicationSync?.eventDate ?? ''), meetingTime: String(saved?.meetingTime || ''), supplement: String(saved?.supplement || ''), opening: '', contact: '', closing: '', itinerary: [] };
  });
  const [recoverable, setRecoverable] = useState(() => cache.isRecoverable());
  const [error, setError] = useState('');
  const [copying, setCopying] = useState(false);
  const project = useMemo(() => createProjectDomain({ getRoom: () => room, getAnnouncement: () => fields, settlement: runtime.store.domain.settlement }), [room, fields, runtime]);
  const text = project.bodyText({ allowPlaceholder: true });
  function patch(changes) {
    const next = { ...fields, ...changes };
    setFields(next); setRecoverable(cache.write({ eventDate: next.eventDate, meetingTime: next.meetingTime, supplement: next.supplement })); setError('');
  }
  async function copy(event) {
    event.preventDefault();
    if (!text || copying) return;
    setCopying(true); setError('');
    try { await navigator.clipboard.writeText(text); onNotice(notice.success('発表文をコピーしました', { placement: 'toast' })); }
    catch { setError('コピーの権限を確認して再試行してください。プレビューから選択してコピーすることもできます。'); }
    finally { setCopying(false); }
  }
  return <Form className="participant-task-form" aria-label="参加者発表文を作成" onSubmit={copy} aria-busy={copying}>
    <p className="task-draft-status">入力はこの端末の下書きです。参加者を変更しても発表文は最新の確定内容から作成します。</p>
    {!recoverable && <p role="status">この端末に下書きを保存できません。再読み込みすると入力が失われる可能性があります。</p>}
    <TextInput id="guidance-date" type="date" labelText="実施日" value={fields.eventDate} onChange={event => patch({ eventDate: event.target.value })} />
    <TextInput id="guidance-time" type="time" labelText="集合時間" value={fields.meetingTime} onChange={event => patch({ meetingTime: event.target.value })} />
    <TextArea id="guidance-supplement" labelText="補足事項" rows={3} value={fields.supplement} onChange={event => patch({ supplement: event.target.value })} />
    <TextArea id="guidance-preview" labelText="発表文プレビュー" rows={14} value={text} readOnly />
    {!text && <InlineNotification kind="warning" title="発表文を作成できません" subtitle="応募フォーム連携済みの企画で参加者を確定してください。" hideCloseButton lowContrast />}
    {error && <InlineNotification kind="error" title="発表文をコピーできませんでした" subtitle={error} hideCloseButton lowContrast />}
    <div className="participant-task-actions"><Button type="submit" disabled={!text || copying}>発表文をコピー</Button></div>
  </Form>;
}
