import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Button, Modal, RadioButton, RadioButtonGroup, Select, SelectItem, Theme, ToastNotification,
} from '@carbon/react';
import { Edit, Time } from '@carbon/icons-react';
import ProjectShell from './components/ProjectShell.jsx';
import ProjectPage from './components/ProjectPage.jsx';
import ProjectOverview from './components/ProjectOverview.jsx';
import ProjectHistorySettings from './components/ProjectHistorySettings.jsx';
import Participants from './components/Participants.jsx';
import Allocation from './components/Allocation.jsx';
import Settlement from './components/Settlement.jsx';
import { BugModal, HistoryModal, OverviewModal } from './components/ProjectTools.jsx';
import { createProjectDomain } from './services/project-domain.js';

const noticeKind = message => /できません|失敗|エラー/.test(message) ? 'error' : /未割り当て|確認してください|選ぶと/.test(message) ? 'warning' : /ました|コピー/.test(message) ? 'success' : 'info';
export default function App({ runtime }) {
  const room = useSyncExternalStore(runtime.store.subscribe, runtime.store.getSnapshot);
  const syncStatus = useSyncExternalStore(runtime.sync.subscribe, runtime.sync.getSnapshot);
  const section = useSyncExternalStore(runtime.navigation.subscribe, runtime.navigation.getSnapshot, () => runtime.initialSection);
  const [theme, setTheme] = useState('g10');
  const [notice, setNotice] = useState('');
  const [globalModal, setGlobalModal] = useState('');
  const [sampleCars, setSampleCars] = useState('3');
  const [sampleType, setSampleType] = useState('normal');
  const previousSection = useRef(section);
  useEffect(() => {
    if (previousSection.current === section) return;
    previousSection.current = section;
    requestAnimationFrame(() => document.getElementById('project-page-title')?.focus());
  }, [section]);
  async function share() {
    try { await navigator.clipboard.writeText(runtime.createShareUrl()); setNotice('リンクをコピーしました'); }
    catch { setNotice('リンクをコピーできませんでした'); }
  }
  function openGlobalModal(name) { setGlobalModal(name); }
  function seedSample(missing = false) {
    const project = createProjectDomain({ getRoom: runtime.store.getSnapshot, settlement: runtime.store.domain.settlement });
    runtime.store.command('restore', { value: project.createSampleAppData({ missing, carCount: Number(sampleCars) }) });
    setGlobalModal('');
    setNotice(missing ? '入力漏れサンプルを入れました' : '通常サンプルを入れました');
  }
  function seedFormLinkedSample() {
    const project = createProjectDomain({ getRoom: runtime.store.getSnapshot, settlement: runtime.store.domain.settlement });
    runtime.store.command('restore', { value: project.createFormLinkedSampleData() });
    setGlobalModal('');
    setNotice('フォーム連携サンプルを入れました');
  }
  function toggleTheme() {
    setTheme(value => value === 'g10' ? 'g100' : 'g10');
  }
  function seedSelectedSample() {
    if (sampleType === 'form') seedFormLinkedSample();
    else seedSample(sampleType === 'missing');
  }
  const participantCount = Object.keys(room.participants || {}).length;
  const page = (() => {
    const sync = syncStatus.kind === 'local' ? [] : [{ label: '同期', value: syncStatus.message }];
    if (section === 'overview') return {
      title: '概要', description: '企画名、メモ、時刻表を確認します。',
      metadata: [{ label: '参加者', value: `${participantCount}人` }, { label: '企画ID', value: runtime.roomId }, ...sync],
      actions: <Button kind="tertiary" renderIcon={Edit} onClick={() => setGlobalModal('overview')}>企画情報を編集</Button>,
      content: <ProjectOverview runtime={runtime} room={room} />,
    };
    if (section === 'participants') return {
      title: '参加者', description: '応募者を確認し、この企画に参加する人を確定します。',
      metadata: [{ label: '参加者', value: `${participantCount}人` }, ...sync],
      content: <Participants runtime={runtime} room={room} onNotice={setNotice} embedded />,
    };
    if (section === 'organization-team') {
      const projection = runtime.store.domain.canonical.projectAllocation(room, 'team');
      return {
        title: '班割', description: '参加者を班へ割り当て、班長と定員を管理します。',
        metadata: [{ label: '未割り当て', value: `${projection.waiting.length}人` }, { label: '班', value: `${projection.cars.length}班` }, ...sync],
        content: <Allocation runtime={runtime} room={room} type="team" onNotice={setNotice} onParticipants={() => runtime.navigation.navigate('participants')} embedded />,
      };
    }
    if (section === 'settlement') return {
      title: '精算', description: '車ごとの距離・費用を入力し、精算額と集金・支払いを確認します。',
      metadata: [{ label: '参加者', value: `${participantCount}人` }, ...sync],
      content: <Settlement runtime={runtime} room={room} onNotice={setNotice} embedded />,
    };
    if (section === 'history-settings') return {
      title: '履歴', description: '企画の状態を保存し、必要なときに以前の状態へ戻します。',
      metadata: [{ label: '保存済み履歴', value: `${runtime.history.read().length}件` }, ...sync],
      actions: <Button kind="tertiary" renderIcon={Time} onClick={() => setGlobalModal('history')}>履歴を開く</Button>,
      content: <ProjectHistorySettings />,
    };
    const projection = runtime.store.domain.canonical.projectAllocation(room, 'car');
    return {
      title: '車割', description: '参加者を車へ割り当て、運転手と定員を管理します。',
      metadata: [{ label: '未割り当て', value: `${projection.waiting.length}人` }, { label: '車', value: `${projection.cars.length}台` }, ...sync],
      content: <Allocation runtime={runtime} room={room} type="car" onNotice={setNotice} onParticipants={() => runtime.navigation.navigate('participants')} embedded />,
    };
  })();
  return <Theme theme={theme} className="application">
    <ProjectShell projectName={room.roomName} roomId={runtime.roomId} section={section} navigation={runtime.navigation} headerProps={{ theme, showSampleData: runtime.sampleDataEnabled, onShare: share, onOpenUtility: openGlobalModal, onToggleTheme: toggleTheme }}>
      <ProjectPage context={room.roomName || '企画名未設定'} title={page.title} description={page.description} metadata={page.metadata} actions={page.actions}>{page.content}</ProjectPage>
    </ProjectShell>
    {globalModal === 'guide' && <Modal className="app-modal" open passiveModal size="md" closeButtonLabel="閉じる" modalHeading="使い方" onRequestClose={() => setGlobalModal('')}>
      <div className="user-guide"><p>企画メニューから、必要な作業を開きます。</p><ul><li><strong>参加者</strong> 応募者を確認し、企画に参加する人を選びます。手動で追加することもできます。</li><li><strong>車割・班割</strong> 確定した参加者を手動またはランダムで割り当てます。</li><li><strong>精算</strong> 各車の距離・費用を入力し、精算額と集金・支払いを確認します。</li></ul><p>概要と履歴は、企画情報の確認・編集や状態の復元が必要なときに使います。共有リンクは右上からコピーできます。</p></div>
    </Modal>}
    {globalModal === 'overview' && <OverviewModal runtime={runtime} room={room} onNotice={setNotice} onClose={() => setGlobalModal('')} />}
    {globalModal === 'history' && <HistoryModal runtime={runtime} onNotice={setNotice} onClose={() => setGlobalModal('')} />}
    {globalModal === 'sample' && <Modal className="app-modal sample-modal" open size="sm" closeButtonLabel="閉じる" modalHeading="サンプルデータ" primaryButtonText="サンプルを入れる" secondaryButtonText="キャンセル" onRequestSubmit={seedSelectedSample} onRequestClose={() => setGlobalModal('')} selectorPrimaryFocus="#sample-normal">
      <div className="sample-form"><p>現在のデータをリセットして、確認用サンプルを入れます。</p><RadioButtonGroup legendText="サンプルの種類" name="sample-type" valueSelected={sampleType} onChange={value => setSampleType(String(value))} orientation="vertical"><RadioButton id="sample-normal" labelText="通常サンプル" value="normal" /><RadioButton id="sample-form" labelText="フォーム連携サンプル" value="form" /><RadioButton id="sample-missing" labelText="入力漏れサンプル" value="missing" /></RadioButtonGroup>{sampleType !== 'form' && <Select id="sample-car-count" labelText="車の数" value={sampleCars} onChange={event => setSampleCars(event.target.value)}>{['2', '3', '4', '5'].map(value => <SelectItem key={value} value={value} text={`${value}台`} />)}</Select>}</div>
    </Modal>}
    {globalModal === 'bug' && <BugModal runtime={runtime} room={room} onNotice={setNotice} onClose={() => setGlobalModal('')} />}
    {notice && <div className="notification-region"><ToastNotification kind={noticeKind(notice)} title={notice} subtitle="" caption="" timeout={2600} onClose={() => { setNotice(''); return true; }} lowContrast /></div>}
  </Theme>;
}
