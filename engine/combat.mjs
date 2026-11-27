import {prepareBaseDamage,convertDamage,scalePackets,aggregateDamage} from './conversion.mjs';
import {resolveHit} from './hit.mjs';
import {mitigateHit} from './defence.mjs?v=0.5.7';
import {applyDamage,paySkillCost} from './resources.mjs?v=0.5.14';
import {igniteFromPackets} from './ignite.mjs';
export function attack({attacker,target,skill,modifiers,rolls,context={}}){
 context={...context,...(skill.context??{})};
 const payment=paySkillCost(attacker,skill.costs??skill.cost??0,skill.lifeCostRatio);
 if(!payment.paid)return {performed:false,attacker,target};
 return resolveAttackImpact({attacker:payment.state,target,skill,modifiers,rolls,context});
}
export function resolveAttackImpact({attacker,target,skill,modifiers,rolls,context={}}){
 context={...context,...(skill.context??{})};
 const rules=attacker.rules??{};
 const fullLife=target.life>=target.maximumLife*(target.rules?.fullLifeThreshold??1);
 const hit=resolveHit({source:skill.source??'attack',accuracy:attacker.accuracy,evasion:target.evasion,entropy:target.entropy??0,criticalChance:(skill.criticalChance??0)+(fullLife?(skill.baseCriticalChance??0)*(rules.criticalFull??0):0),cannotEvade:rules.resolute,cannotCrit:rules.resolute||rules.precise,criticalRoll:rolls.critical,confirmationRoll:rolls.confirmation});
 if(skill.source==='spell'&&(rolls.suppress??1)<(target.defence?.spellDodge??0)){hit.hit=false;hit.critical=false;hit.dodged=true;}
 const nextTarget={...target,entropy:hit.entropy};
 if(!hit.hit)return {performed:true,hit,attacker:attacker,target:nextTarget};
 const base=prepareBaseDamage(skill.baseDamage,modifiers,context,skill.effectiveness??1);
 let packets=convertDamage(base,[...(skill.conversion??[]),...(rules.avatarFire?['physical','cold','lightning'].map(from=>({from,to:'fire',fraction:.5,kind:'convert',priority:'other'})):[])]);
 if(rules.avatarFire)packets=packets.filter(p=>p.type==='fire');
 const attackMore=rules.precise&&skill.source==='attack'&&attacker.accuracy>attacker.maximumLife?1.4:1;
 const spellMore=rules.painAttunement&&skill.source==='spell'&&attacker.life<=attacker.maximumLife*(rules.lowLifeThreshold??.5)?1.3:1;
 const damage=aggregateDamage(scalePackets(packets,modifiers,{...context,tags:[...new Set([...(context.tags??[]),'hit'])]}));
 for(const t of Object.keys(damage))damage[t]*=attackMore*spellMore*(skill.damageMultiplier??1)*(skill.hitDamageMultiplier??1)*(skill.projectileDamageMultiplier??1)*(1+(skill.increasedProjectileDamage??0))*(['physical','chaos'].includes(t)?(skill.physicalChaosMultiplier??1):1);
 if(skill.elementalOverloadActive)for(const type of ['fire','cold','lightning'])damage[type]*=1.4;
 if(hit.critical&&!rules.elementalOverload)for(const t of Object.keys(damage))damage[t]*=1+Math.max(0,(skill.criticalMultiplier??1.5)-1+(target.boss?(rules.criticalUnique??0):0))*(1-(target.defence?.reducedCritExtra??0));
 const mitigation=mitigateHit({damage,source:skill.source??'attack',defender:{...target.defence,resistances:target.combatResistances??target.defence?.resistances},penetration:skill.penetration,blockRoll:skill.noBlock?1:rolls.block,suppressRoll:rolls.suppress,suppressRetry:rolls.suppressRetry});
 const settlement=applyDamage(nextTarget,mitigation.damage,target.rules);
 const ailmentScale=(skill.elementalOverloadActive?1.4:1)*(skill.damageMultiplier??1)*(skill.projectileDamageMultiplier??1)*(1+(skill.increasedProjectileDamage??0));
 const ignite=!mitigation.blocked&&(hit.critical||rolls.ignite<(skill.igniteChance??0))?igniteFromPackets(packets.map(p=>({...p,amount:p.amount*ailmentScale})),modifiers,context,hit.critical&&!rules.elementalOverload):null;
 return {ignite:ignite?.rate>0?ignite:null,performed:true,hit,mitigation,damage,ailmentBase:aggregateDamage(packets),attacker:attacker,target:settlement.state,dead:settlement.dead,rechargeInterrupted:settlement.rechargeInterrupted};
}
