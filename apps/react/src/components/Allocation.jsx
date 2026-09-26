import { useEffect, useRef, useState } from 'react';
import { Button, IconButton, Modal, Select, SelectItem, NumberInput, InlineNotification, Tag, OverflowMenu, OverflowMenuItem, ContainedList, ContainedListItem } from '@carbon/react';
import { Add, Shuffle, ChevronDown, ChevronUp, Pin, PinFilled, Flag } from '@carbon/icons-react';
import ParticipantEditor from './ParticipantEditor.jsx';
import useMediaQuery from '../hooks/useMediaQuery.js';

function GroupEditor({ runtime, room, type, group, onClose, onNotice }) {
  const allocation = room.allocations[type];
  const candidates = Object.entries(allocation.placements).filter(([, p]) => p.kind === 'waiting').map(([id]) => room.participants[id]);
  const [ownerId, setOwnerId] = useState(group?.ownerId || candidates[0]?.id || '');
  const [capacity, setCapacity] = useState(group?.capacity || (type === 'team' ? 5 : 3));
  const [error, setError] = useState('');
  const label = type === 'team' ? '班' : '車';
  function save() {
    if (!ownerId || Number(capacity) < 1 || Number(capacity) > 99) { setError('参加者と1〜99人の定員を指定してください。'); return; }
    try {
      runtime.store.command(group ? 'capacity' : 'createGroup', group ? { type, groupId: group.id, capacity } : { type, ownerId, capacity });
      onNotice(group ? '定員を更新しました。' : `${label}を追加しました。`); onClose();
    } catch (caught) { setError(caught.message); }
  }
  return <Modal open size="xs" modalHeading={group ? '定員を変更' : `${label}を追加`} primaryButtonText={group ? '保存' : '追加'} secondaryButtonText="キャンセル" onRequestSubmit={save} onRequestClose={onClose} preventCloseOnClickOutside selectorPrimaryFocus={group ? '#group-capacity' : '#group-owner'}>
    <div className="form-stack">
      {error && <InlineNotification kind="error" title={error} hideCloseButton lowContrast />}
      {!group && <Select id="group-owner" labelText={type === 'team' ? '班長' : '運転手'} value={ownerId} onChange={event => setOwnerId(event.target.value)}>{candidates.map(person => <SelectItem key={person.id} value={person.id} text={person.name} />)}</Select>}
      <NumberInput id="group-capacity" label="定員" min={1} max={99} value={capacity} onChange={(_, { value }) => setCapacity(value)} invalidText="1〜99人で入力してください。" />
    </div>
  </Modal>;
}

