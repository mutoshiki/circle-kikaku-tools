import { useEffect, useRef, useState } from 'react';
import { Button, InlineLoading, InlineNotification, Link, NumberInput, Select, SelectItem } from '@carbon/react';
import { Add, Shuffle } from '@carbon/icons-react';
import ParticipantEditor from './ParticipantEditor.jsx';
import TaskModal from './TaskModal.jsx';
import AllocationWorkspace from './allocation/AllocationWorkspace.jsx';
import useAllocationOperation from '../hooks/useAllocationOperation.js';
import { allocationView, randomAllocationReview, storedAllocationCapacity } from '../ui/allocation-view.js';

function GroupEditor({ type, view, group, operation, onClose }) {
  const [ownerId, setOwnerId] = useState(group ? '' : view.waiting[0]?.participantId || '');
  const [limit, setLimit] = useState(group?.totalLimit || (type === 'team' ? 6 : 4));
  const [error, setError] = useState('');
  const label = type === 'team' ? '班' : '車';
  async function save() {
    try {
      const capacity = storedAllocationCapacity(limit);
      if (!group && !ownerId) throw new Error('参加者を選択してください。');
      const outcome = await operation.run(group ? 'capacity' : 'createGroup', group ? { type, groupId: group.id, capacity } : { type, ownerId, capacity }, `${label}の設定を保存`);
      if (['saved', 'local'].includes(outcome.disposition)) onClose();
    } catch (caught) { setError(caught.message); }
  }
  return <TaskModal taskId="allocation-group-edit" open size="xs" modalHeading={group ? '人数の上限を変更' : `${label}を追加`} primaryButtonText={group ? '保存' : '追加'} secondaryButtonText="キャンセル" onRequestSubmit={save} onRequestClose={() => { if (!operation.busy) onClose(); }} primaryButtonDisabled={operation.busy || !!operation.receipt} preventCloseOnClickOutside selectorPrimaryFocus={group ? '#group-capacity' : '#group-owner'}>
    <div className="form-stack">
      {error && <InlineNotification kind="error" title="設定を保存できませんでした" subtitle={error} hideCloseButton lowContrast />}
      {!group && <Select id="group-owner" labelText={type === 'team' ? '班長' : '運転手'} value={ownerId} onChange={event => setOwnerId(event.target.value)}>{view.waiting.map(person => <SelectItem key={person.participantId} value={person.participantId} text={person.name} />)}</Select>}
      <NumberInput id="group-capacity" label="割り当て人数の上限（全員を含む）" min={2} max={100} value={limit} onChange={(_, { value }) => setLimit(value)} invalidText="2〜100人で入力してください。" />
      {group && Number(limit) < group.peopleCount && <p>上限を超える参加者は未割り当てへ戻ります。固定した参加者も対象になります。</p>}
    </div>
  </TaskModal>;
}

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
  useEffect(() => { setMovingId(''); setSelectedId(''); setTargetId(destination.groupId || ''); }, [destination.task, destination.groupId]);
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
    } catch (caught) { if (live.current) setError(caught.message); return null; }
  }
  const navigate = (task, groupId = '') => runtime.navigation.navigateAllocationTask(type, task, groupId);
  navigate.href = (task, groupId = '') => runtime.navigation.allocationTaskHrefFor(type, task, groupId);
  function focusHeading() { requestAnimationFrame(() => { if (live.current) document.getElementById('project-page-title')?.focus(); }); }
  function personAction(action, id, launcher) {
    const person = personById(id);
    if (!person) { setError('参加者が変更されました。現在の一覧を確認してください。'); return; }
    if (action === 'move') { setMovingId(id); setSelectedId(''); setTargetId(''); requestAnimationFrame(() => document.getElementById('allocation-move-target')?.focus()); }
    if (action === 'edit') setEditor({ session: runtime.store.beginEdit({ kind: 'participant-edit', participantId: id }), launcher });
    if (action === 'fixed') execute('editParticipant', { id, changes: { locked: !person.locked } }, '固定を保存');
    if (action === 'role') execute('role', { id, type, driver: !person.driver }, `${roleLabel}を保存`);
    if (action === 'delete') setConfirmation({ title: `${person.name}を参加者から削除しますか？`, body: '車割・班割・精算の割り当ても削除されます。', command: 'deleteParticipant', args: { id }, danger: true, button: '参加者を削除' });
  }
  function groupAction(action, groupId) {
    const group = view.groups.find(g => g.id === groupId);
    if (action === 'capacity') setGroupEditor({ group });
    if (action === 'delete') setConfirmation({ title: `${group.name}を削除しますか？`, body: '割り当てた参加者を未割り当てに戻します。参加者自体は削除されません。', command: 'deleteGroup', args: { type, groupId }, danger: true, button: '削除' });
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
  return <section className="allocation-page" aria-label={type === 'team' ? '班割' : '車割'}>
    {error && <InlineNotification kind="error" title="割り当てを確認してください" subtitle={error} hideCloseButton lowContrast />}
    {operation.busy && <InlineLoading status="active" description="共有保存中" />}
    {!operation.recoverable && <p role="status">この端末に保存状態を記録できません。再読み込みすると再試行の情報が失われる可能性があります。</p>}
    {operation.receipt && !operation.busy && <section aria-label="割り当ての保存状態"><p role="status">{operation.receipt.disposition === 'adjusted' ? '同時編集により内容が調整されました。現在の結果を確認してください。' : operation.receipt.disposition === 'reset' ? '企画がリセットされました。現在の結果を確認してください。' : '共有保存を確認できません。端末に反映した内容と共有結果が異なる場合があります。'}</p>
      {operation.receipt.canRetry && <Button kind="tertiary" onClick={operation.retry}>共有保存を再試行</Button>}
      {['adjusted', 'reset'].includes(operation.receipt.disposition) && <Button kind="tertiary" onClick={operation.inspect}>現在の結果を確認した</Button>}
    </section>}
    {!view.participantCount ? <div className="allocation-empty"><p>参加者がいません</p><Link href={runtime.navigation.hrefFor('participants')} onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onParticipants(); } }}>参加者へ</Link></div> : <>
      <div className="allocation-actions">
        <Button kind={view.groups.length ? 'tertiary' : 'primary'} renderIcon={Add} disabled={disabled || !view.waiting.length} onClick={() => setGroupEditor({})}>{label}を追加</Button>
        <Button kind="tertiary" renderIcon={Shuffle} disabled={disabled || !view.groups.length || !review.eligibleCount} onClick={() => setConfirmation({ title: 'ランダム割り当て', body: `対象 ${review.eligibleCount}人。固定した参加者と${roleLabel}は移動しません。割り当て済みの参加者も変更されます。`, command: 'randomize', args: { type }, button: 'ランダムに割り当て', scope: review.scope })}>ランダム割り当て</Button>
      </div>
      {!view.groups.length && <p>未割り当ての参加者を選んで{label}を追加してください。</p>}
      {view.groups.length > 0 && !review.eligibleCount && <p>ランダム割り当ての対象者がいません。固定・役割を確認するか、手動で移動してください。</p>}
      <AllocationWorkspace view={view} destination={destination} selectedId={selectedId} targetId={targetId} busy={disabled} movingId={movingId} onSelect={id => { setMovingId(''); setSelectedId(id); }} onTarget={setTargetId} onMove={assign} onNavigate={navigate} onPersonAction={personAction} onGroupAction={groupAction}
        onCancelMove={() => { const id = movingId; setMovingId(''); requestAnimationFrame(() => document.getElementById(`allocation-move-${id}`)?.focus()); }}
        onManualMove={() => execute('move', { id: movingId, type, groupId: targetId }, `${label}へ移動`, () => { setMovingId(''); focusHeading(); })} />
    </>}
    {editor && <ParticipantEditor runtime={runtime} session={editor.session} launcherButtonRef={editor.launcher} onClose={() => setEditor(null)} />}
    {groupEditor && <GroupEditor type={type} view={view} group={groupEditor.group} operation={operation} onClose={() => setGroupEditor(null)} />}
    {confirmation && <TaskModal taskId="allocation-group-confirm" open size="xs" modalHeading={confirmation.title} danger={confirmation.danger} primaryButtonText={confirmation.button} secondaryButtonText="キャンセル" primaryButtonDisabled={disabled} onRequestClose={() => { if (!operation.busy) setConfirmation(null); }} onRequestSubmit={() => {
      if (confirmation.scope && confirmation.scope !== review.scope) { setConfirmation({ ...confirmation, scope: review.scope, body: `割り当てが変更されました。内容を確認してもう一度選んでください。対象 ${review.eligibleCount}人。` }); return; }
      execute(confirmation.command, confirmation.args, confirmation.button, () => { setConfirmation(null); focusHeading(); });
    }}><p>{confirmation.body}</p></TaskModal>}
  </section>;
}
