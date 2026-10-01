import { useEffect, useRef, useState } from 'react';
import { Accordion, AccordionItem, Button, Checkbox, Column, Form, Grid, InlineLoading, InlineNotification, RadioButton, RadioButtonGroup, Select, SelectItem, TextArea, TextInput } from '@carbon/react';
import { registrationPeople } from '../ui/participant-registration.js';
import { createParticipantTaskDraft } from '../ui/participant-task-draft.js';
import { focusFirstInvalid } from '../ui/focus-first-invalid.js';
import { participantSaveReceipt, completeParticipantSave } from '../ui/participant-save.js';

export default function ParticipantRegistration({ runtime, onCancel, onSaved }) {
  const [cache] = useState(() => createParticipantTaskDraft({ storage: () => window.localStorage, roomId: runtime.roomId, task: 'import' }));
  const [draft, setDraft] = useState(() => {
    const saved = cache.read();
    return { source: saved?.source === 'paste' ? 'paste' : 'manual', sheet: String(saved?.sheet || ''), members: String(saved?.members || ''), drivers: String(saved?.drivers || ''),
      grades: Array.from({ length: 4 }, (_, index) => String(saved?.grades?.[index] || '')), corrections: saved?.corrections || {}, receipt: saved?.receipt || null, resetGeneration: saved?.resetGeneration ?? runtime.store.getSnapshot().resetGeneration };
  });
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recoverable, setRecoverable] = useState(() => cache.isRecoverable());
  const formRef = useRef(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const result = registrationPeople(draft);
  function patch(changes) {
    const next = { ...draft, ...changes };
    setDraft(next);
    setRecoverable(cache.write(next));
    setError('');
    setInvalid(false);
  }
  function cancel() {
    if (!cache.clear()) { setError('この端末の下書きを削除できません。保存領域を確認して、もう一度キャンセルしてください。'); return; }
    onCancel();
  }
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    if (!result.ok) {
      setInvalid(true);
      setError(result.errors?.join(' ') || '入力内容を確認してください。');
      requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (draft.resetGeneration !== runtime.store.getSnapshot().resetGeneration) throw new Error('企画がリセットされました。下書きをキャンセルして、開き直してください。');
      let receipt = draft.receipt;
      if (!receipt) {
        receipt = participantSaveReceipt(runtime.store.domain.sync, runtime.store.command('addParticipants', { people: result.people }), runtime.storage.read('outbox') || {});
        const committed = { ...draft, receipt };
        setDraft(committed);
        setRecoverable(cache.write(committed));
      }
      await completeParticipantSave(runtime, receipt, nextReceipt => {
        const current = cache.read();
        if (current?.receipt?.operationId !== receipt?.operationId) return;
        receipt = nextReceipt;
        const next = { ...current, receipt: nextReceipt };
        const persisted = cache.write(next);
        if (alive.current) { setDraft(next); setRecoverable(persisted); }
      });
      if (draft.resetGeneration !== runtime.store.getSnapshot().resetGeneration) throw new Error('企画がリセットされました。下書きをキャンセルして、開き直してください。');
      // Complete even after navigation, but never clear a newer draft from a
      // newly mounted editor. That editor must acknowledge its own attempt.
      if (!alive.current) return;
      if (!cache.clear()) throw new Error('登録しましたが、この端末の下書きを削除できません。保存領域を確認して再試行してください。');
      onSaved();
    } catch (caught) {
      if (alive.current) { setError(String(caught?.message || caught)); setSaving(false); }
    }
  }
  const inputError = invalid && (draft.source !== 'paste' || result.invalidIndex < 0 || result.invalidIndex === undefined);
  const inputsLocked = saving || !!draft.receipt;
  return <Form ref={formRef} className="participant-task-form" aria-label="参加者を登録" aria-busy={saving} onSubmit={submit}>
    <p className="task-draft-status">{draft.receipt ? '登録内容は端末に反映済みです。キャンセルは再試行用の下書きだけを破棄し、参加者を削除しません。' : '登録するまで共有されません。戻る・画面移動ではこの端末に下書きを残します。キャンセルは下書きだけを破棄します。'}</p>
    {!recoverable && <p role="status">この端末に下書きを保存できません。入力は保持していますが、再読み込みすると失われる可能性があります。</p>}
    {draft.receipt && !saving && <p role="status">端末への登録は反映済みです。共有保存を再試行してください。登録内容の変更は共有保存後に参加者一覧で行います。</p>}
    {error && <InlineNotification kind="error" title="参加者を登録できませんでした" subtitle={error} hideCloseButton lowContrast />}
    <fieldset disabled={inputsLocked} className="registration-fields">
    <RadioButtonGroup legendText="入力方法" name="registration-source" valueSelected={draft.source} orientation="vertical" disabled={inputsLocked} onChange={source => patch({ source })}>
      <RadioButton id="registration-manual" value="manual" labelText="手動入力" />
      <RadioButton id="registration-paste" value="paste" labelText="表データを貼り付け" />
    </RadioButtonGroup>
    {draft.source === 'paste' ? <>
      <TextArea id="registration-sheet" labelText="Googleフォームの回答を貼り付け" helperText="見出しの行と回答を一緒にコピーしてください。列の順番は自由です。" disabled={inputsLocked} rows={5} value={draft.sheet} invalid={inputError} invalidText={result.errors?.join(' ')} onChange={event => patch({ sheet: event.target.value, corrections: {} })} />
      <Accordion><AccordionItem title="貼り付け方を見る"><p>応募フォームの管理画面で「回答」を開き、右上の緑色のスプレッドシートアイコンから回答用スプレッドシートを作成します。名前、学年または学籍番号、車出しの有無の見出しと回答を一緒にコピーしてください。</p></AccordionItem></Accordion>
      {!!result.warnings?.length && <section aria-labelledby="registration-warnings"><h2 id="registration-warnings">読取時の注意</h2><ul>{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></section>}
      {!!result.people?.length && <section className="registration-review" aria-labelledby="registration-review-title"><h2 id="registration-review-title">登録内容を確認・修正</h2>
        {result.columnText && <p>名前: {result.columnText.name} / 学年: {result.columnText.grade} / 学籍番号: {result.columnText.studentId} / 車出し: {result.columnText.driver}</p>}
        <p>表データを書き換えると、ここでの修正は新しい読取結果に置き換わります。</p>
        {result.people.map((person, index) => <fieldset key={index} className="registration-review__person"><legend>{index + 1}人目</legend>
          <TextInput id={`registration-name-${index}`} labelText={`${index + 1}人目の名前`} disabled={inputsLocked} value={person.name} invalid={invalid && result.invalidIndex === index} invalidText="名前を入力してください。" onChange={event => patch({ corrections: { ...draft.corrections, [index]: { ...draft.corrections[index], name: event.target.value } } })} />
          <Select id={`registration-person-grade-${index}`} labelText={`${index + 1}人目の学年`} disabled={inputsLocked} value={String(person.grade)} onChange={event => patch({ corrections: { ...draft.corrections, [index]: { ...draft.corrections[index], grade: Number(event.target.value) } } })}><SelectItem value="0" text="未設定" />{[1, 2, 3, 4].map(grade => <SelectItem key={grade} value={String(grade)} text={`${grade}年`} />)}</Select>
          <Checkbox id={`registration-person-driver-${index}`} labelText={`${index + 1}人目の車出し`} disabled={inputsLocked} checked={person.driver} onChange={(_, { checked }) => patch({ corrections: { ...draft.corrections, [index]: { ...draft.corrections[index], driver: checked } } })} />
        </fieldset>)}
      </section>}
    </> : <section aria-labelledby="registration-manual-title">
      <h2 id="registration-manual-title">参加者と属性</h2>
      <p>1行に1人ずつ入力します。車出し・学年欄だけに書いた人も登録されます。</p>
      <Grid fullWidth className="registration-inputs"><Column sm={4} md={8} lg={16}><TextArea id="registration-members" labelText="参加者（改行区切り）" rows={3} disabled={inputsLocked} value={draft.members} invalid={inputError} invalidText="参加者を入力してください。" onChange={event => patch({ members: event.target.value })} /></Column>
        <Column sm={4} md={8} lg={16}><TextArea id="registration-drivers" labelText="車出し可能な参加者" rows={3} disabled={inputsLocked} value={draft.drivers} onChange={event => patch({ drivers: event.target.value })} /></Column>
        {draft.grades.map((value, index) => <Column key={index} sm={4} md={4} lg={8}><TextArea id={`registration-grade-${index + 1}`} labelText={`${index + 1}年生`} rows={2} disabled={inputsLocked} value={value} onChange={event => patch({ grades: draft.grades.map((item, i) => i === index ? event.target.value : item) })} /></Column>)}
      </Grid>
    </section>}
    </fieldset>
    <p role="status">登録する参加者 {result.people?.length || 0}人</p>
    <div className="participant-task-actions"><Button type="submit" disabled={saving}>参加者を登録</Button><Button type="button" kind="secondary" disabled={saving} onClick={cancel}>キャンセル</Button>{saving && <InlineLoading status="active" description="登録内容を保存中" />}</div>
  </Form>;
}
