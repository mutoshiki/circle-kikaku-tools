import { Accordion, AccordionItem, Link, Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@carbon/react';
const money = value => `${Number(value || 0) < 0 ? '−' : ''}¥${Math.round(Math.abs(Number(value) || 0)).toLocaleString('ja-JP')}`;
const metrics = [
  ['shareCount', '費用を負担する人数', false], ['payerCount', '現金を集める人数', false], ['perPerson', '1人あたりの集金額', true],
  ['totalSplit', '割勘の費用合計', true], ['totalClub', '部費の費用合計', true], ['totalReward', '車出し協力代合計', true],
  ['expectedCollected', '集金予定額', true], ['totalDriverCollectionOffset', '運転手分の差し引き合計', true], ['driverTotal', '車への支払額合計', true],
  ['totalSplitRound', '車ごとの割勘の端数', true], ['totalClubRound', '車ごとの部費の端数', true], ['surplus', '割勘の余剰', true], ['accounting', '支払額と集金予定額の差', true],
];
function Comparison({ label, current = {}, candidate = {}, rows }) {
  return <Table size="sm" aria-label={label} className="rules-comparison"><TableHead><TableRow><TableHeader>項目</TableHeader><TableHeader>現在</TableHeader><TableHeader>未保存の試算</TableHeader></TableRow></TableHead><TableBody>{rows.map(([key, text, yen]) => <TableRow key={key}><TableCell>{text}</TableCell><TableCell>{yen ? money(current[key]) : `${current[key] ?? 0}人`}</TableCell><TableCell>{yen ? money(candidate[key]) : `${candidate[key] ?? 0}人`}</TableCell></TableRow>)}</TableBody></Table>;
}
export default function RulesPreview({ projection, onCorrect }) {
  const { current, candidate, readiness, candidateInput } = projection;
  return <section className="rules-preview" aria-labelledby="rules-preview-title"><h2 id="rules-preview-title">計算への影響</h2>
    <p>現在の費用と、変更した精算ルールを使った試算です。保存するまで共有ルールは変わりません。</p>
    <Comparison label="現在と未保存の試算" current={current} candidate={candidate} rows={metrics} />
    <p>1人あたりの集金額は{candidate.rounding}円単位で切り上げます。車ごとの割勘・部費への支払いは、それぞれ100円単位で切り上げます。差額には部費など異なる原資も含まれます。</p>
    <section aria-labelledby="rules-readiness-title" className="rules-readiness"><h3 id="rules-readiness-title">精算に必要な入力</h3>
      {readiness.length ? <><p>ルールは保存できます。精算額の確認前に、次の入力を確認してください。</p><ul>{readiness.map(issue => <li key={issue.key}>{issue.destination ? <Link href={onCorrect.href(issue.destination)} onClick={event => { if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) { event.preventDefault(); onCorrect(issue.destination); } }}>{issue.message}</Link> : issue.message}</li>)}</ul></> : <p>計算に必要な入力は揃っています。集金・支払いの完了を示すものではありません。</p>}
    </section>
    <h3>車ごとの試算と内訳</h3>
    <Accordion>{candidate.cars.map(car => {
      const old = current.cars.find(value => value.name === car.name);
      const state = candidateInput.state.cars[car.name];
      return <AccordionItem key={car.name} title={`${car.name}車 — ${money(car.adjustedTotalPay)}`}>
        <p>運転手: {car.driverNames.join('、') || 'なし'}。差し引き対象: {car.offsetDriverCount}人（1人 {money(car.collectionOffsetPerDriver)}）。</p>
        <Comparison label={`${car.name}車の現在と試算`} current={old} candidate={car} rows={[
          ['movementAmount', car.usesTimesRental ? 'タイムズ移動料金' : 'ガソリン代', true], ['splitExtras', '割勘の追加費用・差引', true], ['clubExtras', '部費の追加費用・差引', true],
          ['splitPay', '割勘からの支払い（差引前）', true], ['clubPay', '部費からの支払い', true], ['splitRound', '割勘の端数', true], ['clubRound', '部費の端数', true],
          ['collectionOffset', '運転手分の差し引き', true], ['adjustedSplitPay', '割勘からの支払い（差引後）', true], ['adjustedClubPay', '部費からの支払い（調整後）', true], ['adjustedTotalPay', '車への支払額', true],
        ]} />
        <p>走行距離 {state?.dist || '未入力'}km{!car.usesTimesRental && `・燃費 ${state?.eco || '未入力'}km/L・ガソリン単価 ${state?.price || '未入力'}円/L`}</p>
        <ul>{car.extras.map((extra, index) => <li key={extra.id || index}>{extra.name || '名目未入力'}: {money(extra.amountValue)}（{extra.baseType === 'club' ? '部費' : '割勘'}{extra.amountValue < 0 ? 'から差し引き' : ''}）</li>)}</ul>
      </AccordionItem>;
    })}</Accordion>
  </section>;
}