export default function Allocation({ runtime, room, type, onNotice, onParticipants }) {
  const isMobile = useMediaQuery('(max-width: 671px)');
  const [editor, setEditor] = useState(null);
  const [groupEditor, setGroupEditor] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [openCandidates, setOpenCandidates] = useState({});
  const [waitingOpen, setWaitingOpen] = useState(false);
  const [localWarning, setLocalWarning] = useState('');
  const personMenus = useRef(new Map());
  const menuKeyHandlers = useRef(new Map());
  const escapeClosedMenus = useRef(new Set());
  const projection = runtime.store.domain.canonical.projectAllocation(room, type);
  const groupLabel = type === 'team' ? '班' : '車';
  const roleLabel = type === 'team' ? '班長' : '運転手';
  const count = Object.keys(room.participants).length;
  function execute(command, args) {
    try { runtime.store.command(command, args); }
    catch (error) { onNotice(error.message); }
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
    return <ContainedListItem key={id} action={<div className="person-actions">
      <IconButton kind="ghost" size={isMobile ? 'lg' : 'sm'} label={`${record.name}の固定${record.locked ? 'を解除' : ''}`} aria-pressed={record.locked === true} onClick={() => execute('editParticipant', { id, changes: { locked: !record.locked } })}>{record.locked ? <PinFilled /> : <Pin />}</IconButton>
      <OverflowMenu ref={node => node ? personMenus.current.set(id, node) : personMenus.current.delete(id)} onOpen={() => trackMenuKeys(id)} onClose={() => closeMenu(id)} ariaLabel={`${record.name}の操作`} iconDescription={`${record.name}の操作`} size="lg" flipped>
        <OverflowMenuItem itemText="メモ" onClick={() => edit(id)} />
        <OverflowMenuItem itemText={person.driver ? `${roleLabel}を外す` : `${roleLabel}にする`} onClick={() => execute('role', { id, type, driver: !person.driver })} />
        <OverflowMenuItem itemText="しるし" onClick={() => edit(id)} />
        <OverflowMenuItem itemText={inWaiting ? '削除' : '未割り当てに戻す'} hasDivider={inWaiting} isDelete={inWaiting} onClick={() => inWaiting ? setConfirmation({ title: '参加者を削除しますか？', body: '車割・班割・精算の割り当ても削除されます。', action: () => execute('deleteParticipant', { id }), button: '削除', danger: true }) : execute('move', { id, type })} />
        <OverflowMenuItem itemText="学年" onClick={() => edit(id)} />
        <OverflowMenuItem itemText="名前を変更" onClick={() => edit(id)} />
      </OverflowMenu>
    </div>}>
      <div className="person-summary"><span className="person-name">{record.name}</span><span className="person-tags">{record.flag && record.flag !== 'none' && <Flag className={`person-flag flag-${record.flag}`} aria-label={`${record.flag}のしるし`} />}{person.driver && <Tag type="gray" size="sm">{roleLabel}</Tag>}{record.grade > 0 && <Tag type="gray" size="sm">{record.grade}年</Tag>}</span></div>
      {record.memo && <p className="person-memo">{record.memo}</p>}
    </ContainedListItem>;
  }
  if (!count) return <section className="allocation-page"><div className="empty-state">{type === 'car' && <h1>車割</h1>}<p>参加者がいません</p><Button onClick={onParticipants}>参加者を追加</Button></div></section>;
  return <section className="allocation-page" aria-label={type === 'team' ? '班割' : '車割'}>
    <div className="allocation-toolbar"><div className="allocation-toolbar-summary"><p><span>未割り当て <strong>{projection.waiting.length}人</strong></span><span className="row-detail">{count}人・{projection.cars.length}{type === 'team' ? '班' : '台'}</span></p></div>
      <Button kind="tertiary" size="md" renderIcon={Shuffle} onClick={() => setConfirmation({ title: 'ランダム割り当て', body: '参加者をランダムに割り当てます。', button: '実行', action: () => execute('randomize', { type }) })}>ランダム割り当て</Button>
    </div>
    <div className="allocation-groups">{projection.cars.map(car => {
      const group = room.allocations[type].groups[car.groupId];
      const empty = Math.max(0, group.capacity - car.members.length);
      const expanded = !!openCandidates[group.id];
      const name = `${car.name}${groupLabel}`;
      return <section className="allocation-group" key={group.id} aria-label={name}>
        <div className="group-heading"><h2>{name}</h2><div className="inline-actions"><span className="group-capacity-display cds--type-body-compact-01">{car.members.length}/{group.capacity}人</span><OverflowMenu ariaLabel={`${name}の操作`} iconDescription={`${name}の操作`} size={isMobile ? 'lg' : 'sm'} flipped><OverflowMenuItem itemText="定員変更" onClick={() => setGroupEditor({ group })} /><OverflowMenuItem itemText="削除" hasDivider isDelete onClick={() => setConfirmation({ title: `${groupLabel}を削除しますか？`, body: '割り当てた参加者を未割り当てに戻します。', button: '削除', danger: true, action: () => execute('deleteGroup', { type, groupId: group.id }) })} /></OverflowMenu></div></div>
        <ContainedList label={name} className="allocation-person-list" size="lg">{personRow({ ...car, id: car.participantId })}{car.members.map(person => personRow(person))}</ContainedList>
        {empty > 0 && <Button className="empty-seats-action" kind="ghost" renderIcon={expanded ? ChevronUp : ChevronDown} aria-expanded={expanded} aria-controls={`${group.id}-candidates`} onClick={() => setOpenCandidates(current => ({ ...current, [group.id]: !expanded }))}><span className="empty-seat-count">空席 {empty}</span><span className="empty-seat-action-label">参加者を追加</span></Button>}
        {expanded && empty > 0 && <ContainedList id={`${group.id}-candidates`} label={`${name}に追加`} kind="disclosed" size="lg">{projection.waiting.map(person => <ContainedListItem key={person.participantId} action={<IconButton kind="ghost" size={isMobile ? 'lg' : 'sm'} label={`${person.name}を${name}に追加`} onClick={() => execute('move', { id: person.participantId, type, groupId: group.id, order: car.members.length })}><Add /></IconButton>}>{person.name}</ContainedListItem>)}{!projection.waiting.length && <ContainedListItem>追加できる参加者がいません</ContainedListItem>}</ContainedList>}
      </section>;
    })}</div>
    <div className="allocation-add-area"><Button kind="tertiary" renderIcon={Add} onClick={() => { if (projection.waiting.length) { setLocalWarning(''); setGroupEditor({}); } else setLocalWarning(`未割り当ての参加者を選ぶと${groupLabel}を追加できます。`); }}>{groupLabel}を追加</Button>{localWarning && <InlineNotification kind="warning" title={localWarning} hideCloseButton lowContrast />}</div>
    {projection.waiting.length > 0 && <div className="waiting-section"><Button kind="ghost" renderIcon={waitingOpen ? ChevronUp : ChevronDown} aria-expanded={waitingOpen} onClick={() => setWaitingOpen(value => !value)}>未割り当て {projection.waiting.length}人</Button>{waitingOpen && <ContainedList label="未割り当て" size="lg">{projection.waiting.map(person => personRow(person, true))}</ContainedList>}</div>}
    {editor && <ParticipantEditor runtime={runtime} session={editor} onClose={() => setEditor(null)} onNotice={onNotice} />}
    {groupEditor && <GroupEditor runtime={runtime} room={room} type={type} group={groupEditor.group} onClose={() => setGroupEditor(null)} onNotice={onNotice} />}
    {confirmation && <Modal open size="xs" modalHeading={confirmation.title} danger={confirmation.danger} primaryButtonText={confirmation.button} secondaryButtonText="キャンセル" onRequestSubmit={() => { confirmation.action(); setConfirmation(null); }} onRequestClose={() => setConfirmation(null)}><p>{confirmation.body}</p></Modal>}
  </section>;
}
