import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Button, Column, Grid, InlineLoading, Link, RadioButton, RadioButtonGroup, Select, SelectItem, TextInput } from '@carbon/react';
import { createSettlementRulesController } from '../../ui/settlement-rules-controller.js';
import { createSettlementRulesDraft } from '../../ui/settlement-rules-draft.js';
import RulesPreview from './RulesPreview.jsx';

export const rulesFieldId = key => `settlement-rules-${key.replaceAll('.', '-')}`;
const normalClick = event => event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
function RulesForm({ runtime, room, onPageChange, onReturn }) {
  const controller = useMemo(() => createSettlementRulesController({ runtime, cache: createSettlementRulesDraft({ roomId: runtime.roomId, storage: () => sessionStorage }) }), [runtime]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [attempted, setAttempted] = useState(false), [touched, setTouched] = useState([]), [composing, setComposing] = useState(false);
  const active = useRef(true), returned = useRef(false), composition = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; controller.dispose(); }; }, [controller]);
  const { state, projection } = snapshot, result = projection.candidate;
  const mode = state.standalone.enabled ? '人数だけ' : '登録した参加者';
  const pageKey = `${mode}:${result.shareCount}:${result.payerCount}:${result.perPerson}`;
  useEffect(() => { onPageChange({ metadata: [{ label: '対象', value: mode }, { label: '負担 / 集金', value: `${result.shareCount} / ${result.payerCount}人` }, { label: '1人あたり', value: `${result.perPerson.toLocaleString('ja-JP')}円（試算）` }] }); }, [onPageChange, pageKey]);
  useEffect(() => { if (snapshot.completion && active.current && !returned.current) { returned.current = true; onReturn({ focusId: 'settlement-rules-entry', reason: 'saved' }); } }, [snapshot.completion, onReturn]);
  const focus = key => (document.getElementById(rulesFieldId(key)) || document.getElementById(rulesFieldId('standalone.enabled')))?.focus();
  function error(key) { return attempted || touched.includes(key) ? snapshot.validation.fields.find(value => value.key === key)?.message || '' : ''; }
  function input(key, label, helperText, inputMode) { const message = error(key); return <TextInput key={key} id={rulesFieldId(key)} labelText={label} helperText={helperText} inputMode={inputMode} readOnly={snapshot.frozen} value={key.startsWith('standalone.') ? state.standalone[key.slice(11)] : state[key]} invalid={!!message} invalidText={message} onBlur={() => setTouched(value => value.includes(key) ? value : [...value, key])} onChange={event => controller.updateField(key, event.target.value)} />; }
  async function save(event) { event.preventDefault(); setAttempted(true); const result = await controller.save({ composing: composition.current || event.nativeEvent?.isComposing }); if (active.current && result.disposition === 'invalid') focus(controller.getSnapshot().validation.fields[0].key); }
  const correct = Object.assign(destination => {
    if (destination.kind === 'rule') focus(destination.fieldKey);
    else if (destination.kind === 'participants') runtime.navigation.navigateTask('import');
    else if (destination.kind === 'vehicle-cost') runtime.navigation.navigateVehicleCostTask(destination.destination);
  }, { href: destination => destination.kind === 'rule' ? `#${rulesFieldId(destination.fieldKey)}` : destination.kind === 'participants' ? runtime.navigation.taskHrefFor('import') : runtime.navigation.vehicleCostTaskHrefFor(destination.destination) });
  const driverRule = state.driverCollectionOffset && state.driverCollectionFree ? 'both' : state.driverCollectionFree ? 'free' : state.driverCollectionOffset ? 'offset' : 'normal';
  const people = Object.entries(room.participants || {}).sort(([, a], [, b]) => a.name.localeCompare(b.name, 'ja'));
  const organizer = people.find(([, person]) => runtime.store.domain.canonical.normalizeNameKey(person.name) === runtime.store.domain.canonical.normalizeNameKey(state.organizerName));
  const organizerValue = snapshot.organizerId !== null ? snapshot.organizerId : organizer?.[0] || '';
  const unsafe = snapshot.writeIssues.length > 0;
  return <form aria-label="精算ルール" noValidate className="rules-form" onSubmit={save} onCompositionStart={() => { composition.current = true; setComposing(true); }} onCompositionEnd={() => { composition.current = false; setComposing(false); }}>
    <p className="rules-draft-status" role="status">{snapshot.status || (snapshot.dirty ? '未保存' : '現在のルール')}。戻る・再読み込みでは入力を保持します。</p>
    {!snapshot.recoverable && <p role="status">この端末に入力を保存できません。再読み込みすると失われます。</p>}
    {attempted && snapshot.validation.fields.length > 0 && <section aria-label="入力エラー"><p>入力を確認してください。</p><ul>{snapshot.validation.fields.map(field => <li key={field.key}><Link href={`#${rulesFieldId(field.key)}`} onClick={event => { if (normalClick(event)) { event.preventDefault(); focus(field.key); } }}>{field.message}</Link></li>)}</ul></section>}
    {unsafe && <section aria-label="保存前の確認"><ul>{snapshot.writeIssues.map(issue => <li key={issue.key}>{issue.reason}</li>)}</ul>{snapshot.writeIssues.some(issue => ['stale-settings', 'reset'].includes(issue.key)) && <><p>現在のルールから編集し直すと、この入力の控えを破棄します。共有ルールは変更しません。</p><Button kind="tertiary" type="button" onClick={() => { controller.restartFromCurrent(); setAttempted(false); setTouched([]); focus('standalone.enabled'); }}>現在のルールから編集し直す</Button></>}</section>}
    <Grid fullWidth className="rules-grid">
      <Column sm={4} md={8} lg={10} className="rules-input-column"><div className="rules-groups">
        <section className="rules-group" aria-labelledby="rules-target-title"><h2 id="rules-target-title">精算対象</h2>
          <RadioButtonGroup legendText="精算方法" name="settlement-rules-mode" orientation="vertical" valueSelected={state.standalone.enabled ? 'standalone' : 'normal'} disabled={snapshot.frozen} onChange={value => controller.setMode(value === 'standalone')}>
            <RadioButton id={rulesFieldId('standalone.enabled')} value="normal" labelText="登録した参加者で精算" /><RadioButton id="settlement-rules-mode-standalone" value="standalone" labelText="人数だけで精算" />
          </RadioButtonGroup>
          {state.standalone.enabled ? <div className="rules-group">
            {input('standalone.driverCount', '運転手の人数', '計算では0〜99人の整数として扱います。入力途中では変更しません。', 'decimal')}
            {input('standalone.memberCount', '同乗者の人数', '運転手を含めずに入力します。', 'decimal')}
            {Array.from({ length: runtime.store.domain.settlement.getStandaloneCount(state.standalone.driverCount) }, (_, index) => <TextInput key={index} id={`settlement-rules-driver-name-${index}`} labelText={`運転手${index + 1}の名前`} readOnly={snapshot.frozen} value={state.standalone.driverNames[index] || ''} onChange={event => { const names = [...state.standalone.driverNames]; names[index] = event.target.value; controller.updateField('standalone.driverNames', names); }} />)}
            <p>空の名前には「車出し1」などを使用し、同じ名前には番号を付けます。計算対象: 運転手 {projection.candidateInput.data.standaloneCounts?.driverCount || 0}人・同乗者 {projection.candidateInput.data.standaloneCounts?.memberCount || 0}人。</p>
          </div> : <><p>登録済み {Object.keys(room.participants || {}).length}人。参加者・車出しの変更は参加者と車割で行います。</p><Link href={runtime.navigation.hrefFor('participants')} onClick={event => { if (normalClick(event)) { event.preventDefault(); runtime.navigation.navigate('participants'); } }}>参加者を確認</Link>
            <Select id={rulesFieldId('organizerName')} labelText="企画者" value={organizerValue} disabled={snapshot.frozen} onChange={event => controller.setOrganizer(event.target.value)}><SelectItem value="" text="選択してください" />{people.map(([id, person]) => <SelectItem key={id} value={id} text={person.name} />)}</Select>
            {state.organizerName && !organizer && <p>現在の企画者: {state.organizerName}。参加者から選び直せます。</p>}
          </>}
        </section>
        <section className="rules-group" aria-labelledby="rules-rounding-title"><h2 id="rules-rounding-title">割勘と端数</h2><p>費用を負担する人数と、現金を集める人数は異なる場合があります。</p>
          <RadioButtonGroup legendText="1人あたりの集金額の端数単位" name="settlement-rules-rounding" orientation="vertical" valueSelected={state.rounding} disabled={snapshot.frozen} onChange={value => controller.updateField('rounding', value)}>
            {(['1', '10', '100'].includes(state.rounding) ? ['1', '10', '100'] : ['1', '10', '100', state.rounding]).map(value => <RadioButton key={value} id={`settlement-rules-rounding-${value}`} value={value} labelText={`${value}円単位${['1','10','100'].includes(value) ? '' : '（現在の設定）'}`} />)}
          </RadioButtonGroup><p>車ごとの支払額の端数処理とは別の設定です。</p>
        </section>
        <section className="rules-group" aria-labelledby="rules-reward-title"><h2 id="rules-reward-title">車出し協力代・部費</h2>
          {input('driverReward', '1台あたりの協力代（円）', '車単位の協力代です。実際の内訳は車ごとの試算で確認できます。', 'decimal')}
          <RadioButtonGroup legendText="協力代の負担" name="settlement-rules-reward" orientation="vertical" valueSelected={state.driverRewardType} disabled={snapshot.frozen} onChange={value => controller.updateField('driverRewardType', value)}><RadioButton id="settlement-rules-reward-split" value="split" labelText="参加者で割勘" /><RadioButton id="settlement-rules-reward-club" value="club" labelText="部費から支払う" /></RadioButtonGroup>
          <p>その他の費用の負担先は、車両費用で変更します。</p>
        </section>
        <section className="rules-group" aria-labelledby="rules-exemption-title"><h2 id="rules-exemption-title">免除・差し引き</h2>
          <RadioButtonGroup legendText="運転手分の扱い" name="settlement-rules-driver" orientation="vertical" valueSelected={driverRule} disabled={snapshot.frozen} onChange={controller.setDriverRule}>
            <RadioButton id={rulesFieldId('driverCollectionRule')} value="normal" labelText="集金する" /><RadioButton id="settlement-rules-driver-offset" value="offset" labelText="車への支払額から差し引く" /><RadioButton id="settlement-rules-driver-free" value="free" labelText="割勘を免除する" />{driverRule === 'both' && <RadioButton id="settlement-rules-driver-both" value="both" labelText="免除と差し引き（現在の設定）" />}
          </RadioButtonGroup><p>差し引きは費用負担に含め、現金を集めず車への支払額から控除します。免除は費用負担から除外します。どちらも集金済みではありません。</p>
          {!state.standalone.enabled && <RadioButtonGroup legendText="企画者分の扱い" name="settlement-rules-organizer" orientation="vertical" valueSelected={state.organizerFree ? 'free' : 'collect'} disabled={snapshot.frozen} onChange={value => controller.updateField('organizerFree', value === 'free')}><RadioButton id="settlement-rules-organizer-collect" value="collect" labelText="集金する" /><RadioButton id="settlement-rules-organizer-free" value="free" labelText="割勘を免除する" /></RadioButtonGroup>}
          <p>費目の割引・差引は車両費用で入力します。集金担当と支払い状況は、精算ページで記録します。</p>
        </section>
      </div></Column>
      <Column sm={4} md={8} lg={6} className="rules-preview-column"><RulesPreview projection={projection} onCorrect={correct} /></Column>
      <Column sm={4} md={8} lg={16} className="rules-action-column">
        {snapshot.receipt && <div className="rules-save-feedback"><p role="status">{snapshot.status}</p>{snapshot.receipt.disposition === 'reset' || snapshot.receipt.disposition === 'adjusted' && snapshot.receipt.acknowledged ? <><p>入力の控えを閉じて、現在の共有精算を表示します。共有ルールは変更しません。</p><Button kind="tertiary" type="button" disabled={snapshot.saving} onClick={() => { if (controller.confirmCurrent()) onReturn({ focusId: 'settlement-rules-entry', reason: 'current' }); }}>現在の精算を確認</Button></> : <Button kind="tertiary" type="button" disabled={snapshot.saving} onClick={() => void controller.retry()}>{snapshot.receipt.canRetry ? '同じ内容を再試行' : '保存結果を確認'}</Button>}</div>}
        {snapshot.saving && <InlineLoading description="精算ルールを保存しています" />}
        {composing && <p>文字の入力を確定してから保存してください。</p>}
        {!snapshot.receipt && <div className="rules-actions"><Button type="submit" disabled={snapshot.frozen || composing || unsafe}>精算ルールを保存</Button><Button type="button" kind="secondary" disabled={snapshot.saving} onClick={() => { if (controller.cancel()) onReturn({ focusId: 'settlement-rules-entry', reason: 'cancel' }); }}>キャンセル</Button></div>}
      </Column>
    </Grid>
  </form>;
}
export default function SettlementRules(props) {
  if (!props.resolved) return <InlineLoading description="精算ルールを読み込んでいます" />;
  return <RulesForm {...props} />;
}
