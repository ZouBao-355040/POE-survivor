import {compatible} from './skill.mjs';
import {actOne} from './act-one.mjs';

const unlocks=[
 {level:1,chapter:1,after:null,label:'抵達獅眼守望'},
 {level:4,chapter:1,after:'coast',label:'完成暮光海灘'},
 {level:8,chapter:1,after:'passage',label:'完成海潮地穴'},
 {level:12,chapter:1,after:'upper-prison',label:'擊敗典獄長布魯特斯'},
 {level:16,chapter:2,label:'抵達第二章'},
 {level:24,chapter:3,label:'抵達第三章'},
 {level:34,chapter:4,label:'抵達第四章'},
];
const stageById=new Map(actOne.map(({id},index)=>[id,index]));
const specialTags=new Set(['awakened','exceptional','vaal','pact']);
const special=gem=>gem.tags?.some(tag=>specialTags.has(tag))||/Alt[A-Z]$/.test(gem.sourceKey??'');
export function shopCampaign({chapter=1,zone,routeIndex=0,encounter,dead}){
 return {chapter,reachedTown:zone==='town'||zone==='trial',
  cleared:routeIndex+Number(zone==='trial'&&encounter?.phase==='cleared'&&!dead)};
}
export function gemAvailability(gem,{progression,campaign}){
 if(special(gem))
  return {available:false,listed:false,reason:'特殊寶石，不由商店販售'};
 const requiredLevel=gem.requiredLevel??1;
 const gate=unlocks.findLast(tier=>requiredLevel>=tier.level);
 const requirements=[];
 if(!campaign?.reachedTown||campaign.chapter<gate.chapter||
    (campaign.chapter===1&&gate.after&&campaign.cleared<=stageById.get(gate.after)))requirements.push(gate.label);
 if((progression?.level??1)<requiredLevel)requirements.push('角色等級 '+requiredLevel);
 return {available:requirements.length===0,listed:true,reason:requirements.join('、'),requiredLevel};
}

export function gemPrice(gem){
 if(gem.kind==='active'){
  if(gem.tags?.includes('vaal')||gem.sourceKey?.startsWith('Pact'))return 6;
  return /Alt[A-Z]$/.test(gem.sourceKey??'')?5:3;
 }
 return gem.sourceKey?.startsWith('SupportAwakened')||gem.sourceKey?.startsWith('SupportGreater')?4:2;
}
export function purchaseGem({progression,gold,catalog,ownedIds,campaign,inTown=false},id){
 if(!inTown)throw new Error('商店尚未開放');
 const gem=catalog.find(g=>g.id===id);
 if(!gem||ownedIds.includes(id))throw new Error('這顆寶石已擁有或不在商店內');
 const status=gemAvailability(gem,{progression,campaign});
 if(!status.available)throw new Error(status.reason);
 const cost=gemPrice(gem);
 if(!Number.isSafeInteger(gold)||gold<cost)throw new Error('金幣不足');
 return {gem,gold:gold-cost};
}
export function shopStock(catalog,ownedIds,kind,active=null){
 const owned=new Set(ownedIds);
 return catalog.filter(g=>g.kind===kind&&!special(g)&&!owned.has(g.id)&&(!active||kind!=='support'||compatible(active,g)));
}
export function selectDroppedGem(kill,catalog,ownedIds,context,random=Math.random){
 if(random()>=(kill.boss?.15:.008))return null;
 const owned=new Set(ownedIds);
 const eligible=catalog.filter(g=>!owned.has(g.id)&&gemAvailability(g,context).available);
 return eligible.length?eligible[Math.floor(random()*eligible.length)]:null;
}
export function collectGold(player,existing,dropped,{all=false,radius=1.7}={}){
 const remaining=[];let amount=0;
 for(const drop of [...existing,...dropped]){
  if(all||Math.hypot(player.x-drop.x,player.y-drop.y)<=radius)amount+=drop.amount;
  else remaining.push(drop);
 }
 return {remaining,amount};
}
