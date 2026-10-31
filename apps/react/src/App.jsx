import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Button, Column, Grid, Modal, RadioButton, RadioButtonGroup, Select, SelectItem, Theme, Tabs, TabList, Tab,
  TabPanels, TabPanel, ToastNotification,
} from '@carbon/react';
import AppHeader from './components/AppHeader.jsx';
import ProjectIdentity from './components/ProjectIdentity.jsx';
import Participants from './components/Participants.jsx';
import Allocation from './components/Allocation.jsx';
import Settlement from './components/Settlement.jsx';
import SettlementSettingsModal from './components/SettlementSettingsModal.jsx';
import { BugModal, HistoryModal, OverviewModal } from './components/ProjectTools.jsx';
import { createProjectDomain } from './services/project-domain.js';
import { createDebugSampleProject } from './services/debug-sample-project.js';
import { beginSettlementEdit } from './components/settlement/edit.js';
import { ToolManager, ExternalToolWorkspace } from './components/ProjectToolsWorkspace.jsx';
import { resolveWorkspaceSelection, requestedToolFromView, workspaceTabs } from './services/project-workspace-routing.js';
import { TOOL_REGISTRY } from './services/project-workspace.js';

const legacyToolIds = ['participants', 'car', 'team', 'settlement'];
const optionalTools = TOOL_REGISTRY.filter(tool => !tool.system);
const THEME_PREFERENCE_KEY = 'sanpo-react:theme-preference:v1';
function readThemePreference() {
  try {
    const preference = localStorage.getItem(THEME_PREFERENCE_KEY);
    return preference === 'light' || preference === 'dark' ? preference : 'system';
  } catch { return 'system'; }
}
function readSystemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'g100' : 'g10';
}
const noticeKind = message => /できません|失敗|エラー/.test(message) ? 'error' : /未割り当て|確認してください|選ぶと/.test(message) ? 'warning' : /ました|コピー/.test(message) ? 'success' : 'info';
export default function App({ runtime }) {
  const room = useSyncExternalStore(runtime.store.subscribe, runtime.store.getSnapshot);
  const syncStatus = useSyncExternalStore(runtime.sync.subscribe, runtime.sync.getSnapshot);
  const workspaceSnapshot = useSyncExternalStore(runtime.workspace.subscribe, runtime.workspace.getSnapshot);
  const projectSetup = useSyncExternalStore(runtime.projectSetup.subscribe, runtime.projectSetup.getSnapshot);
  const [themePreference, setThemePreference] = useState(readThemePreference);
  const [systemTheme, setSystemTheme] = useState(readSystemTheme);
  const theme = themePreference === 'system' ? systemTheme : themePreference === 'dark' ? 'g100' : 'g10';
  const contentTheme = theme === 'g100' ? 'g90' : 'g10';
  const [activeToolId, setActiveToolId] = useState(() => requestedToolFromView(new URL(location.href).searchParams.get('view')) || legacyToolIds[runtime.initialView ?? 3] || 'settlement');
  const [visitedToolIds, setVisitedToolIds] = useState(() => new Set([requestedToolFromView(new URL(location.href).searchParams.get('view')) || legacyToolIds[runtime.initialView ?? 3] || 'settlement', 'tools']));
  const legacyEntry = new URL(location.href).searchParams.get('legacy') === '1';
  const [toolsPanelId, setToolsPanelId] = useState(null);
  const standaloneMode = room.settlement?.standalone?.enabled === true;
  const availableTabs = workspaceTabs(workspaceSnapshot.workspace);
  const tabs = legacyEntry
    ? legacyToolIds.map(id => ({ id, label: ({ participants: '参加者', car: '車割', team: '班割', settlement: '精算' })[id], view: id === 'settlement' ? 'seisan' : id }))
    : standaloneMode
      ? [TOOL_REGISTRY.find(tool => tool.id === 'settlement'), availableTabs.find(tool => tool.id === 'tools')].filter(Boolean)
      : availableTabs;
  const selection = resolveWorkspaceSelection(workspaceSnapshot.workspace, activeToolId);
  const selectedIndex = Math.max(0, tabs.findIndex(tool => tool.id === selection.tabId));
  const selectedTabId = tabs[selectedIndex]?.id || 'tools';
  useEffect(() => {
    setVisitedToolIds(current => {
      if (current.has(selectedTabId) && (!selection.toolId || current.has(selection.toolId))) return current;
      const next = new Set(current);
      next.add(selectedTabId);
      if (selection.toolId) next.add(selection.toolId);
      return next;
    });
    if (selection.toolId && !toolsPanelId) setToolsPanelId(selection.toolId);
  }, [selectedTabId, selection.toolId, toolsPanelId]);
  const [notice, setNotice] = useState('');
  const [noticeTimeout, setNoticeTimeout] = useState(2600);
  const pendingResetNotice = useRef(null);
  function showNotice(message) {
    if (pendingResetNotice.current) return;
    setNoticeTimeout(2600);
    setNotice(message);
  }
  const [countOnlySettlementRequest, setCountOnlySettlementRequest] = useState(null);
  const countOnlySettlementRequestId = useRef(0);
  const [participantRegistrationRequest, setParticipantRegistrationRequest] = useState(null);
  const participantRegistrationRequestId = useRef(0);
  const participantStartRef = useRef(null);
  const [settlementSettingsEdit, setSettlementSettingsEdit] = useState(null);
  const [settlementSettingsLauncher, setSettlementSettingsLauncher] = useState(null);
  const [globalModal, setGlobalModal] = useState('');
  const [sampleCars, setSampleCars] = useState('3');
  const [sampleType, setSampleType] = useState('normal');
  useEffect(() => runtime.store.subscribeIntents(intent => {
    const resets = intent.randomizationResets?.filter(change => change.type === 'car' || change.type === 'team') || [];
    if (!resets.length) return;
    const reasons = new Set(resets.map(change => change.reason));
    const types = new Set(resets.map(change => change.type));
    const reasonLabel = reasons.has('participants') ? '参加者' : reasons.has('fixed') ? '固定設定' : reasons.has('capacity') ? '定員' : '割り当て条件';
    const typesLabel = [...types].map(type => type === 'car' ? '車割' : '班割').join('・');
    const message = `${typesLabel}：${reasonLabel}が変わったため、ランダム割り当ての実行回数を0に戻しました。`;
    pendingResetNotice.current = message;
    setNoticeTimeout(8000);
    setNotice(message);
    queueMicrotask(() => { setNotice(message); pendingResetNotice.current = null; });
  }), [runtime]);
  async function share() {
    try { await navigator.clipboard.writeText(runtime.createShareUrl()); showNotice('企画のリンクをコピーしました。'); }
    catch { showNotice('リンクをコピーできませんでした'); }
  }
  function openGlobalModal(name) { setGlobalModal(name); }
  function seedSample(missing = false) {
    const project = createProjectDomain({ getRoom: runtime.store.getSnapshot, settlement: runtime.store.domain.settlement });
    runtime.store.command('restore', { value: project.createSampleAppData({ missing, carCount: Number(sampleCars) }), source: 'sample' });
    setGlobalModal('');
    showNotice(missing ? '未入力項目があるサンプルに置き換えました。' : '通常のサンプルに置き換えました。');
  }
  function seedFormLinkedSample() {
    const project = createProjectDomain({ getRoom: runtime.store.getSnapshot, settlement: runtime.store.domain.settlement });
    runtime.store.command('restore', { value: project.createFormLinkedSampleData(), source: 'sample' });
    setGlobalModal('');
    showNotice('フォーム連携のサンプルに置き換えました。');
  }
  function resetDebugSample() {
    if (!runtime.debugSample) return;
    const project = createProjectDomain({ getRoom: runtime.store.getSnapshot, settlement: runtime.store.domain.settlement });
    runtime.store.command('restore', { value: createDebugSampleProject({ projectDomain: project, now: Date.now() }), source: 'debug-sample' });
    window.dispatchEvent(new CustomEvent('sanpo:debug-sample-reset', { detail: { roomId: runtime.roomId } }));
    showNotice('デバッグ用サンプルを初期状態に戻しました。');
  }
  useEffect(() => {
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = event => setSystemTheme(event.matches ? 'g100' : 'g10');
    const updateStoredPreference = event => {
      if (event.key === THEME_PREFERENCE_KEY || event.key === null) setThemePreference(readThemePreference());
    };
    colorScheme.addEventListener('change', updateSystemTheme);
    window.addEventListener('storage', updateStoredPreference);
    return () => {
      colorScheme.removeEventListener('change', updateSystemTheme);
      window.removeEventListener('storage', updateStoredPreference);
    };
  }, []);
  function updateThemePreference(preference) {
    try {
      if (preference === 'system') localStorage.removeItem(THEME_PREFERENCE_KEY);
      else localStorage.setItem(THEME_PREFERENCE_KEY, preference);
    } catch { /* Theme selection remains available when browser storage is disabled. */ }
    setThemePreference(preference);
  }
  function toggleTheme() {
    updateThemePreference(theme === 'g10' ? 'dark' : 'light');
  }
  function useSystemTheme() {
    updateThemePreference('system');
  }
  function seedSelectedSample() {
    if (sampleType === 'reset') {
      runtime.store.command('restore', { value: runtime.store.domain.canonical.emptyRoom(), source: 'reset' });
      setGlobalModal('');
      showNotice('企画データを空にしました。');
      return;
    }
    if (sampleType === 'form') seedFormLinkedSample();
    else seedSample(sampleType === 'missing');
  }
  function changeView(nextToolId) {
    if (typeof nextToolId === 'number') nextToolId = tabs[nextToolId]?.id || 'tools';
    setActiveToolId(nextToolId);
    setVisitedToolIds(current => current.has(nextToolId) ? current : new Set([...current, nextToolId]));
    if (nextToolId === 'tools' || workspaceSnapshot.workspace.tools[nextToolId]?.pinned) setToolsPanelId(null);
    const url = new URL(location.href);
    url.searchParams.delete('allocation');
    const requested = tabs.find(tool => tool.id === nextToolId) || (workspaceSnapshot.workspace.tools[nextToolId]?.enabled ? { view: nextToolId } : null);
    url.searchParams.set('view', requested?.view || (nextToolId === 'tools' ? 'tools' : 'seisan'));
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }
  function openUnpinnedTool(toolId) { setToolsPanelId(toolId); setActiveToolId(toolId); setVisitedToolIds(current => current.has(toolId) ? current : new Set([...current, toolId])); const url = new URL(location.href); url.searchParams.set('view', toolId); history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`); }
  function openSettlementSettings({ standalone = false, launcherButtonRef = null } = {}) {
    setSettlementSettingsLauncher(launcherButtonRef);
    setSettlementSettingsEdit(beginSettlementEdit(runtime.store, { standalone }));
  }
  function closeSettlementSettings(saved) {
    const launcher = settlementSettingsLauncher?.current;
    if (!saved && settlementSettingsEdit && !settlementSettingsEdit.session.closed) runtime.store.cancelEdit(settlementSettingsEdit.session);
    setSettlementSettingsEdit(null);
    setSettlementSettingsLauncher(null);
    window.requestAnimationFrame(() => {
      const visible = element => element?.isConnected && element.getClientRects().length > 0;
      const fallback = [...document.querySelectorAll('button')].find(button => visible(button) && /精算設定を編集|人数だけで精算/.test(button.textContent || ''));
      (visible(launcher) ? launcher : fallback)?.focus();
    });
  }
  useEffect(() => {
    const onPopState = () => {
      const url = new URL(location.href);
      const requested = url.searchParams.get('view') === 'tools' ? 'tools' : requestedToolFromView(url.searchParams.get('view'));
      const next = resolveWorkspaceSelection(workspaceSnapshot.workspace, requested);
      setToolsPanelId(next.toolId);
      setActiveToolId(requested || next.tabId);
      const selected = next.toolId || next.tabId;
      setVisitedToolIds(current => current.has(selected) ? current : new Set([...current, selected]));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [workspaceSnapshot.workspace]);
  function openCountOnlySettlement() {
    changeView('settlement');
    const requestId = ++countOnlySettlementRequestId.current;
    setCountOnlySettlementRequest(requestId);
  }
  function openParticipantRegistration() {
    changeView('participants');
    const currentRoom = runtime.store.getSnapshot();
    if (runtime.store.domain.applicants.validApplicationSync(currentRoom.meta?.applicationSync)) return;
    const requestId = ++participantRegistrationRequestId.current;
    setParticipantRegistrationRequest(requestId);
  }
  function consumeParticipantRegistrationRequest(requestId) {
    setParticipantRegistrationRequest(current => current === requestId ? null : current);
  }
  function consumeCountOnlySettlementRequest(requestId) {
    setCountOnlySettlementRequest(current => current === requestId ? null : current);
  }
  return <Theme theme={theme} className="application">
    <Theme theme="g100" className="app-header-theme">
      <AppHeader theme={theme} themePreference={themePreference} onShare={share} onOpenUtility={openGlobalModal} onToggleTheme={toggleTheme} onUseSystemTheme={useSystemTheme} debugSample={runtime.debugSample} onResetDebugSample={resetDebugSample} />
    </Theme>
    <Theme theme={contentTheme} className="main-surface" data-floating-menu-container>
    <main id="main-content" tabIndex={-1} aria-labelledby="project-heading">
    <Grid fullWidth className="project-grid"><Column sm={4} md={8} lg={{ span: 12, start: 3 }} xlg={{ span: 12, start: 3 }} max={{ span: 12, start: 3 }}><ProjectIdentity name={room.roomName} syncStatus={syncStatus} onRename={name => runtime.store.command('rename', { name })} onProjectList={() => window.location.assign(new URL(import.meta.env.BASE_URL, window.location.href))} /></Column></Grid>
    <Grid fullWidth className="content-grid"><Column sm={4} md={8} lg={{ span: 12, start: 3 }} xlg={{ span: 12, start: 3 }} max={{ span: 12, start: 3 }}><div className="main-content">
      {projectSetup.status === 'creating' && <ToastNotification kind="info" title="企画を作成しています" subtitle="利用するツールを設定しています。" timeout={0} lowContrast />}
      {projectSetup.status === 'error' && <ToastNotification kind="error" title="企画を作成できませんでした" subtitle={projectSetup.error?.includes('企画IDが既に使われています') ? '企画一覧に戻り、新しい企画を作成してください。' : '通信状態を確認して、再読み込みしてください。'} timeout={0} lowContrast />}
      <Tabs selectedIndex={selectedIndex} onChange={({ selectedIndex: index }) => changeView(tabs[index]?.id || 'tools')}>
        <TabList aria-label="企画のツール" contained className="project-tool-tabs">{tabs.map(tool => <Tab key={tool.id}>{tool.label}</Tab>)}</TabList>
        <TabPanels>
          {tabs.map(tool => <TabPanel className="app-tab-panel" key={tool.id}>
            {!visitedToolIds.has(tool.id) ? null : <>
            {tool.id === 'tools' ? <div className="project-tools-panel">
              <div className="project-tools-panel__manager" hidden={Boolean(toolsPanelId)}><ToolManager workspaceSnapshot={workspaceSnapshot} workspaceSync={runtime.workspace} openTool={openUnpinnedTool} onNotice={showNotice} /></div>
              {optionalTools.filter(item => visitedToolIds.has(item.id) && workspaceSnapshot.workspace.tools[item.id]?.pinned !== true).map(item => <div className="project-tool-panel" key={item.id} hidden={toolsPanelId !== item.id}>
                {toolsPanelId === item.id && <Button kind="ghost" size="sm" onClick={() => { setToolsPanelId(null); setActiveToolId('tools'); }}>ツール一覧へ戻る</Button>}
                <ExternalToolWorkspace toolId={item.id} runtime={runtime} room={room} onNotice={showNotice} active={toolsPanelId === item.id && item.id === activeToolId} />
              </div>)}
            </div>
            : tool.id === 'participants' ? <Participants runtime={runtime} room={room} onNotice={showNotice} onOpenCountOnlySettlement={openCountOnlySettlement} openRegistrationRequestId={participantRegistrationRequest} onRegistrationRequestHandled={consumeParticipantRegistrationRequest} participantStartRef={participantStartRef} roomStatus={syncStatus} />
            : tool.id === 'car' || tool.id === 'team' ? <Allocation runtime={runtime} room={room} type={tool.id} onNotice={showNotice} onParticipants={openParticipantRegistration} roomStatus={syncStatus} />
            : tool.id === 'settlement' ? <Settlement runtime={runtime} room={room} onNotice={showNotice} onOpenParticipantRegistration={openParticipantRegistration} onOpenSettings={openSettlementSettings} participantStartRef={participantStartRef} openSettingsRequestId={countOnlySettlementRequest} onSettingsRequestHandled={consumeCountOnlySettlementRequest} roomStatus={syncStatus} />
            : <ExternalToolWorkspace toolId={tool.id} runtime={runtime} room={room} onNotice={showNotice} active={tool.id === activeToolId} />}
            </>}
          </TabPanel>)}
        </TabPanels>
      </Tabs>
    </div></Column></Grid>
    </main>
    </Theme>
    {settlementSettingsEdit && <SettlementSettingsModal runtime={runtime} edit={settlementSettingsEdit} launcherButtonRef={settlementSettingsLauncher} onNotice={showNotice} onClose={closeSettlementSettings} />}
    {globalModal === 'guide' && <Modal className="app-modal" open passiveModal size="md" closeButtonLabel="閉じる" modalHeading="使い方" onRequestClose={() => setGlobalModal('')}>
      <div className="user-guide"><p>使うツールは企画ごとに選べます。</p><ul><li><strong>応募フォーム</strong><span>企画名と実施日を引き継いでフォームを作成します。回答から参加者を選べます。</span></li><li><strong>参加者</strong><span>参加者を登録し、応募者を参加者に確定します。</span></li><li><strong>車割・班割</strong><span>参加者を車や班に割り当てます。</span></li><li><strong>精算</strong><span>集金額と車ごとの支払額を計算します。人数だけでも精算できます。</span></li><li><strong>共有</strong><span>リンクから同じ企画を開けます。</span></li></ul></div>
    </Modal>}
    {globalModal === 'overview' && <OverviewModal runtime={runtime} room={room} onNotice={showNotice} onClose={() => setGlobalModal('')} />}
    {globalModal === 'history' && <HistoryModal runtime={runtime} onNotice={showNotice} onClose={() => setGlobalModal('')} />}
    {globalModal === 'sample' && <Modal className="app-modal sample-modal" open size="sm" closeButtonLabel="閉じる" modalHeading={sampleType === 'reset' ? '企画データを空にしますか？' : 'サンプルデータ'} primaryButtonText={sampleType === 'reset' ? '空にする' : 'サンプルに置き換える'} secondaryButtonText="キャンセル" onRequestSubmit={seedSelectedSample} onRequestClose={() => setGlobalModal('')} selectorPrimaryFocus="#sample-normal">
      <div className="sample-form"><p>{sampleType === 'reset' ? '企画名、参加者、割り当て、精算情報を空にします。フォーム連携情報は保持されます。' : 'この企画の参加者・割り当て・精算データをサンプルに置き換えます。共有している端末にも反映されます。'}</p><RadioButtonGroup legendText="サンプルの種類" name="sample-type" valueSelected={sampleType} onChange={value => setSampleType(String(value))} orientation="vertical"><RadioButton id="sample-normal" labelText="通常のサンプル" value="normal" /><RadioButton id="sample-form" labelText="フォーム連携のサンプル" value="form" /><RadioButton id="sample-missing" labelText="未入力項目があるサンプル" value="missing" /><RadioButton id="sample-reset" labelText="企画データを空にする" value="reset" /></RadioButtonGroup>{(sampleType === 'normal' || sampleType === 'missing') && <Select id="sample-car-count" labelText="車の数" value={sampleCars} onChange={event => setSampleCars(event.target.value)}>{['2', '3', '4', '5'].map(value => <SelectItem key={value} value={value} text={`${value}台`} />)}</Select>}</div>
    </Modal>}
    {globalModal === 'bug' && <BugModal runtime={runtime} room={room} onNotice={showNotice} onClose={() => setGlobalModal('')} />}
    {notice && <div className="notification-region"><ToastNotification key={notice} kind={noticeKind(notice)} title={notice} subtitle="" caption="" timeout={noticeTimeout} onClose={() => { setNotice(current => current === notice ? '' : current); return true; }} lowContrast /></div>}
  </Theme>;
}
