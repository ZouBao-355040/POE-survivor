import {damageTypes,scale} from './core.mjs';
export function weaponStats(base,local={}){
 const damage={};
 for(const type of damageTypes){
 const range=base.damage[type]??[0,0],flat=local.damage?.[type]??[0,0],inc=local.increasedDamage?.[type]??0;
 damage[type]=range.map((v,i)=>scale(v,flat[i],inc));
 }
 return {damage,attacksPerSecond:scale(base.attacksPerSecond,0,local.increasedAttackSpeed??0),criticalChance:scale(base.criticalChance,0,local.increasedCriticalChance??0)};
}
export function rollWeaponDamage(weapon,random){
 const result={};
 for(const type of damageTypes){const [min,max]=weapon.damage[type];const roll=random();if(!(roll>=0&&roll<1))throw new RangeError('Invalid random sample');result[type]=min+(max-min)*roll;}
 return result;
}
