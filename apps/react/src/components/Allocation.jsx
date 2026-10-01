import { useEffect, useRef, useState } from 'react';
import { Button, InlineNotification, Link } from '@carbon/react';
import { Add, Shuffle } from '@carbon/icons-react';
import ParticipantEditor from './ParticipantEditor.jsx';
import AllocationWorkspace from './allocation/AllocationWorkspace.jsx';
import AllocationPresentation from './allocation/AllocationPresentation.jsx';
import { AllocationConfirmation, AllocationSaveStatus, GroupEditor } from './allocation/AllocationDialogs.jsx';
import useAllocationOperation from '../hooks/useAllocationOperation.js';
import { allocationView, randomAllocationReview } from '../ui/allocation-view.js';
import { allocationReceiptAffectsPresentation } from '../ui/allocation-save.js';
import { createParticipantTaskDraft } from '../ui/participant-task-draft.js';

export default function Allocation({ runtime, room, type, destination, resolved = true, onNotice, onParticipants }) {
  const view = allocationView(room, type, runtime.store.domain.canonical);
  const operation = useAllocationOperation(runtime, type);
  const [selectedId, setSelectedId] = useState('');
  const [targetId, setTargetId] = useState(destination?.groupId || '');
  const [movingId, setMovingId] = useState('');
  const [editor, setEditor] = useState(null);
  const [groupEditor, setGroupEditor] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState('');
  const live = useRef(true), route = useRef(destination);
  route.current = destination;
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => {
    setMovingId(''); setSelectedId(''); setTargetId(destination.groupId || '');
    setGroupEditor(null); setConfirmation(null);
    setEditor(current => { if (current) runtime.store.cancelEdit(current.session); return null; });
  }, [destination.task, destination.groupId, runtime]);
  useEffect(() => {
    if (resolved && (destination.invalid || destination.groupId && !view.groups.some(g => g.id === destination.groupId))) {
      setError('割り当て先が見つかりません。現在の一覧を確認してください。');
      runtime.navigation.replaceAllocationTask(type, '');
    }
  }, [destination.invalid, destination.groupId, resolved, room, runtime, type]);
  const personById = id => [...view.groups.flatMap(g => g.people), ...view.waiting].find(p => p.participantId === id);
  const label = type === 'team' ? '班' : '車';
  const roleLabel = type === 'team' ? '班長' : '運転手';
  const disabled = operation.busy || !!operation.receipt;
  async function execute(command, args, label, onDone) {
    const initialRoute = JSON.stringify(route.current);
    setError('');
    try {
      const result = await operation.run(command, args, label);
      if (live.current && initialRoute === JSON.stringify(route.current) && ['saved', 'local'].includes(result.disposition)) onDone?.();
      return result;
    } catch (caught) {
      if (live.current) { setError(caught.message); setConfirmation(current => current ? { ...current, error: caught.message } : null); }
      return { disposition: 'error', message: caught.message };
    }
  }
  const navigate = (task, groupId = '') => runtime.navigation.navigateAllocationTask(type, task, groupId);
  navigate.href = (task, groupId = '') => runtime.navigation.allocationTaskHrefFor(type, task, groupId);
  function focusHeading() { requestAnimationFrame(() => { if (live.current) document.getElementById('project-page-title')?.focus(); }); }
  function returnFocus(launcher) { requestAnimationFrame(() => { if (live.current) (launcher?.current?.isConnected ? launcher.current : document.getElementById('project-page-title'))?.focus(); }); }
  function closeGroup() { const launcher = groupEditor?.launcher; setGroupEditor(null); returnFocus(launcher); }
  function closeConfirmation() { const launcher = confirmation?.launcher; setConfirmation(null); returnFocus(launcher); }
  function personAction(action, id, launcher) {
    const person = personById(id);
    if (!person) { setError('参加者が変更されました。現在の一覧を確認してください。'); return; }
    if (action === 'move') { setMovingId(id); setSelectedId(''); setTargetId(''); requestAnimationFrame(() => document.getElementById('allocation-move-target')?.focus()); }
    if (action === 'edit') setEditor({ session: runtime.store.beginEdit({ kind: 'participant-edit', participantId: id }), launcher });
    if (action === 'fixed') execute('editParticipant', { id, changes: { locked: !person.locked } }, '固定を保存');
    if (action === 'role') execute('role', { id, type, driver: !person.driver }, `${roleLabel}を保存`);
    if (action === 'delete') setConfirmation({ title: `${person.name}を参加者から削除しますか？`, body: '車割・班割・精算の割り当ても削除されます。', command: 'deleteParticipant', args: { id }, danger: true, button: '参加者を削除', launcher });
  }
  function groupAction(action, groupId) {
    const group = view.groups.find(g => g.id === groupId);
    if (!group) return;
    const launcher = { current: document.getElementById(`allocation-group-menu-${groupId}`) };
    if (action === 'capacity') setGroupEditor({ group, launcher });
    if (action === 'delete') setConfirmation({ title: `${group.name}を削除しますか？`, body: '割り当てた参加者を未割り当てに戻します。参加者自体は削除されません。', command: 'deleteGroup', args: { type, groupId }, danger: true, button: '削除', launcher });
  }
  function assign() {
    if (!selectedId || !targetId) return;
    const current = view.groups.find(g => g.id === targetId);
    execute('move', { id: selectedId, type, groupId: targetId, order: Math.max(0, (current?.peopleCount || 1) - 1) }, `${label}へ割り当て`, () => {
      setSelectedId('');
      const next = allocationView(runtime.store.getSnapshot(), type, runtime.store.domain.canonical).waiting[0];
      requestAnimationFrame(() => { if (live.current) (document.getElementById(`allocation-select-${next?.participantId}`) || document.getElementById('project-page-title'))?.focus(); });
    });
  }
  const review = randomAllocationReview(room, type, runtime.store.domain.assignment);
  let presentationReceipt = operation.receipt;
  if (destination.task === 'presentation' && !presentationReceipt) {
    const other = createParticipantTaskDraft({ storage: () => window.localStorage, roomId: runtime.roomId, task: `allocation:${type === 'car' ? 'team' : 'car'}` }).read()?.receipt;
    const base = runtime.storage.read('base');
    const unknown = other && !other.acknowledged && !base?.syncOperations?.[other.operationId] && !['saved', 'local'].includes(other.disposition) && (!base || base.resetGeneration === other.resetGeneration);
    const pending = runtime.storage.read('outbox');
    presentationReceipt = unknown && allocationReceiptAffectsPresentation(other, type) ? other : allocationReceiptAffectsPresentation(pending, type) ? pending : null;
  }
  return <section className="allocation-page" aria-label={type === 'team' ? '班割' : '車割'}>
    {error && <InlineNotification kind="error" title="割り当てを確認してください" subtitle={error} hideCloseButton lowContrast />}
    {!editor && !groupEditor && !confirmation && <AllocationSaveStatus operation={operation} />}
    {destination.task === 'presentation' ? <AllocationPresentation view={view} projectName={room.roomName} receipt={presentationReceipt} busy={operation.busy} onNotice={onNotice} /> : !view.participantCount ? <div className="allocation-empty"><p>参加者がいません</p><Link href={runtime.navigation.hrefFor('participants')} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onParticipants(); } }}>参加者へ</Link></div> : <>
      <div className="allocation-actions">
        <Button id="allocation-add" kind={view.groups.length ? 'tertiary' : 'primary'} renderIcon={Add} disabled={disabled || !view.waiting.length} onClick={event => setGroupEditor({ launcher: { current: event.currentTarget } })}>{label}を追加</Button>
        <Button id="allocation-random" kind="tertiary" renderIcon={Shuffle} disabled={disabled || !view.groups.length || !review.eligibleCount || !review.slotCount} onClick={event => setConfirmation({ title: 'ランダム割り当て', command: 'randomize', args: { type }, button: 'ランダムに割り当て', scope: review.scope, launcher: { current: event.currentTarget } })}>ランダム割り当て</Button>
      </div>
      <Link id="allocation-presentation" href={navigate.href('presentation')} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate('presentation'); } }}>結果を確認・コピー</Link>
      {!view.groups.length && <p>未割り当ての参加者を選んで{label}を追加してください。</p>}
      {view.groups.length > 0 && !review.eligibleCount && <p>ランダム割り当ての対象者がいません。固定・役割を確認するか、手動で移動してください。</p>}
      {view.groups.length > 0 && review.eligibleCount > 0 && !review.slotCount && <p>ランダム割り当てに使える空き枠がありません。人数の上限・固定・役割を確認してください。</p>}
      {!view.waiting.length && <p>未割り当ての参加者を選ぶと{label}を追加できます。移動から未割り当てへ戻せます。</p>}
      <AllocationWorkspace view={view} destination={destination} selectedId={selectedId} targetId={targetId} busy={disabled} movingId={movingId} onSelect={id => { setMovingId(''); setSelectedId(id); }} onTarget={setTargetId} onMove={assign} onNavigate={navigate} onPersonAction={personAction} onGroupAction={groupAction}
        onCancelMove={() => { const id = movingId; setMovingId(''); requestAnimationFrame(() => document.getElementById(`allocation-move-${id}`)?.focus()); }}
        onManualMove={() => execute('move', { id: movingId, type, groupId: targetId }, `${label}へ移動`, () => { setMovingId(''); focusHeading(); })} />
    </>}
    {editor && <ParticipantEditor runtime={runtime} session={editor.session} launcherButtonRef={editor.launcher} onClose={() => setEditor(null)} saveIntent={session => operation.run(() => runtime.store.commitEdit(session, { close: false }), {}, '参加者を保存')} saveBlocked={disabled} saveFeedback={<AllocationSaveStatus operation={operation} onAccepted={() => { runtime.store.cancelEdit(editor.session); setEditor(null); returnFocus(editor.launcher); }} />} />}
    {groupEditor && <GroupEditor type={type} view={view} group={groupEditor.group} operation={operation} onSave={execute} launcherButtonRef={groupEditor.launcher} onClose={closeGroup} />}
    {confirmation && <AllocationConfirmation state={confirmation} review={review} type={type} operation={operation} launcherButtonRef={confirmation.launcher} onClose={closeConfirmation} onSubmit={() => {
      const latestReview = randomAllocationReview(runtime.store.getSnapshot(), type, runtime.store.domain.assignment);
      if (confirmation.scope && confirmation.scope !== latestReview.scope) { setConfirmation({ ...confirmation, scope: latestReview.scope, changed: true }); return; }
      execute(confirmation.command, confirmation.args, confirmation.button, () => { setConfirmation(null); focusHeading(); });
    }} />}
  </section>;
}
