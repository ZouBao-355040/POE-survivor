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
// Apply the attack multiplier before measuring excess; excess enters the spell base.
export function blockStats({attack=0,spell=0,attackMaxBonus=0,spellMaxBonus=0,glancing=false,versatile=false}={}){
 const penalty=versatile?.10:0, multiplier=glancing?2:1;
 const maximumAttackBlock=clamp(.75+attackMaxBonus-penalty,0,.90);
 const maximumSpellBlock=clamp(.75+spellMaxBonus-penalty,0,.90);
 const uncappedAttackBlock=Math.max(0,attack*multiplier);
 const attackBlockExcess=Math.max(0,uncappedAttackBlock-maximumAttackBlock);
 const uncappedSpellBlock=Math.max(0,(spell+(versatile?2*attackBlockExcess:0))*multiplier);
 return {attackBlock:Math.min(uncappedAttackBlock,maximumAttackBlock),spellBlock:Math.min(uncappedSpellBlock,maximumSpellBlock),
  maximumAttackBlock,maximumSpellBlock,attackBlockExcess,blockedDamageFraction:glancing?.65:0};
}
// Preliminary ordinary hits only; special keystones and damage prevention deferred.
export function mitigateHit({damage,source,defender={},penetration={},blockRoll=1,suppressRoll=1,suppressRetry=1}){
 if(!['attack','spell'].includes(source))throw new Error('Invalid source');
 const shifted=shiftTaken(damage,defender.takenAs);
 const isAttack=source==='attack';
 const cap=(isAttack?defender.maximumAttackBlock:defender.maximumSpellBlock)??defender.maximumBlock??.75;
 const blocked=blockRoll<clamp((isAttack?defender.attackBlock:defender.spellBlock)??0,0,cap);
 const suppressed=source==='spell'&&(defender.suppressionLucky?Math.min(suppressRoll,suppressRetry):suppressRoll)<clamp(defender.suppressionChance??0,0,1);
 const result=emptyDamage(),maximumReduction=defender.maximumDamageReduction??.9;
 for(const t of damageTypes){
 let v=shifted[t];
 if(t==='physical')v*=1-Math.min(maximumReduction,armourReduction((defender.armour??0)*(defender.hitArmourMultiplier??1),v,defender.additionalPhysicalReduction??0));
 else v=resistanceDamage(v,defender.resistances?.[t]??0,defender.maximumResistances?.[t]??.75,penetration[t]??0);
 if(['fire','cold','lightning'].includes(t))v*=1-clamp(defender.additionalElementalReduction??0,0,maximumReduction);
 v*=Math.max(0,1+(defender.increasedTaken??0)+(defender.increasedTakenByType?.[t]??0));
 v*=(defender.takenMultipliers??[]).reduce((a,b)=>a*b,1);
 v*=(defender.hitTakenMultipliers??[]).reduce((a,b)=>a*b,1);
 if(suppressed)v*=1-clamp(defender.suppressionPrevented??.5,0,1);
 if(blocked)v*=clamp(defender.blockedDamageFraction??0,0,1);
 result[t]=v;
 }return {damage:result,blocked,suppressed,physicalPrevented:Math.max(0,shifted.physical-result.physical),total:Object.values(result).reduce((a,b)=>a+b,0)};
}
