import { useState, useSyncExternalStore } from 'react';
import {
  Column, Grid, Modal, RadioButton, RadioButtonGroup, Select, SelectItem, Theme, Tabs, TabList, Tab,
  TabPanels, TabPanel, TextInput, ToastNotification,
} from '@carbon/react';
import AppHeader from './components/AppHeader.jsx';
import Participants from './components/Participants.jsx';
import Allocation from './components/Allocation.jsx';
import Settlement from './components/Settlement.jsx';
import { BugModal, HistoryModal, OverviewModal } from './components/ProjectTools.jsx';
import { createProjectDomain } from './services/project-domain.js';

const destinations = ['参加者', '車割', '班割', '精算'];
const noticeKind = message => /できません|失敗|エラー/.test(message) ? 'error' : /未割り当て|確認してください|選ぶと/.test(message) ? 'warning' : /ました|コピー/.test(message) ? 'success' : 'info';
export default function App({ runtime }) {
  const room = useSyncExternalStore(runtime.store.subscribe, runtime.store.getSnapshot);
  const syncStatus = useSyncExternalStore(runtime.sync.subscribe, runtime.sync.getSnapshot);
  const [theme, setTheme] = useState('g10');
  const [view, setView] = useState(runtime.initialView ?? 1);
  const [roomName, setRoomName] = useState(null);
  const [notice, setNotice] = useState('');
  const [globalModal, setGlobalModal] = useState('');
  const [sampleCars, setSampleCars] = useState('3');
  const [sampleType, setSampleType] = useState('normal');
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
  function changeView(selectedIndex) {
    setView(selectedIndex);
    const url = new URL(location.href);
    url.searchParams.delete('allocation');
    if (selectedIndex === 0) url.searchParams.set('view', 'participants');
    else if (selectedIndex === 3) url.searchParams.set('view', 'seisan');
    else url.searchParams.delete('view');
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }
  return <Theme theme={theme} className="application">
    <AppHeader theme={theme} onShare={share} onOpenUtility={openGlobalModal} onToggleTheme={toggleTheme} />
    <Grid fullWidth className="project-grid"><Column sm={4} md={8} lg={{ span: 12, start: 3 }} xlg={{ span: 12, start: 3 }} max={{ span: 12, start: 3 }}><section className="project-title" aria-label="企画情報">
      <TextInput id="room-name" labelText="企画名" placeholder="企画名未設定" value={roomName ?? room.roomName} onChange={event => setRoomName(event.target.value)} onBlur={() => { if (roomName !== null) runtime.store.command('rename', { name: roomName }); setRoomName(null); }} />
      {syncStatus.kind !== 'local' && <span className="sync-status" role="status">{syncStatus.message}</span>}
    </section></Column></Grid>
    <Grid fullWidth className="content-grid"><Column sm={4} md={8} lg={{ span: 12, start: 3 }} xlg={{ span: 12, start: 3 }} max={{ span: 12, start: 3 }}><main className="main-content">
      <Tabs selectedIndex={view} onChange={({ selectedIndex }) => changeView(selectedIndex)}>
        <TabList aria-label="画面切り替え" contained fullWidth>{destinations.map(name => <Tab key={name}>{name}</Tab>)}</TabList>
        <TabPanels>
          <TabPanel><Participants runtime={runtime} room={room} onNotice={setNotice} /></TabPanel>
          <TabPanel><Allocation runtime={runtime} room={room} type="car" onNotice={setNotice} onParticipants={() => changeView(0)} /></TabPanel>
          <TabPanel><Allocation runtime={runtime} room={room} type="team" onNotice={setNotice} onParticipants={() => changeView(0)} /></TabPanel>
          <TabPanel><Settlement runtime={runtime} room={room} onNotice={setNotice} /></TabPanel>
        </TabPanels>
      </Tabs>
    </main></Column></Grid>
    {globalModal === 'guide' && <Modal className="app-modal" open passiveModal size="md" closeButtonLabel="閉じる" modalHeading="使い方" onRequestClose={() => setGlobalModal('')}>
      <div className="user-guide"><p>参加者の選択、車割、班割、精算を上部の4つのタブから行います。</p><ol><li><strong>参加者</strong> 応募者を確認し、企画に参加する人を選びます。</li><li><strong>車割</strong> 車と参加者を割り当てます。</li><li><strong>班割</strong> 班と参加者を割り当てます。</li><li><strong>共有</strong> 右上の共有リンクから通常の企画ルームURLをコピーします。</li><li><strong>精算</strong> 設定、車ごとの費用、集金・支払い状況を管理します。</li></ol></div>
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
