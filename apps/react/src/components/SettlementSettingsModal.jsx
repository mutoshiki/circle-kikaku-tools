import { useState } from 'react';
import { InlineNotification, Modal, NumberInput, ProgressIndicator, ProgressStep, RadioButton, RadioButtonGroup, Select, SelectItem, TextInput } from '@carbon/react';
import useMediaQuery from '../hooks/useMediaQuery.js';
import { commitSettlementEdit, initializeStandaloneCounts } from './settlement/edit.js';

const steps = ['精算方法', '車出し協力代', '集金ルール'];
const hasNegativeValue = value => /^[-−]/.test(String(value ?? '').trim());
const money = value => `¥${Math.round(Number(value) || 0).toLocaleString('ja-JP')}`;

function amountSnapshot(store) {
  const snapshot = store.getSnapshot();
  const { data, state } = store.domain.settlementInput(snapshot);
  const result = store.domain.settlement.calculateSettlement(data, state);
  return { amount: result.perPerson, hasRecordedCollections: result.participants.some(person => !result.excludedNames.has(person.name) && state.paid[person.name]) };
}

function saveNotice(before, after) {
  const label = '精算設定を保存しました。';
  if (before.amount === after.amount) return label;
  return `${label} 1人あたりの集金額が ${money(before.amount)} から ${money(after.amount)} に変更されました。${after.hasRecordedCollections ? ' 記録済みの集金状況を確認してください。' : ''}`;
}

