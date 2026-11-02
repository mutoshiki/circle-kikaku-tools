import { Checkbox, Link } from '@carbon/react';

const steps = [
  { title: '目的地を検索', text: 'Googleマップで目的地を検索します。', image: '1-search.jpg', alt: 'Googleマップの検索欄' },
  { title: '車の経路を表示', text: '「経路」を押し、移動手段を車にして、出発地を設定します。', image: '2-directions.jpg', alt: '目的地の「経路」ボタン' },
  { title: '立ち寄る場所を追加', text: '必要な場合は「経由地を追加」から、立ち寄る場所を順番に追加します。', image: '3-waypoint.jpg', alt: '「経由地を追加」ボタン' },
  { title: '距離を確認して入力', text: '表示された「km」を確認し、このサイトに戻って「移動距離（km）」へ入力します。', image: '4-distance.jpg', alt: '経路の距離「39 km」の表示' },
];

export default function DistanceGuide({ checked, onCheckedChange, onOpenMaps }) {
  return <section className="distance-guide" aria-label="Googleマップで移動距離を確認する手順">
    <ol className="distance-guide__steps">
      {steps.map((step, index) => <li className="distance-guide__step" key={step.image}>
        <div className="distance-guide__step-copy"><h3>{index + 1}. {step.title}</h3><p>{step.text}</p></div>
        <img src={`${import.meta.env.BASE_URL}images/distance-guide/${step.image}`} alt={step.alt} loading="lazy" />
      </li>)}
    </ol>
    <p className="distance-guide__round-trip">往復の場合は、帰りの分も含めて確認してください。</p>
    <Checkbox id="distance-guide-skip-next-time" labelText="次回からこの説明を表示しない" checked={checked} onChange={(_, { checked: next }) => onCheckedChange(next)} />
    <div className="distance-guide__actions">
      <Link id="distance-guide-open-maps" href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" onClick={onOpenMaps}>Googleマップを開く</Link>
    </div>
  </section>;
}
