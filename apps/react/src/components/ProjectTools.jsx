import { useMemo, useState } from 'react';
import { Button, InlineNotification, Modal, OverflowMenu, OverflowMenuItem, TextArea, TextInput } from '@carbon/react';
import { Add, TrashCan } from '@carbon/icons-react';
import { createProjectDomain } from '../services/project-domain.js';

export function OverviewModal({ runtime, room, onClose, onNotice }) {
  const initial = runtime.overviewDraft.read(room.overview || {});
  const [draft, setDraft] = useState({ memo: String(initial.memo || ''), timetableItems: Array.isArray(initial.timetableItems) && initial.timetableItems.length ? initial.timetableItems : [{ time: '', title: '' }] });
  function patch(next) { setDraft(next); runtime.overviewDraft.write(next); }
  function saveShared() { runtime.store.command('overview', { overview: runtime.store.domain ? { memo: draft.memo, timetableItems: draft.timetableItems.filter(item => item.time || item.title) } : draft }); onNotice('企画情報を共有保存しました。'); onClose(); }
  return <Modal className="app-modal" open size="md" hasScrollingContent modalHeading="企画情報" primaryButtonText="共有保存" secondaryButtonText="閉じる" onRequestSubmit={saveShared} onRequestClose={onClose} preventCloseOnClickOutside selectorPrimaryFocus="#overview-memo">
    <div className="form-stack"><InlineNotification kind="info" title="この端末の下書き" subtitle="入力中は端末内だけに保存されます。共有保存するまで他の端末へ反映されません。" hideCloseButton lowContrast />
      <TextArea id="overview-memo" labelText="メモ" rows={4} value={draft.memo} onChange={event => patch({ ...draft, memo: event.target.value })} />
      <section><div className="section-heading"><h3>時刻表</h3><Button kind="ghost" size="sm" renderIcon={Add} onClick={() => patch({ ...draft, timetableItems: [...draft.timetableItems, { time: '', title: '' }] })}>行を追加</Button></div>
        <div className="timetable-list">{draft.timetableItems.map((item, index) => <div className="timetable-row" key={index}><TextInput id={`overview-time-${index}`} type="time" labelText="時刻" value={item.time} onChange={event => { const rows = draft.timetableItems.map((row, i) => i === index ? { ...row, time: event.target.value } : row); patch({ ...draft, timetableItems: rows }); }} /><TextInput id={`overview-title-${index}`} labelText="内容" value={item.title} onChange={event => { const rows = draft.timetableItems.map((row, i) => i === index ? { ...row, title: event.target.value } : row); patch({ ...draft, timetableItems: rows }); }} /><Button kind="danger-ghost" size="sm" renderIcon={TrashCan} onClick={() => patch({ ...draft, timetableItems: draft.timetableItems.filter((_, i) => i !== index) })}>削除</Button></div>)}</div>
      </section>
    </div>
  </Modal>;
}

export function HistoryModal({ runtime, onClose, onNotice }) {
  const [items, setItems] = useState(runtime.history.read());
  const [undo, setUndo] = useState(runtime.history.canUndo());
  function snapshot() { runtime.history.save(runtime.store.getSnapshot()); setItems(runtime.history.read()); onNotice('履歴を保存しました。'); }
  function restore(item) { runtime.history.restore(runtime.store, item); setUndo(true); onNotice('履歴を復元しました。'); }
  function restoreUndo() { if (runtime.history.undo(runtime.store)) { setUndo(false); onNotice('復元前の状態に戻しました。'); } }
  return <Modal className="app-modal" open size="md" hasScrollingContent modalHeading="履歴" primaryButtonText="閉じる" onRequestSubmit={onClose} onRequestClose={onClose}><div className="form-stack"><div className="inline-actions"><Button onClick={snapshot}>現在の状態を保存</Button>{undo && <Button kind="ghost" onClick={restoreUndo}>復元を取り消す</Button>}</div>{items.length ? <div className="history-list">{items.map((item, index) => <div className="history-row" key={`${item.time}-${index}`}><span><strong>{item.data?.roomName || '企画名未設定'}</strong><small>{new Date(item.time).toLocaleString('ja-JP')}</small></span><Button kind="ghost" onClick={() => restore(item)}>復元</Button></div>)}</div> : <p>履歴がありません</p>}</div></Modal>;
}

