export function inspectLocalHistory({history,storage}) {
  let raw;try{raw=storage().getItem(history.key);}catch{return {kind:'unavailable',items:[],message:'この端末の履歴を読み込めません。保存先へのアクセスを確認してください。'};}
  try{const parsed=JSON.parse(raw || '[]');if(!Array.isArray(parsed))throw Error('not a list');return {kind:'ready',items:history.read(),message:''};}
  catch{return {kind:'corrupt',items:[],message:'この端末の履歴を読み込めません。保存済みデータは変更していません。'};}
}
