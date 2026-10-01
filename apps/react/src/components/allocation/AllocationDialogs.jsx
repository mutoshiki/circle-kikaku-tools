import { useEffect, useRef, useState } from 'react';
import { Button, InlineLoading, InlineNotification, NumberInput, Select, SelectItem } from '@carbon/react';
import TaskModal from '../TaskModal.jsx';
import { focusFirstInvalid } from '../../ui/focus-first-invalid.js';
import { storedAllocationCapacity } from '../../ui/allocation-view.js';

export function AllocationSaveStatus({ operation, onAccepted }) {
  const { receipt, busy } = operation;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function check(observe) {
    const outcome = await operation.retry(observe);
    if (alive.current && ['saved', 'local'].includes(outcome?.disposition)) onAccepted?.();
  }
  return <>
    {busy && <InlineLoading status="active" description="共有保存中" />}
    {!operation.recoverable && <p role="status">この端末に保存状態を記録できません。再読み込みすると再試行の情報が失われる可能性があります。</p>}
    {receipt && !busy && <section aria-label="割り当ての保存状態">
      <p role="status">{receipt.disposition === 'adjusted' ? '同時編集により内容が調整されました。現在の結果を確認してください。' : receipt.disposition === 'reset' ? '企画がリセットされました。現在の結果を確認してください。' : receipt.disposition === 'pending' ? '端末に反映しました。共有保存を確認しています。' : '共有保存を確認できません。端末に反映した内容と共有結果が異なる場合があります。'}</p>
      {receipt.canRetry && <Button kind="tertiary" disabled={busy} onClick={() => check(false)}>共有保存を再試行</Button>}
      {!receipt.canRetry && !['adjusted', 'reset'].includes(receipt.disposition) && <Button kind="tertiary" disabled={busy} onClick={() => check(true)}>共有結果を再確認</Button>}
      {['adjusted', 'reset'].includes(receipt.disposition) && <Button kind="tertiary" onClick={operation.inspect}>現在の結果を確認した</Button>}
    </section>}
  </>;
}

export function GroupEditor({ type, view, group, operation, onSave, onClose, launcherButtonRef }) {
  const [ownerId, setOwnerId] = useState(group ? '' : view.waiting[0]?.participantId || '');
  const [limit, setLimit] = useState(group?.totalLimit || (type === 'team' ? 6 : 4));
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);
  const form = useRef(null);
  const label = type === 'team' ? '班' : '車';
  const blocked = operation.busy || !!operation.receipt;
  const missing = !operation.receipt && (group ? !view.groups.some(g => g.id === group.id) : !view.waiting.some(p => p.participantId === ownerId));
  async function save() {
    let capacity;
    try { capacity = storedAllocationCapacity(limit); }
    catch (caught) { setInvalid(true); setError(caught.message); requestAnimationFrame(() => focusFirstInvalid(form.current)); return; }
    if (missing) { setError('参加者・割り当て先が変更されました。キャンセルして現在の一覧を確認してください。'); return; }
    const outcome = await onSave(group ? 'capacity' : 'createGroup', group ? { type, groupId: group.id, capacity } : { type, ownerId, capacity }, `${label}の設定を保存`, onClose);
    if (outcome?.message) setError(outcome.message);
  }
  return <TaskModal taskId="allocation-group-edit" open size="xs" modalHeading={group ? '人数の上限を変更' : `${label}を追加`} primaryButtonText={group ? '保存' : '追加'} secondaryButtonText="キャンセル" onRequestSubmit={save} onRequestClose={() => { if (!operation.busy) onClose(); }} primaryButtonDisabled={blocked || missing} preventCloseOnClickOutside selectorPrimaryFocus={group ? '#group-capacity' : '#group-owner'} launcherButtonRef={launcherButtonRef}>
    <div ref={form} className="form-stack">
      <AllocationSaveStatus operation={operation} onAccepted={onClose} />
      {error && <InlineNotification kind="error" title="設定を確認してください" subtitle={error} hideCloseButton lowContrast />}
      {missing && <p role="status">参加者・割り当て先が変更されました。キャンセルして現在の一覧を確認してください。</p>}
      {!group && <Select id="group-owner" labelText={type === 'team' ? '班長' : '運転手'} value={ownerId} disabled={blocked} onChange={event => setOwnerId(event.target.value)}>{view.waiting.map(person => <SelectItem key={person.participantId} value={person.participantId} text={person.name} />)}</Select>}
      <NumberInput id="group-capacity" label="割り当て人数の上限（全員を含む）" min={2} max={100} value={limit} disabled={blocked} invalid={invalid} onChange={(_, { value }) => { setLimit(value); setInvalid(false); setError(''); }} invalidText="2〜100人で入力してください。" />
      {group && Number(limit) < (view.groups.find(g => g.id === group.id)?.peopleCount || 0) && <p>上限を超える参加者は未割り当てへ戻ります。固定した参加者も対象になります。</p>}
    </div>
  </TaskModal>;
}

export function AllocationConfirmation({ state, review, type, operation, onSubmit, onClose, launcherButtonRef }) {
  const role = type === 'team' ? '班長' : '運転手';
  const random = state.command === 'randomize';
  return <TaskModal taskId="allocation-group-confirm" open size="xs" modalHeading={state.title} danger={state.danger} primaryButtonText={state.button} secondaryButtonText="キャンセル" primaryButtonDisabled={operation.busy || !!operation.receipt || random && (!review.eligibleCount || !review.slotCount)} preventCloseOnClickOutside onRequestClose={() => { if (!operation.busy) onClose(); }} onRequestSubmit={onSubmit} launcherButtonRef={launcherButtonRef}>
    <div className="form-stack">
      <AllocationSaveStatus operation={operation} onAccepted={onClose} />
      {state.error && <p role="alert">{state.error}</p>}
      {random ? <>
        {state.changed && <p role="status">割り当てが変更されました。現在の内容を確認してもう一度実行してください。</p>}
        <p>対象 {review.eligibleCount}人 · 固定 {review.fixedCount}人 · {role} {review.roleCount}人 · 空き枠 {review.slotCount}人</p>
        <p>固定した参加者と{role}は移動しません。割り当て済みの対象者も変更されます。</p>
        <p>固定は車割・班割の両方に適用されます。手動での移動はできます。</p>
        {review.fixedWaitingCount > 0 && <p>固定した未割り当て {review.fixedWaitingCount}人は未割り当てのまま残ります。</p>}
        {review.slotCount < review.eligibleCount && <p>空き枠が足りないため、対象者全員を割り当てられません。</p>}
      </> : <p>{state.body}</p>}
    </div>
  </TaskModal>;
}
