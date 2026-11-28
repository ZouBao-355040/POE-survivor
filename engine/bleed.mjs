import {mitigateDot} from './dot.mjs';

// Applications expire independently. Do not discard a weaker one merely
// because it is currently out of the top one/eight: it may outlast the others.
export function integrateBleed(instances,start,end,movingUntil=start,defender={}){
 if(!instances.length||end<=start)return 0;
 const cuts=[...new Set([start,end,movingUntil,...instances.flatMap(i=>[i.start,i.end])])]
  .filter(t=>t>=start&&t<=end).sort((a,b)=>a-b);
 let damage=0;
 for(let n=0;n+1<cuts.length;n++){
  const t=cuts[n],span=cuts[n+1]-t;
  const active=instances.filter(i=>i.start<=t&&i.end>t);
  const limit=active.some(i=>i.crimson)?8:1;
  const rates=active.map(i=>i.rate*(i.crimson?1:t<movingUntil||i.aggravated?3:1)).sort((a,b)=>b-a);
  const rate=rates.slice(0,limit).reduce((a,b)=>a+b,0);
  damage+=mitigateDot({physical:rate},defender).physical*span;
 }
 return damage;
}

export function bleedApplication({result,skill,player,modifiers,time,mult=1,chainBonus=0,pierceBonus=0,minion=false,random=Math.random}){
 const base=result.ailmentBase?.physical??0;
 if(!(base>0)||!result.hit?.hit||result.mitigation?.blocked||!result.canInflictHitAilments||(skill.source??'attack')!=='attack'||player.rules?.avatarFire)return null;
 const skillContext={...skill.context,tags:[...new Set([...(skill.context?.tags??[]),'attack'])]};
 const isPuncture=!!skill.active?.bleed;
 const chance=isPuncture?1:minion?0:modifiers.calculate(0,'bleedChance',skillContext);
 if(!(chance>0)||(chance<1&&random()>=chance))return null;
 const excluded=new Set(['attack','spell','projectile','hit','melee','area']);
 const dotContext={...skillContext,tags:skillContext.tags.filter(tag=>!excluded.has(tag))};
 const crimson=!!player.rules?.crimsonDance&&!minion;
 const critical=!!result.hit.critical&&!player.rules?.elementalOverload;
 const faster=Math.max(.01,1+modifiers.calculate(0,'bleedFaster',dotContext));
 const scaling=modifiers.calculate(1,['damage','physicalDamage','damageOverTime','bleedDamage'],dotContext);
 const dotMultiplier=Math.max(0,result.ailmentCriticalMultiplier??(1+(critical?.5:0)+
  modifiers.calculate(0,['dotMultiplier','physicalDotMultiplier','bleedDotMultiplier'],dotContext)));
 const rate=base*(isPuncture?.91:.7)*scaling*dotMultiplier*mult*(1+chainBonus+pierceBonus)*
  (skill.physicalChaosMultiplier??1)*(skill.projectileDamageMultiplier??1)*faster*(crimson?.5:1);
 const duration=modifiers.calculate(isPuncture?(skill.active.duration??8):5,'bleedDuration',dotContext)/faster;
 return rate>0&&duration>0?{type:'physical',key:'bleed',crimson,rate,start:time,end:time+duration}:null;
}
