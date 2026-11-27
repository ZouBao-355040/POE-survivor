import {compileAttack} from './skill.mjs?v=0.5.1';
import {weaponStats} from './weapon.mjs';
import {crudeBow,burningArrow,basicBowAttack} from './starter-data.mjs';
import {Momentum,momentumSupport} from './momentum.mjs';
import {payManaCost,applyDamage} from './resources.mjs';
import {resolveAttackImpact} from './combat.mjs';
import {projectilePattern,bearing} from './projectile-pattern.mjs';
import {nearestEnemy,distance} from './world.mjs';
import {Charges,chargeEffects} from './charges.mjs';
import {mitigateDot} from './dot.mjs';

const TAU=2*Math.PI;
const segmentDistance=(e,a,b)=>{
 const dx=b.x-a.x,dy=b.y-a.y,n=dx*dx+dy*dy,numerator=(e.x-a.x)*dx+(e.y-a.y)*dy;
 const t=n===0?0:Math.min(1,Math.max(0,numerator/n));
 return Math.hypot(e.x-a.x-t*dx,e.y-a.y-t*dy);
};
const trainingWeapons={
 Bow:crudeBow,Wand:{damage:{physical:[6,11]},attacksPerSecond:1.45,criticalChance:.07},
 Shield:{damage:{physical:[7,13]},attacksPerSecond:1.35,criticalChance:.05},
 'One Hand Sword':{damage:{physical:[7,13]},attacksPerSecond:1.45,criticalChance:.05},
 Claw:{damage:{physical:[5,12]},attacksPerSecond:1.5,criticalChance:.065},
 'One Hand Axe':{damage:{physical:[7,14]},attacksPerSecond:1.35,criticalChance:.05},
 Unarmed:{damage:{physical:[4,8]},attacksPerSecond:1.5,criticalChance:.05}
};
export const trainingWeaponFor=g=>Object.keys(trainingWeapons).find(w=>g?.weaponTypes?.includes(w))??'Bow';
const colorFor={physical:'#efdfc5',fire:'#ff995a',ice:'#8bdefe',lightning:'#dad3ff',chaos:'#afda74'};
const colorForSkill=g=>g.tags.includes('fire')?colorFor.fire:g.tags.includes('cold')?colorFor.ice:g.tags.includes('lightning')?colorFor.lightning:g.tags.includes('chaos')?colorFor.chaos:colorFor.physical;

