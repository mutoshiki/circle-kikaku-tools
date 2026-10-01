import { useMemo, useState } from 'react';
import { Button, InlineNotification, TextArea } from '@carbon/react';
import { createProjectDomain } from '../services/project-domain.js';
import { notice } from '../ui/task-contracts.js';
import TaskModal from './TaskModal.jsx';

export function HistoryModal({ runtime, onClose, onNotice }) {
  const [items, setItems] = useState(runtime.history.read());
  const [undo, setUndo] = useState(runtime.history.canUndo());
  function snapshot() { runtime.history.save(runtime.store.getSnapshot()); setItems(runtime.history.read()); }
  function restore(item) { runtime.history.restore(runtime.store, item); setUndo(true); }
  function restoreUndo() { if (runtime.history.undo(runtime.store)) setUndo(false); }
  return <TaskModal taskId="history-management" className="app-modal" open size="md" hasScrollingContent modalHeading="履歴" primaryButtonText="閉じる" onRequestSubmit={onClose} onRequestClose={onClose}><div className="form-stack"><div className="inline-actions"><Button onClick={snapshot}>現在の状態を保存</Button>{undo && <Button kind="ghost" onClick={restoreUndo}>復元を取り消す</Button>}</div>{items.length ? <div className="history-list">{items.map((item, index) => <div className="history-row" key={`${item.time}-${index}`}><span><strong>{item.data?.roomName || '企画名未設定'}</strong><small>{new Date(item.time).toLocaleString('ja-JP')}</small></span><Button kind="ghost" onClick={() => restore(item)}>復元</Button></div>)}</div> : <p>履歴がありません</p>}</div></TaskModal>;
}
export function ExportModal({ runtime, room, onClose, onNotice }) {
  const [error, setError] = useState('');
  const project = useMemo(() => createProjectDomain({ getRoom: () => room, settlement: runtime.store.domain.settlement }), [room, runtime]);
  const selection = project.committedExportSelection();
  const blocked = !project.applicationSync() || !runtime.handoffToken || selection.ambiguousNames.length > 0 || (!selection.responseKeys.length && !selection.manualNames.length);
  const reason = !project.applicationSync() ? '応募フォームと自動連携した企画で利用できます。' : !runtime.handoffToken ? 'この端末には作成権限がありません。' : selection.ambiguousNames.length ? `同名の応募者（${selection.ambiguousNames.join('・')}）を安全に判別できません。` : '参加者を確定してください。';
  async function download() {
    setError('');
    try {
      let participants = [];
      let filename = `${String(project.applicationSync()?.title || '企画').replace(/[\\/:*?"<>|]/g, '_')}_参加者.csv`;
      if (selection.responseKeys.length) {
        const payload = await runtime.external.handoff({ action: 'handoff-export', projectId: runtime.roomId, token: runtime.handoffToken, responses: selection.responseKeys.join(',') });
        if (!payload?.ok || !Array.isArray(payload.participants)) throw new Error(payload?.error || '参加者データを読み取れませんでした。');
        participants = payload.participants; filename = payload.filename || filename;
      }
      participants.push(...selection.manualNames.map(name => ({ studentId: '', name })));
      const blob = new Blob([project.buildParticipantCsv(participants)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      onNotice(notice.success(`${participants.length}人の引き継ぎデータを作成しました`, { placement: 'toast' })); onClose();
    } catch (caught) { setError(caught.message); }
  }
  return <TaskModal taskId="participant-export" className="app-modal" open size="sm" modalHeading="引き継ぎデータ" primaryButtonText="引き継ぎデータを作成" secondaryButtonText="閉じる" primaryButtonDisabled={blocked} onRequestSubmit={download} onRequestClose={onClose}><p>学務提出書類作成ツールに読み込むための引き継ぎデータを作成します。</p>{error && <InlineNotification kind="error" title="引き継ぎデータを作成できませんでした" subtitle={error} hideCloseButton lowContrast />}{blocked && <InlineNotification kind="warning" title="作成できません" subtitle={reason} hideCloseButton lowContrast />}</TaskModal>;
}

export function BugModal({ runtime, room, onClose, onNotice }) {
  const [error, setError] = useState('');
  const [message, setMessage] = useState(''); const [sending, setSending] = useState(false);
  async function send() { setSending(true); setError(''); try { await runtime.external.bugReport({ message: message.trim().slice(0, 2000), roomId: runtime.roomId.slice(0, 80), pageUrl: location.href.slice(0, 2048), projectTitle: room.roomName }); onNotice(notice.success('バグ報告を送信しました', { placement: 'toast' })); onClose(); } catch { setError('接続を確認して、もう一度送信してください。'); setSending(false); } }
  return <TaskModal taskId="bug-report" className="app-modal" open size="sm" modalHeading="バグを報告" primaryButtonText="送信" secondaryButtonText="キャンセル" primaryButtonDisabled={!message.trim() || sending} onRequestSubmit={send} onRequestClose={onClose} preventCloseOnClickOutside selectorPrimaryFocus="#bug-message">{error && <InlineNotification kind="error" title="バグ報告を送信できませんでした" subtitle={error} hideCloseButton lowContrast />}<TextArea id="bug-message" labelText="バグの内容" rows={6} value={message} onChange={event => setMessage(event.target.value)} /></TaskModal>;
}
