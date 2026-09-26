import { useRef, useState } from 'react';
import { Modal, TextArea, InlineNotification, Accordion, AccordionItem } from '@carbon/react';
import { formParser } from '../domain/index.js';

export default function RegistrationModal({ runtime, onClose, onNotice }) {
  const [sheet, setSheet] = useState('');
  const [members, setMembers] = useState('');
  const [drivers, setDrivers] = useState('');
  const [grades, setGrades] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const sheetRef = useRef(null);
  const parsed = sheet.trim() ? formParser.parseSpreadsheetImport(sheet) : null;
  function focusSheet() {
    requestAnimationFrame(() => {
      sheetRef.current?.focus();
      sheetRef.current?.scrollIntoView({ block: 'nearest' });
    });
  }
  function updatePrimaryInput(setter, value) {
    setter(value);
    if (error) setError('');
  }
  function submit() {
    const split = value => value.split(/\r?\n/).map(name => name.trim()).filter(Boolean);
    const driverKeys = new Set(split(drivers).map(formParser.normalizeNameForCompare));
    const gradeKeys = grades.map(value => new Set(split(value).map(formParser.normalizeNameForCompare)));
    const people = parsed?.people || split(members).map(name => ({ name, grade: Math.max(0, gradeKeys.findIndex(keys => keys.has(formParser.normalizeNameForCompare(name))) + 1), driver: driverKeys.has(formParser.normalizeNameForCompare(name)) }));
    if (parsed && !parsed.ok) { setError(parsed.errors.join(' ')); focusSheet(); return; }
    if (!people.length) { setError('参加者を入力してください。'); focusSheet(); return; }
    try { runtime.store.command('addParticipants', { people }); onNotice('参加者を登録しました。'); onClose(); }
    catch (caught) { setError(caught.message); }
  }
  return <Modal className="app-modal registration-modal" open hasScrollingContent modalHeading="参加者登録" size="lg" primaryButtonText="登録" secondaryButtonText="キャンセル" onRequestSubmit={submit} onRequestClose={onClose} preventCloseOnClickOutside selectorPrimaryFocus="#registration-sheet">
    <div className="form-stack">
      {error && <InlineNotification kind="error" title={error} lowContrast hideCloseButton />}
      <TextArea ref={sheetRef} id="registration-sheet" labelText="Googleフォームの回答を貼り付け" helperText="各項目の見出しの行も必ず一緒にコピーしてください。" value={sheet} onChange={event => updatePrimaryInput(setSheet, event.target.value)} rows={4} />
      {parsed && <p role="status">{parsed.ok ? `${parsed.people.length}人を読み込みました。` : parsed.errors.join(' ')}</p>}
      {parsed?.warnings?.length > 0 && <p>{parsed.warnings.join(' ')}</p>}
      <Accordion><AccordionItem title="貼り付け方を見る"><p>応募フォームの管理画面で「回答」を開き、右上の緑色のスプレッドシートアイコンを押すと、回答用スプレッドシートを作成できます。</p><p>名前、学年または学籍番号、車出しの有無の見出しと回答を一緒にコピーしてください。列の順番は自由です。</p></AccordionItem></Accordion>
      <div className="form-grid">
        <TextArea id="registration-members" labelText="参加者（改行区切り）" rows={3} value={members} onChange={event => updatePrimaryInput(setMembers, event.target.value)} disabled={!!sheet.trim()} />
        <TextArea id="registration-drivers" labelText="車出し可能な参加者" rows={3} value={drivers} onChange={event => updatePrimaryInput(setDrivers, event.target.value)} disabled={!!sheet.trim()} />
        {grades.map((value, index) => <TextArea key={index} id={`registration-grade-${index + 1}`} labelText={`${index + 1}年生`} rows={2} value={value} onChange={event => setGrades(current => current.map((item, i) => i === index ? event.target.value : item))} disabled={!!sheet.trim()} />)}
      </div>
    </div>
  </Modal>;
}
