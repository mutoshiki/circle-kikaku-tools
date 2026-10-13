import { useEffect, useRef, useState } from 'react';
import { Button, TextInput } from '@carbon/react';

export default function ProjectIdentity({ name, syncStatus, onRename }) {
  const hasName = String(name ?? '').trim().length > 0;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saveError, setSaveError] = useState('');
  const editButton = useRef(null);
  const input = useRef(null);
  const composing = useRef(false);
  const wasEditing = useRef(false);

  useEffect(() => {
    if (editing) input.current?.focus();
    else if (wasEditing.current) editButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  function beginEditing() {
    setDraft(name ?? '');
    setSaveError('');
    setEditing(true);
  }

  function cancelEditing() {
    setSaveError('');
    setEditing(false);
  }

  function saveEditing() {
    if (draft === (name ?? '')) {
      setEditing(false);
      return;
    }
    try {
      onRename(draft);
      setSaveError('');
      setEditing(false);
    } catch {
      setSaveError('企画名を保存できませんでした。入力内容を確認して、もう一度お試しください。');
    }
  }

  function handleKeyDown(event) {
    if (composing.current || event.nativeEvent.isComposing) {
      if (event.key === 'Enter' || event.key === 'Escape') event.preventDefault();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      saveEditing();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditing();
    }
  }

  return <section className="project-title" aria-label="企画情報">
    <div className="project-identity-heading">
      <h1 id="project-heading">{name || '企画名未設定'}</h1>
      <div className="project-identity-actions">
        <Button ref={editButton} kind="ghost" size="sm" aria-label={hasName ? '企画名を変更' : '企画名を設定'} hidden={editing} onClick={beginEditing}>{hasName ? '変更' : '企画名を設定'}</Button>
        {syncStatus.kind === 'connected' && <span className="sync-status sync-status--compact" role="status">{syncStatus.message}</span>}
      </div>
    </div>
    {editing && <form className="project-name-editor" onSubmit={event => { event.preventDefault(); saveEditing(); }}>
      <TextInput ref={input} id="room-name" labelText="企画名" placeholder="企画名未設定" value={draft} invalid={!!saveError} invalidText={saveError} onChange={event => setDraft(event.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={handleKeyDown} />
      <div className="project-name-editor-actions">
        <Button type="submit" kind="primary" size="sm">保存</Button>
        <Button type="button" kind="ghost" size="sm" onClick={cancelEditing}>キャンセル</Button>
      </div>
    </form>}
    {syncStatus.kind !== 'local' && syncStatus.kind !== 'connected' && <span className="sync-status sync-status--prominent" role="status">{syncStatus.message}</span>}
  </section>;
}
