import {prepareBaseDamage,convertDamage,scalePackets,aggregateDamage} from './conversion.mjs';
import {resolveHit} from './hit.mjs?v=0.5.15';
import {mitigateHit} from './defence.mjs?v=0.5.7';
import {applyDamage,paySkillCost} from './resources.mjs?v=0.5.14';
import {igniteFromPackets} from './ignite.mjs?v=0.5.15';
export function attack({attacker,target,skill,modifiers,rolls,context={},combatTime=0}){
 context={...context,...(skill.context??{})};
 const payment=paySkillCost(attacker,skill.costs??skill.cost??0,skill.lifeCostRatio);
 if(!payment.paid)return {performed:false,attacker,target};
 return resolveAttackImpact({attacker:payment.state,target,skill,modifiers,rolls,context,combatTime});
}
export function resolveAttackImpact({attacker,target,skill,modifiers,rolls,context={},combatTime=0}){
 context={...context,...(skill.context??{})};
 const rules=attacker.rules??{};
 const source=skill.source??'attack';
 const arrowDance=source==='attack'&&target.rules?.arrowDancing;
 const dodgeRating=(target.evasion??0)*(arrowDance?skill.attackKind==='projectile'?2:skill.attackKind==='melee'?.75:1:1);
 const wind=source==='attack'&&target.rules?.windDancer;
 const recently=wind&&combatTime-(target.lastAttackHit??-Infinity)<4-1e-9;
 const fullLife=target.life>=target.maximumLife*(target.rules?.fullLifeThreshold??1);
 const hit=resolveHit({source,moreEvadeChance:recently?1.1:1,accuracy:attacker.accuracy,evasion:dodgeRating,entropy:target.entropy??0,criticalChance:(skill.criticalChance??0)+(fullLife?(skill.baseCriticalChance??0)*(rules.criticalFull??0):0),cannotEvade:rules.resolute,cannotCrit:rules.resolute||rules.precise,criticalRoll:rolls.critical,confirmationRoll:rolls.confirmation});
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
 const criticalMultiplier=(skill.criticalMultiplier??1.5)+(target.boss?(rules.criticalUnique??0):0);
 const criticalAilment=hit.critical&&!rules.elementalOverload;
 const canInflictHitAilments=!rules.perfectAgony||criticalAilment;
 const ailmentCriticalMultiplier=rules.perfectAgony?criticalMultiplier:undefined;
 if(hit.critical&&!rules.elementalOverload&&!rules.perfectAgony)for(const t of Object.keys(damage))damage[t]*=1+Math.max(0,criticalMultiplier-1)*(1-(target.defence?.reducedCritExtra??0));
 const defender={...target.defence,resistances:target.combatResistances??target.defence?.resistances};
 if(wind)defender.hitTakenMultipliers=[...(defender.hitTakenMultipliers??[]),recently?1.2:.8];
 const mitigation=mitigateHit({damage,source,defender,penetration:skill.penetration,blockRoll:skill.noBlock?1:rolls.block,suppressRoll:rolls.suppress,suppressRetry:rolls.suppressRetry});
 // An attack landed even if it was subsequently blocked; spells never update the attack history.
 if(source==='attack')nextTarget.lastAttackHit=combatTime;
 const settlement=applyDamage(nextTarget,mitigation.damage,target.rules);
 const ailmentScale=(skill.elementalOverloadActive?1.4:1)*(skill.damageMultiplier??1)*(skill.projectileDamageMultiplier??1)*(1+(skill.increasedProjectileDamage??0));
 const ignite=!mitigation.blocked&&canInflictHitAilments&&(hit.critical||rolls.ignite<(skill.igniteChance??0))?igniteFromPackets(packets.map(p=>({...p,amount:p.amount*ailmentScale})),modifiers,context,criticalAilment,ailmentCriticalMultiplier):null;
 return {ignite:ignite?.rate>0?ignite:null,performed:true,hit,mitigation,damage,canInflictHitAilments,ailmentCriticalMultiplier,ailmentBase:aggregateDamage(packets),attacker:attacker,target:settlement.state,dead:settlement.dead,rechargeInterrupted:settlement.rechargeInterrupted};
}
