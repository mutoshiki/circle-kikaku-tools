import { useState } from 'react';
import { InlineNotification, Modal, TextInput } from '@carbon/react';
import { assertStandaloneDriverNameTargetCurrent, applyStandaloneDriverName, commitSettlementEdit } from './settlement/edit.js';

export default function StandaloneDriverNameModal({ runtime, edit, launcherButtonRef, onNotice, onClose }) {
  const [name, setName] = useState(edit.driverName);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    let result;
    try {
      assertStandaloneDriverNameTargetCurrent(runtime.store, edit);
      result = applyStandaloneDriverName(edit, edit.state, name);
      if (!result.ok) { setError(result.error); return; }
      setSaving(true); setError('');
      await commitSettlementEdit(runtime, edit);
      onNotice('運転手の名前を保存しました。');
      onClose(true);
    } catch (caught) {
      if (result?.ok) edit.oldName = result.name;
      setError(caught.message || '運転手の名前を保存できませんでした。');
      setSaving(false);
    }
  }

  function cancel() { onClose(false); }
  return <Modal className="app-modal standalone-driver-name-modal" open size="sm" modalHeading="運転手の名前を編集" closeButtonLabel="閉じる" launcherButtonRef={launcherButtonRef} primaryButtonText="保存" secondaryButtonText="キャンセル" primaryButtonDisabled={saving} onRequestSubmit={save} onRequestClose={cancel} preventCloseOnClickOutside selectorPrimaryFocus="#standalone-driver-name">
    {error && <InlineNotification kind="error" title="名前を保存できません" subtitle={error} hideCloseButton lowContrast />}
    <TextInput id="standalone-driver-name" labelText="運転手の名前（任意）" helperText="空欄の場合は「車出し1」などの仮名を表示します。" value={name} invalid={!!error} invalidText={error} onChange={event => { setName(event.target.value); setError(''); }} />
  </Modal>;
}
