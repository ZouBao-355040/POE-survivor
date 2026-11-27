import {collectGold} from './gem-shop.mjs';
import {advanceFlaskRecovery,autoFlasks} from './flasks.mjs';
import {moveToward,nearestEnemy,spawnEnemy} from './world.mjs';
import {stepProjectiles} from './projectile.mjs';
import {igniteIntervals} from './ignite.mjs';
import {mitigateDot,integrateDot} from './dot.mjs';
import {applyDamage} from './resources.mjs';
import {resolveAttackImpact} from './combat.mjs';
import {grantExperience} from './progression.mjs';
export function stepWorld(state,dt,{direction={x:0,y:0},spawnInterval=2,spawnRadius=12,enemyStats,random=Math.random,onImpact,onFire,onTerminate,onPulse,onTick,onHitEffect,steer,onMove,addSouls,momentum,manaRegen=0,enemyModifiers,experienceRequired}={}){
 if(!Number.isFinite(dt)||dt<0||dt>.05)throw new RangeError('World step must be between 0 and 50ms');
 if(state.paused||state.dead||state.progression?.pendingChoices>0)return {...state,events:[]};
 let flasks=state.flasks;
 let player={...state.player},enemies=state.enemies.map(e=>({...e})),projectiles=[],events=[];
 let time=state.time??0,nextSpawn=state.nextSpawn??0,nextId=state.nextId??0;
 const length=Math.hypot(direction.x,direction.y);
 if(length){momentum?.move();onMove?.(player.speed*dt);player.x+=direction.x/length*(player.speed*(1+(momentum?.movementSpeed(time)??0)))*dt;player.y+=direction.y/length*(player.speed*(1+(momentum?.movementSpeed(time)??0)))*dt;}
 if(enemyStats&&spawnInterval>0)while(nextSpawn<=time){enemies.push(spawnEnemy('enemy-'+nextId++,player,random()*Math.PI*2,spawnRadius,enemyStats));nextSpawn+=spawnInterval;}
 if(Number.isFinite(player.maximumMana))player.mana=Math.min(player.maximumMana-(player.reservedMana??0),(player.mana??0)+manaRegen*dt);
 if(flasks)({player,flasks}=advanceFlaskRecovery(player,flasks,dt));
 enemies=enemies.map(e=>{let target=e;for(const i of igniteIntervals(e.ignites??[],time,time+dt)){if(target.life<=0)break;const rates=mitigateDot({fire:i.rate},target.defence);target=applyDamage(target,Object.fromEntries(Object.entries(rates).map(([k,v])=>[k,v*(i.end-i.start)])),target.rules).state;}if(target.life>0)target=applyDamage(target,integrateDot((e.dots??[]).map(i=>i.type==='chaos'&&e.witherUntil>time?{...i,rate:i.rate*1.15}:i),time,time+dt,target.defence),target.rules).state;return {...target,dots:(e.dots??[]).filter(i=>i.end>time+dt),ignites:(e.ignites??[]).filter(i=>i.end>time+dt)};});
 enemies=enemies.map(e=>e.life>0?moveToward(e,player,(e.frozenUntil>time?0:(e.speed??0)*(e.chilledUntil>time?.7:1)),dt,e.attackRange??.5):e);
 const hit=(e,p)=>{const i=enemies.findIndex(t=>t.id===e.id);if(i<0||enemies[i].life<=0)return;if(onImpact){const t=enemies[i];const shocked=t.shockedUntil>time;const next=onImpact(shocked?{...t,defence:{...t.defence,increasedTaken:(t.defence?.increasedTaken??0)+.15}}:t,p,time+dt,player);enemies[i]=shocked?{...next,defence:t.defence}:next;}onHitEffect?.(p,enemies[i],env);events.push({type:'impact',target:e.id,skill:p.skill?.id});};
 const env={player,enemies,hit,time:time+dt};
 const fields=[],spawned=[];
 env.spawn=p=>spawned.push(p);
 env.findField=filter=>fields.find(filter)??state.fields?.find(filter);
 env.addField=field=>fields.push(field);
 for(const field of state.fields??[]){
  if(field.until<=time)continue;
  if(field.next<=time){let updated={...field};if(field.moving){const aim=nearestEnemy(field,enemies,5);if(aim)updated=moveToward(field,aim,1.4,field.pulseEvery);}onPulse?.(updated,env);fields.push({...updated,next:field.next+field.pulseEvery});}
  else fields.push(field);
 }
 projectiles=stepProjectiles(state.projectiles,dt,{enemies,player,impact:hit,steer:(p,dt)=>steer?.(p,dt,enemies,player)??p,pulse:p=>onPulse?.(p,env),terminate:(p,e)=>onTerminate?.(p,e,env)});
 onTick?.(env,dt);
 projectiles.push(...spawned);

 const enemyCasts=[];
 if(enemyModifiers){
  const rollHit=(attacker,skill)=>{
   const result=resolveAttackImpact({attacker,target:player,skill,modifiers:enemyModifiers,
    rolls:{critical:random(),confirmation:random(),block:random(),ignite:random()}});
   player=result.target;
   events.push({type:'enemyAttack',source:attacker.id,dead:result.dead??false});
  };
  for(const cast of state.enemyCasts??[]){
   if(cast.impactAt>time+dt){enemyCasts.push(cast);continue;}
   if(player.life>0&&Math.hypot(cast.x-player.x,cast.y-player.y)<=cast.radius)
    rollHit({id:cast.source},{source:'spell',baseDamage:{[cast.element??'fire']:cast.damage},criticalChance:0,igniteChance:0});
  }
  for(const e of enemies){
   if(e.life<=0||player.life<=0||!e.attack||e.frozenUntil>time)continue;
   e.attackCooldown=Math.max(0,(e.attackCooldown??0)-dt);
   if(e.attackCooldown!==0||Math.hypot(e.x-player.x,e.y-player.y)>(e.attackRange??.5)+1e-8)continue;
   e.attackCooldown=1/e.attack.attacksPerSecond;
   if(e.fireCast){
    enemyCasts.push({x:player.x,y:player.y,source:e.id,impactAt:time+dt+e.fireCast.windup,...e.fireCast});
   }else rollHit(e.blindedUntil>time?{...e,accuracy:e.accuracy*.7}:e,e.attack);
  }
 }else enemyCasts.push(...(state.enemyCasts??[]));
 let cooldown=Math.max(0,(state.cooldown??0)-dt);
 const target=nearestEnemy(player,enemies,player.attackRange??10);
 if(player.life>0&&cooldown===0&&target&&onFire){const shot=onFire(player,target,time,enemies,env);if(shot){player=shot.player??player;projectiles.push(...(shot.projectiles??[shot.projectile]));cooldown=shot.cooldown;events.push({type:'fire',target:target.id,skill:shot.skill});}}
 let progression=state.progression,flaskCharges=0;
 const dropped=[];
 const economy=Number.isSafeInteger(state.gold)&&!state.practice;
 for(const e of enemies.filter(e=>e.life<=0)){flaskCharges+=e.flaskChargeReward??1;if(economy&&player.life>0)dropped.push({x:e.x,y:e.y,amount:e.goldReward??1});events.push({type:'kill',target:e.id,experience:e.experienceReward??0});addSouls?.(1,time+dt);if(experienceRequired)progression=grantExperience(progression??{},e.experienceReward??0,experienceRequired);}
 if(flasks){const result=autoFlasks(player,flasks,flaskCharges);flasks=result.flasks;for(const resource of result.used)events.push({type:'flask',resource});}
 let wallet={};
 if(economy&&player.life>0){
  const collected=collectGold(player,state.goldDrops??[],dropped,{all:progression?.pendingChoices>0});
  wallet={gold:state.gold+collected.amount,goldDrops:collected.remaining};
  if(collected.amount>0)events.push({type:'gold',amount:collected.amount});
 }
 return {...state,...wallet,...(flasks?{flasks}:{}),progression,dead:player.life<=0,player,enemies:enemies.filter(e=>e.life>0),projectiles,fields,...(enemyCasts.length||state.enemyCasts?{enemyCasts}:{}),time:time+dt,nextSpawn,nextId,cooldown,events};
}
