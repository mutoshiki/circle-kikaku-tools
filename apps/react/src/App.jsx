import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Button, InlineNotification, Modal, RadioButton, RadioButtonGroup, Select, SelectItem, Theme, ToastNotification,
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
import { createProjectDomain } from './services/project-domain.js';
import { isToastNotice, notice as taskNotice } from './ui/task-contracts.js';

export default function App({ runtime }) {
  const room = useSyncExternalStore(runtime.store.subscribe, runtime.store.getSnapshot);
  const syncStatus = useSyncExternalStore(runtime.sync.subscribe, runtime.sync.getSnapshot);
  const section = useSyncExternalStore(runtime.navigation.subscribe, runtime.navigation.getSnapshot, () => runtime.initialSection);
  const [theme, setTheme] = useState('g10');
  const [feedback, setFeedback] = useState(null);
  const [globalModal, setGlobalModal] = useState('');
  const [overviewEditing, setOverviewEditing] = useState(false);
  const [sampleCars, setSampleCars] = useState('3');
  const [sampleType, setSampleType] = useState('normal');
  const previousSection = useRef(section);
  const overviewEditButtonRef = useRef(null);
  useEffect(() => {
    if (previousSection.current === section) return;
    previousSection.current = section;
    setFeedback(null);
    requestAnimationFrame(() => document.getElementById('project-page-title')?.focus());
  }, [section]);
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
    setOverviewEditing(false);
    requestAnimationFrame(() => overviewEditButtonRef.current?.focus());
  }
  const participantCount = Object.keys(room.participants || {}).length;
  const page = (() => {
    const sync = syncStatus.kind === 'local' ? [] : [{ label: '同期', value: syncStatus.message }];
    if (section === 'overview') return {
      title: '概要', description: '企画の基本情報と現在の準備状況を確認します。',
      metadata: [{ label: '参加者', value: `${participantCount}人` }, { label: '企画ID', value: runtime.roomId }, ...sync],
      actions: !overviewEditing && <Button ref={overviewEditButtonRef} renderIcon={Edit} onClick={() => setOverviewEditing(true)}>企画情報を編集</Button>,
      content: <ProjectOverview runtime={runtime} room={room} editing={overviewEditing} onCancel={finishOverviewEdit} onSaved={finishOverviewEdit} />,
    };
    if (section === 'participants') return {
      title: '参加者', description: '応募者を確認し、この企画に参加する人を確定します。',
      metadata: [{ label: '参加者', value: `${participantCount}人` }, ...sync],
      content: <Participants runtime={runtime} room={room} onNotice={setFeedback} embedded />,
    };
    if (section === 'organization-team') {
      const projection = runtime.store.domain.canonical.projectAllocation(room, 'team');
      return {
        title: '班割', description: '参加者を班へ割り当て、班長と定員を管理します。',
        metadata: [{ label: '未割り当て', value: `${projection.waiting.length}人` }, { label: '班', value: `${projection.cars.length}班` }, ...sync],
        content: <Allocation runtime={runtime} room={room} type="team" onNotice={setFeedback} onParticipants={() => runtime.navigation.navigate('participants')} embedded />,
      };
    }
    if (section === 'settlement') return {
      title: '精算', description: '企画後の費用、集金、運転手への支払い状況を管理します。',
      metadata: [{ label: '参加者', value: `${participantCount}人` }, ...sync],
      content: <Settlement runtime={runtime} room={room} onNotice={setFeedback} embedded />,
    };
    if (section === 'history-settings') return {
      title: '履歴と設定', description: '企画の復元ポイントと共通設定を管理します。',
      metadata: [{ label: '保存済み履歴', value: `${runtime.history.read().length}件` }, ...sync],
      actions: <Button kind="tertiary" renderIcon={Time} onClick={() => setGlobalModal('history')}>履歴を開く</Button>,
      content: <ProjectHistorySettings />,
    };
    const projection = runtime.store.domain.canonical.projectAllocation(room, 'car');
    return {
      title: '車割', description: '参加者を車へ割り当て、運転手と定員を管理します。',
      metadata: [{ label: '未割り当て', value: `${projection.waiting.length}人` }, { label: '車', value: `${projection.cars.length}台` }, ...sync],
      content: <Allocation runtime={runtime} room={room} type="car" onNotice={setFeedback} onParticipants={() => runtime.navigation.navigate('participants')} embedded />,
    };
  })();
  return <Theme theme={theme} className="application">
    <ProjectShell projectName={room.roomName} roomId={runtime.roomId} section={section} navigation={runtime.navigation} headerProps={{ theme, showSampleData: runtime.sampleDataEnabled, onShare: share, onOpenUtility: openGlobalModal, onToggleTheme: toggleTheme }}>
      <ProjectPage
        context={room.roomName || '企画名未設定'}
        title={page.title}
        description={page.description}
        metadata={page.metadata}
        actions={page.actions}
        status={feedback && !isToastNotice(feedback) ? <InlineNotification kind={feedback.kind} title={feedback.title} subtitle={feedback.subtitle} lowContrast onClose={() => { setFeedback(null); return true; }} /> : null}
      >{page.content}</ProjectPage>
    </ProjectShell>
    {globalModal === 'guide' && <Modal className="app-modal" open passiveModal size="md" closeButtonLabel="閉じる" modalHeading="使い方" onRequestClose={() => setGlobalModal('')}>
      <div className="user-guide"><p>企画メニューから、準備の段階に合わせて作業を進めます。</p><ol><li><strong>概要</strong> 企画名、メモ、時刻表を確認します。</li><li><strong>参加者</strong> 応募者を確認し、企画に参加する人を選びます。</li><li><strong>運営準備</strong> 車割と班割を管理します。</li><li><strong>共有</strong> 右上の共有リンクから通常の企画ルームURLをコピーします。</li><li><strong>精算</strong> 設定、車ごとの費用、集金・支払い状況を管理します。</li></ol></div>
    </Modal>}
    {globalModal === 'history' && <HistoryModal runtime={runtime} onNotice={setFeedback} onClose={() => setGlobalModal('')} />}
    {globalModal === 'sample' && <Modal className="app-modal sample-modal" open size="sm" closeButtonLabel="閉じる" modalHeading="サンプルデータ" primaryButtonText="サンプルを入れる" secondaryButtonText="キャンセル" onRequestSubmit={seedSelectedSample} onRequestClose={() => setGlobalModal('')} selectorPrimaryFocus="#sample-normal">
      <div className="sample-form"><p>現在のデータをリセットして、確認用サンプルを入れます。</p><RadioButtonGroup legendText="サンプルの種類" name="sample-type" valueSelected={sampleType} onChange={value => setSampleType(String(value))} orientation="vertical"><RadioButton id="sample-normal" labelText="通常サンプル" value="normal" /><RadioButton id="sample-form" labelText="フォーム連携サンプル" value="form" /><RadioButton id="sample-missing" labelText="入力漏れサンプル" value="missing" /></RadioButtonGroup>{sampleType !== 'form' && <Select id="sample-car-count" labelText="車の数" value={sampleCars} onChange={event => setSampleCars(event.target.value)}>{['2', '3', '4', '5'].map(value => <SelectItem key={value} value={value} text={`${value}台`} />)}</Select>}</div>
    </Modal>}
    {globalModal === 'bug' && <BugModal runtime={runtime} room={room} onNotice={setFeedback} onClose={() => setGlobalModal('')} />}
    {feedback && isToastNotice(feedback) && <div className="notification-region"><ToastNotification kind={feedback.kind} title={feedback.title} subtitle={feedback.subtitle} caption="" timeout={feedback.timeout} onClose={() => { setFeedback(null); return true; }} lowContrast /></div>}
  </Theme>;
}
