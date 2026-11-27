import {rollWeaponDamage} from './weapon.mjs';

function typeExpression(expr,types){
 const stack=[];
 for(const op of expr??[]){
  if(op==='NOT')stack.push(!stack.pop());
  else if(op==='AND'||op==='OR'){const b=stack.pop(),a=stack.pop();stack.push(op==='AND'?a&&b:a||b);}
  else {stack.push(types.has(op));}
 }
 return stack.length===0||stack.some(Boolean);
}
export function compatible(active,support){
 const tags=new Set([...(active.tags??[]),...(active.weaponTypes??[]).map(t=>t.toLowerCase())]);
 if(!(support.requiresAll??[]).every(t=>tags.has(t))||(support.requiresAny?.length&&!support.requiresAny.some(t=>tags.has(t)))||(support.excludes??[]).some(t=>tags.has(t)))return false;
 if(active.types&&support.supportRules){
  const types=new Set(active.types);
  if(!typeExpression(support.supportRules.allowed_types,types))return false;
  if(support.supportRules.excluded_types?.length&&typeExpression(support.supportRules.excluded_types,types))return false;
 }
 return support.appliesTo?.(active)!==false;
}
export function effectiveSupports(active,supports){
 const byFamily=new Map();
 for(const s of supports.filter(s=>compatible(active,s))){
  const key=s.family??s.id,old=byFamily.get(key);
  if(!old||(!old.family&&s.family))byFamily.set(key,s);
 }
 return [...byFamily.values()];
}
export function compileAttack(active,weapon,supports,modifiers,random,context={}){
 const linked=effectiveSupports(active,supports);
 const product=key=>linked.reduce((n,s)=>n*(s[key]??1),1);
 const sum=key=>linked.reduce((n,s)=>n+(s[key]??0),0);
 const any=key=>linked.some(s=>s[key]);
 const deployment=active.deploy??linked.find(s=>s.deploy)?.deploy;
 const tags=[...new Set([...(context.tags??[]),...(active.tags??[]),...(deployment?[deployment]:[]),...(active.melee?['melee']:[])])];
 const ctx={...context,tags};
 const spell=tags.includes('spell')&&!tags.includes('attack');
 const effectiveness=active.effectiveness??1;
 const roll=([min,max])=>min+(max-min)*random();
 const baseDamage=spell?Object.fromEntries(Object.entries(active.baseSpellDamage??{}).map(([t,r])=>[t,roll(r)])):rollWeaponDamage(weapon,random);
 if(!spell)for(const t of Object.keys(baseDamage))baseDamage[t]*=active.weaponDamageMultiplier??effectiveness;
 for(const [t,r] of Object.entries(active.baseAddedDamage??{}))baseDamage[t]=(baseDamage[t]??0)+roll(r);
 for(const support of linked)for(const [type,range] of Object.entries(support.addedDamage??{})){baseDamage[type]=(baseDamage[type]??0)+roll(range)*effectiveness;}
 const flatFire=(active.lifeFire??0)*(ctx.maximumLife??0);
 const flatLightning=(active.manaLightning??0)*(ctx.maximumMana??0);
 if(active.lifeChaos)baseDamage.chaos=(baseDamage.chaos??0)+active.lifeChaos*((ctx.maximumLife??0)+(ctx.maximumEnergyShield??0));
 if(active.elementalOnly){delete baseDamage.physical;delete baseDamage.chaos;}
 if(flatFire)baseDamage.fire=(baseDamage.fire??0)+flatFire;
 if(flatLightning)baseDamage.lightning=(baseDamage.lightning??0)+flatLightning;
 const rateKey=spell?'castSpeed':'attackSpeed';
 const speedBase=spell?1/(active.castTime??1):weapon.attacksPerSecond*(active.attackSpeedMultiplier??1)*product('attackSpeedMultiplier');
 const speed=modifiers.breakdown(rateKey,ctx);
 const supportIncrease=sum(spell?'increasedCastSpeed':'increasedAttackSpeed');
 const speedSlope=speed.override===undefined?(speedBase+speed.flat)*speed.multipliers.reduce((a,b)=>a*b,1):0;
 const criticalBase=spell?(active.spellCriticalChance??.05):weapon.criticalChance;
 const conversion=[...(active.conversion??[])];
 if(sum('gainFire'))conversion.push({from:'physical',to:'fire',kind:'extra',fraction:sum('gainFire')});
 return {source:spell?'spell':'attack',id:active.id,active,context:ctx,baseDamage,effectiveness,conversion,
  attackSpeedPerIncrease:speedSlope,attacksPerSecond:modifiers.calculate(speedBase,rateKey,ctx)+supportIncrease*speedSlope,
  baseCriticalChance:criticalBase+(active.critBonus??0),
  criticalChance:Math.min(1,modifiers.calculate(criticalBase+(active.critBonus??0),'criticalChance',ctx)),criticalMultiplier:modifiers.calculate(1.5,'criticalMultiplier',ctx),
  lifeCostRatio:modifiers.calculate(0,'lifeCostRatio',ctx),noBlock:modifiers.calculate(0,'noBlock',ctx)>0,
  cost:Math.max(0,Math.floor(modifiers.calculate((active.cost??0)*product('costMultiplier'),'manaCost',ctx)/(1+modifiers.calculate(0,'manaEfficiency',ctx)))),
  increasedProjectileSpeed:sum('increasedProjectileSpeed'),projectileSpeedMultiplier:product('projectileSpeedMultiplier'),
  increasedProjectileDamage:sum('increasedProjectileDamage'),additionalProjectiles:sum('additionalProjectiles'),
  pierce:active.noPierce?0:(active.pierce??0)+sum('pierce')+modifiers.calculate(0,'pierce',ctx),extraPierce:active.noPierce?0:sum('pierce')+modifiers.calculate(0,'pierce',ctx),fork:sum('fork'),chain:Math.floor(((active.chain??0)+sum('chain'))*product('chainMultiplier')),
  canReturn:active.canReturn||any('canReturn')||modifiers.calculate(0,'return',ctx)>0,split:(active.split??0)+(active.splitCountInstead?sum('additionalProjectiles'):0),
  extraForkChance:sum('extraForkChance'),returnMultiplier:product('returnMultiplier'),
  echo:sum('echo'),echoRate:product('echoRate'),echoLast:product('echoLast'),
  unleash:linked.some(s=>s.unleash)?Math.max(0,...linked.map(s=>s.unleash??0))+modifiers.calculate(0,'unleashSeals',ctx):0,unleashPeriod:Math.min(1.2,...linked.map(s=>s.unleashPeriod??1.2)),
  mirage:any('mirage'),wisps:any('wisps'),voidstorm:any('voidstorm'),phantasm:any('phantasm'),pointBlank:any('pointBlank'),pinpoint:any('pinpoint'),gluttony:any('gluttony'),windburst:any('windburst'),retaliate:any('retaliate'),ironGrip:any('ironGrip'),deploy:active.deploy??linked.find(s=>s.deploy)?.deploy,focused:any('focused'),volley:any('volley'),nova:any('nova'),
  sequence:active.sequence||any('sequence'),sequenceTimePerShot:sum('sequenceTimePerShot'),
  linkedSupports:linked.map(s=>s.id),igniteChance:active.igniteChance??0,damageMultiplier:product('damageMultiplier'),
  hitDamageMultiplier:product('hitDamageMultiplier'),projectileDamageMultiplier:product('projectileDamageMultiplier'),
  physicalChaosMultiplier:product('physicalChaosMultiplier')};
}
