import { Button, Form, InlineNotification, Tag, TextArea, TextInput } from '@carbon/react';
import { Add, TrashCan } from '@carbon/icons-react';
import { useEffect, useRef, useState } from 'react';

function normalizedOverview(value = {}) {
  return {
    memo: String(value.memo || ''),
    timetableItems: (Array.isArray(value.timetableItems) ? value.timetableItems : [])
      .map(item => ({ time: String(item?.time || '').slice(0, 5), title: String(item?.title || '') }))
      .filter(item => item.time || item.title),
  };
}

function OverviewEditor({ runtime, room, onCancel, onSaved }) {
  const persistedDraft = runtime.overviewDraft.read(room.overview || {});
  const initialOverview = normalizedOverview(persistedDraft);
  const [draft, setDraft] = useState({
    roomName: Object.hasOwn(persistedDraft, 'roomName') ? String(persistedDraft.roomName || '') : String(room.roomName || ''),
    memo: initialOverview.memo,
    timetableItems: initialOverview.timetableItems.length ? initialOverview.timetableItems : [{ time: '', title: '' }],
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const nameRef = useRef(null);
  const savedOverview = normalizedOverview(room.overview || {});
  const draftOverview = normalizedOverview(draft);
  const dirty = draft.roomName !== String(room.roomName || '') || JSON.stringify(draftOverview) !== JSON.stringify(savedOverview);

  useEffect(() => {
    requestAnimationFrame(() => nameRef.current?.focus());
  }, []);

  function patch(next) {
    setDraft(next);
    runtime.overviewDraft.write(next);
    if (error) setError('');
  }

  function cancel() {
    runtime.overviewDraft.write({ roomName: room.roomName, ...savedOverview });
    onCancel();
  }

  function save(event) {
    event.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    setError('');
    try {
      runtime.store.command('projectOverview', { name: draft.roomName, overview: draftOverview });
      runtime.overviewDraft.write({ roomName: draft.roomName, ...draftOverview });
      onSaved();
    } catch (caught) {
      setError(String(caught?.message || caught));
      setSaving(false);
    }
  }

  function updateRow(index, changes) {
    patch({ ...draft, timetableItems: draft.timetableItems.map((row, rowIndex) => rowIndex === index ? { ...row, ...changes } : row) });
  }

  return <Form className="overview-editor" aria-labelledby="overview-editor-title" onSubmit={save}>
    <div className="content-section-heading overview-editor__heading">
      <div><h2 id="overview-editor-title">企画情報を編集</h2><p>入力内容は「保存」を押すまで共有されません。</p></div>
      {dirty && <Tag type="gray" size="sm">未保存の変更</Tag>}
    </div>
    {error && <InlineNotification kind="error" title="企画情報を保存できませんでした" subtitle={error} hideCloseButton lowContrast />}
    <TextInput ref={nameRef} id="room-name" labelText="企画名" placeholder="企画名未設定" value={draft.roomName} onChange={event => patch({ ...draft, roomName: event.target.value })} />
    <TextArea id="overview-memo" labelText="メモ" rows={4} value={draft.memo} onChange={event => patch({ ...draft, memo: event.target.value })} />
    <section className="overview-editor__timetable" aria-labelledby="overview-timetable-editor-title">
      <div className="content-section-heading">
        <div><h3 id="overview-timetable-editor-title">時刻表</h3><p>企画当日の順序を入力します。</p></div>
        <Button kind="ghost" size="sm" type="button" renderIcon={Add} onClick={() => patch({ ...draft, timetableItems: [...draft.timetableItems, { time: '', title: '' }] })}>行を追加</Button>
      </div>
      <div className="timetable-list">{draft.timetableItems.map((item, index) => <div className="timetable-row" key={index}>
        <TextInput id={`overview-time-${index}`} type="time" labelText="時刻" value={item.time} onChange={event => updateRow(index, { time: event.target.value })} />
        <TextInput id={`overview-title-${index}`} labelText="内容" value={item.title} onChange={event => updateRow(index, { title: event.target.value })} />
        <Button kind="danger-ghost" size="sm" type="button" renderIcon={TrashCan} onClick={() => patch({ ...draft, timetableItems: draft.timetableItems.filter((_, rowIndex) => rowIndex !== index) })}>削除</Button>
      </div>)}</div>
    </section>
    <div className="overview-editor__actions">
      <Button type="submit" disabled={!dirty || saving}>保存</Button>
      <Button type="button" kind="secondary" onClick={cancel}>キャンセル</Button>
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