export default function SettlementSettingsModal({ runtime, edit, launcherButtonRef, onNotice, onClose }) {
  const [, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [composing, setComposing] = useState(false);
  const [step, setStep] = useState(0);
  const isNarrowMobile = useMediaQuery('(max-width: 399px)');
  const state = edit.state;
  const update = changes => { Object.assign(state, changes); setRevision(value => value + 1); };
  const updateStandalone = changes => update({ standalone: { ...state.standalone, ...changes } });
  const invalidDriverCount = state.standalone.enabled && hasNegativeValue(state.standalone.driverCount);
  const invalidMemberCount = state.standalone.enabled && hasNegativeValue(state.standalone.memberCount);
  const invalidReward = hasNegativeValue(state.driverReward);
  const invalidCurrentStep = step === 0 ? invalidDriverCount || invalidMemberCount : step === 1 && invalidReward;
  const driverRule = state.driverCollectionFree ? 'free' : state.driverCollectionOffset ? 'offset' : 'normal';

  async function save() {
    if (composing || saving || invalidDriverCount || invalidMemberCount || invalidReward) return;
    setSaving(true); setError('');
    const before = amountSnapshot(runtime.store);
    try {
      await commitSettlementEdit(runtime, edit);
      onNotice(saveNotice(before, amountSnapshot(runtime.store)));
      onClose(true);
    } catch (caught) { setError(caught.message); setSaving(false); }
  }

  function go(next) {
    if (next > step && step === 0 && (invalidDriverCount || invalidMemberCount)) return;
    if (next > step && step === 1 && invalidReward) return;
    if (next > step && step === 0 && state.standalone.enabled && ((Number(state.standalone.driverCount) || 0) + (Number(state.standalone.memberCount) || 0) <= 0)) {
      setError('運転手または同乗者の人数を入力してください。');
      return;
    }
    setError(''); setStep(Math.max(0, Math.min(2, next)));
  }

  return <Modal className="app-modal settlement-settings-modal" open size="lg" hasScrollingContent modalHeading="精算設定を編集" closeButtonLabel="閉じる" launcherButtonRef={launcherButtonRef} primaryButtonText={step === 2 ? '保存' : '次へ'} secondaryButtons={[{ buttonText: 'キャンセル', onClick: () => onClose(false) }, { buttonText: '戻る', onClick: () => go(step - 1) }]} primaryButtonDisabled={saving || composing || invalidCurrentStep} onRequestSubmit={() => step === 2 ? save() : go(step + 1)} onRequestClose={() => onClose(false)} preventCloseOnClickOutside selectorPrimaryFocus="#settlement-mode-normal">
    <div className="form-stack settlement-settings-form" onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}>
      {isNarrowMobile
        ? <div className="settlement-settings-progress-compact" role="status" aria-label={`ステップ ${step + 1}/3：${steps[step]}`}><span className="settlement-settings-progress-compact__count">ステップ {step + 1}/3</span><strong>{steps[step]}</strong></div>
        : <ProgressIndicator id="settlement-settings-progress" className="settlement-settings-progress" currentIndex={step} vertical={false} spaceEqually aria-label="精算設定の進行状況">{steps.map((label, index) => <ProgressStep key={label} label={label} current={step === index} complete={step > index} />)}</ProgressIndicator>}
      {error && <InlineNotification kind="error" title="保存できませんでした" subtitle={error} hideCloseButton lowContrast />}
      {step === 0 && <section className="settlement-settings-step" aria-label="精算方法"><RadioButtonGroup legendText="精算方法" name="settlement-mode" valueSelected={state.standalone.enabled ? 'standalone' : 'normal'} onChange={value => updateStandalone(value === 'standalone' ? { ...initializeStandaloneCounts(state.standalone), enabled: true } : { enabled: false })} orientation="vertical">
        <RadioButton id="settlement-mode-normal" value="normal" labelText="参加者を登録して精算" />
        <RadioButton id="settlement-mode-standalone" value="standalone" labelText="人数だけで精算" />
      </RadioButtonGroup>
      {state.standalone.enabled && <div className="form-grid">
        <NumberInput id="settlement-driver-count" label="運転手の人数" min={0} max={99} allowEmpty invalid={invalidDriverCount} invalidText="人数は0以上で入力してください。" value={state.standalone.driverCount} onChange={(_, { value }) => updateStandalone({ driverCount: String(value) })} />
        <NumberInput id="settlement-member-count" label="同乗者の人数" min={0} max={99} allowEmpty invalid={invalidMemberCount} invalidText="人数は0以上で入力してください。" value={state.standalone.memberCount} onChange={(_, { value }) => updateStandalone({ memberCount: String(value) })} />
      </div>}
      <RadioButtonGroup legendText="精算額の切り上げ単位" name="settlement-rounding" valueSelected={state.rounding} onChange={value => update({ rounding: String(value) })} orientation="vertical">{['1', '10', '100'].map(value => <RadioButton key={value} id={`settlement-rounding-${value}`} value={value} labelText={`${value}円単位`} />)}</RadioButtonGroup></section>}
      {step === 1 && <section className="settlement-settings-step" aria-labelledby="settlement-reward-title"><h3 id="settlement-reward-title">車出し協力代</h3><div className="form-grid">
        <TextInput id="settlement-driver-reward" labelText="1台あたりの協力代（円）" inputMode="numeric" invalid={invalidReward} invalidText="金額は0円以上で入力してください。" value={state.driverReward} onChange={event => update({ driverReward: event.target.value })} />
        <RadioButtonGroup legendText="協力代の負担" name="settlement-reward-type" valueSelected={state.driverRewardType} onChange={value => update({ driverRewardType: value })} orientation="vertical"><RadioButton id="settlement-reward-split" value="split" labelText="参加者で割勘" /><RadioButton id="settlement-reward-club" value="club" labelText="部費から支払う" /></RadioButtonGroup>
      </div></section>}
      {step === 2 && <section className="settlement-settings-step" aria-labelledby="settlement-collection-title"><h3 id="settlement-collection-title">集金ルール</h3><RadioButtonGroup legendText="運転手分の集金" name="settlement-driver-rule" valueSelected={driverRule} onChange={value => update({ driverCollectionOffset: value === 'offset', driverCollectionFree: value === 'free' })} orientation="vertical"><RadioButton id="settlement-driver-normal" value="normal" labelText="集金する" /><RadioButton id="settlement-driver-offset" value="offset" labelText="支払額から差し引く" /><RadioButton id="settlement-driver-free" value="free" labelText="集金対象外" /></RadioButtonGroup>
        {!state.standalone.enabled && <Select id="settlement-organizer" labelText="企画者" value={state.organizerName} onChange={event => update({ organizerName: event.target.value })}><SelectItem value="" text="選択してください" />{Object.values(edit.session.base.participants || {}).sort((a, b) => a.name.localeCompare(b.name, 'ja')).map(person => <SelectItem key={person.id} value={person.name} text={person.name} />)}</Select>}
        {!state.standalone.enabled && <RadioButtonGroup legendText="企画者分の集金" name="settlement-organizer-rule" valueSelected={state.organizerFree ? 'free' : 'collect'} onChange={value => update({ organizerFree: value === 'free' })} orientation="vertical"><RadioButton id="settlement-organizer-collect" value="collect" labelText="集金する" /><RadioButton id="settlement-organizer-free" value="free" labelText="集金対象外" /></RadioButtonGroup>}</section>}
    </div>
  </Modal>;
}
