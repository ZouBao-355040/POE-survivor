export const gemLevelCap=20;
export function gemXpRequired(level){return Math.round(14+10*level+3*level**1.65);}
export function gemProgress(g,xp,characterLevel){
 let level=g.level??1,experience=g.experience??0;
 if(level>=gemLevelCap||!(xp>0))return g;
 experience+=Math.round(xp*(1+Math.min(3,Math.max(0,(characterLevel??1)-level-2)*.42)));
 while(level<gemLevelCap&&experience>=gemXpRequired(level)){experience-=gemXpRequired(level);level++;}
 return {...g,level,experience:level>=gemLevelCap?0:experience};
}
export function withGemLevel(g){
 const level=g.level??1;
 if(level===1)return g;
 const n=level-1;
 if(g.kind==='active'){
  const m=1.14**n;
  return {...g,weaponDamageMultiplier:(g.weaponDamageMultiplier??1)*m,effectiveness:(g.effectiveness??1)*m,
   baseSpellDamage:Object.fromEntries(Object.entries(g.baseSpellDamage??{}).map(([k,v])=>[k,v.map(x=>x*m)]))};
 }
 const scale=1+.045*n;
 return {...g,increasedAttackSpeed:g.increasedAttackSpeed===undefined?undefined:g.increasedAttackSpeed+.012*n,
  increasedCastSpeed:g.increasedCastSpeed===undefined?undefined:g.increasedCastSpeed+.012*n,
  increasedProjectileSpeed:g.increasedProjectileSpeed===undefined?undefined:g.increasedProjectileSpeed+.01*n,
  addedDamage:g.addedDamage&&Object.fromEntries(Object.entries(g.addedDamage).map(([k,v])=>[k,v.map(x=>x*scale)])),
  gainFire:g.gainFire===undefined?undefined:g.gainFire+.008*n,
  damageMultiplier:g.damageMultiplier===undefined?1+.007*n:g.damageMultiplier*(1+.009*n)};
}
