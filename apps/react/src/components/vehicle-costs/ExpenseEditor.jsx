import { useRef } from 'react';
import { Button, Checkbox, Form, RadioButton, RadioButtonGroup, TextInput } from '@carbon/react';

export const costFieldId = (key, field) => `vehicle-cost-${encodeURIComponent(key)}-${field}`;
export default function ExpenseEditor({ snapshot, onFieldChange, onRentalType, onMovementType, onAdd, onReuse, onRemove, onRoute, onSave, onCancel }) {
  const composing = useRef(false);
  const { domain, car, activeFee: fee, frozen, attempted } = snapshot;
  const times = domain.isTimesRentalCar(car);
  const issue = field => attempted && snapshot.issues.fields.find(i => i.feeKey === fee.key && i.field === field);
  const input = (field, label, value) => <TextInput id={costFieldId(fee.key, field)} labelText={label} inputMode={field === 'name' ? undefined : 'decimal'} value={value ?? ''} disabled={frozen} invalid={!!issue(field)} invalidText={issue(field)?.message} onChange={event => onFieldChange(fee.key, field, event.target.value)} />;
  const type = fee.kind === 'movement' ? fee.row?.type || 'split' : fee.row?.type || 'split';
  const baseType = domain.getSettlementExtraBaseType(type);
  const minus = domain.isNegativeSettlementExtraType(type);
  function changeType(value) { if (fee.kind === 'movement') onMovementType(value); else onFieldChange(fee.key, 'type', value); }
  const calc = snapshot.preview.cars.find(row => row.name === snapshot.target.car.name);
  const formula = times ? `走行距離 ${car.dist || '未入力'}km` : `${car.dist || '未入力'}km ÷ ${car.eco || '未入力'}km/L × ${car.price || '未入力'}円/L`;
  return <Form aria-label="車両費用の入力" className="vehicle-cost-form" onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onSubmit={event => { event.preventDefault(); if (!composing.current && !event.nativeEvent.isComposing) onSave(); }}>
    <fieldset className="vehicle-cost-fields" disabled={frozen}><legend>{fee.kind === 'movement' ? '移動条件' : fee.row?.name || '追加費用'}</legend>
      {fee.kind === 'movement' ? <>
        <RadioButtonGroup name="vehicle-rental-type" legendText="車の種類" valueSelected={times ? 'times' : 'private'} onChange={onRentalType} orientation="vertical">
          <RadioButton id="vehicle-private" value="private" labelText="自家用車" /><RadioButton id="vehicle-times" value="times" labelText="タイムズ" />
        </RadioButtonGroup>
        {input('dist', '走行距離（km）', car.dist)}
        {!times && <>{input('eco', '燃費（km/L）', car.eco)}{input('price', 'ガソリン単価（円/L）', car.price)}</>}
        <Button kind="tertiary" type="button" onClick={onRoute} disabled={frozen}>ルートから距離を計算</Button>
        <div className="vehicle-cost-preview"><h3>{times ? 'タイムズ移動料金' : 'ガソリン代'}</h3><p>{Number(calc?.movementAmount || 0).toLocaleString('ja-JP')}円</p><p>{formula}</p></div>
      </> : <>{fee.kind === 'extra' && input('name', '費用名', fee.row?.name)}{input('amount', '金額（円）', fee.row?.amount)}</>}
      <RadioButtonGroup name="vehicle-cost-burden" legendText="負担区分" valueSelected={baseType} orientation="vertical" onChange={value => changeType(`${value}${minus ? '-minus' : ''}`)}>
        <RadioButton id="vehicle-cost-split" value="split" labelText="割勘" /><RadioButton id="vehicle-cost-club" value="club" labelText="部費" />
      </RadioButtonGroup>
      {fee.kind !== 'movement' && <Checkbox id="vehicle-cost-minus" labelText={`${baseType === 'club' ? '部費' : '割勘'}の費用から差し引く`} helperText="金額は0円以上で入力します。" checked={minus} onChange={(_, {checked}) => changeType(`${baseType}${checked ? '-minus' : ''}`)} />}
    </fieldset>
    <div className="vehicle-cost-actions"><Button kind="tertiary" type="button" disabled={frozen} onClick={onAdd}>費用を追加</Button>{onReuse}</div>
    <p>保存すると、この車の未保存の入力をまとめて共有します。</p>
    <div className="vehicle-cost-actions"><Button type="submit" disabled={frozen}>車両費用を保存</Button><Button kind="secondary" type="button" disabled={frozen} onClick={onCancel}>キャンセル</Button></div>
  </Form>;
}
