import { useMemo, useState } from 'react';
import { Button, Checkbox, InlineNotification } from '@carbon/react';
import { ExportModal } from './ProjectTools.jsx';
import { movePinnedTool, setToolAvailability, setToolPinned } from '../services/project-workspace-actions.js';
import { TOOL_REGISTRY } from '../services/project-workspace.js';
import { createMountainPlanHref } from '../services/mountain-plan-handoff.js';

const tools = TOOL_REGISTRY.filter(tool => !tool.system);
const mountainPlanMaker = 'https://mutoshiki.github.io/tozan-keikaku-syo-maker/';
const release = 'https://github.com/mutoshiki/sampokai-submission-builder/releases';

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
      setMessage(result.conflict ? '別の端末で設定が変更されています。内容を確認してから保存し直してください。' : `設定を保存できませんでした。${result.error || ''}`);
      return;
    }
    setDraft(result.workspace); setBaseRevision(result.workspace.revision);
    onNotice('ツール設定を保存しました。');
  }

  const ordered = draft.tabOrder.map(id => tools.find(tool => tool.id === id)).filter(Boolean);
  return <section className="project-tools-workspace" aria-labelledby="tools-heading">
    {workspaceSnapshot.status === 'error' && <InlineNotification kind="warning" title="共有設定を読み込めません" subtitle="現在の画面は利用できます。ツール設定は接続が戻るまで変更できません。" hideCloseButton />}
    <div className="project-tools-workspace__heading"><div><h2 id="tools-heading">ツール</h2><p>企画で使う機能と、タブに表示する機能を管理します。</p></div></div>
    {message && <InlineNotification kind="warning" title={message} hideCloseButton />}
    {changedRemotely && draftChanged && <InlineNotification kind="warning" title="別の端末で設定が更新されました" subtitle="編集中の内容は残しています。最新設定を取り込むか、差分を確認してから保存してください。" actions={<Button kind="ghost" size="sm" onClick={resetDraft}>最新設定を読み込む</Button>} hideCloseButton />}
    <div className="project-tools-manager">
      <h3>利用できるツール</h3>
      {tools.map(tool => {
        const state = draft.tools[tool.id] || { enabled: false, pinned: false };
        return <div className="project-tool-setting" key={tool.id}>
          <div className="project-tool-setting__main"><Checkbox id={`workspace-enabled-${tool.id}`} labelText={tool.label} checked={state.enabled} onChange={(_, { checked }) => setDraft(value => setToolAvailability(value, tool.id, checked))} /></div>
          {state.enabled && <div className="project-tool-setting__actions"><Checkbox id={`workspace-pinned-${tool.id}`} labelText="タブに固定" checked={state.pinned} onChange={(_, { checked }) => setDraft(value => setToolPinned(value, tool.id, checked))} />{state.pinned ? <><Button kind="ghost" size="sm" disabled={draft.tabOrder.indexOf(tool.id) === 0} onClick={() => setDraft(value => movePinnedTool(value, tool.id, value.tabOrder.indexOf(tool.id) - 1))}>上へ</Button><Button kind="ghost" size="sm" disabled={draft.tabOrder.indexOf(tool.id) === draft.tabOrder.length - 1} onClick={() => setDraft(value => movePinnedTool(value, tool.id, value.tabOrder.indexOf(tool.id) + 1))}>下へ</Button></> : <Button kind="ghost" size="sm" disabled={draftChanged || workspaceSnapshot.status !== 'ready'} onClick={() => openTool(tool.id)}>開く</Button>}</div>}
        </div>;
      })}
      <p className="project-tool-setting__help">タブ固定を外しても、ツールと保存済みデータは残ります。利用を解除したツールも、再度追加できます。</p>
      <div className="project-tools-manager__actions"><Button kind="primary" disabled={!draftChanged || saving || workspaceSnapshot.status !== 'ready'} onClick={save}>{saving ? '保存中…' : '設定を保存'}</Button><Button kind="ghost" disabled={!draftChanged || saving} onClick={resetDraft}>変更を取り消す</Button></div>
    </div>
    {!!ordered.length && <div className="project-tools-pinned"><h3>タブの順序</h3><ol>{ordered.map(tool => <li key={tool.id}>{tool.label}</li>)}</ol><p>順序はこの企画を開くすべての端末で共有されます。</p></div>}
  </section>;
}

export function ExternalToolWorkspace({ toolId, runtime, room, onNotice }) {
  const [showExport, setShowExport] = useState(false);
  const [formLinkBusy, setFormLinkBusy] = useState(false);
  const [formLinkError, setFormLinkError] = useState('');
  const labels = new Map(tools.map(tool => [tool.id, tool.label]));
  if (toolId === 'application-form') return <section className="external-tool-workspace"><h2>{labels.get(toolId)}</h2><p>この企画に応募フォームを作成し、応募者情報を企画へ連携します。</p>{formLinkError && <InlineNotification kind="error" title="フォームメーカーを開けません" subtitle={formLinkError} hideCloseButton />}<Button kind="primary" disabled={formLinkBusy || Boolean(room.meta?.applicationSync)} onClick={async () => { setFormLinkBusy(true); setFormLinkError(''); try { const href = await runtime.external.createApplicationForm({ room }); window.location.assign(href); } catch (error) { setFormLinkError(String(error?.message || '企画への接続を確認してください。')); setFormLinkBusy(false); } }}>{formLinkBusy ? '接続を準備しています…' : room.meta?.applicationSync ? '応募フォーム連携済み' : 'この企画に応募フォームを作成'}</Button></section>;
  if (toolId === 'submission-documents') return <section className="external-tool-workspace"><h2>{labels.get(toolId)}</h2><p>フォーム連携と作成権限がある場合は、既存の引き継ぎデータ作成を利用できます。</p><Button kind="primary" disabled={!runtime.handoffToken} onClick={() => setShowExport(true)}>引き継ぎデータを作成</Button>{!runtime.handoffToken && <p>この端末には作成権限がありません。応募フォーム作成時に案内されたリンクから企画を開いてください。</p>}<p><a href={release} target="_blank" rel="noreferrer">Windowsアプリをダウンロード</a></p>{showExport && <ExportModal runtime={runtime} room={room} onNotice={onNotice} onClose={() => setShowExport(false)} />}</section>;
  if (toolId === 'mountain-plan') return <section className="external-tool-workspace"><h2>{labels.get(toolId)}</h2><p>企画名と実施日をメーカーへ引き継ぎます。実施日はメーカー側で確認してから反映できます。参加者情報は送信しません。</p><Button kind="primary" href={createMountainPlanHref(mountainPlanMaker, { roomId: runtime.roomId, room }) || mountainPlanMaker} target="_blank" rel="noreferrer">企画情報を引き継いで開く</Button></section>;
  return <section className="external-tool-workspace"><h2>このツールを開けません</h2><Button kind="ghost" onClick={() => runtime.store.command('rename', { name: room.roomName || '' })}>再読み込み</Button></section>;
}
