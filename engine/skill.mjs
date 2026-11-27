import {rollWeaponDamage} from './weapon.mjs';
export function compatible(active,support){
 const tags=new Set(active.tags??[]);
 return (support.requiresAll??[]).every(t=>tags.has(t))&&(!(support.requiresAny??[]).length||support.requiresAny.some(t=>tags.has(t)))&&!(support.excludes??[]).some(t=>tags.has(t));
}
export function compileAttack(active,weapon,supports,modifiers,random,context={}){
 const linked=[...new Map(supports.filter(s=>compatible(active,s)).map(s=>[s.id,s])).values()];
 const product=key=>linked.reduce((n,s)=>n*(s[key]??1),1);
 const tags=[...new Set([...(context.tags??[]),...(active.tags??[])])];
 const ctx={...context,tags};
 const effectiveness=active.effectiveness??1;
 const baseDamage=rollWeaponDamage(weapon,random);
 for(const t of Object.keys(baseDamage))baseDamage[t]*=active.weaponDamageMultiplier??effectiveness;
 const speedBase=weapon.attacksPerSecond*(active.attackSpeedMultiplier??1)*product('attackSpeedMultiplier');
 const speed=modifiers.breakdown('attackSpeed',ctx);
 return {attackSpeedPerIncrease:speed.override===undefined?(speedBase+speed.flat)*speed.multipliers.reduce((a,b)=>a*b,1):0,id:active.id,baseDamage,effectiveness,cost:Math.max(0,Math.floor(modifiers.calculate((active.cost??0)*product('costMultiplier'),'manaCost',ctx))),attacksPerSecond:modifiers.calculate(weapon.attacksPerSecond*(active.attackSpeedMultiplier??1)*product('attackSpeedMultiplier'),'attackSpeed',ctx),criticalChance:Math.min(1,modifiers.calculate(weapon.criticalChance,'criticalChance',ctx)),igniteChance:active.igniteChance??0,conversion:active.conversion??[],linkedSupports:linked.map(s=>s.id),damageMultiplier:product('damageMultiplier'),context:ctx};
}
