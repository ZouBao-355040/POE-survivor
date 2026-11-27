import {compatible} from './skill.mjs';

export function gemPrice(gem){
 if(gem.kind==='active'){
  if(gem.tags?.includes('vaal')||gem.sourceKey?.startsWith('Pact'))return 6;
  return /Alt[A-Z]$/.test(gem.sourceKey??'')?5:3;
 }
 return gem.sourceKey?.startsWith('SupportAwakened')||gem.sourceKey?.startsWith('SupportGreater')?4:2;
}
export function purchaseGem({progression,gold,catalog,ownedIds,inTown=false},id){
 if(!inTown&&!(progression?.pendingChoices>0))throw new Error('商店尚未開放');
 const gem=catalog.find(g=>g.id===id);
 if(!gem||ownedIds.includes(id))throw new Error('這顆寶石已擁有或不在商店內');
 const cost=gemPrice(gem);
 if(!Number.isSafeInteger(gold)||gold<cost)throw new Error('金幣不足');
 return {gem,gold:gold-cost};
}
export function shopStock(catalog,ownedIds,kind,active=null){
 const owned=new Set(ownedIds);
 return catalog.filter(g=>g.kind===kind&&!owned.has(g.id)&&(!active||kind!=='support'||compatible(active,g)));
}
export function collectGold(player,existing,dropped,{all=false,radius=1.7}={}){
 const remaining=[];let amount=0;
 for(const drop of [...existing,...dropped]){
  if(all||Math.hypot(player.x-drop.x,player.y-drop.y)<=radius)amount+=drop.amount;
  else remaining.push(drop);
 }
 return {remaining,amount};
}
