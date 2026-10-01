import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Button, InlineNotification, Link, RadioButton, RadioButtonGroup, Select, SelectItem, Theme, ToastNotification,
} from '@carbon/react';
import { Edit, Time } from '@carbon/icons-react';
import ProjectShell from './components/ProjectShell.jsx';
import ProjectPage from './components/ProjectPage.jsx';
import ProjectOverview from './components/ProjectOverview.jsx';
import ProjectHistorySettings from './components/ProjectHistorySettings.jsx';
import Participants from './components/Participants.jsx';
import Allocation from './components/Allocation.jsx';
import Settlement from './components/Settlement.jsx';
import { BugModal, HistoryModal } from './components/ProjectTools.jsx';
import TaskModal from './components/TaskModal.jsx';
import { createProjectDomain } from './services/project-domain.js';
import { isToastNotice, notice as taskNotice } from './ui/task-contracts.js';
import { allocationView } from './ui/allocation-view.js';

export default function App({ runtime }) {
  const room = useSyncExternalStore(runtime.store.subscribe, runtime.store.getSnapshot);
  const syncStatus = useSyncExternalStore(runtime.sync.subscribe, runtime.sync.getSnapshot);
  const section = useSyncExternalStore(runtime.navigation.subscribe, runtime.navigation.getSnapshot, () => runtime.initialSection);
  const participantTask = useSyncExternalStore(runtime.navigation.subscribe, runtime.navigation.getTaskSnapshot, () => '');
  const allocationDestinationJson = useSyncExternalStore(runtime.navigation.subscribe, runtime.navigation.getAllocationTaskSnapshot, () => '{"type":"","task":"","groupId":"","invalid":false}');
  const allocationDestination = JSON.parse(allocationDestinationJson);
  const [roomResolved, setRoomResolved] = useState(() => !runtime.sync.enqueue || syncStatus.kind === 'connected');
  useEffect(() => { if (syncStatus.kind === 'connected') setRoomResolved(true); }, [syncStatus.kind]);
  const [theme, setTheme] = useState('g10');
  const [feedback, setFeedback] = useState(null);
  const [globalModal, setGlobalModal] = useState('');
  const [overviewEditing, setOverviewEditing] = useState(false);
  const [sampleCars, setSampleCars] = useState('3');
  const [sampleType, setSampleType] = useState('normal');
  const previousSection = useRef(`${section}:${participantTask}:${allocationDestinationJson}`);
  const participantReturnFocus = useRef('');
  const overviewEditButtonRef = useRef(null);
  const overviewReturnFocus = useRef(false);
  useEffect(() => {
    if (overviewEditing || !overviewReturnFocus.current) return;
    overviewReturnFocus.current = false;
    overviewEditButtonRef.current?.focus();
  }, [overviewEditing]);
  useEffect(() => {
    const destination = `${section}:${participantTask}:${allocationDestinationJson}`;
    if (previousSection.current === destination) return;
    previousSection.current = destination;
    setFeedback(null);
    const returnId = participantReturnFocus.current;
    participantReturnFocus.current = '';
    const frame = requestAnimationFrame(() => (document.getElementById(returnId) || document.getElementById('project-page-title'))?.focus());
    return () => cancelAnimationFrame(frame);
  }, [section, participantTask, allocationDestinationJson]);
  function finishParticipantTask() {
    participantReturnFocus.current = participantTask === 'import' ? 'participant-add' : 'participant-announcement';
    runtime.navigation.navigateTask('');
  }
  function finishAllocationTask() {
    const { type, task, groupId } = allocationDestination;
    participantReturnFocus.current = task === 'assign' ? `allocation-assign-${groupId}` : groupId ? `allocation-group-${groupId}` : task === 'presentation' ? 'allocation-presentation' : 'allocation-unassigned';
    runtime.navigation.navigateAllocationTask(type, task === 'assign' ? 'group' : '', task === 'assign' ? groupId : '');
  }
  async function share() {
    try { await navigator.clipboard.writeText(runtime.createShareUrl()); setFeedback(taskNotice.success('リンクをコピーしました', { placement: 'toast' })); }
    catch { setFeedback(taskNotice.error('リンクをコピーできませんでした', { placement: 'toast' })); }
  }
  function openGlobalModal(name) { setGlobalModal(name); }
  function seedSample(missing = false) {
    const project = createProjectDomain({ getRoom: runtime.store.getSnapshot, settlement: runtime.store.domain.settlement });
    runtime.store.command('restore', { value: project.createSampleAppData({ missing, carCount: Number(sampleCars) }) });
    setGlobalModal('');
  }
  function seedFormLinkedSample() {
    const project = createProjectDomain({ getRoom: runtime.store.getSnapshot, settlement: runtime.store.domain.settlement });
    runtime.store.command('restore', { value: project.createFormLinkedSampleData() });
    setGlobalModal('');
  }
  function toggleTheme() {
    setTheme(value => value === 'g10' ? 'g100' : 'g10');
  }
  function seedSelectedSample() {
    if (sampleType === 'form') seedFormLinkedSample();
    else seedSample(sampleType === 'missing');
  }
  function finishOverviewEdit() {
    overviewReturnFocus.current = true;
    setOverviewEditing(false);
  }
  const participantCount = Object.keys(room.participants || {}).length;
  const page = (() => {
    const sync = syncStatus.kind === 'local' ? [] : [{ label: '同期', value: syncStatus.message }];
    if (section === 'overview') return {
      title: '概要', description: '企画名、メモ、時刻表を確認します。',
      metadata: [{ label: '参加者', value: `${participantCount}人` }, { label: '企画ID', value: runtime.roomId }, ...sync],
      actions: !overviewEditing && <Button kind="tertiary" ref={overviewEditButtonRef} renderIcon={Edit} onClick={() => setOverviewEditing(true)}>企画情報を編集</Button>,
      content: <ProjectOverview runtime={runtime} room={room} editing={overviewEditing} onCancel={finishOverviewEdit} onSaved={finishOverviewEdit} />,
    };
    if (section === 'participants') return {
      title: participantTask === 'import' ? '参加者を登録' : participantTask === 'announcement' ? '参加者発表文を作成' : '参加者',
      description: participantTask === 'import' ? '手動入力または表データから参加者を追加します。' : participantTask === 'announcement' ? '参加者を確認し、投稿用の発表文を作成します。' : '応募者を確認し、この企画に参加する人を確定します。',
      metadata: [{ label: '参加者', value: `${participantCount}人` }, ...sync],
      back: participantTask && <Link href={runtime.navigation.taskHrefFor('')} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); finishParticipantTask(); } }}>参加者に戻る</Link>,
      content: <Participants runtime={runtime} room={room} task={participantTask} onReturn={finishParticipantTask} onNotice={setFeedback} embedded />,
    };
    if (section === 'organization-team' || section === 'organization-car') {
      const type = section === 'organization-team' ? 'team' : 'car';
      const view = allocationView(room, type, runtime.store.domain.canonical);
      const group = view.groups.find(g => g.id === allocationDestination.groupId);
      const label = type === 'team' ? '班割' : '車割';
      const task = allocationDestination.task;
      return {
        title: task === 'presentation' ? `${label}の結果` : task === 'unassigned' ? `${label}の未割り当て` : group ? task === 'assign' ? `${group.name}へ割り当て` : group.name : label,
        description: task ? '' : '手動・ランダムで割り当てを作り、当日朝の発表に備えます。',
        metadata: [{ label: '割り当て済み', value: `${view.assignedCount}人` }, { label: '未割り当て', value: `${view.waiting.length}人` }, { label: type === 'team' ? '班' : '車', value: `${view.groups.length}${type === 'team' ? '班' : '台'}` }, ...sync],
        back: task && <Link href={runtime.navigation.allocationTaskHrefFor(type, task === 'assign' && group ? 'group' : '', task === 'assign' && group ? group.id : '')} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); finishAllocationTask(); } }}>{task === 'assign' && group ? `${group.name}に戻る` : `${label}に戻る`}</Link>,
        content: <Allocation key={type} runtime={runtime} room={room} type={type} destination={allocationDestination} resolved={roomResolved} onNotice={setFeedback} onParticipants={() => runtime.navigation.navigate('participants')} />,
      };
    }
    if (section === 'settlement') return {
      title: '精算', description: '車ごとの距離・費用を入力し、精算額と集金・支払いを確認します。',
      metadata: [{ label: '参加者', value: `${participantCount}人` }, ...sync],
      content: <Settlement runtime={runtime} room={room} onNotice={setFeedback} embedded />,
    };
    if (section === 'history-settings') return {
      title: '履歴', description: '企画の状態を保存し、必要なときに以前の状態へ戻します。',
      metadata: [{ label: '保存済み履歴', value: `${runtime.history.read().length}件` }, ...sync],
      actions: <Button kind="tertiary" renderIcon={Time} onClick={() => setGlobalModal('history')}>履歴を開く</Button>,
      content: <ProjectHistorySettings />,
    };
    return { title: '参加者', content: <Participants runtime={runtime} room={room} onNotice={setFeedback} embedded /> };
  })();
  return <Theme theme={theme} className="application">
    <ProjectShell projectName={room.roomName} roomId={runtime.roomId} section={section} navigation={runtime.navigation} headerProps={{ theme, showSampleData: runtime.sampleDataEnabled, onShare: share, onOpenUtility: openGlobalModal, onToggleTheme: toggleTheme }}>
      <ProjectPage
        context={room.roomName || '企画名未設定'}
        title={page.title}
        description={page.description}
        metadata={page.metadata}
        actions={page.actions}
        back={page.back}
        status={feedback && !isToastNotice(feedback) ? <InlineNotification kind={feedback.kind} title={feedback.title} subtitle={feedback.subtitle} lowContrast onClose={() => { setFeedback(null); return true; }} /> : null}
      >{page.content}</ProjectPage>
    </ProjectShell>
    {globalModal === 'guide' && <TaskModal taskId="help-guide" className="app-modal" open passiveModal size="md" closeButtonLabel="閉じる" modalHeading="使い方" onRequestClose={() => setGlobalModal('')}>
      <div className="user-guide"><p>企画メニューから、必要な作業を開きます。</p><ul><li><strong>参加者</strong> 応募者を確認し、企画に参加する人を選びます。手動で追加することもできます。</li><li><strong>車割・班割</strong> 確定した参加者を手動またはランダムで割り当てます。</li><li><strong>精算</strong> 各車の距離・費用を入力し、精算額と集金・支払いを確認します。</li></ul><p>概要と履歴は、企画情報の確認・編集や状態の復元が必要なときに使います。共有リンクは右上からコピーできます。</p></div>
    </TaskModal>}
    {globalModal === 'history' && <HistoryModal runtime={runtime} onNotice={setFeedback} onClose={() => setGlobalModal('')} />}
    {globalModal === 'sample' && <TaskModal taskId="sample-data" className="app-modal sample-modal" open size="sm" closeButtonLabel="閉じる" modalHeading="サンプルデータ" primaryButtonText="サンプルを入れる" secondaryButtonText="キャンセル" onRequestSubmit={seedSelectedSample} onRequestClose={() => setGlobalModal('')} selectorPrimaryFocus="#sample-normal">
      <div className="sample-form"><p>現在のデータをリセットして、確認用サンプルを入れます。</p><RadioButtonGroup legendText="サンプルの種類" name="sample-type" valueSelected={sampleType} onChange={value => setSampleType(String(value))} orientation="vertical"><RadioButton id="sample-normal" labelText="通常サンプル" value="normal" /><RadioButton id="sample-form" labelText="フォーム連携サンプル" value="form" /><RadioButton id="sample-missing" labelText="入力漏れサンプル" value="missing" /></RadioButtonGroup>{sampleType !== 'form' && <Select id="sample-car-count" labelText="車の数" value={sampleCars} onChange={event => setSampleCars(event.target.value)}>{['2', '3', '4', '5'].map(value => <SelectItem key={value} value={value} text={`${value}台`} />)}</Select>}</div>
    </TaskModal>}
    {globalModal === 'bug' && <BugModal runtime={runtime} room={room} onNotice={setFeedback} onClose={() => setGlobalModal('')} />}
    {feedback && isToastNotice(feedback) && <div className="notification-region"><ToastNotification kind={feedback.kind} title={feedback.title} subtitle={feedback.subtitle} caption="" timeout={feedback.timeout} onClose={() => { setFeedback(null); return true; }} lowContrast /></div>}
  </Theme>;
}
