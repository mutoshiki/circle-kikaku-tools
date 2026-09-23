import { useState } from 'react';
import { Modal, TextInput, TextArea, Select, SelectItem, Checkbox, InlineNotification } from '@carbon/react';

export default function ParticipantEditor({ runtime, session, onClose, onNotice }) {
  const id = session.participantId;
  const [draft, setDraft] = useState(() => ({ ...session.draft.participants[id] }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const field = (name, value) => setDraft(current => ({ ...current, [name]: value }));
  async function save() {
    if (!draft.name.trim()) { setError('名前を入力してください。'); return; }
    setSaving(true);
    try {
      Object.assign(session.draft.participants[id], draft);
      runtime.store.commitEdit(session, { close: false });
      await runtime.sync.flush();
      if (runtime.sync.getSnapshot().kind === 'error') throw new Error(runtime.sync.getSnapshot().message);
      runtime.store.cancelEdit(session);
      onNotice('参加者を更新しました。');
      onClose();
    } catch (caught) { setError(caught.message); }
    finally { setSaving(false); }
  }
  return <Modal className="app-modal" open hasScrollingContent modalHeading="参加者を編集" size="sm" primaryButtonText="保存" secondaryButtonText="キャンセル" onRequestSubmit={save} onRequestClose={() => { runtime.store.cancelEdit(session); onClose(); }} primaryButtonDisabled={saving} preventCloseOnClickOutside selectorPrimaryFocus="#participant-edit-name">
    <div className="form-stack">
      {error && <InlineNotification kind="error" title={error} hideCloseButton lowContrast />}
      <TextInput id="participant-edit-name" labelText="名前" value={draft.name} onChange={event => field('name', event.target.value)} invalid={!draft.name.trim() && !!error} invalidText="名前を入力してください。" />
      <Select id="participant-edit-grade" labelText="学年" value={String(draft.grade || 0)} onChange={event => field('grade', Number(event.target.value))}>
        <SelectItem value="0" text="未設定" />{[1, 2, 3, 4].map(grade => <SelectItem key={grade} value={String(grade)} text={`${grade}年`} />)}
      </Select>
      <TextArea id="participant-edit-memo" labelText="メモ" value={draft.memo || ''} onChange={event => field('memo', event.target.value)} />
      <Select id="participant-edit-flag" labelText="しるし" value={draft.flag || 'none'} onChange={event => field('flag', event.target.value)}>{[['none', 'しるしなし'], ['blue', '青'], ['purple', '紫'], ['yellow', '黄'], ['red', '赤']].map(([value, text]) => <SelectItem key={value} value={value} text={text} />)}</Select>
      <Checkbox id="participant-edit-locked" labelText="固定" checked={draft.locked === true} onChange={(_, { checked }) => field('locked', checked)} />
    </div>
  </Modal>;
}
