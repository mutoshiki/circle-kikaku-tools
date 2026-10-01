import { useEffect, useRef, useState } from 'react';
import { Button, ContainedList, ContainedListItem, Form, InlineNotification, TextArea } from '@carbon/react';
import { allocationPresentation } from '../../ui/allocation-view.js';
import { notice } from '../../ui/task-contracts.js';

export default function AllocationPresentation({ view, projectName, receipt, busy, onNotice }) {
  const { text, duplicateNames } = allocationPresentation(view, projectName);
  const label = view.type === 'team' ? '班割' : '車割';
  const role = view.type === 'team' ? '班長' : '運転手';
  const [error, setError] = useState('');
  const [copying, setCopying] = useState(false);
  const active = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function copy(event) {
    event.preventDefault();
    if (active.current || busy || receipt) return;
    active.current = true; setCopying(true); setError('');
    try {
      await navigator.clipboard.writeText(text);
      if (alive.current) onNotice(notice.success(`${label}をコピーしました`, { placement: 'toast' }));
    } catch { if (alive.current) setError('コピーの権限を確認して再試行してください。プレビューを選択してコピーすることもできます。'); }
    finally { active.current = false; if (alive.current) setCopying(false); }
  }
  return <section aria-label={`${label}の読み取り専用結果`} className="allocation-presentation">
    <p>現在の割り当てを表示しています。編集すると、この結果も更新されます。</p>
    {duplicateNames.length > 0 && <InlineNotification kind="warning" title="同名の参加者がいます" subtitle="コピー文だけでは区別できない場合があります。編集画面の参加者情報を確認してください。" hideCloseButton lowContrast />}
    {view.groups.map(group => <section key={group.id} aria-label={group.name}>
      <h2>{group.name}</h2><p>{group.peopleCount}人 / 上限{group.totalLimit}人</p>
      <ContainedList label={`${group.name}の参加者`} size="lg">{group.people.map(person => <ContainedListItem key={person.participantId}>{person.name}{person.driver ? ` · ${role}` : ''}</ContainedListItem>)}</ContainedList>
      {!group.roles.length && <p>{role}が設定されていません</p>}
      {group.issues.some(issue => issue.kind === 'over-capacity') && <p>割り当て人数が上限を超えています</p>}
    </section>)}
    <ContainedList label={`未割り当て ${view.waiting.length}人`} size="lg">{view.waiting.length ? view.waiting.map(person => <ContainedListItem key={person.participantId}>{person.name}{person.driver ? ` · ${role}` : ''}</ContainedListItem>) : <ContainedListItem>未割り当ての参加者はいません</ContainedListItem>}</ContainedList>
    <Form aria-label={`${label}をコピー`} className="allocation-copy-form" onSubmit={copy} aria-busy={copying}>
      <TextArea id="allocation-preview" labelText="割当結果プレビュー" value={text} readOnly rows={14} />
      {(receipt || busy) && <p role="status">共有保存が未確認のためコピーできません。保存状態と現在の結果を確認してください。</p>}
      {error && <InlineNotification kind="error" title={`${label}をコピーできませんでした`} subtitle={error} hideCloseButton lowContrast />}
      <div><Button type="submit" disabled={copying || busy || !!receipt}>{label}をコピー</Button></div>
    </Form>
  </section>;
}
