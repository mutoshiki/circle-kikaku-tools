import { useEffect, useRef, useState } from 'react';
import { Button, IconButton, Modal, Select, SelectItem, NumberInput, InlineNotification, Tag, OverflowMenu, OverflowMenuItem, ContainedList, ContainedListItem } from '@carbon/react';
import { Add, Shuffle, ChevronDown, ChevronUp, Pin, PinFilled, Flag } from '@carbon/icons-react';
import ParticipantEditor from './ParticipantEditor.jsx';
import useMediaQuery from '../hooks/useMediaQuery.js';
import InitialEmptyState from './InitialEmptyState.jsx';
import { getCapacitySummary, toStoredCapacity } from './allocation-capacity.js';

function GroupEditor({ runtime, room, type, group, onClose, onNotice }) {
  const allocation = room.allocations[type];
  const candidates = Object.entries(allocation.placements).filter(([, p]) => p.kind === 'waiting').map(([id]) => room.participants[id]);
  const [ownerId, setOwnerId] = useState(group?.ownerId || candidates[0]?.id || '');
  const initialCapacity = group ? group.capacity + (type === 'car' ? 1 : 0) : (type === 'team' ? 6 : 4);
  const [capacity, setCapacity] = useState(initialCapacity);
  const [error, setError] = useState('');
  const label = type === 'team' ? '班' : '車';
  const minimum = type === 'team' ? 1 : 2;
  const maximum = 100;
  const currentOccupancy = group ? Object.values(allocation.placements).filter(placement => placement.kind === 'member' && placement.groupId === group.id).length : 0;
  const numericCapacity = capacity === '' ? NaN : Number(capacity);
  const capacityUnchanged = !!group && numericCapacity === initialCapacity;
  const willUnassignMembers = !!group && Number.isInteger(numericCapacity) && numericCapacity < currentOccupancy;
  function save() {
    if (!Number.isFinite(numericCapacity) || !Number.isInteger(numericCapacity) || (!capacityUnchanged && (numericCapacity < minimum || numericCapacity > maximum))) {
      setError(`${minimum}〜${maximum}人の整数で入力してください。`); return;
    }
    if (!ownerId) { setError(`参加者を選択してから${label}を追加してください。`); return; }
    if (capacityUnchanged) { onClose(); return; }
    try {
      const storedCapacity = toStoredCapacity(type, numericCapacity);
      runtime.store.command(group ? 'capacity' : 'createGroup', group ? { type, groupId: group.id, capacity: storedCapacity } : { type, ownerId, capacity: storedCapacity });
      onNotice(group ? '定員を更新しました。' : `${label}を追加しました。`); onClose();
    } catch (caught) { setError(caught.message); }
  }
  return <Modal className="app-modal" open size="xs" modalHeading={group ? '定員を変更' : `${label}を追加`} closeButtonLabel="閉じる" primaryButtonText={group ? '保存' : '追加'} secondaryButtonText="キャンセル" onRequestSubmit={save} onRequestClose={onClose} preventCloseOnClickOutside selectorPrimaryFocus={group ? '#group-capacity' : '#group-owner'}>
    <div className="form-stack">
      {error && <InlineNotification kind="error" title={error} hideCloseButton lowContrast />}
      {!group && <Select id="group-owner" labelText={type === 'team' ? '班長' : '運転手'} value={ownerId} onChange={event => setOwnerId(event.target.value)}>{candidates.map(person => <SelectItem key={person.id} value={person.id} text={person.name} />)}</Select>}
      <NumberInput id="group-capacity" label={type === 'team' ? '定員（班長を含む）' : '定員（運転手を含む）'} translateWithId={messageId => messageId === 'increment.number' ? '定員を増やす' : '定員を減らす'} min={minimum} max={maximum} allowEmpty value={capacity} invalid={!!error} invalidText={error || `${minimum}〜${maximum}人の整数で入力してください。`} helperText={willUnassignMembers ? '定員を減らすと、超過した参加者は未割り当てに戻ります。' : undefined} onChange={(_, { value }) => { setCapacity(value); setError(''); }} />
    </div>
  </Modal>;
}

