import { lazy, Suspense, useRef, useState, useSyncExternalStore } from 'react';
import { Button, Checkbox, InlineLoading, InlineNotification } from '@carbon/react';
import { ExportModal } from './ProjectTools.jsx';
import SectionHeading from './ui/SectionHeading.jsx';
import { movePinnedTool, setToolTabVisibility } from '../services/project-workspace-actions.js';
import { TOOL_REGISTRY } from '../services/project-workspace.js';
import { createFormMakerWorkspaceProps, loadFormMakerWorkspace } from '../services/form-maker-workspace.js';
import { createMountainPlanWorkspaceProps, loadMountainPlanWorkspace } from '../services/mountain-plan-workspace.js';
import '@sanpokai/form-maker-workspace/style.css';
import '@sanpokai/mountain-plan-workspace/style.css';

const tools = TOOL_REGISTRY.filter(tool => !tool.system);
const release = 'https://github.com/mutoshiki/sampokai-submission-builder/releases';
const FormMakerWorkspace = lazy(loadFormMakerWorkspace);
const MountainPlanWorkspace = lazy(loadMountainPlanWorkspace);

export function ToolManager({ workspaceSnapshot, workspaceSync, highlightedToolId = null }) {
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const ready = workspaceSnapshot.status === 'ready';
  const workspace = workspaceSnapshot.workspace;

  async function updateWorkspace(update) {
    if (savingRef.current || workspaceSync.getSnapshot().status !== 'ready') return;
    const current = workspaceSync.getSnapshot().workspace;
    const next = update(current);
    if (JSON.stringify({ ...next, revision: 0, updatedAt: 0 }) === JSON.stringify({ ...current, revision: 0, updatedAt: 0 })) return;

    savingRef.current = true;
    setSaving(true);
    setMessage('');
    try {
      const result = await workspaceSync.save(next, current.revision);
      if (!result.ok) {
        setMessage(result.conflict
          ? '別の端末で変更されました。もう一度選んでください。'
          : 'タブの変更を保存できませんでした。');
      }
    } catch {
      setMessage('タブの変更を保存できませんでした。');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const orderedTools = workspace.tabOrder
    .map(id => tools.find(tool => tool.id === id))
    .filter(Boolean);

  return <section className="project-tools-workspace" aria-labelledby="tab-editor-heading" aria-busy={saving}>
    <SectionHeading className="project-tools-workspace__heading" id="tab-editor-heading" title="タブを編集" />
    {message && <InlineNotification kind="error" title={message} hideCloseButton />}
    {workspaceSnapshot.status === 'loading' && <div className="project-tool-loading" role="status"><InlineLoading description="タブを読み込んでいます" /></div>}
    {workspaceSnapshot.status === 'error' && <InlineNotification kind="error" title="タブを読み込めませんでした" subtitle="通信状態を確認してください。" hideCloseButton />}
    {ready && <div className="project-tools-manager">
      <h3 id="tab-editor-list-heading">表示するタブ</h3>
      <fieldset className="project-tools-manager__group" aria-labelledby="tab-editor-list-heading" disabled={saving}>
        <ul className="project-tools-manager__list">
          {tools.map(tool => {
            const record = workspace.tools[tool.id] || { enabled: false, pinned: false };
            const visible = record.enabled === true && record.pinned === true;
            const order = workspace.tabOrder.indexOf(tool.id);
            return <li className="project-tool-setting" key={tool.id} data-highlighted={highlightedToolId === tool.id ? 'true' : undefined}>
              <Checkbox
                id={`workspace-tab-visible-${tool.id}`}
                labelText={tool.label}
                checked={visible}
                onChange={(_, { checked }) => updateWorkspace(current => setToolTabVisibility(current, tool.id, checked))}
              />
              {visible && <div className="project-tool-setting__actions" aria-label={`${tool.label}の順番`}>
                <Button kind="ghost" size="sm" disabled={order <= 0} aria-label={`${tool.label}を上へ`} onClick={() => updateWorkspace(current => movePinnedTool(current, tool.id, current.tabOrder.indexOf(tool.id) - 1))}>上へ</Button>
                <Button kind="ghost" size="sm" disabled={order === workspace.tabOrder.length - 1} aria-label={`${tool.label}を下へ`} onClick={() => updateWorkspace(current => movePinnedTool(current, tool.id, current.tabOrder.indexOf(tool.id) + 1))}>下へ</Button>
              </div>}
            </li>;
          })}
        </ul>
      </fieldset>
      {highlightedToolId && <p className="project-tool-setting__focus-help">この機能をタブに表示するには、チェックを入れてください。</p>}
    </div>}
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
