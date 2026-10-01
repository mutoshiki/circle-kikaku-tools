import { useEffect, useRef, useState } from 'react';
import { allocationSaveReceipt, settleAllocationSave } from '../ui/allocation-save.js';
import { createParticipantTaskDraft } from '../ui/participant-task-draft.js';

export default function useAllocationOperation(runtime, type) {
  const [cache] = useState(() => createParticipantTaskDraft({ storage: () => window.localStorage, roomId: runtime.roomId, task: `allocation:${type}` }));
  const [receipt, setReceipt] = useState(() => cache.read()?.receipt || null);
  const [busy, setBusy] = useState(false);
  const [recoverable, setRecoverable] = useState(() => cache.isRecoverable());
  const current = useRef(receipt), active = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  function remember(next) {
    current.current = next;
    const persisted = next ? cache.write({ receipt: next }) : cache.clear();
    if (alive.current) { setReceipt(next); setRecoverable(persisted); }
  }
  async function finish(original, retry = false) {
    const expected = original?.operationId;
    const outcome = await settleAllocationSave(runtime, original, { retry, onReceipt: next => {
      // A remounted workspace may already own another attempt. Never clear it.
      if (cache.read()?.receipt?.operationId !== (current.current?.operationId || expected)) return;
      remember(next);
    } });
    if (alive.current && current.current?.operationId === outcome.receipt?.operationId) {
      remember(['saved', 'local'].includes(outcome.disposition) ? null : outcome.receipt);
    }
    return outcome;
  }
  async function run(command, args, label) {
    if (active.current || current.current) throw new Error('前の操作の保存状態を確認してください。');
    active.current = true; setBusy(true);
    try {
      const next = allocationSaveReceipt(runtime, runtime.store.command(command, args), { type, label });
      remember(next);
      return await finish(next);
    } finally { active.current = false; if (alive.current) setBusy(false); }
  }
  async function retry() {
    if (active.current || !current.current) return null;
    active.current = true; setBusy(true);
    try { return await finish(current.current, true); }
    finally { active.current = false; if (alive.current) setBusy(false); }
  }
  function inspect() {
    if (active.current) return;
    if (['adjusted', 'reset'].includes(current.current?.disposition)) remember(null);
  }
  return { receipt, busy, recoverable, run, retry, inspect };
}
