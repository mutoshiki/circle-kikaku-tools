import { vehicleCostTargets } from './vehicle-cost-target.js';
import { settlementRulesReadiness } from './settlement-rules-model.js';

export function orderedOperationValue(value) {
  if (Array.isArray(value)) return value.map(orderedOperationValue);
  return value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, orderedOperationValue(value[key])])) : value;
}
export const equalOperationValue = (a,b) => JSON.stringify(orderedOperationValue(a)) === JSON.stringify(orderedOperationValue(b));
export const operationNeedsReview = operation => !!operation && !['saved','local'].includes(operation.receipt?.disposition || operation.disposition);
const unsafePrototype = name => ['__proto__','prototype','constructor'].includes(name);

export function sameBusinessState({ before, after, domain }) {
  if (!before || !after) return false;
  return !domain.sync.patchHasDomainChanges(domain.sync.buildEntityPatch(before, after)) && equalOperationValue(before.meta || {}, after.meta || {});
}

export function projectSettlementOperations({room,domain,operation=null}) {
  const input = domain.settlementInput(room), {data,state} = input;
  const result = domain.settlement.calculateSettlement(data,state);
  const keyOf = domain.canonical.normalizeNameKey;
  const people = result.isStandaloneSettlement ? result.participants : Object.entries(room.participants || {}).map(([id,p]) => ({...p,participantId:id}));
  const counts = new Map();
  for (const p of [...people, ...(result.isStandaloneSettlement ? Object.values(room.participants || {}) : [])]) counts.set(keyOf(p.name),(counts.get(keyOf(p.name)) || 0) + 1);
  const context = JSON.stringify({reset:room.resetGeneration,mode:result.isStandaloneSettlement?'standalone':'registered',people:people.map(p=>[p.participantId || '',p.name])});
  const retained = (kind,key) => operationNeedsReview(operation) && operation.kind === kind && operation.targetKey === key;
  const collections = people.map(person => {
    const name = person.name, participantId = person.participantId || domain.canonical.findParticipantIdByName(room.participants || {}, name) || null;
    const key = !result.isStandaloneSettlement && person.participantId ? `participant:${person.participantId}` : `name:${name}`;
    const ambiguous = (counts.get(keyOf(name)) || 0) > 1;
    const unsafe = unsafePrototype(name) || !participantId && /[/.#$\[\]\u0000-\u001f\u007f]/.test(name);
    const reasons = [];
    if (result.excludedName === name) reasons.push('企画者免除');
    if (result.driverNames.has(name) && result.driverCollectionFree) reasons.push('運転手免除');
    if (result.driverNames.has(name) && result.driverCollectionOffset) reasons.push('支払額から差引');
    const reason = ambiguous ? '同じ名前として扱われる参加者がいるため、記録先を特定できません。' : unsafe ? '名前に保存できない文字が含まれています。対象の名前を確認してください。' : '';
    return { target:{kind:'collection',key,name,participantId,context,editable:!ambiguous&&!unsafe,reason}, name, amount:result.perPerson, paid:!!state.paid[name], collector:state.paidBy[name] || '', excluded:result.excludedNames.has(name), excludedReason:reasons.join('・'), standalone:result.isStandaloneSettlement, retained:retained('collection',key) };
  });
  const targets = vehicleCostTargets(room,domain);
  const payments = result.cars.map((car,index) => {
    const cost = targets[index];
    const safe = cost.editable && !unsafePrototype(car.name);
    const target = {kind:'payment',key:cost.key,name:car.name,participantId:cost.car.participantId || domain.canonical.findParticipantIdByName(room.participants || {},car.name) || null,context:`${context}:${cost.car.groupId || ''}:${car.name}`,editable:safe,reason:safe?'':cost.reason || '記録先を特定できません。車の名前を確認してください。'};
    return {target,name:cost.label,amount:car.adjustedTotalPay,drivers:car.driverNames,paid:!!state.driverPaid[car.name],detail:car,retained:retained('payment',target.key)};
  });
  const readiness = settlementRulesReadiness({room,input,result,domain});
  const remaining = payments.filter(row=>!row.paid);
  return {input,result,readiness,collections,payments,summary:{paidCount:result.paidCount,payerCount:result.payerCount,unpaidAmount:result.unpaidAmount,paymentRemainingCount:remaining.length,paymentRemainingAmount:remaining.reduce((sum,row)=>sum+row.amount,0),checksComplete:result.payerCount>0 && payments.length>0 && !readiness.length && !operationNeedsReview(operation) && result.unpaidCount===0 && remaining.length===0}};
}

export function resolveMoneyTarget({room,domain,kind,key}) {
  const view=projectSettlementOperations({room,domain});
  return (kind==='payment'?view.payments:view.collections).find(row=>row.target.key===key)?.target || null;
}

export function moneyTargetPaths(target) {
  const suffix = target.participantId ? 'ParticipantId' : 'Name', identity = target.participantId || target.name;
  return target.kind==='payment' ? [`settlement/driverPaidBy${suffix}/${identity}`] : [`settlement/paidBy${suffix}/${identity}`,`settlement/paidCollectorBy${suffix}/${identity}`];
}
