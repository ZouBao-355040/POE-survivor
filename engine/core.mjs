// PoE 1 core primitives. Version-specific parity validation pending.
// All percentages are fractions (0.25 = 25%).
export const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
export function scale(base,flat=0,increased=0,multipliers=[]){return Math.max(0,(base+flat)*(1+increased)*multipliers.reduce((a,b)=>a*b,1));}
export function armourReduction(armour,physicalHit,additional=0){return clamp((physicalHit>0?armour/(armour+5*physicalHit):0)+additional,0,.9);}
export function resistanceDamage(hit,resistance,maximum=.75,penetration=0){return hit*(1-(clamp(resistance,-2,Math.min(maximum,.9))-penetration));}
export function hitChance(accuracy,evasion){return clamp(accuracy<=0?0:1.25*accuracy/(accuracy+Math.pow(Math.max(0,evasion)/5,.9)),.05,1);}
export function entropyHit(entropy,chance){const n=entropy+100*clamp(chance,0,1);return {hit:n>=100,entropy:n>=100?n-100:n};}
export function manaRegeneration(maxMana,flat=0,increased=0,multipliers=[]){return scale(maxMana*.018,flat,increased,multipliers);}
export const damageTypes=Object.freeze(['physical','fire','cold','lightning','chaos']);
export const emptyDamage=()=>Object.fromEntries(damageTypes.map(t=>[t,0]));
export function criticalDamage(hit,multiplier=1.5){return hit*multiplier;}
export function suppressedDamage(hit,prevented=.5){return hit*(1-prevented);}
