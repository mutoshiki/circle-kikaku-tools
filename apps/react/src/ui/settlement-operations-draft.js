const clone = value => structuredClone(value);
const fields = ['version','revision','filters','collectorDraft','memoDraft','operation'];
const allowed = (object,keys) => object && typeof object==='object' && !Array.isArray(object) && Object.keys(object).every(key=>keys.includes(key));
const text = value => typeof value==='string';
const number = value => Number.isSafeInteger(value) && value>=0;
const outcomes = ['local','pending','saved','failed','unresolved','adjusted','reset','accepted-needs-review'];
const validCollectorDraft = value => allowed(value,['targetKey','context','raw']) && text(value.targetKey) && text(value.context) && text(value.raw);

export function validNarrowOperationPath(kind,path) {
  if (['revision','lastUpdatedAt','lastUpdatedBy'].includes(path)) return true;
  if (kind==='memo') return path==='settlement/memo';
  const [root,field,identity,...extra]=path.split('/');
  const fields=kind==='payment'?['driverPaidByParticipantId','driverPaidByName']:['paidByParticipantId','paidByName','paidCollectorByParticipantId','paidCollectorByName'];
  return root==='settlement' && fields.includes(field) && extra.length===0 && !!identity && !/[/.#$\[\]\u0000-\u001f\u007f]/.test(identity);
}

function validOperation(op) {
  if (op===null) return true;
  if (!op || !['collection','payment','memo','restore','undo','sample'].includes(op.kind) || !text(op.targetKey) || !number(op.resetGeneration)) return false;
  if (['restore','undo','sample'].includes(op.kind)) return allowed(op,['kind','targetKey','resetGeneration','operationId','historyTime','disposition','acknowledged']) && text(op.operationId) && outcomes.includes(op.disposition) && (op.historyTime===undefined || Number.isFinite(op.historyTime)) && (op.acknowledged===undefined || typeof op.acknowledged==='boolean');
  if (!allowed(op,['kind','targetKey','resetGeneration','receipt','collectorDraft'])) return false;
  if(op.collectorDraft!==undefined && (op.kind!=='collection' || !validCollectorDraft(op.collectorDraft) || op.collectorDraft.targetKey!==op.targetKey))return false;
  const receipt=op.receipt;
  if (!allowed(receipt,['type','label','resetGeneration','operationId','patch','before','diagnosticCount','disposition','canRetry','acknowledged']) || !number(receipt.resetGeneration) || !text(receipt.operationId) || !outcomes.includes(receipt.disposition) || !number(receipt.diagnosticCount) || typeof receipt.canRetry!=='boolean') return false;
  if (!allowed(receipt.patch,Object.keys(receipt.patch || {})) || !allowed(receipt.before,Object.keys(receipt.before || {}))) return false;
  const paths=Object.keys(receipt.patch),beforePaths=Object.keys(receipt.before),domainPaths=paths.filter(path=>path.startsWith('settlement/'));
  if(receipt.resetGeneration!==op.resetGeneration || receipt.type!==op.kind || !text(receipt.label) || !domainPaths.length || paths.length!==beforePaths.length || paths.some(path=>!beforePaths.includes(path)))return false;
  const identities=new Set(domainPaths.map(path=>path.split('/').slice(2).join('/')));
  if(op.kind!=='memo' && (identities.size!==1 || op.targetKey.startsWith('participant:') && domainPaths.some(path=>!path.endsWith(`ParticipantId/${op.targetKey.slice(12)}`))))return false;
  return Object.entries({...receipt.before,...receipt.patch}).every(([path,value])=>{
    if(!validNarrowOperationPath(op.kind,path))return false;
    if(path==='settlement/memo' || path.includes('/paidCollectorBy'))return value===null || text(value);
    if(path.startsWith('settlement/'))return value===null || typeof value==='boolean';
    return value===null || typeof value==='string' || typeof value==='number' && Number.isFinite(value);
  });
}

function valid(record) {
  if (!allowed(record,fields) || record.version!==1 || !number(record.revision)) return false;
  if (!allowed(record.filters,['collection','payment']) || !['outstanding','all'].includes(record.filters.collection) || !['outstanding','all'].includes(record.filters.payment)) return false;
  const c=record.collectorDraft,m=record.memoDraft;
  if (c!==null && !validCollectorDraft(c)) return false;
  if (m!==null && (!allowed(m,['raw','openingMemo','resetGeneration']) || !text(m.raw) || !text(m.openingMemo) || !number(m.resetGeneration))) return false;
  return validOperation(record.operation);
}

export function createOperationsCache({roomId,storage}) {
  const key=`sanpo-ui:settlement-operations:v1:${encodeURIComponent(roomId)}`;
  let record={version:1,revision:0,filters:{collection:'outstanding',payment:'outstanding'},collectorDraft:null,memoDraft:null,operation:null}, warning='';
  try { const raw=storage().getItem(key); if(raw) { const value=JSON.parse(raw); if(!valid(value)) throw Error('invalid'); record=value; } }
  catch { warning='この端末の入力の控えを読み込めません。現在の内容を確認してください。'; }
  function write(next,{expectedRevision}={}) {
    if(expectedRevision!==record.revision || !valid(next)) return false;
    record={...clone(next),revision:record.revision+1};
    try { storage().setItem(key,JSON.stringify(record)); warning=''; }
    catch { warning='入力は残っていますが、この端末に保存できません。再読み込みで復元できない場合があります。'; }
    return true;
  }
  return {read:()=>clone(record),getWarning:()=>warning,write,
    clear(field,options) { if(!['collectorDraft','memoDraft','operation'].includes(field)) return false; return write({...record,[field]:null},options); }};
}
