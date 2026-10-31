import { lazy, Suspense, useMemo, useState, useSyncExternalStore } from 'react';
import { Button, Checkbox, InlineLoading, InlineNotification } from '@carbon/react';
import { ExportModal } from './ProjectTools.jsx';
import SectionHeading from './ui/SectionHeading.jsx';
import { movePinnedTool, setToolAvailability, setToolPinned } from '../services/project-workspace-actions.js';
import { TOOL_REGISTRY } from '../services/project-workspace.js';
import { createFormMakerWorkspaceProps, loadFormMakerWorkspace } from '../services/form-maker-workspace.js';
import { createMountainPlanWorkspaceProps, loadMountainPlanWorkspace } from '../services/mountain-plan-workspace.js';
import '@sanpokai/form-maker-workspace/style.css';
import '@sanpokai/mountain-plan-workspace/style.css';

const tools = TOOL_REGISTRY.filter(tool => !tool.system);
const mountainPlanMaker = 'https://mutoshiki.github.io/tozan-keikaku-syo-maker/';
const release = 'https://github.com/mutoshiki/sampokai-submission-builder/releases';
const FormMakerWorkspace = lazy(loadFormMakerWorkspace);
const MountainPlanWorkspace = lazy(loadMountainPlanWorkspace);

export function ToolManager({ workspaceSnapshot, workspaceSync, openTool, onNotice }) {
  const [draft, setDraft] = useState(() => workspaceSnapshot.workspace);
  const [baseRevision, setBaseRevision] = useState(() => workspaceSnapshot.workspace.revision);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const latest = workspaceSnapshot.workspace;
  const changedRemotely = Number(latest.revision || 0) !== Number(baseRevision || 0);
  const draftChanged = useMemo(() => JSON.stringify({ ...draft, revision: 0, updatedAt: 0 }) !== JSON.stringify({ ...latest, revision: 0, updatedAt: 0 }), [draft, latest]);

  function resetDraft() { setDraft(latest); setBaseRevision(latest.revision); setMessage(''); }
  async function save() {
    setSaving(true); setMessage('');
    const result = await workspaceSync.save(draft, baseRevision);
    setSaving(false);
    if (!result.ok) {
      setMessage(result.conflict ? '別の端末で設定が変わりました。最新の設定を読み込んでください。' : '設定を保存できませんでした。通信状態を確認してください。');
      return;
    }
    setDraft(result.workspace); setBaseRevision(result.workspace.revision);
    onNotice('ツール設定を保存しました。');
  }

  return <section className="project-tools-workspace" aria-labelledby="tools-heading">
    {workspaceSnapshot.status === 'error' && <InlineNotification kind="warning" title="ツール設定を読み込めません" subtitle="この企画のツールは変更できません。" hideCloseButton />}
    <SectionHeading className="project-tools-workspace__heading" id="tools-heading" title="ツール" description="使うツールと、タブに表示するツールを選びます。" />
    {message && <InlineNotification kind="warning" title={message} hideCloseButton />}
    {changedRemotely && draftChanged && <InlineNotification kind="warning" title="別の端末で設定が変わりました" subtitle="最新の設定を読み込み、もう一度編集してください。" actions={<Button kind="ghost" size="sm" onClick={resetDraft}>最新の設定を読み込む</Button>} hideCloseButton />}
    <div className="project-tools-manager">
      <h3>利用するツール</h3>
      {tools.map(tool => {
        const state = draft.tools[tool.id] || { enabled: false, pinned: false };
        return <div className="project-tool-setting" key={tool.id}>
          <div className="project-tool-setting__main"><Checkbox id={`workspace-enabled-${tool.id}`} labelText={tool.label} checked={state.enabled} onChange={(_, { checked }) => setDraft(value => setToolAvailability(value, tool.id, checked))} /></div>
          {state.enabled && <div className="project-tool-setting__actions"><Checkbox id={`workspace-pinned-${tool.id}`} labelText="タブに表示" checked={state.pinned} onChange={(_, { checked }) => setDraft(value => setToolPinned(value, tool.id, checked))} />{state.pinned ? <><Button kind="ghost" size="sm" disabled={draft.tabOrder.indexOf(tool.id) === 0} onClick={() => setDraft(value => movePinnedTool(value, tool.id, value.tabOrder.indexOf(tool.id) - 1))}>上へ</Button><Button kind="ghost" size="sm" disabled={draft.tabOrder.indexOf(tool.id) === draft.tabOrder.length - 1} onClick={() => setDraft(value => movePinnedTool(value, tool.id, value.tabOrder.indexOf(tool.id) + 1))}>下へ</Button></> : <Button kind="ghost" size="sm" disabled={draftChanged || workspaceSnapshot.status !== 'ready'} onClick={() => openTool(tool.id)}>開く</Button>}</div>}
        </div>;
      })}
      <p className="project-tool-setting__help">タブに表示しないツールは「ツール」から開けます。データは残ります。</p>
      <div className="project-tools-manager__actions"><Button kind="primary" disabled={!draftChanged || saving || workspaceSnapshot.status !== 'ready'} onClick={save}>{saving ? '保存中…' : '設定を保存'}</Button><Button kind="ghost" disabled={!draftChanged || saving} onClick={resetDraft}>変更を取り消す</Button></div>
    </div>
  </section>;
}

