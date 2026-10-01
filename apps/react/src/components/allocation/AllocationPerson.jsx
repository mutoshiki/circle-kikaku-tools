import { useRef } from 'react';
import { Button, ContainedListItem, OverflowMenu, OverflowMenuItem, RadioButton, Tag } from '@carbon/react';
import { Flag } from '@carbon/icons-react';

export default function AllocationPerson({ person, type, roleLabel, busy, onMove, onAction, selected, onSelect }) {
  const menu = useRef(null);
  const id = person.participantId;
  return <ContainedListItem action={<div className="allocation-person-actions">
      {onSelect ? <RadioButton id={`allocation-select-${id}`} name="allocation-person" value={id} checked={selected} disabled={busy} aria-label={`${person.name}を選択`} labelText={<span className="allocation-choice-label">選択</span>} onChange={() => onSelect(id)} /> : <Button id={`allocation-move-${id}`} kind="ghost" disabled={busy} aria-label={`${person.name}の移動`} onClick={() => onMove(id)}>移動</Button>}
      <OverflowMenu ref={menu} size="lg" flipped ariaLabel={`${person.name}の操作`} iconDescription={`${person.name}の操作`} onClose={() => requestAnimationFrame(() => { if (document.activeElement === document.body) menu.current?.focus(); })}>
        <OverflowMenuItem itemText="参加者を編集" disabled={busy} onClick={() => onAction('edit', id, menu)} />
        <OverflowMenuItem itemText={person.driver ? `${roleLabel}を外す` : `${roleLabel}にする`} disabled={busy} onClick={() => onAction('role', id, menu)} />
        <OverflowMenuItem itemText={person.locked ? '固定を解除' : 'ランダム割り当てで固定'} disabled={busy} onClick={() => onAction('fixed', id, menu)} />
        <OverflowMenuItem itemText="参加者を削除" hasDivider isDelete disabled={busy} onClick={() => onAction('delete', id, menu)} />
      </OverflowMenu>
    </div>}>
    <div className="allocation-person-copy"><strong>{person.name}</strong>
      <div className="allocation-person-metadata">
        {person.driver && <Tag type="gray" size="sm">{roleLabel}</Tag>}
        {person.locked && <span>ランダムで固定</span>}
        {person.grade > 0 && <span>{person.grade}年</span>}
        {person.flag && person.flag !== 'none' && <Flag className={`person-flag flag-${person.flag}`} aria-label={`${person.flag}のしるし`} />}
      </div>
      {person.memo && <p>{person.memo}</p>}
    </div>
  </ContainedListItem>;
}
