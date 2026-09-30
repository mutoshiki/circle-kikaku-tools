import { Button, Form, InlineLoading, InlineNotification, Tag, TextArea, TextInput } from '@carbon/react';
import { Add, TrashCan } from '@carbon/icons-react';
import { useEffect, useRef, useState } from 'react';
import { breakpoints } from '@carbon/layout';
import useMediaQuery from '../hooks/useMediaQuery.js';

function normalizedOverview(value = {}) {
  return {
    memo: String(value.memo || ''),
    timetableItems: (Array.isArray(value.timetableItems) ? value.timetableItems : [])
      .map(item => ({ time: String(item?.time || '').slice(0, 5), title: String(item?.title || '') }))
      .filter(item => item.time || item.title),
  };
}

function OverviewEditor({ runtime, room, onCancel, onSaved }) {
  const compact = useMediaQuery(`(min-width: ${breakpoints.md.width})`);
  const [persistedDraft] = useState(() => runtime.overviewDraft.read(room.overview || {}));
  const [baseline] = useState(() => persistedDraft.baseline || { roomName: String(room.roomName || ''), ...normalizedOverview(room.overview), resetGeneration: room.resetGeneration });
  const initialOverview = normalizedOverview(persistedDraft);
  const [draft, setDraft] = useState({
    roomName: Object.hasOwn(persistedDraft, 'roomName') ? String(persistedDraft.roomName || '') : String(room.roomName || ''),
    memo: initialOverview.memo,
    timetableItems: initialOverview.timetableItems.length ? initialOverview.timetableItems : [{ time: '', title: '' }],
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const nameRef = useRef(null);
  const addRowRef = useRef(null);
  const sessionRef = useRef(null);
  const savedOverview = normalizedOverview(baseline);
  const draftOverview = normalizedOverview(draft);
  const dirty = draft.roomName !== baseline.roomName || JSON.stringify(draftOverview) !== JSON.stringify(savedOverview);

  useEffect(() => {
    const session = runtime.store.beginEdit({ kind: 'project-overview' });
    sessionRef.current = session;
    const frame = requestAnimationFrame(() => nameRef.current?.focus());
    return () => { cancelAnimationFrame(frame); runtime.store.cancelEdit(session); sessionRef.current = null; };
  }, [runtime]);

  function patch(next) {
    setDraft(next);
    runtime.overviewDraft.write({ ...next, baseline });
    if (error) setError('');
  }

  function cancel() {
    runtime.overviewDraft.clear();
    onCancel();
  }

  async function save(event) {
    event.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    setError('');
    try {
      const session = sessionRef.current;
      if (baseline.resetGeneration !== room.resetGeneration) throw new Error('企画がリセットされました。キャンセルして開き直してください。');
      // Preserve untouched owners, including remote timetable/memo edits, without
      // changing the existing whole-overview persistence/sync contract.
      const latest = normalizedOverview(runtime.store.getSnapshot().overview);
      session.draft.overview = {
        ...latest,
        ...(draftOverview.memo !== savedOverview.memo ? { memo: draftOverview.memo } : {}),
        ...(JSON.stringify(draftOverview.timetableItems) !== JSON.stringify(savedOverview.timetableItems) ? { timetableItems: draftOverview.timetableItems } : {}),
      };
      if (draft.roomName !== baseline.roomName) session.draft.roomName = draft.roomName;
      runtime.store.commitEdit(session, { close: false });
      do {
        await runtime.sync.flush();
        if (runtime.sync.getSnapshot().kind === 'error') throw new Error('共有保存に失敗しました。接続や権限を確認して、もう一度保存してください。');
      } while (runtime.storage.read('outbox'));
      if (sessionRef.current !== session) return;
      if (baseline.resetGeneration !== runtime.store.getSnapshot().resetGeneration) throw new Error('企画がリセットされました。キャンセルして開き直してください。');
      runtime.overviewDraft.clear();
      onSaved();
    } catch (caught) {
      setError(String(caught?.message || caught));
      setSaving(false);
    }
  }

  function updateRow(index, changes) {
    patch({ ...draft, timetableItems: draft.timetableItems.map((row, rowIndex) => rowIndex === index ? { ...row, ...changes } : row) });
  }

  function removeRow(index) {
    const timetableItems = draft.timetableItems.filter((_, rowIndex) => rowIndex !== index);
    patch({ ...draft, timetableItems });
    requestAnimationFrame(() => {
      const next = document.getElementById(`overview-time-${Math.min(index, timetableItems.length - 1)}`);
      (next || addRowRef.current)?.focus();
    });
  }

  return <Form className="overview-editor" aria-labelledby="overview-editor-title" aria-busy={saving} onSubmit={save}>
    <div className="content-section-heading overview-editor__heading">
      <div><h2 id="overview-editor-title">企画情報を編集</h2><p>「保存」で共有します。画面を移動しても、この端末に下書きが残ります。</p></div>
      {dirty && <Tag type="gray" size="sm">未保存の変更</Tag>}
    </div>
    {error && <InlineNotification kind="error" title="企画情報を保存できませんでした" subtitle={error} hideCloseButton lowContrast />}
    <TextInput disabled={saving} ref={nameRef} id="room-name" labelText="企画名" placeholder="企画名未設定" value={draft.roomName} onChange={event => patch({ ...draft, roomName: event.target.value })} />
    <TextArea disabled={saving} id="overview-memo" labelText="メモ" rows={4} value={draft.memo} onChange={event => patch({ ...draft, memo: event.target.value })} />
    <section className="overview-editor__timetable" aria-labelledby="overview-timetable-editor-title">
      <div className="content-section-heading">
        <div><h3 id="overview-timetable-editor-title">時刻表</h3><p>企画当日の順序を入力します。</p></div>
        <Button ref={addRowRef} disabled={saving} kind="ghost" size={compact ? 'sm' : 'md'} type="button" renderIcon={Add} onClick={() => patch({ ...draft, timetableItems: [...draft.timetableItems, { time: '', title: '' }] })}>行を追加</Button>
      </div>
      <div className="timetable-list">{draft.timetableItems.map((item, index) => <div className="timetable-row" key={index}>
        <TextInput disabled={saving} id={`overview-time-${index}`} type="time" labelText="時刻" value={item.time} onChange={event => updateRow(index, { time: event.target.value })} />
        <TextInput disabled={saving} id={`overview-title-${index}`} labelText="内容" value={item.title} onChange={event => updateRow(index, { title: event.target.value })} />
        <Button disabled={saving} kind="danger--ghost" size={compact ? 'sm' : 'md'} type="button" renderIcon={TrashCan} onClick={() => removeRow(index)}>削除</Button>
      </div>)}</div>
    </section>
    <div className="overview-editor__actions">
      <Button type="submit" disabled={!dirty || saving}>保存</Button>
      <Button type="button" kind="secondary" disabled={saving} onClick={cancel}>キャンセル</Button>
      {saving && <InlineLoading status="active" description="保存中" />}
    </div>
  </Form>;
}

export default function ProjectOverview({ runtime, room, editing = false, onCancel, onSaved }) {
  if (editing) return <OverviewEditor runtime={runtime} room={room} onCancel={onCancel} onSaved={onSaved} />;
  const overview = normalizedOverview(room.overview || {});
  return <div className="overview-layout">
    <section className="overview-section" aria-labelledby="overview-basics-title">
      <div className="content-section-heading">
        <div><h2 id="overview-basics-title">企画の基本情報</h2><p>共有リンクを開く全員に表示されます。</p></div>
      </div>
      <dl className="overview-basics"><div><dt>企画名</dt><dd>{room.roomName || '企画名未設定'}</dd></div></dl>
    </section>
    <section className="overview-section" aria-labelledby="overview-plan-title">
      <div className="content-section-heading">
        <div><h2 id="overview-plan-title">企画メモと時刻表</h2><p>共有済みの企画情報を確認します。</p></div>
      </div>
      {overview.memo ? <p className="overview-memo">{overview.memo}</p> : <p className="empty-copy">メモはまだありません。</p>}
      {overview.timetableItems.length ? <ol className="overview-timetable">{overview.timetableItems.map((item, index) => <li key={`${item.time}-${item.title}-${index}`}><time>{item.time || '時刻未定'}</time><span>{item.title || '内容未設定'}</span></li>)}</ol> : <p className="empty-copy">時刻表はまだありません。</p>}
    </section>
  </div>;
}
