import { useState } from 'react';
import { Button, Checkbox, ContainedList, ContainedListItem, IconButton, Search, Select, SelectItem, Tag, OverflowMenu, OverflowMenuItem, Modal } from '@carbon/react';
import { Add, SettingsAdjust } from '@carbon/icons-react';
import ParticipantEditor from './ParticipantEditor.jsx';
import RegistrationModal from './RegistrationModal.jsx';
import { ExportModal, GuidanceModal } from './ProjectTools.jsx';

export default function Participants({ runtime, room, onNotice }) {
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filter, setFilter] = useState({ grade: 'all', driver: 'all', selected: 'all' });
  const [choices, setChoices] = useState({});
  const [editingSelection, setEditingSelection] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [editor, setEditor] = useState(null);
  const [pendingSelection, setPendingSelection] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [toolModal, setToolModal] = useState('');
  const applicants = runtime.store.domain.applicants;
  const application = applicants.validApplicationSync(room.meta?.applicationSync) ? room.meta.applicationSync : null;
  const entries = applicants.applicantEntries(application);
  const acceptedIds = new Set(entries.map(([key, applicant]) => runtime.store.participantIdForApplicant(key, applicant)).filter(Boolean));
  const participantCount = Object.keys(room.participants).length;
  const rows = [
    ...entries.map(([key, applicant]) => ({ key: `a:${key}`, responseKey: key, id: runtime.store.participantIdForApplicant(key, applicant), person: applicant, driver: applicant.canDrive, detail: applicants.applicantMeta(applicant) })),
    ...Object.entries(room.participants).filter(([id]) => !acceptedIds.has(id)).sort(([, a], [, b]) => a.name.localeCompare(b.name, 'ja')).map(([id, person]) => ({ key: `p:${id}`, id, person, driver: room.allocations.car.placements[id]?.driver, detail: applicants.participantMeta(person) })),
  ];
  const checked = row => Object.hasOwn(choices, row.key) ? choices[row.key] : !!row.id;
  const confirmed = application && Object.keys(room.participants).length > 0;
  const selectionVisible = !confirmed || editingSelection;
  const visible = rows.filter(row => row.person.name.includes(search.trim())
    && (filter.grade === 'all' || String(row.person.grade) === filter.grade)
    && (filter.driver === 'all' || !!row.driver === (filter.driver === 'driver'))
    && (filter.selected === 'all' || checked(row) === (filter.selected === 'selected')));
  function apply(args) {
    try { runtime.store.command('applySelection', args); setChoices({}); setEditingSelection(false); setPendingSelection(null); onNotice('参加者を更新しました。'); }
    catch (error) { onNotice(error.message); }
  }
  function requestApply() {
    const args = { selectedApplicants: rows.filter(row => row.responseKey && checked(row)).map(row => row.responseKey), selectedManual: rows.filter(row => !row.responseKey && checked(row)).map(row => row.id) };
    const removals = rows.filter(row => row.id && !checked(row));
    if (removals.some(row => applicants.participantHasDependentData(room, row.id))) setPendingSelection(args);
    else apply(args);
  }
  function edit(id) { setEditor(runtime.store.beginEdit({ kind: 'participant-edit', participantId: id })); }
  function remove() {
    try { runtime.store.command('deleteParticipant', { id: pendingDelete.id }); onNotice('参加者を削除しました。'); setPendingDelete(null); }
    catch (error) { onNotice(error.message); }
  }
  return <section className="participants-page" aria-label="参加者">
    <div className="section-heading"><div><h1>参加者</h1><p>{application ? <>応募者 {entries.length}人　参加者 <strong>{participantCount}人</strong></> : <strong>参加者 {participantCount}人</strong>}</p></div>
      <div className="inline-actions">{confirmed ? <>{!editingSelection && <Tag type="green" size="sm">確定済み</Tag>}<Button kind="ghost" size="sm" onClick={() => setEditingSelection(value => !value)}>{editingSelection ? '編集を閉じる' : '確定解除'}</Button></> : !application && <Button kind="ghost" renderIcon={Add} onClick={() => setRegistering(true)}>追加</Button>}</div>
    </div>
    {selectionVisible && <>
      {application ? <p className="section-description">応募者を確認して、参加者を選んでください。</p> : participantCount === 0 && <p className="section-description">参加者を追加してください。</p>}
      <div className="participant-toolbar"><Search id="participant-search" labelText="名前を検索" placeholder="名前を検索" value={search} onChange={event => setSearch(event.target.value)} closeButtonLabelText="検索をクリア" />
        <IconButton kind="ghost" label="絞り込み" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}><SettingsAdjust /></IconButton>
      </div>
      {filtersOpen && <div className="form-grid filter-panel">{[['selected', '選択状態', [['all', 'すべて'], ['selected', '選択済み'], ['unselected', '未選択']]], ['grade', '学年', [['all', 'すべて'], ...[1, 2, 3, 4].map(n => [String(n), `${n}年`])]], ['driver', '車出し', [['all', 'すべて'], ['driver', '車出し可'], ['no-driver', '車出しなし']]]].map(([key, label, options]) => <Select key={key} id={`participant-filter-${key}`} labelText={label} value={filter[key]} onChange={event => setFilter(current => ({ ...current, [key]: event.target.value }))}>{options.map(([value, text]) => <SelectItem key={value} value={value} text={text} />)}</Select>)}</div>}
      {!!rows.length && <ContainedList className="participant-list" label="参加者一覧" size="lg">{visible.map(row => <ContainedListItem className="participant-row" key={row.key} action={<div className="participant-row-actions"><Checkbox id={`participant-choice-${row.key}`} labelText={row.person.name} hideLabel aria-label={row.person.name} checked={checked(row)} onChange={(_, { checked: value }) => setChoices(current => ({ ...current, [row.key]: value }))} />{row.id ? <OverflowMenu ariaLabel={`${row.person.name}の操作`} iconDescription={`${row.person.name}の操作`} flipped><OverflowMenuItem itemText="編集" onClick={() => edit(row.id)} /><OverflowMenuItem hasDivider itemText="削除" isDelete onClick={() => setPendingDelete({ id: row.id, name: row.person.name })} /></OverflowMenu> : <span />}</div>}>
        <div className="participant-row-copy"><strong>{row.person.name}</strong><span className="row-detail">{row.detail}</span></div>
      </ContainedListItem>)}</ContainedList>}
      {!rows.length && <p className="empty-state">参加者がいません</p>}
      {!!rows.length && !visible.length && <p className="empty-state">{search.trim() ? `“${search.trim()}” に一致する参加者はいません` : '条件に一致する参加者はいません'}</p>}
      {Object.keys(choices).length > 0 && <div className="selection-actions"><span>選択 {rows.filter(checked).length}人</span><Button onClick={requestApply}>{application ? '参加者を確定' : '選択を反映'}</Button></div>}
    </>}
    {application && confirmed && !editingSelection && <section className="participants-post-confirm" aria-labelledby="participants-post-confirm-title">
      <h2 id="participants-post-confirm-title">参加者確定後</h2>
      <div className="participants-post-confirm__actions">
        <div className="participants-post-confirm__item"><div><h3>参加者発表</h3><p>らくらく連絡網に投稿する参加者発表文を作成します。</p></div><Button kind="ghost" onClick={() => setToolModal('guidance')}>発表文を作成</Button></div>
        <div className="participants-post-confirm__item"><div><h3>引き継ぎデータ</h3><p>学務提出書類作成ツールに読み込むための引き継ぎデータを作成します。</p>{!runtime.handoffToken && <p className="participants-post-confirm__reason">この端末には作成権限がありません。応募フォーム作成後に表示される「この企画をサークル企画ツールで開く」から開いた端末で作成できます。</p>}</div><Button kind="ghost" disabled={!runtime.handoffToken} onClick={() => setToolModal('export')}>引き継ぎデータを作成</Button></div>
      </div>
    </section>}
    {registering && <RegistrationModal runtime={runtime} onClose={() => setRegistering(false)} onNotice={onNotice} />}
    {editor && <ParticipantEditor runtime={runtime} session={editor} onClose={() => setEditor(null)} onNotice={onNotice} />}
    {pendingSelection && <Modal open danger size="xs" modalHeading="参加者から外しますか？" primaryButtonText="外す" secondaryButtonText="キャンセル" onRequestSubmit={() => apply(pendingSelection)} onRequestClose={() => setPendingSelection(null)}><p>車割・班割・精算の割り当ても削除されます。</p></Modal>}
    {pendingDelete && <Modal open danger size="xs" modalHeading="参加者を削除しますか？" primaryButtonText="削除" secondaryButtonText="キャンセル" onRequestSubmit={remove} onRequestClose={() => setPendingDelete(null)}><p>{pendingDelete.name}を削除します。車割・班割・精算の割り当ても削除されます。</p></Modal>}
    {toolModal === 'guidance' && <GuidanceModal runtime={runtime} room={room} onNotice={onNotice} onClose={() => setToolModal('')} />}
    {toolModal === 'export' && <ExportModal runtime={runtime} room={room} onNotice={onNotice} onClose={() => setToolModal('')} />}
  </section>;
}