export default function Allocation({ runtime, room, type, onNotice, onParticipants, roomStatus }) {
  const isMobile = useMediaQuery('(max-width: 671px)');
  const [editor, setEditor] = useState(null);
  const [groupEditor, setGroupEditor] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [moveEditor, setMoveEditor] = useState(null);
  const [moveTarget, setMoveTarget] = useState('');
  const [openCandidates, setOpenCandidates] = useState({});
  const [waitingOpen, setWaitingOpen] = useState(false);
  const [localWarning, setLocalWarning] = useState('');
  const personMenus = useRef(new Map());
  const waitingSectionRef = useRef(null);
  const seatButtons = useRef(new Map());
  const candidateButtons = useRef(new Map());
  const menuKeyHandlers = useRef(new Map());
  const escapeClosedMenus = useRef(new Set());
  const randomizationButtonRef = useRef(null);
  const projection = runtime.store.domain.canonical.projectAllocation(room, type);
  const groupLabel = type === 'team' ? '班' : '車';
  const roleLabel = type === 'team' ? '班長' : '運転手';
  const count = Object.keys(room.participants).length;
  const randomizationStatus = runtime.store.domain.randomization.getRandomizationStatus(room, type);
  const randomizationDescriptionId = `randomization-count-description-${type}`;
  const hasFormApplication = runtime.store.domain.applicants.validApplicationSync(room.meta?.applicationSync);
  function execute(command, args) {
    try { const result = runtime.store.command(command, args); return result !== null; }
    catch (error) { onNotice(error.message); return false; }
  }
  function closeConfirmation() {
    const restoreRandomizationFocus = confirmation?.title === 'ランダム割り当て';
    setConfirmation(null);
    if (restoreRandomizationFocus) setTimeout(() => randomizationButtonRef.current?.focus(), 250);
  }
  function openMoveEditor(id, fromWaiting = false) {
    const currentGroupId = room.allocations[type].placements[id]?.groupId || '';
    const targets = projection.cars.filter(car => car.participantId !== id && car.groupId !== currentGroupId).map(car => {
      const group = room.allocations[type].groups[car.groupId];
      const summary = getCapacitySummary(type, group.capacity, car.members.length);
      return { ...car, ...summary, hasCapacity: summary.remaining > 0 };
    });
    if (!targets.length) { onNotice(`移動できる${groupLabel}がありません。`); return; }
    setMoveTarget((targets.find(car => car.hasCapacity) || targets[0]).groupId);
    const sourceGroup = Object.values(room.allocations[type].groups).find(group => group.ownerId === id);
    const sourceHasOtherMembers = sourceGroup && Object.entries(room.allocations[type].placements).some(([participantId, placement]) => participantId !== id && placement.kind === 'member' && placement.groupId === sourceGroup.id);
    setMoveEditor({ id, targets, fromWaiting, sourceGroupWillBeRemoved: !!sourceGroup && !sourceHasOtherMembers });
  }
  function focusAfterCandidateAdd(groupId, participantId, remaining) {
    setTimeout(() => {
      const next = remaining[0]?.participantId;
      if (next && candidateButtons.current.has(`${groupId}:${next}`)) candidateButtons.current.get(`${groupId}:${next}`).focus();
      else if (seatButtons.current.has(groupId)) seatButtons.current.get(groupId).focus();
      else document.getElementById(`${groupId}-heading`)?.focus();
    }, 0);
  }
  function edit(id) { setEditor(runtime.store.beginEdit({ kind: 'participant-edit', participantId: id })); }
  useEffect(() => () => {
    for (const handler of menuKeyHandlers.current.values()) document.removeEventListener('keydown', handler, true);
  }, []);
  function trackMenuKeys(id) {
    const handler = event => { if (event.key === 'Escape') escapeClosedMenus.current.add(id); };
    menuKeyHandlers.current.set(id, handler);
    document.addEventListener('keydown', handler, true);
  }
  function closeMenu(id) {
    const handler = menuKeyHandlers.current.get(id);
    if (handler) document.removeEventListener('keydown', handler, true);
    menuKeyHandlers.current.delete(id);
    if (!escapeClosedMenus.current.delete(id)) return;
    setTimeout(() => {
      if (document.activeElement === document.body || !document.activeElement) personMenus.current.get(id)?.focus();
    }, 0);
  }
  function personRow(person, inWaiting = false) {
    const id = person.participantId || person.id;
    const record = room.participants[id];
    if (!record) return null;
    const anchoredGroup = Object.values(room.allocations[type].groups).find(group => group.ownerId === id);
    const anchorHasOtherMembers = anchoredGroup && Object.entries(room.allocations[type].placements).some(([participantId, placement]) => participantId !== id && placement.kind === 'member' && placement.groupId === anchoredGroup.id);
    function returnToWaiting() {
      const action = () => { if (execute('move', { id, type })) onNotice(`${record.name}を未割り当てに戻しました。`); };
      if (anchoredGroup && !anchorHasOtherMembers) {
        setConfirmation({ title: `${groupLabel}を削除して未割り当てに戻しますか？`, body: `${record.name}だけの${groupLabel}なので、${groupLabel}も削除されます。`, action, button: '戻す' });
      } else action();
    }
    return <ContainedListItem key={id} action={<div className="person-actions">
      <IconButton kind="ghost" size={isMobile ? 'lg' : 'sm'} label={`ランダム割り当てで${record.name}を${record.locked ? '固定解除' : '固定'}`} aria-pressed={record.locked === true} onClick={() => execute('editParticipant', { id, changes: { locked: !record.locked } })}>{record.locked ? <PinFilled /> : <Pin />}</IconButton>
      <OverflowMenu ref={node => node ? personMenus.current.set(id, node) : personMenus.current.delete(id)} onOpen={() => trackMenuKeys(id)} onClose={() => closeMenu(id)} ariaLabel={`${record.name}の操作`} iconDescription={`${record.name}の操作`} size="lg" flipped>
        <OverflowMenuItem itemText="参加者情報を編集" onClick={() => edit(id)} />
        <OverflowMenuItem itemText={person.driver ? `${roleLabel}を外す` : `${roleLabel}にする`} onClick={() => execute('role', { id, type, driver: !person.driver })} />
        {inWaiting ? <OverflowMenuItem itemText="割り当て先を選択" onClick={() => openMoveEditor(id, true)} /> : <OverflowMenuItem itemText={`別の${groupLabel}へ移す`} onClick={() => openMoveEditor(id)} />}
        <OverflowMenuItem itemText={inWaiting ? '参加者を削除' : '未割り当てに戻す'} hasDivider isDelete={inWaiting} onClick={() => inWaiting ? setConfirmation({ title: '参加者を削除しますか？', body: '車割・班割・精算の割り当ても削除されます。', action: () => execute('deleteParticipant', { id }), button: '削除', danger: true }) : returnToWaiting()} />
      </OverflowMenu>
    </div>}>
      <div className="person-summary"><span className="person-name">{record.name}</span><span className="person-tags">{record.flag && record.flag !== 'none' && <Flag className={`person-flag flag-${record.flag}`} aria-label={`${record.flag}のしるし`} />}{person.driver && <Tag type="gray" size="sm">{roleLabel}</Tag>}{record.grade > 0 && <span className="person-grade cds--type-body-compact-01">{record.grade}年</span>}</span></div>
      {record.memo && <p className="person-memo">{record.memo}</p>}
    </ContainedListItem>;
  }
  if (!count) return <section className="allocation-page"><InitialEmptyState headingId={`${type}-initial-heading`} title={type === 'car' ? '車割を始める' : '班割を始める'} description={hasFormApplication ? 'フォームの応募者を確認して、参加者を選んでください。' : 'まず参加者を登録してください。'} primaryAction={{ label: hasFormApplication ? '参加者を確認' : '参加者を追加', onClick: onParticipants }} roomStatus={roomStatus} /></section>;
  return <section className="allocation-page" aria-label={type === 'team' ? '班割' : '車割'}>
    <div className="allocation-toolbar"><div className="allocation-toolbar-summary"><p><span>未割り当て <strong>{projection.waiting.length}人</strong></span><span className="row-detail">{count}人・{projection.cars.length}{type === 'team' ? '班' : '台'}</span></p></div>
      <div className="allocation-toolbar-actions">{projection.waiting.length > 0 && <Button kind="ghost" size="sm" onClick={() => { setWaitingOpen(true); setTimeout(() => waitingSectionRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0); }}>未割り当て {projection.waiting.length}人を確認</Button>}<div className="allocation-randomization-action"><Button ref={randomizationButtonRef} kind="ghost" size="sm" renderIcon={Shuffle} aria-describedby={randomizationDescriptionId} onClick={() => setConfirmation({ title: 'ランダム割り当て', body: '班長・運転手と固定した参加者を除き、現在の割り当てを組み替えます。', button: '実行', action: () => { try { const result = runtime.store.command('randomize', { type }); if (!result) { onNotice('ランダム割り当てできる参加者や空き枠がありません。'); return; } const currentCount = runtime.store.domain.randomization.getRandomizationStatus(runtime.store.getSnapshot(), type).count; onNotice(`${groupLabel === '車' ? '車割' : '班割'}のランダム割り当てを実行しました。${currentCount}回目。`); } catch (error) { onNotice(error.message); } } })}>ランダム割り当て</Button><span className="allocation-randomization-count" aria-hidden="true">実行 {randomizationStatus.count}回</span></div><span id={randomizationDescriptionId} className="cds--visually-hidden">現在の条件でランダム割り当てを{randomizationStatus.count}回実行しています。</span></div>
    </div>
    <div className="allocation-groups">{projection.cars.map(car => {
      const group = room.allocations[type].groups[car.groupId];
      const { occupied, totalCapacity, remaining: empty } = getCapacitySummary(type, group.capacity, car.members.length);
      const expanded = !!openCandidates[group.id];
      const name = car.groupDisplayName;
      return <section className="allocation-group" key={group.id} aria-label={name}>
        <div className="group-heading"><h2 id={`${group.id}-heading`} tabIndex={-1}>{name}</h2><div className="inline-actions"><span className="group-capacity-display cds--type-body-compact-01">{occupied}/{totalCapacity}人</span><OverflowMenu ariaLabel={`${name}の操作`} iconDescription={`${name}の操作`} size={isMobile ? 'lg' : 'sm'} flipped><OverflowMenuItem itemText="定員変更" onClick={() => setGroupEditor({ group })} /><OverflowMenuItem itemText={`${groupLabel}を削除`} hasDivider isDelete onClick={() => setConfirmation({ title: `${groupLabel}を削除しますか？`, body: '割り当てた参加者を未割り当てに戻します。', button: '削除', danger: true, action: () => execute('deleteGroup', { type, groupId: group.id }) })} /></OverflowMenu></div></div>
        <ContainedList label={name} className="allocation-person-list" size="lg">{personRow({ ...car, id: car.participantId })}{car.members.map(person => personRow(person))}</ContainedList>
        {empty > 0 && <Button ref={node => node ? seatButtons.current.set(group.id, node) : seatButtons.current.delete(group.id)} className="empty-seats-action" kind="ghost" renderIcon={expanded ? ChevronUp : ChevronDown} aria-expanded={expanded} aria-controls={`${group.id}-candidates`} onClick={() => setOpenCandidates(current => ({ ...current, [group.id]: !expanded }))}><span className="empty-seat-count">あと{empty}人追加可</span><span className="empty-seat-action-label">未割り当てから追加</span></Button>}
        {expanded && empty > 0 && <ContainedList id={`${group.id}-candidates`} label={`${name}に追加する参加者`} kind="disclosed" size="lg">{projection.waiting.map((person, index) => <ContainedListItem key={person.participantId} action={<IconButton ref={node => node ? candidateButtons.current.set(`${group.id}:${person.participantId}`, node) : candidateButtons.current.delete(`${group.id}:${person.participantId}`)} kind="ghost" size={isMobile ? 'lg' : 'sm'} label={`${person.name}を${name}に追加`} onClick={() => { if (execute('move', { id: person.participantId, type, groupId: group.id, order: car.members.length })) { onNotice(`${person.name}を${name}に追加しました。`); focusAfterCandidateAdd(group.id, person.participantId, projection.waiting.filter((_, i) => i !== index)); } }}><Add /></IconButton>}>{person.name}</ContainedListItem>)}{!projection.waiting.length && <ContainedListItem>追加できる参加者がいません</ContainedListItem>}</ContainedList>}
      </section>;
    })}</div>
    <div className="allocation-add-area"><Button kind="tertiary" renderIcon={Add} onClick={() => { if (projection.waiting.length) { setLocalWarning(''); setGroupEditor({}); } else setLocalWarning(`未割り当ての参加者を選ぶと${groupLabel}を追加できます。`); }}>{groupLabel}を追加</Button>{localWarning && <InlineNotification kind="warning" title={localWarning} hideCloseButton lowContrast />}</div>
    {projection.waiting.length > 0 && <div className="waiting-section" ref={waitingSectionRef}><Button kind="ghost" renderIcon={waitingOpen ? ChevronUp : ChevronDown} aria-expanded={waitingOpen} onClick={() => setWaitingOpen(value => !value)}>未割り当て {projection.waiting.length}人</Button>{waitingOpen && <ContainedList label="未割り当て" size="lg">{projection.waiting.map(person => personRow(person, true))}</ContainedList>}</div>}
    {editor && <ParticipantEditor runtime={runtime} session={editor} onClose={() => setEditor(null)} onNotice={onNotice} />}
    {groupEditor && <GroupEditor runtime={runtime} room={room} type={type} group={groupEditor.group} onClose={() => setGroupEditor(null)} onNotice={onNotice} />}
    {moveEditor && <Modal className="app-modal" open size="sm" modalHeading={moveEditor.fromWaiting ? `${room.participants[moveEditor.id]?.name || '参加者'}の割り当て先を選択` : `${room.participants[moveEditor.id]?.name || '参加者'}を別の${groupLabel}へ移す`} closeButtonLabel="閉じる" primaryButtonText="移動" secondaryButtonText="キャンセル" primaryButtonDisabled={!moveEditor.targets.find(car => car.groupId === moveTarget)?.hasCapacity} onRequestSubmit={() => { const target = moveEditor.targets.find(car => car.groupId === moveTarget); if (target?.hasCapacity && execute('move', { id: moveEditor.id, type, groupId: target.groupId, order: target.members.length })) { onNotice(`${room.participants[moveEditor.id]?.name || '参加者'}を${target.groupDisplayName}へ移しました。`); setMoveEditor(null); } }} onRequestClose={() => setMoveEditor(null)}><div className="form-stack">{moveEditor.sourceGroupWillBeRemoved && <p>{`この参加者だけの${groupLabel}なので、移動すると元の${groupLabel}は削除されます。`}</p>}<Select id="allocation-move-target" labelText="移動先" value={moveTarget} onChange={event => setMoveTarget(event.target.value)}>{moveEditor.targets.map(car => <SelectItem key={car.groupId} disabled={!car.hasCapacity} value={car.groupId} text={`${car.groupDisplayName}（${car.occupied}/${car.totalCapacity}人${car.hasCapacity ? '' : '・満員'}）`} />)}</Select></div></Modal>}
    {confirmation && <Modal className="app-modal" open size="xs" modalHeading={confirmation.title} closeButtonLabel="閉じる" danger={confirmation.danger} launcherButtonRef={confirmation.title === 'ランダム割り当て' ? randomizationButtonRef : undefined} primaryButtonText={confirmation.button} secondaryButtonText="キャンセル" onRequestSubmit={() => { confirmation.action(); closeConfirmation(); }} onRequestClose={closeConfirmation}><p>{confirmation.body}</p></Modal>}
  </section>;
}
