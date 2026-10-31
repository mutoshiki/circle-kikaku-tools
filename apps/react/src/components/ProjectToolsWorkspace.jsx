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
      setMessage(result.conflict ? '別の端末で設定が変わりました。最新の設定を読み込んでください。' : '設定を保存できませんでした。通信状態を確認してください。');
      return;
    }
    setDraft(result.workspace); setBaseRevision(result.workspace.revision);
    onNotice('ツール設定を保存しました。');
  }

  const ordered = draft.tabOrder.map(id => tools.find(tool => tool.id === id)).filter(Boolean);
  return <section className="project-tools-workspace" aria-labelledby="tools-heading">
    {workspaceSnapshot.status === 'error' && <InlineNotification kind="warning" title="ツール設定を読み込めません" subtitle="この企画のツールは変更できません。" hideCloseButton />}
    <div className="project-tools-workspace__heading"><div><h2 id="tools-heading">ツール</h2><p>使うツールと、タブに表示するツールを選びます。</p></div></div>
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
      <p className="project-tool-setting__help">タブに表示しないツールは「ツール」から開けます。利用をやめてもデータは残ります。</p>
      <div className="project-tools-manager__actions"><Button kind="primary" disabled={!draftChanged || saving || workspaceSnapshot.status !== 'ready'} onClick={save}>{saving ? '保存中…' : '設定を保存'}</Button><Button kind="ghost" disabled={!draftChanged || saving} onClick={resetDraft}>変更を取り消す</Button></div>
    </div>
    {!!ordered.length && <div className="project-tools-pinned"><h3>タブの順序</h3><ol>{ordered.map(tool => <li key={tool.id}>{tool.label}</li>)}</ol><p>この順番は、企画を開く全員に反映されます。</p></div>}
  </section>;
}

export function ExternalToolWorkspace({ toolId, runtime, room, onNotice }) {
  const [showExport, setShowExport] = useState(false);
  const [formLinkBusy, setFormLinkBusy] = useState(false);
  const [formLinkError, setFormLinkError] = useState('');
  const labels = new Map(tools.map(tool => [tool.id, tool.label]));
  if (toolId === 'application-form') return <section className="external-tool-workspace"><h2>{labels.get(toolId)}</h2><p>登録済みの企画名・実施日を引き継ぎます。メールアドレスや応募締切はフォームメーカーで設定してください。</p>{formLinkError && <InlineNotification kind="error" title="フォームメーカーを開けませんでした" subtitle={formLinkError} hideCloseButton />}<Button kind="primary" disabled={formLinkBusy || Boolean(room.meta?.applicationSync)} onClick={async () => { setFormLinkBusy(true); setFormLinkError(''); try { const href = await runtime.external.createApplicationForm({ room }); window.location.assign(href); } catch (error) { const message = String(error?.message || ''); setFormLinkError(/[ぁ-んァ-ヶ一-龠]/.test(message) ? message : 'フォームメーカーを開けませんでした。通信状態を確認してください。'); setFormLinkBusy(false); } }}>{formLinkBusy ? 'フォームメーカーを開いています…' : room.meta?.applicationSync ? '応募フォーム連携済み' : 'フォームメーカーを開く'}</Button></section>;
  if (toolId === 'submission-documents') return <section className="external-tool-workspace"><h2>{labels.get(toolId)}</h2><p>確定した参加者のCSVを作成します。</p><Button kind="primary" disabled={!runtime.handoffToken} onClick={() => setShowExport(true)}>CSVを作成</Button>{!runtime.handoffToken && <p>フォームメーカーの作成結果にある「企画ツールを開く」から、この企画を開いてください。</p>}<p><a href={release} target="_blank" rel="noreferrer">学務書類作成ツールをダウンロード</a></p>{showExport && <ExportModal runtime={runtime} room={room} onNotice={onNotice} onClose={() => setShowExport(false)} />}</section>;
  if (toolId === 'mountain-plan') return <section className="external-tool-workspace"><h2>{labels.get(toolId)}</h2><p>企画名を引き継ぎます。実施日は「実施日に反映」から取り込めます。</p><Button kind="primary" href={createMountainPlanHref(mountainPlanMaker, { roomId: runtime.roomId, room }) || mountainPlanMaker} target="_blank" rel="noreferrer">登山計画書を作成</Button></section>;
  return <section className="external-tool-workspace"><h2>このツールを開けません</h2><Button kind="ghost" onClick={() => window.location.reload()}>画面を再読み込み</Button></section>;
}
