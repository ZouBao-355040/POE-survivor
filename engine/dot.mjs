import {damageTypes,emptyDamage,clamp,resistanceDamage} from './core.mjs';
// Ordinary DoT only. No hit, armour, penetration, block or suppression.
export function mitigateDot(rates,defender={}){
 const result=emptyDamage(),maximumReduction=defender.maximumDamageReduction??.9;
 for(const t of damageTypes){
 let v=Math.max(0,rates[t]??0);
 if(t==='physical')v*=1-clamp(defender.additionalPhysicalReduction??0,0,maximumReduction);
 else v=resistanceDamage(v,defender.resistances?.[t]??0,defender.maximumResistances?.[t]??.75,0);
 if(['fire','cold','lightning'].includes(t))v*=1-clamp(defender.additionalElementalReduction??0,0,maximumReduction);
 v*=Math.max(0,1+(defender.increasedTaken??0)+(defender.increasedDotTaken??0)+(defender.increasedTakenByType?.[t]??0));
 v*=(defender.takenMultipliers??[]).reduce((a,b)=>a*b,1);
 result[t]=v;
 }return result;
}
export function dotRate(base,{increased=0,dotMultiplier=0,more=[]}={}){
 return Math.max(0,base*(1+increased)*(1+dotMultiplier)*more.reduce((a,b)=>a*b,1));
}
// Integrate constant-rate intervals, including exact expiration boundaries.
export function integrateDot(instances,start,end,defender={}){
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)throw new RangeError('Invalid interval');
 const damage=emptyDamage();
 for(const i of instances){
 if(!damageTypes.includes(i.type)||!Number.isFinite(i.rate)||i.rate<0||!Number.isFinite(i.start)||!Number.isFinite(i.end)||i.end<i.start)throw new Error('Invalid DoT instance');
 const dt=Math.max(0,Math.min(end,i.end)-Math.max(start,i.start));
 const rate=mitigateDot({[i.type]:i.rate},defender)[i.type];
 damage[i.type]+=rate*dt;
 }return damage;
}
