import { useEffect, useRef, useState } from 'react';
import { Button, Checkbox, ContainedList, ContainedListItem, IconButton, InlineLoading, InlineNotification, Link, Search, Select, SelectItem, Tag, OverflowMenu, OverflowMenuItem } from '@carbon/react';
import { Add, SettingsAdjust } from '@carbon/icons-react';
import ParticipantEditor from './ParticipantEditor.jsx';
import ParticipantRegistration from './ParticipantRegistration.jsx';
import ParticipantAnnouncement from './ParticipantAnnouncement.jsx';
import { ExportModal } from './ProjectTools.jsx';
import useMediaQuery from '../hooks/useMediaQuery.js';
import TaskModal from './TaskModal.jsx';
import { participantSaveReceipt, completeParticipantSave } from '../ui/participant-save.js';

export default function Participants({ runtime, room, task = '', onReturn, onNotice, embedded = false }) {
  const isMobile = useMediaQuery('(max-width: 671px)');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filter, setFilter] = useState({ grade: 'all', driver: 'all', selected: 'all' });
  const [choices, setChoices] = useState({});
  const [editingSelection, setEditingSelection] = useState(false);
  const [editor, setEditor] = useState(null);
  const [pendingSelection, setPendingSelection] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [confirmationError, setConfirmationError] = useState('');
  const [toolModal, setToolModal] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const participantMenus = useRef(new Map());
  const modalLauncherRef = useRef(null);
  const selectionAttempt = useRef(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const applicants = runtime.store.domain.applicants;
  const application = applicants.validApplicationSync(room.meta?.applicationSync) ? room.meta.applicationSync : null;
  const entries = applicants.applicantEntries(application);
  const acceptedIds = new Set(entries.map(([key, applicant]) => runtime.store.participantIdForApplicant(key, applicant)).filter(Boolean));
  const participantCount = Object.keys(room.participants).length;
  const rows = [
    ...entries.map(([key, applicant]) => {
      const id = runtime.store.participantIdForApplicant(key, applicant);
      return { key: `a:${key}`, responseKey: key, id, person: applicant, driver: applicant.canDrive, assignedDriver: !!(room.participants[id] && room.allocations.car.placements[id]?.driver), detail: applicants.applicantMeta(applicant) };
    }),
    ...Object.entries(room.participants).filter(([id]) => !acceptedIds.has(id)).sort(([, a], [, b]) => a.name.localeCompare(b.name, 'ja')).map(([id, person]) => ({ key: `p:${id}`, id, person, driver: room.allocations.car.placements[id]?.driver, assignedDriver: !!room.allocations.car.placements[id]?.driver, detail: applicants.participantMeta(person) })),
  ];
  const checked = row => Object.hasOwn(choices, row.key) ? choices[row.key] : !!row.id;
  const confirmed = application && Object.keys(room.participants).length > 0;
  const selectionVisible = (!!application && !confirmed) || editingSelection;
  const listRows = selectionVisible ? rows : rows.filter(row => room.participants[row.id]).map(row => {
    const person = room.participants[row.id];
    return { ...row, person, driver: !!room.allocations.car.placements[row.id]?.driver, detail: applicants.participantMeta(person) };
  });
  const nameCounts = new Map();
  for (const row of listRows) nameCounts.set(row.person.name, (nameCounts.get(row.person.name) || 0) + 1);
  const rowLabel = row => nameCounts.get(row.person.name) > 1 ? `${row.person.name}（${row.detail || '属性未設定'}・${listRows.indexOf(row) + 1}人目）` : row.person.name;
  const visible = listRows.filter(row => row.person.name.includes(search.trim())
    && (filter.grade === 'all' || String(row.person.grade) === filter.grade)
    && (filter.driver === 'all' || !!row.driver === (filter.driver === 'driver'))
    && (filter.selected === 'all' || checked(row) === (filter.selected === 'selected')));
  async function apply(args) {
    if (saving) return;
    setEditingSelection(true);
    setSaving(true);
    setSelectionError('');
    try {
      const generation = selectionAttempt.current?.resetGeneration ?? runtime.store.getSnapshot().resetGeneration;
      if (generation !== runtime.store.getSnapshot().resetGeneration) throw new Error('企画がリセットされました。キャンセルして選び直してください。');
      if (!selectionAttempt.current) {
        selectionAttempt.current = participantSaveReceipt(runtime.store.domain.sync, runtime.store.command('applySelection', args), runtime.storage.read('outbox') || {});
      }
      await completeParticipantSave(runtime, selectionAttempt.current, next => { selectionAttempt.current = next; });
      if (generation !== runtime.store.getSnapshot().resetGeneration) throw new Error('企画がリセットされました。キャンセルして選び直してください。');
      if (!alive.current) return;
      selectionAttempt.current = null;
      setChoices({}); setEditingSelection(false); setPendingSelection(null);
      requestAnimationFrame(() => {
        if (alive.current && runtime.navigation.getSnapshot() === 'participants' && !runtime.navigation.getTaskSnapshot()) document.getElementById('project-page-title')?.focus();
      });
    }
    catch (error) { if (alive.current) { if (pendingSelection) setConfirmationError(error.message); else setSelectionError(error.message); } }
    finally { if (alive.current) setSaving(false); }
  }
  function requestApply() {
    setConfirmationError('');
    const args = { selectedApplicants: rows.filter(row => row.responseKey && checked(row)).map(row => row.responseKey), selectedManual: rows.filter(row => !row.responseKey && checked(row)).map(row => row.id) };
    const removals = rows.filter(row => row.id && !checked(row));
    if (removals.some(row => applicants.participantHasDependentData(room, row.id))) setPendingSelection(args);
    else apply(args);
  }
  function rememberLauncher(id) { modalLauncherRef.current = participantMenus.current.get(id) || null; }
  function edit(id) { rememberLauncher(id); setEditor(runtime.store.beginEdit({ kind: 'participant-edit', participantId: id })); }
  function remove() {
    try { runtime.store.command('deleteParticipant', { id: pendingDelete.id }); closeDelete(); }
    catch (error) { setConfirmationError(error.message); }
  }
  function closeDelete() {
    setPendingDelete(null);
    requestAnimationFrame(() => {
      const launcher = modalLauncherRef.current;
      (launcher?.isConnected ? launcher : document.getElementById('project-page-title'))?.focus();
    });
  }
  function cancelSelection() { selectionAttempt.current = null; setChoices({}); setEditingSelection(false); setSelectionError(''); }
  function taskLink(event, next) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); runtime.navigation.navigateTask(next);
  }
  if (task === 'import') return <ParticipantRegistration runtime={runtime} onCancel={onReturn} onSaved={onReturn} />;
  if (task === 'announcement') return <ParticipantAnnouncement runtime={runtime} room={room} onNotice={onNotice} />;
  return <section className="participants-page" aria-label="参加者">
    {!embedded && <h1>参加者</h1>}
    <div className="participant-page-actions">
      <Button id="participant-add" kind={!participantCount && !entries.length ? 'primary' : 'tertiary'} renderIcon={Add} onClick={() => runtime.navigation.navigateTask('import')}>参加者を追加</Button>
      {!!participantCount && !selectionVisible && <Button kind="ghost" onClick={() => setEditingSelection(true)}>参加者を選び直す</Button>}
      {application && <Tag type={confirmed && !editingSelection ? 'green' : 'gray'} size="sm">{saving ? '保存中' : selectionAttempt.current ? '共有保存未完了' : editingSelection ? '選び直し中' : confirmed ? '確定済み' : '未確定'}</Tag>}
    </div>
    {application && selectionVisible && <p className="section-description">応募者 {entries.length}人から参加者を選び、「参加者を確定」を押してください。</p>}
    {!!listRows.length && <>
      <div className="participant-toolbar"><Search id="participant-search" labelText="名前を検索" placeholder="名前を検索" value={search} onChange={event => setSearch(event.target.value)} closeButtonLabelText="検索をクリア" />
        <IconButton kind="ghost" label="絞り込み" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}><SettingsAdjust /></IconButton>
      </div>
      {filtersOpen && <div className="form-grid filter-panel">{[['selected', '選択状態', [['all', 'すべて'], ['selected', '選択済み'], ['unselected', '未選択']]], ['grade', '学年', [['all', 'すべて'], ...[1, 2, 3, 4].map(n => [String(n), `${n}年`])]], ['driver', '車出し', [['all', 'すべて'], ['driver', '車出し可'], ['no-driver', '車出しなし']]]].map(([key, label, options]) => <Select key={key} id={`participant-filter-${key}`} labelText={label} value={filter[key]} onChange={event => setFilter(current => ({ ...current, [key]: event.target.value }))}>{options.map(([value, text]) => <SelectItem key={value} value={value} text={text} />)}</Select>)}</div>}
      <div className="participant-filter-summary"><p role="status">表示 {visible.length}人 / {listRows.length}人</p>{filter.grade !== 'all' && <span>学年: {filter.grade}年</span>}{filter.driver !== 'all' && <span>車出し: {filter.driver === 'driver' ? '可' : 'なし'}</span>}{filter.selected !== 'all' && <span>選択: {filter.selected === 'selected' ? '済み' : '未選択'}</span>}{(search || Object.values(filter).some(value => value !== 'all')) && <Button kind="ghost" size="sm" onClick={() => { setSearch(''); setFilter({ grade: 'all', driver: 'all', selected: 'all' }); }}>条件を解除</Button>}</div>
      {!!visible.length && <ContainedList className="participant-list" label="参加者一覧" size="lg">{visible.map(row => <ContainedListItem className="participant-row" key={row.key} action={<div className="participant-row-actions">{selectionVisible && <Checkbox id={`participant-choice-${row.key}`} disabled={saving || !!selectionAttempt.current} labelText={rowLabel(row)} hideLabel aria-label={rowLabel(row)} checked={checked(row)} onChange={(_, { checked: value }) => setChoices(current => ({ ...current, [row.key]: value }))} />}{row.id && room.participants[row.id] ? <OverflowMenu ref={node => node ? participantMenus.current.set(row.id, node) : participantMenus.current.delete(row.id)} ariaLabel={`${rowLabel(row)}の操作`} iconDescription={`${rowLabel(row)}の操作`} size={isMobile ? 'lg' : 'sm'} flipped><OverflowMenuItem itemText="編集" onClick={() => edit(row.id)} /><OverflowMenuItem hasDivider itemText="削除" isDelete onClick={() => { rememberLauncher(row.id); setConfirmationError(''); setPendingDelete({ id: row.id, name: row.person.name }); }} /></OverflowMenu> : <span />}</div>}>
        <div className="participant-row-copy"><div className="participant-row-title"><strong>{row.person.name}</strong>{row.assignedDriver && <Tag type="gray" size="sm">運転手</Tag>}</div><span className="row-detail">{row.detail}</span></div>
      </ContainedListItem>)}</ContainedList>}
      {!visible.length && <p className="empty-state">{search.trim() ? `“${search.trim()}” に一致する参加者はいません` : '条件に一致する参加者はいません'}</p>}
    </>}
    {!listRows.length && <p className="empty-state">参加者がいません。手動入力または表データから追加できます。</p>}
    {selectionError && <InlineNotification kind="error" title="参加者を更新できませんでした" subtitle={selectionError} hideCloseButton lowContrast />}
    {selectionVisible && <div className="selection-actions" aria-label="参加者の選択" aria-busy={saving}><span>選択 {rows.filter(checked).length}人</span><div className="participant-task-actions"><Button disabled={saving} onClick={requestApply}>{application ? '参加者を確定' : '選択を反映'}</Button><Button disabled={saving} kind="secondary" onClick={cancelSelection}>キャンセル</Button>{saving && <InlineLoading status="active" description="参加者を保存中" />}</div></div>}
    {!!participantCount && !selectionVisible && <section className="participants-next" aria-labelledby="participants-post-confirm-title">
      <h2 id="participants-post-confirm-title">割り当てと共有</h2>
      <div className="participants-next__links">{[['organization-car', '車割へ'], ['organization-team', '班割へ']].map(([section, label]) => <Link key={section} href={runtime.navigation.hrefFor(section)} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); runtime.navigation.navigate(section); } }}>{label}</Link>)}
        {application && <Link id="participant-announcement" href={runtime.navigation.taskHrefFor('announcement')} onClick={event => taskLink(event, 'announcement')}>発表文を作成</Link>}
      </div>
      {application && <><Button kind="ghost" disabled={!runtime.handoffToken} onClick={() => setToolModal('export')}>引き継ぎデータを作成</Button>{!runtime.handoffToken && <p className="participants-next__reason">この端末には作成権限がありません。応募フォーム作成後に表示される「この企画をサークル企画ツールで開く」から開いた端末で作成できます。</p>}</>}
    </section>}
    {editor && <ParticipantEditor runtime={runtime} session={editor} onClose={() => setEditor(null)} onNotice={onNotice} launcherButtonRef={modalLauncherRef} />}
    {pendingSelection && <TaskModal taskId="participant-selection-remove" open danger size="xs" modalHeading="参加者から外しますか？" primaryButtonText="外す" secondaryButtonText="キャンセル" primaryButtonDisabled={saving} secondaryButtonDisabled={saving} onRequestSubmit={() => apply(pendingSelection)} onRequestClose={() => { if (!saving) setPendingSelection(null); }}><p>車割・班割・精算の割り当ても削除されます。応募者データは残ります。</p>{confirmationError && <InlineNotification kind="error" title="参加者を更新できませんでした" subtitle={confirmationError} hideCloseButton lowContrast />}</TaskModal>}
    {pendingDelete && <TaskModal taskId="participant-delete" open danger size="xs" modalHeading="参加者を削除しますか？" primaryButtonText="削除" secondaryButtonText="キャンセル" onRequestSubmit={remove} onRequestClose={closeDelete} launcherButtonRef={modalLauncherRef}><p>{pendingDelete.name}を削除します。車割・班割・精算の割り当ても削除されます。</p>{confirmationError && <InlineNotification kind="error" title="参加者を削除できませんでした" subtitle={confirmationError} hideCloseButton lowContrast />}</TaskModal>}
    {toolModal === 'export' && <ExportModal runtime={runtime} room={room} onNotice={onNotice} onClose={() => setToolModal('')} />}
  </section>;
}
