import {integrateBleed} from './bleed.mjs?v=0.5.19';
import {aimEnemyArrow,launchEnemyArrow,moveEnemyArrows,enemyArrowLimit} from './enemy-arrows.mjs?v=0.5.16';
import {damageProxy,queueHitRecoup,recoverOnKill,tickHitRecoup} from './combat-recovery.mjs?v=0.5.18';
import {advancePlayerLeech} from './player-leech.mjs?v=0.5.18';
import {collectGold} from './gem-shop.mjs';
import {advanceFlaskRecovery,autoFlasks} from './flasks.mjs?v=0.5.18';
import {distance,moveToward,nearestEnemy,spawnEnemy} from './world.mjs';
import {stepProjectiles} from './projectile.mjs?v=0.5.7';
import {igniteIntervals} from './ignite.mjs?v=0.5.15';
import {mitigateDot,integrateDot} from './dot.mjs';
import {applyDamage,recover,recoveryLimit} from './resources.mjs?v=0.5.18';
import {resolveAttackImpact} from './combat.mjs?v=0.5.18';
import {rechargeShield} from './recovery.mjs';
import {agnosticStep,tickGhostShrouds,consumeGhostShroud,recordDivineShieldHit,tickDivineShield} from './keystones.mjs?v=0.5.18';
import {grantExperience} from './progression.mjs';
export function stepWorld(state,dt,{direction={x:0,y:0},spawnInterval=2,spawnRadius=12,enemyStats,random=Math.random,onImpact,onFire,castPlan,manualRequest,onTerminate,onPulse,onTick,onHitEffect,steer,onMove,addSouls,momentum,manaRegen=0,enemyModifiers,experienceRequired,deferLoot=false}={}){
 if(!Number.isFinite(dt)||dt<0||dt>.05)throw new RangeError('World step must be between 0 and 50ms');
 if(state.paused||state.dead||state.progression?.pendingChoices>0)return {...state,events:[]};
 let flasks=state.flasks;
 let player={...state.player},enemies=state.enemies.map(e=>({...e})),projectiles=[],events=[];
 let time=state.time??0,nextSpawn=state.nextSpawn??0,nextId=state.nextId??0;
 const length=Math.hypot(direction.x,direction.y);
 if(length){momentum?.move();onMove?.(player.speed*dt);player.x+=direction.x/length*(player.speed*(1+(momentum?.movementSpeed(time)??0)))*dt;player.y+=direction.y/length*(player.speed*(1+(momentum?.movementSpeed(time)??0)))*dt;}
 if(enemyStats&&spawnInterval>0)while(nextSpawn<=time){enemies.push(spawnEnemy('enemy-'+nextId++,player,random()*Math.PI*2,spawnRadius,enemyStats));nextSpawn+=spawnInterval;}
 if(Number.isFinite(player.maximumMana))player.mana=Math.min(player.maximumMana-(player.reservedMana??0),(player.mana??0)+manaRegen*dt);
 if(Number.isFinite(player.maximumLife)&&player.life>0&&player.lifeRegen>0)player.life=recover(player,'life',player.lifeRegen*dt).life;
 if(player.maximumEnergyShield>0){
  const previous=Math.min(player.maximumEnergyShield,player.energyShield??0);
  player.energyShield=previous;
  const since=time+dt-(player.shieldInterruptedAt??0);
  const charged=player.rules?.ghostReaver?previous:rechargeShield(previous,player.maximumEnergyShield,since,dt,{rate:player.esRechargeRate??1/3});
  const recharged=recover(player,'energyShield',charged-previous).energyShield;
  if(recharged>previous&&!player.shieldCharging){player.shieldRechargeStarted=time+dt;player.shieldCharging=true;}
  player.energyShield=recharged;
  player=recover(player,'energyShield',(player.esRegen??0)*dt);
  if(player.energyShield>=recoveryLimit(player,'energyShield'))player.shieldCharging=false;
 }
 player=tickDivineShield(player,time,dt);
 if(player.rules?.agnostic)player=agnosticStep(player,dt);
 player=tickHitRecoup(tickGhostShrouds(player,dt),dt);
 if(flasks)({player,flasks}=advanceFlaskRecovery(player,flasks,dt));
 advancePlayerLeech(player,dt);
 enemies=enemies.map(e=>{
  let target=e;
  const speed=e.frozenUntil>time||e.arrowWindingUntil>time?0:(e.speed??0)*((e.chilledUntil>time||e.ensnaredUntil>time)?.7:1);
  const stop=e.attackRange??.5;
  const movingUntil=time+(speed>0?Math.min(dt,Math.max(0,distance(e,player)-stop)/speed):0);
  const defence=e.exposureUntil>time?{...e.defence,resistances:{...e.defence?.resistances,...Object.fromEntries((e.exposed??[]).map(type=>[type,(e.defence?.resistances?.[type]??0)-.25]))}}:e.defence;
  for(const i of igniteIntervals(e.ignites??[],time,time+dt)){
   if(target.life<=0)break;
   const rates=mitigateDot({fire:i.rate},defence);
   target=applyDamage(target,Object.fromEntries(Object.entries(rates).map(([k,v])=>[k,v*(i.end-i.start)])),target.rules).state;
  }
  if(target.life>0){
   const dots=e.dots??[],bleeds=dots.filter(i=>i.key==='bleed');
   const damage=integrateDot(dots.filter(i=>i.key!=='bleed').map(i=>i.type==='chaos'&&e.witherUntil>time?{...i,rate:i.rate*1.15}:i),time,time+dt,defence);
   damage.physical+=integrateBleed(bleeds,time,time+dt,movingUntil,defence);
   target=applyDamage(target,damage,target.rules).state;
  }
  if(e.life>0&&target.life<=0){target.killCredit='player-dot';player=recoverOnKill(player);}
  target={...target,dots:(e.dots??[]).filter(i=>i.end>time+dt),ignites:(e.ignites??[]).filter(i=>i.end>time+dt)};
  return target.life>0?moveToward(target,player,speed,dt,stop):target;
 });
 const hit=(e,p,sourcePlayer=player)=>{const i=enemies.findIndex(t=>t.id===e.id);if(i<0||enemies[i].life<=0)return;if(onImpact){const t=enemies[i];const shocked=t.shockedUntil>time;const next=onImpact(shocked?{...t,defence:{...t.defence,increasedTaken:(t.defence?.increasedTaken??0)+.15}}:t,p,time+dt,sourcePlayer);if(next.life<=0){const owned=!damageProxy(p);next.killCredit=owned?'player-hit':'proxy-hit';if(owned)Object.assign(sourcePlayer,recoverOnKill(sourcePlayer));}enemies[i]=shocked?{...next,defence:t.defence}:next;}onHitEffect?.(p,enemies[i],env);events.push({type:'impact',target:e.id,skill:p.skill?.id});};
 const env={player,enemies,hit,time:time+dt};
 const fields=[],spawned=[];
 env.spawn=p=>spawned.push(p);
 env.findField=filter=>fields.find(filter)??state.fields?.find(f=>f.until>time&&filter(f));
 env.activeFields=filter=>fields.filter(f=>f.until>time&&filter(f));
 env.removeField=field=>{const i=fields.indexOf(field);if(i>=0)fields.splice(i,1);};
 env.addField=field=>fields.push(field);
 for(const field of state.fields??[]){
  if(field.until<=time)continue;
  if(field.next<=time){let updated={...field};if(field.moving){const aim=nearestEnemy(field,enemies,5);if(aim)updated=moveToward(field,aim,1.4,field.pulseEvery);}onPulse?.(updated,env);fields.push({...updated,next:field.next+field.pulseEvery});}
  else fields.push(field);
 }
 projectiles=stepProjectiles(state.projectiles,dt,{enemies,player,impact:hit,steer:(p,dt)=>steer?.(p,dt,enemies,player)??p,pulse:p=>onPulse?.(p,env),terminate:(p,e)=>onTerminate?.(p,e,env)});
 onTick?.(env,dt);
 const projectilesSpawnedBeforeCast=spawned.length;
 projectiles.push(...spawned);

 const enemyCasts=[];
 let enemyArrows=state.enemyArrows??[];
 if(enemyModifiers){
  const rollHit=(attacker,skill)=>{
   const result=resolveAttackImpact({attacker,target:player,skill,modifiers:enemyModifiers,combatTime:time+dt,
    rolls:{critical:random(),confirmation:random(),block:random(),ignite:random(),...(skill.source==='spell'&&(player.defence?.suppressionChance>0||player.defence?.spellDodge>0)?{suppress:random(),suppressRetry:random()}:{})}});
   if(result.rechargeInterrupted&&!(player.rules?.wickedWard&&player.shieldCharging&&time+dt-player.shieldRechargeStarted<4)){
    result.target.shieldInterruptedAt=time+dt;result.target.shieldCharging=false;
   }
   player=recordDivineShieldHit(consumeGhostShroud(queueHitRecoup(player,result.target),result),result,time+dt);
   events.push({type:'enemyAttack',source:attacker.id,attackKind:skill.attackKind,hit:result.hit.hit,blocked:result.mitigation?.blocked??false,dead:result.dead??false});
  };
  const swept=moveEnemyArrows(enemyArrows,dt,state.player,player);
  enemyArrows=swept.active;
  for(const arrow of swept.contacts)if(player.life>0)rollHit(arrow.attacker,arrow.skill);
  for(const cast of state.enemyCasts??[]){
   if(cast.kind==='arrow-windup'){
    const archer=enemies.find(e=>e.id===cast.source&&e.life>0&&!(e.frozenUntil>time+dt));
    if(!archer||player.life<=0)continue;
    if(cast.impactAt>time+dt){enemyCasts.push(cast);continue;}
    if(enemyArrows.length<enemyArrowLimit){
     const source=archer.blindedUntil>time+dt?{...archer,accuracy:archer.accuracy*.7}:archer;
     enemyArrows.push(launchEnemyArrow(cast,source));
    }
    continue;
   }
   if(cast.impactAt>time+dt){enemyCasts.push(cast);continue;}
   if(player.life>0&&Math.hypot(cast.x-player.x,cast.y-player.y)<=cast.radius)
    rollHit({id:cast.source},{source:'spell',baseDamage:{[cast.element??'fire']:cast.damage},criticalChance:0,igniteChance:0});
  }
  for(const e of enemies){
   if(e.life<=0||player.life<=0||!e.attack||e.frozenUntil>time)continue;
   e.attackCooldown=Math.max(0,(e.attackCooldown??0)-dt);
   if(e.attackCooldown!==0||Math.hypot(e.x-player.x,e.y-player.y)>(e.attackRange??.5)+1e-8)continue;
   e.attackCooldown=1/e.attack.attacksPerSecond;
   if(e.arrow){
    const aim=aimEnemyArrow(e,player,time+dt);
    e.arrowWindingUntil=aim.impactAt;
    enemyCasts.push(aim);
   }else if(e.fireCast){
    enemyCasts.push({x:player.x,y:player.y,source:e.id,impactAt:time+dt+e.fireCast.windup,...e.fireCast});
   }else rollHit(e.blindedUntil>time?{...e,accuracy:e.accuracy*.7}:e,{...e.attack,attackKind:e.attack.attackKind??'melee'});
  }
 }else enemyCasts.push(...(state.enemyCasts??[]));
 let cooldown=Math.max(0,(state.cooldown??0)-dt);
 const target=nearestEnemy(player,enemies,player.attackRange??10);
 const skillCooldowns=castPlan?Object.fromEntries(Object.entries(state.skillCooldowns??{})
  .filter(([,left])=>left>dt).map(([id,left])=>[id,left-dt])):null;
 const cast=(aim,options)=>{
  env.player=player;
  const shot=onFire(player,aim,time,enemies,env,options);
  if(!shot)return null;
  if(shot.deferred)return shot;
  player=shot.player??player;env.player=player;
  projectiles.push(...(shot.projectiles??[shot.projectile]));
  events.push({type:'fire',target:aim.id??null,skill:shot.skill,...(options?.manual?{manual:true}:{})});
  return shot;
 };
 if(player.life>0&&onFire){
  if(castPlan){
   if(manualRequest&&castPlan.manual&&!skillCooldowns[castPlan.manual.active.id]){
    const aim=target??{x:player.x+(manualRequest.x??1)*4,y:player.y+(manualRequest.y??0)*4};
    const shot=cast(aim,{linked:castPlan.manual,manual:true});
    if(shot)skillCooldowns[castPlan.manual.active.id]=shot.cooldown;
   }
   let attempted=0,fired=0;
   if(target)for(const linked of castPlan.auto){
    if(skillCooldowns[linked.active.id])continue;
    attempted++;
    const aim=nearestEnemy(player,enemies,player.attackRange??10);
    if(!aim)break;
    const shot=cast(aim,{linked,manual:false});
    if(shot){skillCooldowns[linked.active.id]=shot.cooldown;fired++;}
   }
   // Keep the original fallback for unequipped starters and unaffordable auto loadouts, never for a manual-only loadout.
   if(target&&cooldown===0&&!castPlan.manual&&(!castPlan.auto.length||(attempted===castPlan.auto.length&&!fired))){
    const shot=cast(target,{linked:null,manual:false});
    if(shot)cooldown=shot.cooldown;
   }
  }else if(cooldown===0&&target){
   const shot=cast(target);
   if(shot)cooldown=shot.cooldown;
  }
 }
 projectiles.push(...spawned.slice(projectilesSpawnedBeforeCast));
 if(player.life<=0)delete player.activeLeech;
 let progression=state.progression,flaskCharges=0;
 const dropped=[];
 const economy=Number.isSafeInteger(state.gold)&&!state.practice&&!deferLoot;
 for(const e of enemies.filter(e=>e.life<=0)){flaskCharges+=e.flaskChargeReward??1;if(economy&&player.life>0)dropped.push({x:e.x,y:e.y,amount:e.goldReward??1});events.push({type:'kill',target:e.id,credit:e.killCredit,experience:e.experienceReward??0,gold:e.goldReward??1,boss:!!e.boss});addSouls?.(1,time+dt);if(experienceRequired)progression=grantExperience(progression??{},e.experienceReward??0,experienceRequired);}
 if(flasks){const result=autoFlasks(player,flasks,flaskCharges);flasks=result.flasks;for(const resource of result.used)events.push({type:'flask',resource});}
 let wallet={};
 if(economy&&player.life>0){
  const collected=collectGold(player,state.goldDrops??[],dropped,{all:progression?.pendingChoices>0});
  wallet={gold:state.gold+collected.amount,goldDrops:collected.remaining};
  if(collected.amount>0)events.push({type:'gold',amount:collected.amount});
 }
 return {...state,...wallet,...(flasks?{flasks}:{}),progression,dead:player.life<=0,player,enemies:enemies.filter(e=>e.life>0),projectiles,fields,...(enemyCasts.length||state.enemyCasts?{enemyCasts}:{}),...(enemyArrows.length||state.enemyArrows?{enemyArrows}:{}),time:time+dt,nextSpawn,nextId,cooldown,...(skillCooldowns?{skillCooldowns}:{}),events};
}
