import { TextInput } from '@carbon/react';
import { useState } from 'react';

export default function ProjectOverview({ runtime, room }) {
  const [roomName, setRoomName] = useState(null);
  const overview = room.overview || {};
  const timetable = Array.isArray(overview.timetableItems) ? overview.timetableItems : [];
  function saveName() {
    if (roomName !== null && roomName !== room.roomName) runtime.store.command('rename', { name: roomName });
    setRoomName(null);
  }
  return <div className="overview-layout">
    <section className="overview-section" aria-labelledby="overview-basics-title">
      <div className="content-section-heading">
        <div><h2 id="overview-basics-title">企画の基本情報</h2><p>企画名は共有リンクを開く全員に表示されます。</p></div>
      </div>
      <TextInput id="room-name" labelText="企画名" placeholder="企画名未設定" value={roomName ?? room.roomName} onChange={event => setRoomName(event.target.value)} onBlur={saveName} />
    </section>
    <section className="overview-section" aria-labelledby="overview-plan-title">
      <div className="content-section-heading">
        <div><h2 id="overview-plan-title">企画メモと時刻表</h2><p>共有済みの企画情報を確認します。</p></div>
      </div>
      {overview.memo ? <p className="overview-memo">{overview.memo}</p> : <p className="empty-copy">メモはまだありません。</p>}
      {timetable.length ? <ol className="overview-timetable">{timetable.map((item, index) => <li key={`${item.time}-${item.title}-${index}`}><time>{item.time || '時刻未定'}</time><span>{item.title || '内容未設定'}</span></li>)}</ol> : <p className="empty-copy">時刻表はまだありません。</p>}
    </section>
  </div>;
}
