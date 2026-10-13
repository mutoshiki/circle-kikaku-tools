import { useMemo, useRef, useState } from 'react';
import {
  Accordion, AccordionItem, Checkbox, InlineNotification, Modal,
  RadioButton, RadioButtonGroup, Select, SelectItem, TextArea,
} from '@carbon/react';
import { formParser } from '../domain/index.js';
import { buildManualPeople, parseManualNames } from './registration-input.js';
import RegistrationPeoplePreview from './RegistrationPeoplePreview.jsx';

function isHttpUrl(value) {
  try { return ['http:', 'https:'].includes(new URL(value.trim()).protocol); }
  catch { return false; }
}

export default function RegistrationModal({ runtime, room, launcherButtonRef, onClose, onNotice }) {
  const [method, setMethod] = useState('manual');
  const [namesText, setNamesText] = useState('');
  const [sheet, setSheet] = useState('');
  const [attributes, setAttributes] = useState({});
  const [fieldErrors, setFieldErrors] = useState({ manual: '', spreadsheet: '' });
  const [submitError, setSubmitError] = useState('');
  const [showSpreadsheetDetails, setShowSpreadsheetDetails] = useState(false);
  const [composing, setComposing] = useState(false);
  const manualRef = useRef(null);
  const sheetRef = useRef(null);
  const errorRef = useRef(null);
  const manualNames = useMemo(() => parseManualNames(namesText), [namesText]);
  const manualPeople = useMemo(() => buildManualPeople(manualNames, attributes), [manualNames, attributes]);
  const isSpreadsheet = method === 'spreadsheet';
  const parsed = sheet.trim() ? formParser.parseSpreadsheetImport(sheet) : null;
  const urlError = isHttpUrl(sheet) ? 'URLから回答を取得できません。回答用スプレッドシートの表をコピーしてください。' : '';
  const spreadsheetError = urlError || (parsed && !parsed.ok ? parsed.errors.join(' ') : '');
  const people = method === 'manual' ? manualPeople : (parsed?.ok ? parsed.people : []);
  const currentError = isSpreadsheet ? (fieldErrors.spreadsheet || (sheet.trim() ? spreadsheetError : '')) : fieldErrors.manual;
  const existingManualCount = manualPeople.filter(person => runtime.store.domain.canonical.findParticipantIdByName(room.participants, person.name)).length;
  function focusField(target) {
    requestAnimationFrame(() => {
      target.current?.focus();
      target.current?.scrollIntoView({ block: 'nearest' });
    });
  }

  function updateField(methodName, setter, value) {
    setter(value);
    setFieldErrors(current => current[methodName] ? { ...current, [methodName]: '' } : current);
    setSubmitError('');
  }

  function updateAttribute(key, changes) {
    setAttributes(current => ({ ...current, [key]: { ...current[key], ...changes } }));
  }

  function submit() {
    if (composing) return;
    if (method === 'manual' && !manualPeople.length) {
      setFieldErrors(current => ({ ...current, manual: '参加者の名前を入力してください。' }));
      focusField(manualRef);
      return;
    }
    if (method === 'spreadsheet' && (!parsed?.ok || !parsed.people.length)) {
      const message = spreadsheetError || '回答データを貼り付けてください。';
      setFieldErrors(current => ({ ...current, spreadsheet: message }));
      focusField(sheetRef);
      return;
    }
    try {
      runtime.store.command('addParticipants', { people });
      onNotice('参加者を登録しました。');
      onClose(true);
    } catch (caught) {
      setSubmitError(caught.message);
      focusField(errorRef);
    }
  }

  const showManualAttributes = manualNames.length > 0;

  return <Modal className="app-modal registration-modal" open hasScrollingContent modalHeading="参加者を登録" size="md" launcherButtonRef={launcherButtonRef}
    closeButtonLabel="閉じる" primaryButtonText="参加者を登録" secondaryButtonText="キャンセル" onRequestSubmit={submit}
    onRequestClose={() => onClose(false)} preventCloseOnClickOutside selectorPrimaryFocus="#registration-mode-manual">
    <div className="form-stack registration-modal__content" onKeyDownCapture={event => {
      if (event.key === 'Escape' && (event.isComposing || composing)) { event.preventDefault(); event.stopPropagation(); }
    }}>
      {submitError && <div ref={errorRef} tabIndex={-1}><InlineNotification kind="error" title="登録できませんでした" subtitle={submitError} lowContrast hideCloseButton /></div>}
      <RadioButtonGroup legendText="登録方法" name="registration-method" valueSelected={method} onChange={value => {
        setMethod(String(value));
        setSubmitError('');
      }} orientation="vertical">
        <RadioButton id="registration-mode-manual" value="manual" labelText="名前を入力" />
        <RadioButton id="registration-mode-spreadsheet" value="spreadsheet" labelText="回答表を貼り付ける" />
      </RadioButtonGroup>

      {!isSpreadsheet ? <>
        <TextArea ref={manualRef} id="registration-names" labelText="参加者の名前"
          helperText="1行に1人ずつ入力してください。" invalid={!!currentError} invalidText={currentError}
          value={namesText} onChange={event => updateField('manual', setNamesText, event.target.value)}
          onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} rows={4} />
        {showManualAttributes && <RegistrationPeoplePreview people={manualPeople} participants={room.participants}
          canonical={runtime.store.domain.canonical} warnings={[]} />}
        {showManualAttributes && <p className="registration-modal__driver-help">車出しに指定すると、車割にも反映されます。{existingManualCount > 0 && '既存参加者の学年・車出しを未設定に戻す場合は、参加者の編集から行ってください。'}</p>}
        {showManualAttributes && <Accordion className="registration-modal__attributes">
          <AccordionItem title="学年・車出しを設定（任意）">
            <div className="registration-modal__attribute-list">
              {manualNames.map(({ key, name }) => <div className="registration-modal__attribute-row" key={key}>
                <strong className="registration-modal__attribute-name">{name}</strong>
                <Select id={`registration-grade-${encodeURIComponent(key)}`} labelText={`${name}の学年`} value={attributes[key]?.grade || '0'}
                  onChange={event => updateAttribute(key, { grade: event.target.value })}>
                  <SelectItem value="0" text="未設定" />
                  {[1, 2, 3, 4].map(grade => <SelectItem key={grade} value={String(grade)} text={`${grade}年`} />)}
                </Select>
                <Checkbox id={`registration-driver-${encodeURIComponent(key)}`} labelText={`${name}を車出しに指定`}
                  checked={attributes[key]?.driver === true} onChange={(_, { checked }) => updateAttribute(key, { driver: checked })} />
              </div>)}
            </div>
          </AccordionItem>
        </Accordion>}
      </> : <>
        <TextArea ref={sheetRef} id="registration-sheet" labelText="回答データ"
          helperText="回答用スプレッドシートから、見出し行と回答行を一緒にコピーしてください。"
          invalid={!!currentError} invalidText={currentError} value={sheet}
          onChange={event => updateField('spreadsheet', setSheet, event.target.value)}
          onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} rows={5} />
        {parsed?.ok && <RegistrationPeoplePreview people={parsed.people} participants={room.participants}
          canonical={runtime.store.domain.canonical} warnings={parsed.warnings || []} spreadsheet
          expanded={showSpreadsheetDetails} onToggleDetails={() => setShowSpreadsheetDetails(value => !value)} />}
        <Accordion>
          <AccordionItem title="貼り付け方を見る">
            <p>応募フォームの管理画面で「回答」を開き、右上の緑色のスプレッドシートアイコンを押すと、回答用スプレッドシートを作成できます。</p>
            <p>名前、学年または学籍番号、車出しの有無の見出しと回答を一緒にコピーしてください。列の順番は自由です。</p>
          </AccordionItem>
        </Accordion>
      </>}
    </div>
  </Modal>;
}
