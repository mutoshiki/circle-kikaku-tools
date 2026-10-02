import { Button, Column, ContainedList, ContainedListItem, Form, Grid, Link, OverflowMenu, OverflowMenuItem, Select, SelectItem } from '@carbon/react';
import useMediaQuery from '../../hooks/useMediaQuery.js';
import AllocationPerson from './AllocationPerson.jsx';

export default function AllocationWorkspace({ view, destination, selectedId, targetId, busy, onSelect, onTarget, onMove, onNavigate, onPersonAction, onGroupAction, movingId, onCancelMove, onManualMove, costDestination, costNavigation }) {
  const desktop = useMediaQuery('(min-width: 1056px)');
  const roleLabel = view.type === 'team' ? '班長' : '運転手';
  const label = view.type === 'team' ? '班' : '車';
  const group = view.groups.find(g => g.id === destination.groupId);
  const groups = group ? [group] : view.groups;
  const showPeople = desktop || !!group;
  const showPool = desktop || ['assign', 'unassigned'].includes(destination.task);
  const selected = view.waiting.find(person => person.participantId === selectedId);
  const mover = [...view.groups.flatMap(g => g.people), ...view.waiting].find(p => p.participantId === movingId);
  const currentGroup = mover && view.groups.find(g => g.people.some(p => p.participantId === movingId));
  const moveTarget = view.groups.find(g => g.id === targetId);
  const canMove = !busy && (!targetId || moveTarget && moveTarget.id !== currentGroup?.id && moveTarget.vacancies > 0);
  function taskLink(task, groupId, text, props = {}) {
    return <Link {...props} href={onNavigate.href(task, groupId)} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) { event.preventDefault(); onNavigate(task, groupId); } }}>{text}</Link>;
  }
  const candidateRows = view.waiting.map(person => <AllocationPerson key={person.participantId} person={person} type={view.type} roleLabel={roleLabel} busy={busy} selected={selectedId === person.participantId} onSelect={onSelect} onAction={onPersonAction} />);
  return <div>
    {mover && <Form className="allocation-move-form" aria-label={`${mover.name}の移動`} onSubmit={event => { event.preventDefault(); if (canMove) onManualMove(); }}>
      <h2>{mover.name}の移動</h2>
      <p>固定・役割を保持して移動します。グループ名の基準になる参加者は変わる場合があります。</p>
      <Select id="allocation-move-target" labelText="移動先" value={targetId} disabled={busy} onChange={event => onTarget(event.target.value)}>
        <SelectItem value="" text="未割り当て" />
        {view.groups.filter(g => g.id !== currentGroup?.id).map(g => <SelectItem key={g.id} value={g.id} disabled={g.vacancies <= 0} text={`${g.name}（空き${g.vacancies}人）`} />)}
      </Select>
      {targetId && !canMove && !busy && <p role="status">移動先が変更されました。空きのある移動先を選択してください。</p>}
      <div className="allocation-actions"><Button type="submit" disabled={!canMove}>{label}へ移動</Button><Button type="button" kind="secondary" disabled={busy} onClick={onCancelMove}>キャンセル</Button></div>
    </Form>}
    <Grid fullWidth className="allocation-workspace">
      {destination.task !== 'unassigned' && !(destination.task === 'assign' && !desktop) && <Column sm={4} md={8} lg={10} xlg={10} max={10}>
        <div className="allocation-groups">{groups.map(g => <section className="allocation-group" key={g.id} aria-label={g.name}>
          <div className="allocation-group-heading"><h2>{group ? '割り当て内容' : g.name}</h2><OverflowMenu id={`allocation-group-menu-${g.id}`} size="lg" flipped ariaLabel={`${g.name}の操作`} iconDescription={`${g.name}の操作`}>
            <OverflowMenuItem itemText="人数の上限を変更" disabled={busy} onClick={() => onGroupAction('capacity', g.id)} />
            <OverflowMenuItem itemText="削除" hasDivider isDelete disabled={busy} onClick={() => onGroupAction('delete', g.id)} />
          </OverflowMenu></div>
          <p className="allocation-group-summary">{g.peopleCount}人 / 上限{g.totalLimit}人 · 空き{g.vacancies}人</p>
          {!showPeople && <p>{roleLabel}：{g.roles.map(p => p.name).join('、') || '未設定'}</p>}
          {g.issues.some(issue => issue.kind === 'missing-role') && <p>{roleLabel}が設定されていません</p>}
          {showPeople && <ContainedList label={`${g.name}の参加者`} size="lg">{g.people.map(person => <AllocationPerson key={person.participantId} person={person} type={view.type} roleLabel={roleLabel} busy={busy} onMove={id => onPersonAction('move', id)} onAction={onPersonAction} />)}</ContainedList>}
          <div className="allocation-task-links">
            {!group && taskLink('group', g.id, '詳細', { id: `allocation-group-${g.id}`, 'aria-label': `${g.name}の詳細` })}
            {g.vacancies > 0 && taskLink('assign', g.id, '参加者を割り当て', { id: `allocation-assign-${g.id}`, 'aria-label': group ? '参加者を割り当て' : `${g.name}へ参加者を割り当て` })}
            {view.type === 'car' && (()=>{const target=costDestination?.(g.id), dest=target && {carKey:target.key,returnTo:{section:'organization-car',groupId:g.id}};return dest ? <Link id={`allocation-cost-${g.id}`} href={costNavigation.vehicleCostTaskHrefFor(dest)} onClick={event=>{if(event.button===0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey){event.preventDefault();costNavigation.navigateVehicleCostTask(dest);}}}>{target.label}の費用</Link> : <p>費用の保存先が見つかりません。車両費用で対象車を確認してください。</p>;})()}
          </div>
        </section>)}</div>
      </Column>}
      {showPool && <Column sm={4} md={8} lg={destination.task === 'unassigned' ? 16 : 6} xlg={destination.task === 'unassigned' ? 16 : 6} max={destination.task === 'unassigned' ? 16 : 6}>
        <section aria-label="未割り当ての参加者" className="allocation-pool">
          <ContainedList label={`未割り当て ${view.waiting.length}人`} size="lg">{candidateRows.length ? candidateRows : <ContainedListItem>未割り当ての参加者はいません</ContainedListItem>}</ContainedList>
          {!movingId && (selected || targetId) && <Form aria-label="参加者を割り当て" className="allocation-assignment-form" onSubmit={event => { event.preventDefault(); onMove(); }}>
            <p>{selected ? `${selected.name}を割り当て` : '割り当てる参加者を選択'}</p>
            <Select id="allocation-target" labelText="割り当て先" value={targetId} disabled={busy} onChange={event => onTarget(event.target.value)}>
              <SelectItem value="" text="車・班を選択" />
              {view.groups.map(g => <SelectItem key={g.id} value={g.id} disabled={g.vacancies <= 0} text={`${g.name}（空き${g.vacancies}人）`} />)}
            </Select>
            <Button type="submit" disabled={busy || !selected || !view.groups.some(g => g.id === targetId && g.vacancies > 0)}>{label}へ割り当て</Button>
          </Form>}
        </section>
      </Column>}
    </Grid>
    {!desktop && !destination.task && <div className="allocation-task-links">{taskLink('unassigned', '', `未割り当て ${view.waiting.length}人を確認`, { id: 'allocation-unassigned' })}</div>}
  </div>;
}
