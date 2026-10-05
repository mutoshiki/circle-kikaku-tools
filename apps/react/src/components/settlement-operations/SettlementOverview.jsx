import {Accordion,AccordionItem,Button,Link} from '@carbon/react';
import {createSettlementRulesDraft} from '../../ui/settlement-rules-draft.js';
import {prepareStandaloneRulesDraft} from '../../ui/settlement-rules-controller.js';
import {normalClick,money} from './OperationFeedback.jsx';

export default function SettlementOverview({runtime,view,children}) {
  const {result,readiness,summary}=view;
  function taskLink(task,label,id) {return <Link id={id} href={runtime.navigation.settlementTaskHrefFor(task)} onClick={event=>{if(normalClick(event)){event.preventDefault();runtime.navigation.navigateSettlementTask(task);}}}>{label}</Link>;}
  const rulesCache=createSettlementRulesDraft({roomId:runtime.roomId,storage:()=>sessionStorage});
  const cachedRules=rulesCache.read();
  return <div className="operations-overview">
    {!result.participants.length && <section><h2>精算対象を確認</h2><p>参加者がいません。参加者を登録するか、人数だけで精算できます。</p><div className="operations-links"><Link href={runtime.navigation.taskHrefFor('import')} onClick={event=>{if(normalClick(event)){event.preventDefault();runtime.navigation.navigateTask('import');}}}>参加者を登録</Link><Button kind="tertiary" onClick={()=>{prepareStandaloneRulesDraft({runtime,cache:rulesCache});runtime.navigation.navigateSettlementTask('rules');}}>人数だけで精算</Button></div></section>}
    {readiness.length>0 && <section aria-labelledby="operations-readiness-title"><h2 id="operations-readiness-title">確認が必要な項目</h2><ul>{readiness.map(issue=><li key={issue.key}>{issue.destination ? <Link href={issue.destination.kind==='participants'?runtime.navigation.taskHrefFor('import'):issue.destination.kind==='vehicle-cost'?runtime.navigation.vehicleCostTaskHrefFor(issue.destination.destination):runtime.navigation.settlementTaskHrefFor('rules')} onClick={event=>{if(normalClick(event)){event.preventDefault(); if(issue.destination.kind==='participants') runtime.navigation.navigateTask('import');else if(issue.destination.kind==='vehicle-cost')runtime.navigation.navigateVehicleCostTask(issue.destination.destination);else runtime.navigation.navigateSettlementTask('rules');}}}>{issue.message}</Link> : issue.message}</li>)}</ul></section>}
    <section aria-labelledby="operations-amounts-title"><h2 id="operations-amounts-title">精算額</h2><p>現在の費用・ルールによる金額</p>
      <dl className="operations-amounts"><div><dt>1人あたりの請求額</dt><dd>{money(result.perPerson)}</dd></div><div><dt>費用を負担する人数</dt><dd>{result.shareCount}人</dd></div><div><dt>現金を集める人数</dt><dd>{result.payerCount}人</dd></div><div><dt>車への支払い</dt><dd>{money(result.driverTotal)}</dd></div></dl>
      <Accordion size="sm"><AccordionItem title="割勘・部費と計算内訳"><dl className="operations-amounts">{[['割勘費用',result.totalSplit],['部費',result.totalClub],['集金予定額',result.expectedCollected],['車の端数調整',result.paymentAdjustmentTotal],['集金分差引',result.totalDriverCollectionOffset],['余剰',result.surplus],['会計差額',result.accounting]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl></AccordionItem></Accordion>
      <div className="operations-links">{taskLink('rules','精算ルール','settlement-rules-entry')}<Link href={runtime.navigation.hrefFor('vehicle-costs')} onClick={event=>{if(normalClick(event)){event.preventDefault();runtime.navigation.navigate('vehicle-costs');}}}>車両費用を確認</Link>{cachedRules && <span>{cachedRules.receipt?'ルールの保存結果を確認してください':'未保存のルールあり'}</span>}</div>
    </section>
    <section aria-labelledby="operations-work-title"><h2 id="operations-work-title">集金・支払い</h2><ul className="operations-work-links"><li>{taskLink('collection','集金を確認','settlement-collection-entry')}<span>未集金 {result.unpaidCount}人・{money(summary.unpaidAmount)}</span></li><li>{taskLink('payments','支払いを確認','settlement-payments-entry')}<span>未払い {summary.paymentRemainingCount}台・{money(summary.paymentRemainingAmount)}</span></li></ul><p>チェック後に費用・ルールを変更した場合は、集金・支払いを再確認してください。</p>{summary.checksComplete && <p role="status">現在の集金・支払いチェックはすべて記録されています</p>}</section>
    {children}
  </div>;
}
