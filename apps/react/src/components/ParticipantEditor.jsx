import { useEffect, useRef, useState } from 'react';
import { TextInput, TextArea, Select, SelectItem, Checkbox, InlineNotification } from '@carbon/react';
import TaskModal from './TaskModal.jsx';
import { focusFirstInvalid } from '../ui/focus-first-invalid.js';

export default function ParticipantEditor({ runtime, session, onClose, launcherButtonRef, saveIntent, saveFeedback, saveBlocked = false }) {
  const id = session.participantId;
  const [draft, setDraft] = useState(() => ({ ...session.draft.participants[id] }));
  const [driver, setDriver] = useState(() => session.draft.allocations.car.placements[id]?.driver === true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const field = (name, value) => setDraft(current => ({ ...current, [name]: value }));
  const focusLauncher = () => requestAnimationFrame(() => launcherButtonRef?.current?.focus());
  function close() {
    if (saving) return;
    runtime.store.cancelEdit(session);
    onClose();
    focusLauncher();
  }
  async function save() {
    if (!draft.name.trim()) {
      setError('名前を入力してください。');
      requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return;
    }
    setSaving(true);
    try {
      Object.assign(session.draft.participants[id], draft);
      const placement = session.draft.allocations.car.placements[id];
      if (placement) placement.driver = driver;
      if (saveIntent) {
        const outcome = await saveIntent(session);
        if (!['saved', 'local'].includes(outcome.disposition)) return;
      } else {
        runtime.store.commitEdit(session, { close: false });
        await runtime.sync.flush();
        if (runtime.sync.getSnapshot().kind === 'error') throw new Error(runtime.sync.getSnapshot().message);
      }
      if (!alive.current) return;
      runtime.store.cancelEdit(session);
      onClose();
      focusLauncher();
    } catch (caught) { if (alive.current) setError(caught.message); }
    finally { if (alive.current) setSaving(false); }
  }
  return <TaskModal taskId="participant-edit" className="app-modal" open hasScrollingContent modalHeading="参加者を編集" size="sm" primaryButtonText="保存" secondaryButtonText="キャンセル" onRequestSubmit={save} onRequestClose={close} primaryButtonDisabled={saving || saveBlocked} preventCloseOnClickOutside launcherButtonRef={launcherButtonRef} selectorPrimaryFocus="#participant-edit-name">
    <div ref={formRef} className="form-stack">
      {saveFeedback}
      {error && <InlineNotification kind="error" title={error} hideCloseButton lowContrast />}
      <TextInput id="participant-edit-name" labelText="名前" value={draft.name} onChange={event => { field('name', event.target.value); if (error === '名前を入力してください。' && event.target.value.trim()) setError(''); }} invalid={!draft.name.trim() && !!error} invalidText="名前を入力してください。" />
      <Select id="participant-edit-grade" labelText="学年" value={String(draft.grade || 0)} onChange={event => field('grade', Number(event.target.value))}>
        <SelectItem value="0" text="未設定" />{[1, 2, 3, 4].map(grade => <SelectItem key={grade} value={String(grade)} text={`${grade}年`} />)}
      </Select>
      {session.draft.allocations.car.placements[id] && <Checkbox id="participant-edit-driver" labelText="運転手" checked={driver} onChange={(_, { checked }) => setDriver(checked)} />}
      <TextArea id="participant-edit-memo" labelText="メモ" value={draft.memo || ''} onChange={event => field('memo', event.target.value)} />
      <Select id="participant-edit-flag" labelText="しるし" value={draft.flag || 'none'} onChange={event => field('flag', event.target.value)}>{[['none', 'しるしなし'], ['blue', '青'], ['purple', '紫'], ['yellow', '黄'], ['red', '赤']].map(([value, text]) => <SelectItem key={value} value={value} text={text} />)}</Select>
      <Checkbox id="participant-edit-locked" labelText="固定" checked={draft.locked === true} onChange={(_, { checked }) => field('locked', checked)} />
    </div>
  </TaskModal>;
}