export function rangerHooks({modifiers,random=Math.random,weapon=weaponStats(crudeBow),active=burningArrow,supports=[momentumSupport],momentum=new Momentum(),inventory}){
 const charges=new Charges();
 let intensity=0,lastIntensity=0,casts=0,souls=60,soulBlockedUntil=0,walked=0,hunger=0,disgorgeUntil=0,lastSealAt=-4,phantasmAt=-Infinity;
 const addSouls=(count,time)=>{if(time>=soulBlockedUntil)souls=Math.min(60,souls+count);};
 const resetIntensity=distance=>{intensity=0;walked=Math.min(10,walked+distance);};
 const rolls=()=>({critical:random(),confirmation:random(),block:random(),ignite:random()});
 const targetWithin=(env,at,range)=>env.enemies.filter(e=>e.life>0&&distance(at,e)<=range+(e.radius??.35));
 const skillDamage=(s,m)=>({...s,damageMultiplier:s.damageMultiplier*m});
 const radial=(p,count,range,phase=0)=>{
  const volley={hits:new Set()},returnVolley={hits:new Set()};
  return Array.from({length:count},(_,i)=>{
   const a=phase+TAU*i/count;
   return {...p,x:p.x,y:p.y,dx:Math.cos(a),dy:Math.sin(a),remainingRange:range,delay:0,age:0,distanceTravelled:0,heading:a,
    hitIds:[],volley,returnVolley,returning:false,noCollision:false,burst:0,nova:0,ignoreId:null};
  });
 };
 function detonate(p,env,exclude,amount=1,radius=p.skill.active.areaRadius??1.2){
  for(const e of targetWithin(env,p,radius))if(e.id!==exclude)env.hit(e,{...p,secondary:true,skill:skillDamage(p.skill,amount)});
  env.addField({x:p.x,y:p.y,radius,color:p.color,until:env.time+.19,visual:true});
 }
 function applyDot(p,target,env,type,rate,duration,stack=false,key=p.skill.id){
  if(rate<=0)return;
  const index=env.enemies.findIndex(e=>e.id===target.id);
  if(index<0)return;
  const t=env.enemies[index],dots=(t.dots??[]).filter(x=>stack||x.key!==key);
  dots.push({type,key,rate,start:env.time,end:env.time+duration});
  env.enemies[index]={...t,dots};
 }
 function paintDormant(p,env,radius=.36,until=1){
  env.addField({x:p.x,y:p.y,color:p.color,radius,until:env.time+until,visual:true});
 }
 function field(p,env,type){
  const a=p.skill.active;
  env.addField({x:p.x,y:p.y,radius:a.areaRadius??1.2,color:p.color,type,skill:p.skill,
   until:env.time+(a.duration??2),next:env.time,pulseEvery:.2,moving:a.movingGround,fuseGround:a.fuseGround,pierce:p.pierce,rolls:p.rolls,attacker:p.attacker});
 }
 function projectileSpeed(chosen,skill){
  const base=chosen.projectileSpeed??32.6, ps=modifiers.breakdown('projectileSpeed',skill.context);
  const support=ps.override===undefined?(base+ps.flat)*ps.multipliers.reduce((a,b)=>a*b,1)*skill.increasedProjectileSpeed:0;
  return Math.max(.001,(modifiers.calculate(base,'projectileSpeed',skill.context)+support)*(skill.projectileSpeedMultiplier??1));
 }
 return {momentum,charges,addSouls,onMove:resetIntensity,onFire(player,target,time,enemies=[target],env){
  const linked=inventory?.current();
  let chosen=inventory?(linked?.active??basicBowAttack):active;
  const ctx={maximumLife:player.maximumLife,maximumMana:player.maximumMana,maximumEnergyShield:player.maximumEnergyShield};
  let skillSupports=inventory?(linked?.supports??[]):supports;
  if(chosen.pactActive){
   const base=chosen.pactActive,boost=chosen.pact==='beidat',n=(chosen.level??1)-1;
   const baseSpellDamage=Object.fromEntries(Object.entries(base.baseSpellDamage).map(([k,v])=>[k,v.map(x=>x*(1+.13*n)*1.16)]));
   chosen={...base,id:chosen.id,name:chosen.name,sourceKey:chosen.sourceKey,level:chosen.level,
    pact:chosen.pact,baseSpellDamage,baseDot:base.baseDot*1.40,gemDotScale:chosen.gemDotScale,cost:chosen.cost||base.cost,radiation:false,lifeCost:.024,radialLaunch:boost,
    projectileCount:boost?5:2,spiral:boost};
  }
  if(chosen.vaalSouls&&souls<chosen.vaalSouls){
   chosen=chosen.fallbackActive??basicBowAttack;
  }
  const equipped=inventory?weaponStats(trainingWeapons[trainingWeaponFor(chosen)]):weapon;
  let skill=compileAttack(chosen,equipped,skillSupports,modifiers,random,ctx);
  let payment=payManaCost(player,skill.cost,{eldritchBattery:!!player.rules?.eldritchBattery});
  if(!payment.paid){chosen=basicBowAttack;skill=compileAttack(chosen,weapon,[],modifiers,random,ctx);payment=payManaCost(player,0);}
  if(!payment.paid||distance(player,target)<1e-9)return null;
  if(chosen.vaalSouls){souls-=chosen.vaalSouls;soulBlockedUntil=time+3;}
  if(chosen.lifeCost)payment.state.life=Math.max(1,payment.state.life-payment.state.maximumLife*chosen.lifeCost);
  if(chosen.shell)payment.state.energyShield=Math.max(payment.state.energyShield??0,payment.state.maximumLife*.17);
  const castIndex=++casts, empowered=chosen.extraFifth&&castIndex%5===0;
  if(skill.pinpoint){if(time-lastIntensity>1.45)intensity=0;lastIntensity=time;}
  if(skill.gluttony&&++hunger>=10){hunger=0;disgorgeUntil=time+4;}
  if(skill.gluttony&&disgorgeUntil>time){
   chosen={...chosen,radialLaunch:true};
   skill={...skill,active:chosen,additionalProjectiles:skill.additionalProjectiles+5};
  }
  const rawCount=(chosen.projectileCount??1)+(chosen.splitCountInstead||chosen.countLocked?0:skill.additionalProjectiles)-(skill.pinpoint?intensity:0)+(empowered?4:0);
  const count=Math.max(1,Math.min(48,Math.floor(modifiers.calculate(rawCount,'projectileCount',skill.context))));
  const speed=projectileSpeed(chosen,skill),duration=chosen.projectileLifetime??1;
  const maxFlight=chosen.fixedProjectileRange??speed*duration;
  const range=Math.min(chosen.aimRange||skill.nova?distance(player,target):Infinity,maxFlight);
  const inc=skill.linkedSupports.includes('momentum')?momentum.use(time):0;
  const c=charges.snapshot(time),charge=chargeEffects(c);
  const rate=(skill.attacksPerSecond+(inc+(skill.source==='spell'?charge.increasedCastSpeed:charge.increasedAttackSpeed))*skill.attackSpeedPerIncrease)*
   (chosen.charges==='frenzy'?1+.05*c.frenzy:1);
  skill={...skill,damageMultiplier:skill.damageMultiplier*charge.moreDamage*(chosen.charges==='frenzy'?1+.05*c.frenzy:1),
   criticalChance:Math.min(1,skill.criticalChance*(1+charge.increasedCriticalChance)*(chosen.charges==='power'?1+.10*c.power:1)),
   criticalMultiplier:skill.criticalMultiplier+(chosen.charges==='power'?.20*c.power:0)};
  if(skill.pinpoint){skill=skillDamage(skill,.81*(1+.20*intensity));intensity=Math.min(3,intensity+1);}
  if(skill.ironGrip)skill={...skill,physicalChaosMultiplier:skill.physicalChaosMultiplier*(1+(player.strength??20)*.002)};
  if(chosen.heavy||empowered)skill=skillDamage(skill,chosen.heavy??1.7);
  if(chosen.wild){
   const type=['fire','cold','lightning'][Math.floor(random()*3)];
   const alternate={fire:{explosion:1.7},cold:{pierce:2},lightning:{chain:4}};
   chosen={...chosen,...alternate[type],tags:[...chosen.tags.filter(tag=>!['fire','cold','lightning'].includes(tag)),type]};
   skill={...skill,active:chosen,chain:chosen.chain??0,pierce:chosen.pierce??0,conversion:[{from:'physical',to:type,fraction:1,kind:'convert',priority:'skill'}]};
  }
  if(!(rate>0))return null;
  const cooldown=(1+count*skill.sequenceTimePerShot)*(1+skill.echo)/(rate*skill.echoRate)+(chosen.windup??0);
  const seals=skill.unleash?Math.min(skill.unleash,Math.max(0,Math.floor((time-lastSealAt)/skill.unleashPeriod))):0;
  if(seals>0)lastSealAt=seals===skill.unleash?time:lastSealAt+seals*skill.unleashPeriod;
  const a=bearing(player,target);
  const template={x:player.x,y:player.y,dx:Math.cos(a),dy:Math.sin(a),speed,remainingRange:range,
   pierce:skill.pierce,fork:skill.fork,chain:skill.chain,split:skill.split,canReturn:skill.canReturn,
   skill,attacker:{accuracy:player.accuracy},rolls:rolls(),color:colorForSkill(chosen),noCollision:chosen.noCollision,
   pulseEvery:chosen.pulseEvery,pulseRadius:chosen.pulseRadius,extraForkChance:skill.extraForkChance,forkRoll:random(),burst:chosen.burst,bounces:chosen.bounce?skill.chain:0,age:0,
   heading:a,launchedX:player.x,launchedY:player.y,wanderSeed:random()*TAU,phaseSeed:random()*TAU};
  const mk=(source,aim,worldEnemies)=>{
   const groups=new Map(),returnGroups=new Map();
   const heading=bearing(source,aim),rangeToTarget=distance(source,aim);
   const seed={...template,x:source.x,y:source.y,launchedX:source.x,launchedY:source.y,heading,dx:Math.cos(heading),dy:Math.sin(heading),remainingRange:Math.min(rangeToTarget,maxFlight)};
   if(skill.nova)return [{...seed,canReturn:false,noCollision:true,nova:count,pulseEvery:0}];
   if(chosen.tornado==='payload'){
    const flight=seed.remainingRange,speed=seed.speed*.68;
    return [{...seed,speed,pierce:0,split:0,fork:0,chain:0,canReturn:false,noCollision:true,
      tornadoStage:'payload',flight,burst:Math.max(1,Math.min(48,chosen.payloadArrows+count-1))}];
   }
   if(chosen.radialLaunch)return radial(seed,count,maxFlight,heading).map((q,i)=>({...q,delay:(chosen.windup??0)+(chosen.spiral?i*.036:0)}));
   if(chosen.rain)return Array.from({length:count},(_,i)=>{
    const lane=i-(count-1)/2,theta=i*2.39996;
    const dispersion=chosen.rain==='line'?lane*.48:chosen.rain==='cross'?Math.abs(lane)*.63:Math.sqrt(i)*.39;
    const angle=chosen.rain==='line'?heading:chosen.rain==='cross'?(i%4)*TAU/4:theta;
    const rainAim=chosen.targetRain?worldEnemies.filter(e=>e.life>0)[i%Math.max(worldEnemies.filter(e=>e.life>0).length,1)]??aim:aim;
    const impact={x:rainAim.x+Math.cos(angle)*dispersion,y:rainAim.y+Math.sin(angle)*dispersion};
    const b=bearing(source,impact);
    return {...seed,dx:Math.cos(b),dy:Math.sin(b),remainingRange:Math.min(maxFlight,Math.max(.2,distance(source,impact))),delay:i*(chosen.slowRain?.12:.028),pierce:0,canReturn:false};
   });
   return projectilePattern({player:source,target:aim,enemies:worldEnemies,count,skill,cooldown}).map(({group,aim:shotAim,...pattern},i)=>{
    if(!groups.has(group)){groups.set(group,{hits:new Set()});returnGroups.set(group,{hits:new Set()});}
    const targetRange=Math.min(chosen.aimRange?rangeToTarget:Infinity,maxFlight);
    const flight=chosen.lob?Math.min(maxFlight,Math.max(1,targetRange*(.82+random()*.36))):targetRange;
    const alternate=chosen.seekEach?worldEnemies.filter(e=>e.life>0)[i%Math.max(worldEnemies.filter(e=>e.life>0).length,1)]:null;
    if(alternate){const angle=bearing(source,alternate);pattern.dx=Math.cos(angle);pattern.dy=Math.sin(angle);}
    if(chosen.tornado==='primary'){
     // Intersect each arrow with the same aiming plane rather than a circular range.
     const forward=Math.max(.1,pattern.dx*Math.cos(heading)+pattern.dy*Math.sin(heading));
     return {...seed,...pattern,tornadoStage:'primary',split:0,fork:0,chain:0,canReturn:false,pierce:Infinity,
      heading:Math.atan2(pattern.dy,pattern.dx),remainingRange:Math.min(maxFlight,rangeToTarget/forward),
      volley:groups.get(group),returnVolley:returnGroups.get(group)};
    }
    return {...seed,...pattern,heading:Math.atan2(pattern.dy,pattern.dx),delay:pattern.delay+(chosen.windup??0),remainingRange:flight,
      volley:chosen.allowShotgun?undefined:groups.get(group),returnVolley:returnGroups.get(group)};
   });
  };
  let projectiles=[];
  if(skill.deploy&&env){
   const dir=bearing(player,target),bolt=['mine','trap'].includes(skill.deploy);
   const pos=bolt||skill.deploy==='geyser'?{x:target.x-Math.cos(dir)*1.4,y:target.y-Math.sin(dir)*1.4}:
    {x:player.x+Math.cos(dir)*1.1,y:player.y+Math.sin(dir)*1.1};
   const fr=bolt?.15:skill.focused?.34:.57;
   env.addField({...pos,radius:bolt?.36:.48,color:template.color,deploy:skill.deploy,next:time+(bolt?.24:.05),pulseEvery:fr,until:time+(bolt?1.8:chosen.vaalSouls?5.8:2.9),mk,aim:target,retaliate:skill.retaliate,template});
  }else{
   let source=player;
   if(chosen.melee&&env&&distance(player,target)<=2.2){
    env.hit(target,{...template,secondary:true,skill:skillDamage(skill,1.18)});
    if(chosen.fromTarget)source={...player,x:target.x+template.dx*.46,y:target.y+template.dy*.46};
   }
   projectiles=mk(source,target,enemies);
   for(let i=0;i<skill.echo;i++){
    const repeat=mk(source,target,enemies);
    projectiles.push(...repeat.map(p=>({...p,delay:(p.delay??0)+cooldown*(i+1)/(1+skill.echo),skill:skillDamage(p.skill,i===skill.echo-1?skill.echoLast:1)})));
   }
   for(let i=0;i<seals;i++)projectiles.push(...mk(source,target,enemies).map(p=>({...p,delay:(p.delay??0)+.10*(i+1),skill:skillDamage(p.skill,.72)})));
   if(skill.wisps&&random()<.44)projectiles.push(...mk({x:source.x-template.dy*.60,y:source.y+template.dx*.60},target,enemies).map(p=>({...p,delay:(p.delay??0)+.12,skill:skillDamage(p.skill,.65)})));
   if(chosen.launchCone&&env)for(const e of targetWithin(env,player,range)){
    const turn=Math.atan2(Math.sin(bearing(player,e)-a),Math.cos(bearing(player,e)-a));
    if(Math.abs(turn)<=.5)env.hit(e,{...template,secondary:true});
   }
  }
  return {player:payment.state,cooldown,projectile:projectiles[0],projectiles,skill:chosen.id};
 },steer(p,dt,enemies,player){
  const a=p.skill.active;
  if(!p.fragment&&(a.wander||a.zigzag||a.helix||a.orbit)){
   let angle;
   if(a.wander)angle=p.heading+(Math.sin(p.wanderSeed+p.age*16)-Math.sin(p.wanderSeed))*(a.wander===true?.44:a.wander);
   else if(a.zigzag)angle=p.heading+(p.age<.085?0:Math.floor((p.age-.085)/.065)%2?.25:-.25);
   else if(a.orbit){
    const t=p.phaseSeed+p.age*3.8;
    const tx=player.x+Math.cos(t)*2.8,ty=player.y+Math.sin(t)*2.8;
    angle=bearing(p,{x:tx,y:ty});p={...p,speed:Math.max(7,Math.min(65,Math.hypot(tx-p.x,ty-p.y)*16+3))};
   }else angle=p.heading+p.age*5.5+Math.atan(p.age*2.5);
   p={...p,dx:Math.cos(angle),dy:Math.sin(angle)};
  }
  if(a.phase&&!p.phaseDone&&(p.age??0)+dt>=.24)p={...p,phaseDone:true,pierce:Infinity,speed:p.speed*4};
  if(a.homing){const target=nearestEnemy(p,enemies,4);if(target){const angle=bearing(p,target);p={...p,dx:Math.cos(angle),dy:Math.sin(angle)};}}
  return p;
 },onImpact(target,p,time,player){
  const active=p.skill.active??{tags:[]};
  if(active.explosion&&!p.secondary&&!active.corpse&&!active.explodeOnSplit)return target;
  let mult=(p.returning?Math.min(p.skill.returnMultiplier,active.returnMultiplier??1):1)*(active.chainBonus?1+active.chainBonus*(p.chain??0):1);
  if(active.pulseDecay)mult*=Math.max(.15,1-(p.age??0)/(active.projectileLifetime??.56)*.85);
  const distanceTraveled=p.distanceTravelled??0;
  const pointBlank=p.skill.pointBlank?Math.max(.7,1.3-(distanceTraveled/14)*.6):1;
  let s={...p.skill,damageMultiplier:p.skill.damageMultiplier*mult,
   hitDamageMultiplier:p.skill.hitDamageMultiplier*pointBlank,
   criticalChance:p.phaseDone&&active.sourceKey==='IceSpear'?Math.min(1,p.skill.criticalChance*7):p.skill.criticalChance,
   criticalMultiplier:p.skill.criticalMultiplier+(p.phaseDone&&active.sourceKey==='IceSpear'?.3:0)};
  const result=resolveAttackImpact({attacker:p.attacker,target,skill:s,modifiers,rolls:p.rolls});
  let t=result.target;
  if(!result.hit.hit||result.mitigation?.blocked)return t;
  if(active.cull&&t.life>0&&t.life<=t.maximumLife*.1)t={...t,life:0};
  if(active.charges==='frenzy'&&!p.returning)charges.gain('frenzy',time);
  if(active.charges==='power'&&t.life<=0)charges.gain('power',time);
  const added=(type,rate,duration,key,stack=false)=>{
   if(!(rate>0))return;
   t={...t,dots:[...(t.dots??[]).filter(x=>stack||x.key!==key),{type,key,rate,start:time,end:time+duration}]};
  };
  const ailmentMult=mult*(p.skill.physicalChaosMultiplier??1)*(p.skill.projectileDamageMultiplier??1);
  if(active.bleed)added('physical',(result.ailmentBase?.physical??0)*.91*ailmentMult*(target.speed>0?3:1),active.duration??8,'bleed');
  if(active.poisonChance>0&&random()<active.poisonChance)added('chaos',((result.ailmentBase?.physical??0)+(result.ailmentBase?.chaos??0))*.3*ailmentMult,2,'poison',true);
  if(active.drain){added('chaos',active.baseDot*(active.gemDotScale??1)*mult,active.duration,'essence-drain');if(!active.noHeal&&player.life>0)player.life=Math.min(player.maximumLife,player.life+active.baseDot*.025);}
  if(result.damage?.cold>0&&(result.hit.critical||random()<(active.freezeChance??0)))t={...t,frozenUntil:Math.max(t.frozenUntil??0,time+.28*Math.max(.2,mult))};
  if(result.damage?.lightning>0&&(result.hit.critical||active.guaranteedShock))t={...t,shockedUntil:time+1.5};
  if(active.ensnare&&!p.secondary&&(p.pierce??0)===0&&(p.chain??0)===0&&(p.fork??0)===0)t={...t,chilledUntil:time+1.5};
  return {...t,ignites:[...(t.ignites??[]),...(result.ignite?[{rate:result.ignite.rate,start:time,end:time+result.ignite.duration}]:[])]};
 },onHitEffect(p,target,env){
  const a=p.skill.active;
  if(p.skill.phantasm&&!p.fragment&&target.life<=0&&env.time>phantasmAt&&random()<.55){
   phantasmAt=env.time+.25;const origin={x:target.x,y:target.y};
   const phantasmSkill={...p.skill,id:'phantasm',source:'spell',baseDamage:{physical:8+(a.level??1)*2},conversion:[],
    active:{tags:['spell','physical','projectile'],sourceKey:'Phantasm'},damageMultiplier:.85,igniteChance:0};
   const mk=(source,aim)=>{const direction=bearing(source,aim);return [{...p,...source,dx:Math.cos(direction),dy:Math.sin(direction),
    skill:phantasmSkill,speed:19,remainingRange:10,pierce:Infinity,canReturn:false,pulseEvery:0,hitIds:[],volley:undefined,
    noCollision:false,burst:0,nova:0,fragment:true,color:'#c4d6cb'}];};
   env.addField({...origin,deploy:'phantasm',mk,radius:.28,color:'#c4d6cb',next:env.time+.15,pulseEvery:.60,until:env.time+4});
  }
  if(p.secondary)return;
  if(p.skill.mirage&&!p.fragment&&!env.findField(f=>f.deploy==='archer')){
   const mk=(source,aim)=>{const angle=bearing(source,aim);return [{...p,...source,dx:Math.cos(angle),dy:Math.sin(angle),
    remainingRange:Math.max(10,p.speed*.55),fragment:true,delay:0,hitIds:[],volley:undefined,canReturn:false,skill:skillDamage(p.skill,.42)}];};
   env.addField({x:env.player.x,y:env.player.y,deploy:'archer',mk,radius:.27,color:'#b1c7ca',next:env.time+.65,pulseEvery:.85,until:env.time+3.5});
  }
  if(p.skill.windburst&&walked>=10){walked=0;const q={...p,pulseEvery:0,fragment:true,skill:skillDamage(p.skill,.8)};for(const shot of radial(q,6,p.speed*.18,p.heading))env.spawn(shot);paintDormant(p,env,1.65,.2);}
  if(a.groundOnImpact)field(p,env,a.ground);
  if(a.fuse){
   const prior=env.findField(f=>f.fuseTarget===target.id);
   if(prior){prior.stacks++;if(prior.stacks>=20)prior.next=env.time;}
   else env.addField({...p,radius:.55,fuseTarget:target.id,stacks:1,next:env.time+1,pulseEvery:1.1,until:env.time+1.04});
  }
  if(a.shieldShard&&!p.fragment){
   for(const shot of radial({...p,chain:0,pierce:0,canReturn:false,fragment:true,skill:skillDamage(p.skill,.64)},a.shieldShard,p.speed*.28,p.heading+.3)){
    env.spawn({...shot,hitIds:[target.id]});
   }
  }
  if(a.explodeOnSplit&&p.split>0)detonate(p,env,target.id,.75);
  if(a.splash==='lightning'){
   const list=targetWithin(env,target,1.8).filter(e=>e.id!==target.id).sort((x,y)=>distance(target,x)-distance(target,y)).slice(0,3);
   for(const e of list)env.hit(e,{...p,secondary:true});
   env.addField({x:target.x,y:target.y,radius:1.8,color:p.color,until:env.time+.13,visual:true});
  }else if(a.splash==='cone'){
   for(const e of targetWithin(env,target,2.25)){
    if(e.id===target.id)continue;
    const dx=e.x-target.x,dy=e.y-target.y,d=Math.hypot(dx,dy)||1;
    if((dx*p.dx+dy*p.dy)/d>=.60)env.hit(e,{...p,secondary:true});
   }
   env.addField({x:p.x+p.dx,y:p.y+p.dy,radius:1.3,color:p.color,until:env.time+.19,visual:true});
  }else if(a.splash==='elemental')detonate(p,env,target.id,1,a.areaRadius);
  else if(a.splash==='cluster'||a.splash==='tight-cluster'){
   for(let i=0;i<4;i++){
    const t=i*TAU/4+(p.age??0)*11;
    detonate({...p,x:p.x+Math.cos(t)*(a.splash==='tight-cluster'?.55:1.1),y:p.y+Math.sin(t)*(a.splash==='tight-cluster'?.55:1.1)},env,null,.60,1.10);
   }
  }
 },onTerminate(p,target,env){
  const a=p.skill.active;
  if(p.nova)return radial({...p,noCollision:false,canReturn:p.skill.canReturn},p.nova,p.speed*(a.projectileLifetime??.85));
  if(a.splitOnEnd&&!target&&p.split>0&&!p.returning)return radial(p,p.split,p.speed*.26,Math.atan2(p.dy,p.dx)).map(q=>({...q,split:0}));
  if(p.tornadoStage&&p.burst){
   const payload=p.tornadoStage==='payload',duration=.30;
   env.addField({x:p.x,y:p.y,tornadoImpact:true,color:p.color,visual:true,start:env.time,until:env.time+duration,duration});
   const phase=random()*TAU,gap=TAU/p.burst;
   const speed=payload?p.speed/.68:p.speed;
   return radial({...p,speed,fragment:true,tornadoStage:'secondary',pierce:Number.isFinite(p.skill.pierce)?p.skill.pierce:
    p.skill.extraPierce,fork:p.skill.fork,chain:p.skill.chain,split:p.skill.split,canReturn:p.skill.canReturn},p.burst,speed*.34,phase)
    .map((q,i)=>{
     const heading=phase+(i+(payload?0:(random()-.5)*.56))*gap;
     return {...q,heading,dx:Math.cos(heading),dy:Math.sin(heading),distanceTravelled:p.distanceTravelled,returnVolley:q.volley};
    });
  }
  if(p.burst)return radial(p,p.burst,p.speed*.34,Math.atan2(p.dy,p.dx)+.25);
  if(a.explosion&&!a.fuseGround)detonate(p,env,null,1,a.explosion);
  if(a.fuseGround&&!a.ground)env.addField({...p,radius:a.explosion,groundBomb:true,next:env.time+.32,until:env.time+.36,pulseEvery:1});
  if(a.ground&&(!a.groundOnImpact||!target))field(p,env,a.ground);
  if(a.bladeRemains)paintDormant(p,env,.22,2.8);
  if(a.thunder)env.addField({...p,radius:2.35,thunder:true,stages:0,inside:false,next:env.time+.25,until:env.time+10,pulseEvery:.25});
  if(p.skill.voidstorm){
   env.addField({...p,type:'void',radius:1.6,next:env.time+.10,until:env.time+1.6,pulseEvery:.18,color:'#c3a0e3'});
  }
  if(a.anomaly)env.addField({...p,radius:1.45,groundBomb:true,next:env.time+.45,until:env.time+.50,pulseEvery:1});
  if(a.storm)env.addField({...p,radius:.42,storm:true,next:env.time+.45,until:env.time+2.6,pulseEvery:a.stormRate??.50});
  if(a.burstAfterExplosion&&!p.fragment)for(const shot of radial({...p,fragment:true,bounces:0,skill:skillDamage(p.skill,.65)},a.burstAfterExplosion,p.speed*.18,p.heading))env.spawn(shot);
  if(a.corpse)env.addField({x:p.x,y:p.y,radius:.33,color:'#a48069',until:env.time+7,visual:true});
  if(a.catch&&p.returning)env.player.caughtBlades=Math.min(30,(env.player.caughtBlades??0)+1);
  if(a.bounce&&!p.fragment&&p.bounces>0){
   const target=nearestEnemy(p,env.enemies,8);
   const angle=target&&distance(p,target)>.6?bearing(p,target):Math.atan2(p.dy,p.dx);
   return [{...p,dx:Math.cos(angle),dy:Math.sin(angle),remainingRange:target?Math.max(1,distance(p,target)):4,bounces:p.bounces-1}];
  }
  return [];
 },onPulse(p,env){
  if(p.visual)return;
  if(p.deploy){
   const range=['totem','mirage'].includes(p.deploy)?11:7;
   if(p.retaliate){const near=nearestEnemy(p,env.enemies,2.5);
    if(near){const q=p.template;detonate({...q,x:near.x,y:near.y,skill:{...q.skill,baseDamage:{fire:q.skill.baseDamage.fire??13}}},env,null,1,1.35);}
   }
   const source=p.deploy==='archer'?env.player:p;
   const aim=nearestEnemy(source,env.enemies,range);
   if(aim&&(!['mine','trap'].includes(p.deploy)||!p.used)){
    p.used=true;
    for(const shot of p.mk(source,aim,env.enemies))env.spawn(shot);
   }
   return;
  }
  const a=p.skill.active;
  if(p.fuseTarget){
   const target=env.enemies.find(e=>e.id===p.fuseTarget);
   const s=a.stats??{};
   const added=((s.explosive_arrow_explosion_minimum_added_fire_damage??20)+(s.explosive_arrow_explosion_maximum_added_fire_damage??30))/2;
   const ps={...p.skill,baseDamage:{...p.skill.baseDamage,fire:(p.skill.baseDamage.fire??0)+added},damageMultiplier:p.skill.damageMultiplier*(1+.12*p.stacks)};
   detonate({...p,x:target?.x??p.x,y:target?.y??p.y,skill:ps},env,null,1,1.45+Math.min(1,p.stacks*.15));return;
  }
  if(p.groundBomb){detonate(p,env,null,1,p.radius);return;}
  if(p.thunder){
   const inStorm=distance(p,env.player)<p.radius;
   if(inStorm){p.inside=true;p.stages=Math.min(4,p.stages+1);}
   else if(p.inside){if(p.stages>=4)detonate(p,env,null,4,p.radius);p.until=env.time;}
   for(const e of targetWithin(env,p,p.radius)){const i=env.enemies.indexOf(e);env.enemies[i]={...e,blindedUntil:env.time+.32};}
   return;
  }
  if(p.fuseGround&&p.until-env.time<.25){detonate(p,env,null,.80,p.radius);p.fuseGround=false;}
  if(p.storm){
   const other=env.findField(f=>f.storm&&f!==p&&distance(p,f)>.25&&distance(p,f)<7.5);
   if(other){
    for(const e of env.enemies)if(e.life>0&&segmentDistance(e,p,other)<.50)env.hit(e,{...p,secondary:true});
    env.addField({...p,visual:true,beamTo:{x:other.x,y:other.y},until:env.time+.16});
   }
   return;
  }
  if(a.trailGround&&!p.type){field(p,env,a.ground);return;}
  if(a.flightFork&&!p.fragment){
   const tier=p.flightForkTier??0;if(tier>=3)return;
   for(const shot of radial({...p,fragment:false,heading:p.heading,pulseEvery:tier<2?.12:0,flightForkTier:tier+1,skill:skillDamage(p.skill,.8)},2,p.speed*.29,p.heading+.25))env.spawn(shot);
   return;
  }
  if(a.shards&&!p.fragment){
   if(a.radiation)return;
   const q={...p,pulseEvery:0,fragment:true,canReturn:false,skill:skillDamage(p.skill,a.sourceKey.startsWith('EyeOfWinter')?1:.50)};
   for(const shot of radial(q,a.shards,Math.max(2,p.speed*.30),p.age*7.5+p.heading))env.spawn(shot);
   return;
  }
  const radius=p.pulseRadius??p.radius??1.2,dotScale=a.gemDotScale??1;
  for(const e of targetWithin(env,p,radius)){
   if(p.type==='void')applyDot(p,e,env,'chaos',11, .21,false);
   else if(p.type==='cold'){const i=env.enemies.indexOf(e);env.enemies[i]={...e,chilledUntil:env.time+.3};if(a.baseDot>0)applyDot(p,e,env,'cold',a.baseDot*dotScale,.25);}
   else if(p.type==='fire')applyDot(p,e,env,'fire',Math.max(5,a.baseDot)*dotScale,.27,false);
   else if(p.type==='chaos'){
    applyDot(p,e,env,'chaos',Math.max(4,a.baseDot)*dotScale,.23,false);
    if(a.wither){const i=env.enemies.findIndex(t=>t.id===e.id);env.enemies[i]={...env.enemies[i],witherUntil:env.time+.4};}
   }
   else if(a.radiation)applyDot(p,e,env,'fire',a.baseDot*dotScale,a.duration,false);
   else if(a.trailDot)applyDot(p,e,env,'chaos',Math.max(a.baseDot,3)*dotScale,.58,false);
   else if(a.sourceKey.startsWith('BallLightning')){
    if(!p.skill.pulseHits)p.skill.pulseHits=new Map();
    if((p.skill.pulseHits.get(e.id)??-Infinity)>env.time- .149)continue;
    p.skill.pulseHits.set(e.id,env.time);env.hit(e,{...p,secondary:true,rolls:rolls()});
   }
   else env.hit(e,{...p,secondary:true});
  }
 }};
}