export function GuidanceModal({ runtime, room, onClose, onNotice }) {
  const [fields, setFields] = useState({ eventDate: room.meta?.applicationSync?.eventDate || '', meetingTime: '', opening: '', supplement: '', contact: '', closing: '', itinerary: [] });
  const project = useMemo(() => createProjectDomain({ getRoom: () => room, getAnnouncement: () => fields, settlement: runtime.store.domain.settlement }), [room, fields, runtime]);
  const text = project.bodyText({ allowPlaceholder: true });
  async function copy() { try { await navigator.clipboard.writeText(text); onNotice('案内文をコピーしました。'); } catch { onNotice('案内文をコピーできませんでした。'); } }
  return <Modal className="app-modal" open size="lg" hasScrollingContent modalHeading="参加者発表文を作成" primaryButtonText="コピー" secondaryButtonText="閉じる" primaryButtonDisabled={!text} onRequestSubmit={copy} onRequestClose={onClose} preventCloseOnClickOutside selectorPrimaryFocus="#guidance-date"><div className="form-stack"><div className="form-grid"><TextInput id="guidance-date" type="date" labelText="実施日" value={fields.eventDate} onChange={event => setFields({ ...fields, eventDate: event.target.value })} /><TextInput id="guidance-time" type="time" labelText="集合時間" value={fields.meetingTime} onChange={event => setFields({ ...fields, meetingTime: event.target.value })} /></div><TextArea id="guidance-supplement" labelText="補足事項" rows={3} value={fields.supplement} onChange={event => setFields({ ...fields, supplement: event.target.value })} /><TextArea id="guidance-preview" labelText="発表文プレビュー" rows={14} value={text} readOnly />{!text && <InlineNotification kind="warning" title="発表文を作成できません" subtitle="応募フォーム連携済みの企画で参加者を確定してください。" hideCloseButton lowContrast />}</div></Modal>;
}

export function ExportModal({ runtime, room, onClose, onNotice }) {
  const project = useMemo(() => createProjectDomain({ getRoom: () => room, settlement: runtime.store.domain.settlement }), [room, runtime]);
  const selection = project.committedExportSelection();
  const blocked = !project.applicationSync() || !runtime.handoffToken || selection.ambiguousNames.length > 0 || (!selection.responseKeys.length && !selection.manualNames.length);
  const reason = !project.applicationSync() ? '応募フォームと自動連携した企画で利用できます。' : !runtime.handoffToken ? 'この端末には作成権限がありません。' : selection.ambiguousNames.length ? `同名の応募者（${selection.ambiguousNames.join('・')}）を安全に判別できません。` : '参加者を確定してください。';
  async function download() {
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
      onNotice(`${participants.length}人の引き継ぎデータを作成しました。`); onClose();
    } catch (error) { onNotice(error.message); }
  }
  return <Modal className="app-modal" open size="sm" modalHeading="引き継ぎデータ" primaryButtonText="引き継ぎデータを作成" secondaryButtonText="閉じる" primaryButtonDisabled={blocked} onRequestSubmit={download} onRequestClose={onClose}><p>学務提出書類作成ツールに読み込むための引き継ぎデータを作成します。</p>{blocked && <InlineNotification kind="warning" title="作成できません" subtitle={reason} hideCloseButton lowContrast />}</Modal>;
}

export function BugModal({ runtime, room, onClose, onNotice }) {
  const [message, setMessage] = useState(''); const [sending, setSending] = useState(false);
  async function send() { setSending(true); try { await runtime.external.bugReport({ message: message.trim().slice(0, 2000), roomId: runtime.roomId.slice(0, 80), pageUrl: location.href.slice(0, 2048), projectTitle: room.roomName }); onNotice('送信しました'); onClose(); } catch { onNotice('送信できませんでした'); setSending(false); } }
  return <Modal className="app-modal" open size="sm" modalHeading="バグを報告" primaryButtonText="送信" secondaryButtonText="キャンセル" primaryButtonDisabled={!message.trim() || sending} onRequestSubmit={send} onRequestClose={onClose} preventCloseOnClickOutside selectorPrimaryFocus="#bug-message"><TextArea id="bug-message" labelText="バグの内容" rows={6} value={message} onChange={event => setMessage(event.target.value)} /></Modal>;
}

export default function ProjectTools({ runtime, room, onNotice }) {
  const [open, setOpen] = useState('');
  const application = runtime.store.domain.applicants.validApplicationSync(room.meta?.applicationSync);
  const hasParticipants = Object.keys(room.participants || {}).length > 0;
  return <><OverflowMenu ariaLabel="参加者画面のその他の操作" iconDescription="参加者画面のその他の操作" flipped><OverflowMenuItem itemText="企画情報" onClick={() => setOpen('overview')} /><OverflowMenuItem itemText="履歴" onClick={() => setOpen('history')} />{application && hasParticipants && <OverflowMenuItem itemText="案内文" onClick={() => setOpen('guidance')} />}{application && <OverflowMenuItem itemText="引き継ぎCSV" onClick={() => setOpen('export')} />}<OverflowMenuItem itemText="バグを報告" onClick={() => setOpen('bug')} /></OverflowMenu>{open === 'overview' && <OverviewModal runtime={runtime} room={room} onNotice={onNotice} onClose={() => setOpen('')} />}{open === 'history' && <HistoryModal runtime={runtime} onNotice={onNotice} onClose={() => setOpen('')} />}{open === 'guidance' && <GuidanceModal runtime={runtime} room={room} onNotice={onNotice} onClose={() => setOpen('')} />}{open === 'export' && <ExportModal runtime={runtime} room={room} onNotice={onNotice} onClose={() => setOpen('')} />}{open === 'bug' && <BugModal runtime={runtime} room={room} onNotice={onNotice} onClose={() => setOpen('')} />}</>;
}
