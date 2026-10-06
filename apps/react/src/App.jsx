import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Button, InlineLoading, InlineNotification, Link, Theme, ToastNotification,
} from '@carbon/react';
import { Edit } from '@carbon/icons-react';
import ProjectShell from './components/ProjectShell.jsx';
import ProjectPage from './components/ProjectPage.jsx';
import ProjectOverview from './components/ProjectOverview.jsx';
import ProjectHistory from './components/history/ProjectHistory.jsx';
import SampleWorkspace from './components/history/SampleWorkspace.jsx';
import Participants from './components/Participants.jsx';
import Allocation from './components/Allocation.jsx';
import Settlement from './components/Settlement.jsx';
import SettlementRules from './components/settlement-rules/SettlementRules.jsx';
import VehicleCosts from './components/vehicle-costs/VehicleCosts.jsx';
import { BugModal } from './components/ProjectTools.jsx';
import TaskModal from './components/TaskModal.jsx';
import { isToastNotice, notice as taskNotice } from './ui/task-contracts.js';
import { allocationView } from './ui/allocation-view.js';
import { createOperationsCache } from './ui/settlement-operations-draft.js';
import { createSettlementOperationController } from './ui/settlement-operation-controller.js';
import { createSettlementMemoController } from './ui/settlement-memo-controller.js';
import { createProjectHistoryController } from './ui/project-history-controller.js';
import { projectSettlementOperations } from './ui/settlement-operations-model.js';
import CollectionWorkspace from './components/settlement-operations/CollectionWorkspace.jsx';
import PaymentWorkspace from './components/settlement-operations/PaymentWorkspace.jsx';
import OperationFeedback, { normalClick } from './components/settlement-operations/OperationFeedback.jsx';

export default function App({ runtime }) {
  const [resources, setResources] = useState(null);
  useEffect(() => {
    // Subscribe only after commit: StrictMode render probes must not create
    // a second live controller or transport observer.
    const cache = createOperationsCache({ roomId: runtime.roomId, storage: () => sessionStorage });
    const controller = createSettlementOperationController({ runtime, cache });
    const memoController = createSettlementMemoController({ runtime, operations: controller, cache });
    const historyController = createProjectHistoryController({ runtime, operations: controller, rawStorage: () => localStorage });
    setResources({ runtime, cache, controller, memoController, historyController });
    void controller.observe();
    return () => { historyController.dispose(); memoController.dispose(); controller.dispose(); };
  }, [runtime]);
  if (resources?.runtime !== runtime) return <InlineLoading description="企画を開いています" />;
  return <Application runtime={runtime} resources={resources} />;
}

