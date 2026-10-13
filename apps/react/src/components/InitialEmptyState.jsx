import { Button } from '@carbon/react';

export default function InitialEmptyState({ headingId, title, description, primaryAction, alternateAction, roomStatus }) {
  if (roomStatus?.hasLoadedRoom === false) {
    if (roomStatus.kind === 'error') return <section className="initial-empty-state" aria-labelledby={headingId}>
      <h2 id={headingId}>企画を読み込めませんでした</h2>
      <p>ページを再読み込みしてください。</p>
      <Button onClick={() => window.location.reload()}>再読み込み</Button>
    </section>;
    return <section className="initial-empty-state" aria-label="企画の読み込み状況">
      <p role="status">企画を読み込み中…</p>
    </section>;
  }
  return <section className="initial-empty-state" aria-labelledby={headingId}>
    <h2 id={headingId}>{title}</h2>
    <p>{description}</p>
    <div className="initial-empty-state__actions">
      <Button ref={primaryAction.buttonRef} onClick={primaryAction.onClick}>{primaryAction.label}</Button>
      {alternateAction && <Button ref={alternateAction.buttonRef} kind="ghost" onClick={alternateAction.onClick}>{alternateAction.label}</Button>}
    </div>
  </section>;
}
