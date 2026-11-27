import {prepareBaseDamage,convertDamage,scalePackets,aggregateDamage} from './conversion.mjs';
import {resolveHit} from './hit.mjs';
import {mitigateHit} from './defence.mjs';
import {applyDamage,payManaCost} from './resources.mjs';
export function attack({attacker,target,skill,modifiers,rolls,context={}}){
 context={...context,...(skill.context??{})};
 const payment=payManaCost(attacker,skill.cost??0,{eldritchBattery:!!attacker.rules?.eldritchBattery});
 if(!payment.paid)return {performed:false,attacker,target};
 const hit=resolveHit({source:'attack',accuracy:attacker.accuracy,evasion:target.evasion,entropy:target.entropy??0,criticalChance:skill.criticalChance??0,criticalRoll:rolls.critical,confirmationRoll:rolls.confirmation});
 const nextTarget={...target,entropy:hit.entropy};
 if(!hit.hit)return {performed:true,hit,attacker:payment.state,target:nextTarget};
 const base=prepareBaseDamage(skill.baseDamage,modifiers,context,skill.effectiveness??1);
 const damage=aggregateDamage(scalePackets(convertDamage(base,skill.conversion??[]),modifiers,context));
 for(const t of Object.keys(damage))damage[t]*=skill.damageMultiplier??1;
 if(hit.critical)for(const t of Object.keys(damage))damage[t]*=skill.criticalMultiplier??1.5;
 const mitigation=mitigateHit({damage,source:'attack',defender:target.defence,penetration:skill.penetration,blockRoll:rolls.block});
 const settlement=applyDamage(nextTarget,mitigation.damage,target.rules);
 return {performed:true,hit,mitigation,attacker:payment.state,target:settlement.state,dead:settlement.dead};
}