function Application({ runtime, resources: { cache, controller, memoController, historyController } }) {
  const room = useSyncExternalStore(runtime.store.subscribe, runtime.store.getSnapshot);
  const operationSnapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const historySnapshot = useSyncExternalStore(historyController.subscribe, historyController.getSnapshot);
  const operationsView = projectSettlementOperations({ room, domain: runtime.store.domain, operation: operationSnapshot.operation });
  const syncStatus = useSyncExternalStore(runtime.sync.subscribe, runtime.sync.getSnapshot);
  const section = useSyncExternalStore(runtime.navigation.subscribe, runtime.navigation.getSnapshot, () => runtime.initialSection);
  const participantTask = useSyncExternalStore(runtime.navigation.subscribe, runtime.navigation.getTaskSnapshot, () => '');
  const allocationDestinationJson = useSyncExternalStore(runtime.navigation.subscribe, runtime.navigation.getAllocationTaskSnapshot, () => '{"type":"","task":"","groupId":"","invalid":false}');
  const allocationDestination = JSON.parse(allocationDestinationJson);
  const vehicleDestinationJson = useSyncExternalStore(runtime.navigation.subscribe, runtime.navigation.getVehicleCostTaskSnapshot);
  const vehicleDestination = JSON.parse(vehicleDestinationJson);
  const settlementDestinationJson = useSyncExternalStore(runtime.navigation.subscribe, runtime.navigation.getSettlementTaskSnapshot);
  const settlementDestination = JSON.parse(settlementDestinationJson);
  const historyDestinationJson = useSyncExternalStore(runtime.navigation.subscribe, runtime.navigation.getHistoryTaskSnapshot);
  const historyDestination = JSON.parse(historyDestinationJson);
  const [rulesPage, setRulesPage] = useState(null);
  const [rulesEntryProblem, setRulesEntryProblem] = useState('');
  const changeRulesPage = useCallback(value => setRulesPage(current => JSON.stringify(current) === JSON.stringify({ key: settlementDestinationJson, ...value }) ? current : { key: settlementDestinationJson, ...value }), [settlementDestinationJson]);
  const [vehiclePage, setVehiclePage] = useState(null);
  const changeVehiclePage = useCallback(value => setVehiclePage(current => JSON.stringify(current) === JSON.stringify({key:vehicleDestinationJson,...value}) ? current : {key:vehicleDestinationJson,...value}), [vehicleDestinationJson]);
  const [roomResolved, setRoomResolved] = useState(() => !runtime.sync.enqueue || syncStatus.kind === 'connected');
  useEffect(() => { if (syncStatus.kind === 'connected') setRoomResolved(true); }, [syncStatus.kind]);
  const rulesResolved = roomResolved || syncStatus.kind === 'error' && !!runtime.storage.read('base');
  useEffect(() => {
    if (historyDestination.task === 'sample' && !runtime.sampleDataEnabled || roomResolved && historyDestination.invalid) runtime.navigation.replaceHistoryTask('');
  }, [historyDestination.task, historyDestination.invalid, roomResolved, runtime]);
  useEffect(() => {
    if (rulesResolved && settlementDestination.invalid) { setRulesEntryProblem('指定された精算画面が見つかりません。精算ルールはここから開けます。'); runtime.navigation.replaceSettlementTask(''); }
    else if (settlementDestination.task === 'rules') setRulesEntryProblem('');
  }, [rulesResolved, settlementDestination.invalid, settlementDestination.task, runtime]);
  const [theme, setTheme] = useState('g10');
  const [feedback, setFeedback] = useState(null);
  const [globalModal, setGlobalModal] = useState('');
  const [overviewEditing, setOverviewEditing] = useState(false);
  const previousSection = useRef(`${section}:${participantTask}:${allocationDestinationJson}:${vehicleDestinationJson}:${settlementDestinationJson}:${historyDestinationJson}`);
  const participantReturnFocus = useRef('');
  const overviewEditButtonRef = useRef(null);
  const overviewReturnFocus = useRef(false);
  useEffect(() => {
    if (overviewEditing || !overviewReturnFocus.current) return;
    overviewReturnFocus.current = false;
    overviewEditButtonRef.current?.focus();
  }, [overviewEditing]);
  useLayoutEffect(() => {
    const destination = `${section}:${participantTask}:${allocationDestinationJson}:${vehicleDestinationJson}:${settlementDestinationJson}:${historyDestinationJson}`;
    if (previousSection.current === destination) return;
    previousSection.current = destination;
    setFeedback(null);
    const returnId = participantReturnFocus.current;
    participantReturnFocus.current = '';
    // Commit focus with the destination DOM, before the next user input.
    // A queued animation frame could steal focus after fast WebKit typing.
    (document.getElementById(returnId) || document.getElementById('project-page-title'))?.focus();
  }, [section, participantTask, allocationDestinationJson, vehicleDestinationJson, settlementDestinationJson, historyDestinationJson]);
  const returnFromRules = useCallback(({ focusId }) => { participantReturnFocus.current = focusId; runtime.navigation.navigateSettlementTask(''); }, [runtime]);
  function returnFromMoney(task) {
    participantReturnFocus.current = task === 'collection' ? 'settlement-collection-entry' : 'settlement-payments-entry';
    runtime.navigation.navigateSettlementTask('');
  }
  function returnFromVehicle({destination, focusId}) {
    participantReturnFocus.current = focusId;
    if (destination.section === 'organization-car') runtime.navigation.navigateAllocationTask('car','group',destination.groupId);
    else if (destination.section === 'vehicle-costs' && destination.carKey) {
      const changed=runtime.navigation.navigateVehicleCostTask(destination);
      if (!changed) { participantReturnFocus.current=''; requestAnimationFrame(()=>document.getElementById(focusId)?.focus()); }
    }
    else if(destination.section === 'settlement') runtime.navigation.navigateSettlementTask('payments');
    else runtime.navigation.navigate(destination.section);
  }
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
  function openGlobalModal(name) { if (name === 'history') runtime.navigation.navigate('history-settings'); else setGlobalModal(name); }
  function toggleTheme() {
    setTheme(value => value === 'g10' ? 'g100' : 'g10');
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
        metadata: group ? [{ label: '人数', value: `${group.peopleCount}人 / 上限${group.totalLimit}人` }, { label: '空き', value: `${group.vacancies}人` }, { label: '未割り当て', value: `${view.waiting.length}人` }, ...sync] : [{ label: '割り当て済み', value: `${view.assignedCount}人` }, { label: '未割り当て', value: `${view.waiting.length}人` }, { label: type === 'team' ? '班' : '車', value: `${view.groups.length}${type === 'team' ? '班' : '台'}` }, ...sync],
        back: task && <Link href={runtime.navigation.allocationTaskHrefFor(type, task === 'assign' && group ? 'group' : '', task === 'assign' && group ? group.id : '')} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); finishAllocationTask(); } }}>{task === 'assign' && group ? `${group.name}に戻る` : `${label}に戻る`}</Link>,
        content: <Allocation key={type} runtime={runtime} room={room} type={type} destination={allocationDestination} resolved={roomResolved} onNotice={setFeedback} onParticipants={() => runtime.navigation.navigate('participants')} />,
      };
    }
    if (section === 'vehicle-costs') return {
      title:'車両費用',description:'対象車を選び、距離・費用を入力します。',
      ...(vehiclePage?.key === vehicleDestinationJson && vehicleDestination.carKey ? vehiclePage : {}),
      metadata:[...(vehiclePage?.key === vehicleDestinationJson && vehicleDestination.carKey ? vehiclePage.metadata || [] : []),...sync],
      content:<VehicleCosts runtime={runtime} room={room} resolved={roomResolved || syncStatus.kind === 'error' && !!runtime.storage.read('base')} destination={vehicleDestination} onPageChange={changeVehiclePage} onReturn={returnFromVehicle} />,
    };
    if (section === 'settlement' && settlementDestination.task === 'rules') return {
      title: '精算ルール', description: '負担と集金の扱いを設定し、計算への影響を確認します。',
      metadata: [...(rulesPage?.key === settlementDestinationJson ? rulesPage.metadata || [] : []), ...sync],
      back: <Link href={runtime.navigation.settlementTaskHrefFor('')} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); returnFromRules({ focusId: 'settlement-rules-entry', reason: 'back' }); } }}>精算に戻る</Link>,
      content: <SettlementRules runtime={runtime} room={room} resolved={rulesResolved} destination={settlementDestination} onPageChange={changeRulesPage} onReturn={returnFromRules} />,
    };
    if (section === 'settlement' && ['collection', 'payments'].includes(settlementDestination.task)) {
      const task = settlementDestination.task;
      return {
        title: task === 'collection' ? '集金' : '支払い',
        description: task === 'collection' ? '実際に集金した人を記録し、未集金者を確認します。' : '車単位で支払いを記録し、未払いと内訳を確認します。',
        metadata: sync,
        back: <Link href={runtime.navigation.settlementTaskHrefFor('')} onClick={event => { if (normalClick(event)) { event.preventDefault(); returnFromMoney(task); } }}>精算へ戻る</Link>,
        content: <><OperationFeedback controller={controller} snapshot={operationSnapshot} />{task === 'collection' ? <CollectionWorkspace runtime={runtime} view={operationsView} controller={controller} snapshot={operationSnapshot} cache={cache} /> : <PaymentWorkspace runtime={runtime} view={operationsView} controller={controller} snapshot={operationSnapshot} cache={cache} />}</>,
      };
    }
    if (section === 'settlement') return {
      title: '精算', description: '車ごとの距離・費用を入力し、精算額と集金・支払いを確認します。',
      metadata: [{ label: '参加者', value: `${participantCount}人` }, ...sync],
      content: <>{rulesEntryProblem && <InlineNotification kind="error" title={rulesEntryProblem} hideCloseButton lowContrast />}<OperationFeedback controller={controller} snapshot={operationSnapshot} /><Settlement runtime={runtime} room={room} view={operationsView} memoController={memoController} /></>,
    };
    if (section === 'history-settings' && historyDestination.task === 'sample' && runtime.sampleDataEnabled) return {
      title: 'サンプルデータ', description: 'ローカル環境の企画を確認用データで置き換えます。', metadata: sync,
      back: <Link href={runtime.navigation.historyTaskHrefFor('')} onClick={event => { if (normalClick(event)) { event.preventDefault(); participantReturnFocus.current = 'history-sample-entry'; runtime.navigation.navigateHistoryTask(''); } }}>履歴へ戻る</Link>,
      content: <><OperationFeedback controller={controller} snapshot={operationSnapshot} /><SampleWorkspace runtime={runtime} room={room} controller={controller} snapshot={operationSnapshot} /></>,
    };
    if (section === 'history-settings') return {
      title: '履歴', description: '企画の状態を保存し、必要なときに以前の状態へ戻します。',
      metadata: [...(historySnapshot.loadIssue ? [] : [{ label: 'この端末の履歴', value: `${historySnapshot.items.length}件` }]), ...sync],
      actions: <Button kind="tertiary" disabled={historySnapshot.blocked} onClick={() => historyController.saveSnapshot()}>現在の状態を保存</Button>,
      content: <><OperationFeedback controller={controller} snapshot={operationSnapshot} /><ProjectHistory runtime={runtime} controller={historyController} /></>,
    };
    return { title: '参加者', content: <Participants runtime={runtime} room={room} onNotice={setFeedback} embedded /> };
  })();
  return <Theme theme={theme} className="application">
    <ProjectShell projectName={room.roomName} roomId={runtime.roomId} section={section} navigation={runtime.navigation} headerProps={{ theme, onShare: share, onOpenUtility: openGlobalModal, onToggleTheme: toggleTheme }}>
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
    {globalModal === 'bug' && <BugModal runtime={runtime} room={room} onNotice={setFeedback} onClose={() => setGlobalModal('')} />}
    {feedback && isToastNotice(feedback) && <div className="notification-region"><ToastNotification kind={feedback.kind} title={feedback.title} subtitle={feedback.subtitle} caption="" timeout={feedback.timeout} onClose={() => { setFeedback(null); return true; }} lowContrast /></div>}
  </Theme>;
}