export function ExternalToolWorkspace({ toolId, runtime, room, onNotice, active = true }) {
  const handoffToken = useSyncExternalStore(runtime.handoffCapability?.subscribe || (() => () => {}), () => runtime.handoffCapability?.getSnapshot().token ?? runtime.handoffToken ?? '');
  const [showExport, setShowExport] = useState(false);
  const labels = new Map(tools.map(tool => [tool.id, tool.label]));
  if (toolId === 'application-form') return <>
    {room.meta?.applicationSync && !runtime.debugSample && <InlineNotification kind="success" title="この企画には応募フォームが連携済みです" subtitle="回答は参加者タブで確認できます。フォームメーカーには、このブラウザーで確認できる作成履歴を表示します。" hideCloseButton />}
    <Suspense fallback={<div className="project-tool-loading" role="status"><InlineLoading description="フォームメーカーを読み込んでいます" /></div>}><FormMakerWorkspace {...createFormMakerWorkspaceProps({ runtime, room, active, onNotice })} /></Suspense>
  </>;
  if (toolId === 'submission-documents') return <section className="external-tool-workspace"><h2>{labels.get(toolId)}</h2><p>{runtime.debugSample ? 'サンプル参加者のCSV内容を確認できます。ファイル作成や外部送信は行いません。' : '確定した参加者のCSVを作成します。'}</p><Button kind="primary" disabled={!runtime.debugSample && !handoffToken} onClick={() => setShowExport(true)}>{runtime.debugSample ? 'CSVをプレビュー' : 'CSVを作成'}</Button>{!runtime.debugSample && !handoffToken && <p>フォームメーカーの作成結果にある「企画ツールを開く」から、この企画を開いてください。</p>}{!runtime.debugSample && <p><a href={release} target="_blank" rel="noreferrer">学務書類作成ツールをダウンロード</a></p>}{showExport && <ExportModal runtime={runtime} room={room} onNotice={onNotice} onClose={() => setShowExport(false)} />}</section>;
  if (toolId === 'mountain-plan') return <Suspense fallback={<div className="project-tool-loading" role="status"><InlineLoading description="登山計画書を読み込んでいます" /></div>}><MountainPlanWorkspace {...createMountainPlanWorkspaceProps({ runtime, room, active, onNotice })} /></Suspense>;
  return <section className="external-tool-workspace"><h2>このツールを開けません</h2><Button kind="ghost" onClick={() => window.location.reload()}>画面を再読み込み</Button></section>;
}
