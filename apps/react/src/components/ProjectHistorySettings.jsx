export default function ProjectHistorySettings() {
  return <div className="history-settings-layout">
    <section className="overview-section" aria-labelledby="history-section-title">
      <div className="content-section-heading">
        <div><h2 id="history-section-title">履歴</h2><p>現在の状態を保存し、必要なときに以前の状態へ戻します。</p></div>
      </div>
    </section>
    <section className="overview-section" aria-labelledby="settings-section-title">
      <div className="content-section-heading"><div><h2 id="settings-section-title">設定</h2><p>企画固有の設定は、対応する作業画面で管理します。</p></div></div>
      <p className="empty-copy">共通設定はまだありません。</p>
    </section>
  </div>;
}
