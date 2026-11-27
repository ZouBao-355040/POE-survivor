import {damageTypes,emptyDamage,clamp,armourReduction,resistanceDamage} from './core.mjs';
export function shiftTaken(damage,rules=[]){
 const out=emptyDamage();
 for(const type of damageTypes){
 const amount=damage[type]??0;
 const rs=rules.filter(r=>r.from===type);
 for(const r of rs)if(!damageTypes.includes(r.to)||r.to===type||!Number.isFinite(r.fraction)||r.fraction<0)throw new Error('Invalid damage shift');
 const total=rs.reduce((s,r)=>s+r.fraction,0),factor=total>1?1/total:1;
 out[type]+=amount*(1-Math.min(total,1));
 for(const r of rs)out[r.to]+=amount*r.fraction*factor;
 }return out;
}
// Preliminary ordinary hits only; special keystones and damage prevention deferred.
export function mitigateHit({damage,source,defender={},penetration={},blockRoll=1,suppressRoll=1}){
 if(!['attack','spell'].includes(source))throw new Error('Invalid source');
 const shifted=shiftTaken(damage,defender.takenAs);
 const blocked=blockRoll<clamp(source==='attack'?(defender.attackBlock??0):(defender.spellBlock??0),0,defender.maximumBlock??.75);
 const suppressed=source==='spell'&&suppressRoll<clamp(defender.suppressionChance??0,0,1);
 const result=emptyDamage();
 for(const t of damageTypes){
 let v=shifted[t];
 if(t==='physical')v*=1-armourReduction(defender.armour??0,v,defender.additionalPhysicalReduction??0);
 else v=resistanceDamage(v,defender.resistances?.[t]??0,defender.maximumResistances?.[t]??.75,penetration[t]??0);
 v*=Math.max(0,1+(defender.increasedTaken??0)+(defender.increasedTakenByType?.[t]??0));
 if(suppressed)v*=1-clamp(defender.suppressionPrevented??.5,0,1);
 if(blocked)v*=clamp(defender.blockedDamageFraction??0,0,1);
 result[t]=v;
 }return {damage:result,blocked,suppressed,total:Object.values(result).reduce((a,b)=>a+b,0)};
}
