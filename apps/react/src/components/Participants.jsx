import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button, Checkbox, ContainedList, ContainedListItem, IconButton, Search, Select, SelectItem, Tag, OverflowMenu, OverflowMenuItem, Modal } from '@carbon/react';
import { Add, SettingsAdjust } from '@carbon/icons-react';
import ParticipantEditor from './ParticipantEditor.jsx';
import RegistrationModal from './RegistrationModal.jsx';
import { ExportModal, GuidanceModal } from './ProjectTools.jsx';
import InitialEmptyState from './InitialEmptyState.jsx';
import useMediaQuery from '../hooks/useMediaQuery.js';

function keepConfirmationTabWithinDialog(event) {
  if (event.key !== 'Tab') return;
  const dialog = event.target.closest?.('[role="dialog"]');
  if (!dialog) return;
  const tabbable = [...dialog.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
    .filter(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
  if (!tabbable.length) return;
  const first = tabbable[0];
  const last = tabbable[tabbable.length - 1];
  if (!event.shiftKey && event.target === last) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && event.target === first) {
    event.preventDefault();
    last.focus();
  }
}

export default function Participants({ runtime, room, onNotice, onOpenCountOnlySettlement, openRegistrationRequestId = null, onRegistrationRequestHandled, participantStartRef, roomStatus }) {
  const handoffToken = useSyncExternalStore(runtime.handoffCapability?.subscribe || (() => () => {}), () => runtime.handoffCapability?.getSnapshot().token ?? runtime.handoffToken ?? '');
  const isMobile = useMediaQuery('(max-width: 671px)');
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
  const [composingSearch, setComposingSearch] = useState(false);
  const [resultAnnouncement, setResultAnnouncement] = useState('');
  const [resultRevision, setResultRevision] = useState(0);
  const searchRef = useRef(null);
  const filterTriggerRef = useRef(null);
  const participantsHeadingRef = useRef(null);
  const modalLauncherRef = useRef(null);
  const registrationLauncherRef = useRef(null);
  const lastHandledRegistrationRequest = useRef(0);
  const participantMenuTriggers = useRef(new Map());
  const resultSnapshot = useRef({ conditions: '', visibleCount: 0, total: 0 });
  const applicants = runtime.store.domain.applicants;
  const application = applicants.validApplicationSync(room.meta?.applicationSync) ? room.meta.applicationSync : null;
  const entries = applicants.applicantEntries(application);
  const acceptedIds = new Set(entries.map(([key, applicant]) => runtime.store.participantIdForApplicant(key, applicant)).filter(Boolean));
  const participantCount = Object.keys(room.participants).length;
  const initialEmpty = participantCount === 0 && !application;
  const rows = [
    ...entries.map(([key, applicant]) => {
      const id = runtime.store.participantIdForApplicant(key, applicant);
      return { key: `a:${key}`, responseKey: key, id, person: applicant, driver: applicant.canDrive, assignedDriver: !!(room.participants[id] && room.allocations.car.placements[id]?.driver), detail: applicants.applicantMeta(applicant) };
    }),
    ...Object.entries(room.participants).filter(([id]) => !acceptedIds.has(id)).sort(([, a], [, b]) => a.name.localeCompare(b.name, 'ja')).map(([id, person]) => ({ key: `p:${id}`, id, person, driver: room.allocations.car.placements[id]?.driver, assignedDriver: !!room.allocations.car.placements[id]?.driver, detail: applicants.participantMeta(person) })),
  ];
  const checked = row => Object.hasOwn(choices, row.key) ? choices[row.key] : !!row.id;
  const confirmed = application && Object.keys(room.participants).length > 0;
  const selectionVisible = !confirmed || editingSelection;
  const visible = rows.filter(row => row.person.name.includes(search.trim())
    && (filter.grade === 'all' || String(row.person.grade) === filter.grade)
    && (filter.driver === 'all' || !!row.driver === (filter.driver === 'driver'))
    && (filter.selected === 'all' || checked(row) === (filter.selected === 'selected')));
  const hasApplicantRows = rows.some(row => row.responseKey);
  const activeFilters = [
    ...(search.trim() ? [`検索: ${search.trim()}`] : []),
    ...(filter.grade !== 'all' ? [`学年: ${filter.grade}年`] : []),
    ...(filter.selected !== 'all' ? [`参加者の選択: ${filter.selected === 'selected' ? '選択済み' : '未選択'}`] : []),
    ...(filter.driver !== 'all' ? [`${hasApplicantRows ? '車出し' : '運転手'}: ${filter.driver === 'driver' ? (hasApplicantRows ? 'あり' : '運転手') : (hasApplicantRows ? 'なし' : '運転手以外')}`] : []),
  ];
  const announceConditions = activeFilters.length ? activeFilters.join('、') : 'すべての参加者';
  resultSnapshot.current = { conditions: announceConditions, visibleCount: visible.length, total: rows.length };
  useEffect(() => {
    if (!resultRevision || composingSearch) return undefined;
    const timer = window.setTimeout(() => {
      const latest = resultSnapshot.current;
      setResultAnnouncement(`${latest.conditions}。${latest.total}人中${latest.visibleCount}人を表示しています。`);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [resultRevision, composingSearch]);
  useEffect(() => {
    if (!openRegistrationRequestId || openRegistrationRequestId <= lastHandledRegistrationRequest.current) return;
    lastHandledRegistrationRequest.current = openRegistrationRequestId;
    if (!application) {
      registrationLauncherRef.current = participantStartRef?.current || participantsHeadingRef.current;
      setRegistering(true);
    }
    onRegistrationRequestHandled?.(openRegistrationRequestId);
  }, [openRegistrationRequestId, onRegistrationRequestHandled, application, participantStartRef]);
  function openRegistration(launcher = participantStartRef?.current) {
    registrationLauncherRef.current = launcher || participantsHeadingRef.current;
    setRegistering(true);
  }
  function closeRegistration(saved = false) {
    setRegistering(false);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const candidates = saved
          ? [participantsHeadingRef.current]
          : [participantStartRef?.current, registrationLauncherRef.current, participantsHeadingRef.current];
        const target = candidates.find(element => element?.isConnected && element.getClientRects().length > 0);
        target?.focus();
      });
    });
  }
  function focusAfterClose(target) {
    window.requestAnimationFrame(() => {
      if (target?.isConnected) target.focus();
      else participantsHeadingRef.current?.focus();
    });
  }
  function closeSelectionConfirmation() {
    setPendingSelection(null);
    focusAfterClose(modalLauncherRef.current);
  }
  function closeDeleteConfirmation() {
    setPendingDelete(null);
    focusAfterClose(modalLauncherRef.current);
  }
  function clearFilters() {
    const returnToSearch = !!search.trim();
    setSearch('');
    setFilter({ grade: 'all', driver: 'all', selected: 'all' });
    setResultRevision(value => value + 1);
    window.requestAnimationFrame(() => (returnToSearch ? searchRef : filterTriggerRef).current?.focus());
  }
  function apply(args) {
    const { confirmationText: _confirmationText, ...selectionArgs } = args;
    try { runtime.store.command('applySelection', selectionArgs); setChoices({}); setEditingSelection(false); setPendingSelection(null); onNotice('参加者を更新しました。'); }
    catch (error) { onNotice(error.message); }
  }
  function requestApply() {
    const args = { selectedApplicants: rows.filter(row => row.responseKey && checked(row)).map(row => row.responseKey), selectedManual: rows.filter(row => !row.responseKey && checked(row)).map(row => row.id) };
    const removals = rows.filter(row => row.id && !checked(row));
    if (removals.some(row => applicants.participantHasDependentData(room, row.id))) {
      const ownedGroups = removals.flatMap(row => ['car', 'team'].flatMap(type => {
        const projection = runtime.store.domain.canonical.projectAllocation(room, type);
        const groups = Object.values(room.allocations[type].groups).filter(group => group.ownerId === row.id);
        return groups.map(group => {
          const displayName = projection.cars.find(car => car.groupId === group.id)?.groupDisplayName || (type === 'car' ? '車' : '班');
          const memberCount = Object.values(room.allocations[type].placements).filter(placement => placement.kind === 'member' && placement.groupId === group.id).length;
          return `${row.person.name}が所有する${displayName}も削除され、同じ${type === 'car' ? '車' : '班'}の${memberCount}人は未割り当てに戻ります。`;
        });
      }));
      const names = removals.map(row => row.person.name);
      const confirmationText = `${names.join('、')}を参加者から外します。車割・班割の配置と、紐づく精算情報が更新されます。${ownedGroups.length ? ` ${ownedGroups.join(' ')}` : ''}`;
      setPendingSelection({ ...args, confirmationText });
    } else apply(args);
  }
  function edit(id, launcher) { modalLauncherRef.current = launcher || participantMenuTriggers.current.get(id); setEditor(runtime.store.beginEdit({ kind: 'participant-edit', participantId: id })); }
  function remove() {
    try { modalLauncherRef.current = participantsHeadingRef.current; runtime.store.command('deleteParticipant', { id: pendingDelete.id }); onNotice('参加者を削除しました。'); closeDeleteConfirmation(); }
    catch (error) { onNotice(error.message); }
  }
  return <section className="participants-page" aria-label="参加者">
    {initialEmpty ? <InitialEmptyState headingId="participants-initial-heading" title="参加者を登録して始める" description="参加者を登録すると、車割・班割・精算ができます。" primaryAction={{ label: '参加者を追加', buttonRef: participantStartRef, onClick: event => openRegistration(event.currentTarget) }} alternateAction={{ label: '人数だけで精算', onClick: onOpenCountOnlySettlement }} roomStatus={roomStatus} /> : <>
    <div className="section-heading"><div><h2 id="participants-heading" ref={participantsHeadingRef} tabIndex={-1}>{application ? <>応募者 {entries.length}人　参加者 <span>{participantCount}人</span></> : <>参加者 {participantCount}人</>}</h2></div>
      <div className="inline-actions">{confirmed ? <><Tag type="green" size="sm">{editingSelection ? '選び直し中' : '確定済み'}</Tag><Button kind="ghost" size="sm" onClick={() => setEditingSelection(value => !value)}>{editingSelection ? '選び直しを閉じる' : '参加者を選び直す'}</Button></> : !application && <Button kind="ghost" renderIcon={Add} onClick={event => openRegistration(event.currentTarget)}>参加者を追加</Button>}</div>
    </div>
    {selectionVisible && <>
      {application ? <p className="section-description">企画に参加する人にチェックを入れてください。変更後に「{editingSelection ? '参加者を更新' : '参加者を確定'}」を押します。</p> : participantCount === 0 && <p className="section-description">参加者はまだ登録されていません。「参加者を追加」から名前を登録できます。</p>}
      <div className="participant-toolbar"><Search ref={searchRef} id="participant-search" labelText="名前を検索" placeholder="名前を検索" value={search} onCompositionStart={() => setComposingSearch(true)} onCompositionEnd={() => setComposingSearch(false)} onChange={event => { setSearch(event.target.value); setResultRevision(value => value + 1); }} closeButtonLabelText="検索語を消去" />
        <IconButton ref={filterTriggerRef} kind="ghost" label="絞り込み" aria-expanded={filtersOpen} aria-controls="participant-filter-panel" onClick={() => setFiltersOpen(value => !value)}><SettingsAdjust /></IconButton>
      </div>
      {activeFilters.length > 0 && <div className="participant-filter-summary"><span>絞り込み中: {activeFilters.join('、')}</span><Button kind="ghost" size="sm" onClick={clearFilters}>絞り込みを解除</Button></div>}
      <p className="participant-results-status" role="status" aria-live="polite" aria-atomic="true">{resultAnnouncement}</p>
      <div id="participant-filter-panel" className="form-grid filter-panel" hidden={!filtersOpen}>{[['selected', '参加者の選択', [['all', 'すべて'], ['selected', '選択済み'], ['unselected', '未選択']]], ['grade', '学年', [['all', 'すべて'], ...[1, 2, 3, 4].map(n => [String(n), `${n}年`])]], ['driver', hasApplicantRows ? '車出し' : '運転手', [['all', 'すべて'], ['driver', hasApplicantRows ? 'あり' : '運転手'], ['no-driver', hasApplicantRows ? 'なし' : '運転手以外']]]].map(([key, label, options]) => <Select key={key} id={`participant-filter-${key}`} labelText={label} value={filter[key]} onChange={event => { setFilter(current => ({ ...current, [key]: event.target.value })); setResultRevision(value => value + 1); }}>{options.map(([value, text]) => <SelectItem key={value} value={value} text={text} />)}</Select>)}
        {hasApplicantRows && filter.driver !== 'all' && <p className="participant-filter-help">応募者は車出しの回答、手入力の参加者は運転手設定で絞り込みます。</p>}
      </div>
      {!!rows.length && <ContainedList className="participant-list" label="参加者一覧" size="lg">{visible.map(row => <ContainedListItem className="participant-row" key={row.key} action={<div className="participant-row-actions"><Checkbox id={`participant-choice-${row.key}`} labelText={`${row.person.name}を参加者に含める`} hideLabel checked={checked(row)} onChange={(_, { checked: value }) => setChoices(current => ({ ...current, [row.key]: value }))} />{row.id ? <OverflowMenu ref={node => { if (node) participantMenuTriggers.current.set(row.id, node); }} ariaLabel={`${row.person.name}の操作`} iconDescription={`${row.person.name}の操作`} size={isMobile ? 'lg' : 'sm'} flipped><OverflowMenuItem itemText="編集" onClick={event => edit(row.id, participantMenuTriggers.current.get(row.id), event)} /><OverflowMenuItem hasDivider itemText="削除" isDelete onClick={() => { modalLauncherRef.current = participantMenuTriggers.current.get(row.id); setPendingDelete({ id: row.id, name: row.person.name, confirmationText: `${row.person.name}を参加者から削除します。車割・班割の配置と、この人に紐づく精算情報が変わります.${['car', 'team'].flatMap(type => { const projection = runtime.store.domain.canonical.projectAllocation(room, type); return Object.values(room.allocations[type].groups).filter(group => group.ownerId === row.id).map(group => { const groupName = projection.cars.find(car => car.groupId === group.id)?.groupDisplayName || (type === 'car' ? '車' : '班'); const count = Object.values(room.allocations[type].placements).filter(placement => placement.kind === 'member' && placement.groupId === group.id).length; return ` ${groupName}も削除され、同じ${type === 'car' ? '車' : '班'}の${count}人は未割り当てに戻ります。`; }); }).join('')}` }); }} /></OverflowMenu> : <span />}</div>}>
        <div className="participant-row-copy"><div className="participant-row-title"><span>{row.person.name}</span>{row.assignedDriver && <Tag type="gray" size="sm">運転手</Tag>}</div><span className="row-detail">{row.detail}</span></div>
      </ContainedListItem>)}</ContainedList>}
      {!rows.length && <div className="participants-empty-state">
        <p className="empty-state">参加者はまだ登録されていません。</p>
        {participantCount === 0 && !application && <Button kind="ghost" onClick={onOpenCountOnlySettlement}>人数だけで精算</Button>}
      </div>}
      {!!rows.length && !visible.length && <p className="empty-state">{search.trim() ? `「${search.trim()}」に一致する人はいません。` : '絞り込み条件に一致する人はいません。'}</p>}
      {Object.keys(choices).length > 0 && <div className="selection-actions"><span>選択中 {rows.filter(checked).length}人</span><Button onClick={event => { modalLauncherRef.current = event.currentTarget; requestApply(); }}>{application ? (editingSelection ? '参加者を更新' : '参加者を確定') : '参加者を更新'}</Button></div>}
    </>}
    {application && confirmed && !editingSelection && <section className="participants-post-confirm" aria-labelledby="participants-post-confirm-title">
      <h2 id="participants-post-confirm-title">参加者確定後</h2>
      <div className="participants-post-confirm__actions">
        <div className="participants-post-confirm__item"><div><h3>参加者発表</h3></div><Button kind="ghost" onClick={() => setToolModal('guidance')}>発表文を作成</Button></div>
        <div className="participants-post-confirm__item"><div><h3>学務書類用CSV</h3><p>確定した参加者をCSVで出力します。</p>{!handoffToken && <p className="participants-post-confirm__reason">フォームメーカーの作成結果から「企画ツールを開く」を選んでください。</p>}</div><Button kind="ghost" disabled={!handoffToken} onClick={() => setToolModal('export')}>学務書類用CSVを作成</Button></div>
      </div>
    </section>}
    </>}
    {registering && <RegistrationModal runtime={runtime} room={room} launcherButtonRef={registrationLauncherRef} onClose={closeRegistration} onNotice={onNotice} />}
    {editor && <ParticipantEditor runtime={runtime} session={editor} launcherButtonRef={modalLauncherRef} onClose={() => { const launcher = modalLauncherRef.current; setEditor(null); focusAfterClose(launcher); }} onNotice={onNotice} />}
    {pendingSelection && <Modal className="app-modal" open danger size="xs" closeButtonLabel="閉じる" launcherButtonRef={modalLauncherRef} modalHeading="参加者から外しますか？" primaryButtonText="参加者から外す" secondaryButtonText="キャンセル" onRequestSubmit={() => { modalLauncherRef.current = participantsHeadingRef.current; apply(pendingSelection); }} onRequestClose={closeSelectionConfirmation}><p>{pendingSelection.confirmationText}</p></Modal>}
    {pendingDelete && <Modal className="app-modal" open danger size="xs" closeButtonLabel="閉じる" launcherButtonRef={modalLauncherRef} modalHeading="参加者を削除しますか？" primaryButtonText="参加者を削除" secondaryButtonText="キャンセル" onKeyDownCapture={keepConfirmationTabWithinDialog} onRequestSubmit={remove} onRequestClose={closeDeleteConfirmation}><p>{pendingDelete.confirmationText}</p></Modal>}
    {toolModal === 'guidance' && <GuidanceModal runtime={runtime} room={room} onNotice={onNotice} onClose={() => setToolModal('')} />}
    {toolModal === 'export' && <ExportModal runtime={runtime} room={room} onNotice={onNotice} onClose={() => setToolModal('')} />}
  </section>;
}
