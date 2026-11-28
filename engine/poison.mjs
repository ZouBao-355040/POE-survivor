export function poisonApplication({result,skill,player,modifiers,time,mult=1,chainBonus=0,pierceBonus=0,minion=false,random=Math.random}){
 if(!result.hit?.hit||result.mitigation?.blocked||!result.canInflictHitAilments||player.rules?.avatarFire)return null;
 const base=(result.ailmentBase?.physical??0)+(result.ailmentBase?.chaos??0);
 if(!(base>0))return null;
 const ctx={...skill.context,tags:[...new Set([...(skill.context?.tags??[]),skill.source??'attack'])]};
 const chance=(skill.active?.poisonChance??0)+(minion?0:modifiers.calculate(0,'poisonChance',ctx));
 if(!(chance>0)||random()>=chance)return null;
 // A hit can constrain application chance, but hit-only damage does not scale poison.
 const excluded=new Set(['hit','attack','spell','projectile','melee','area','fire','cold','lightning','elemental']);
 const active=(result.target?.dots??[]).filter(x=>x.start<=time&&x.end>time);
 const dot={...ctx,tags:[...ctx.tags.filter(t=>!excluded.has(t)),'poison'],
  conditions:{...ctx.conditions,nonPoisoned:!minion&&!active.some(x=>x.key==='poison'),
   bleedingTarget:!minion&&active.some(x=>x.key==='bleed')}};
 const faster=minion?1:Math.max(.01,1+modifiers.calculate(0,'poisonFaster',dot));
 const crit=result.hit.critical&&!player.rules?.elementalOverload;
 const scaling=modifiers.calculate(1,['damage','chaosDamage','damageOverTime','poisonDamage'],dot);
 const multiplier=Math.max(0,result.ailmentCriticalMultiplier??(1+(crit?.5:0)+modifiers.calculate(0,['dotMultiplier','chaosDotMultiplier','poisonDotMultiplier'],dot)));
 const rate=base*.3*faster*scaling*multiplier*mult*(1+chainBonus+pierceBonus)*(skill.physicalChaosMultiplier??1)*(skill.projectileDamageMultiplier??1);
 const duration=modifiers.calculate(2,'poisonDuration',dot)/faster;
 return rate>0&&duration>0?{type:'chaos',key:'poison',rate,start:time,end:time+duration}:null;
}
