import {moveToward,nearestEnemy,spawnEnemy} from './world.mjs';
import {advanceProjectile} from './projectile.mjs';
import {igniteIntervals} from './ignite.mjs';
import {mitigateDot} from './dot.mjs';
import {applyDamage} from './resources.mjs';
export function stepWorld(state,dt,{direction={x:0,y:0},spawnInterval=2,spawnRadius=12,enemyStats,random=Math.random,onImpact,onFire,momentum,manaRegen=0}={}){
 if(!Number.isFinite(dt)||dt<0||dt>.05)throw new RangeError('World step must be between 0 and 50ms');
 let player={...state.player},enemies=state.enemies.map(e=>({...e})),projectiles=[],events=[];
 let time=state.time??0,nextSpawn=state.nextSpawn??0,nextId=state.nextId??0;
 const length=Math.hypot(direction.x,direction.y);
 if(length){momentum?.move();player.x+=direction.x/length*player.speed*dt;player.y+=direction.y/length*player.speed*dt;}
 if(enemyStats&&spawnInterval>0)while(nextSpawn<=time){enemies.push(spawnEnemy('enemy-'+nextId++,player,random()*Math.PI*2,spawnRadius,enemyStats));nextSpawn+=spawnInterval;}
 if(Number.isFinite(player.maximumMana))player.mana=Math.min(player.maximumMana-(player.reservedMana??0),(player.mana??0)+manaRegen*dt);
 enemies=enemies.map(e=>{let target=e;for(const i of igniteIntervals(e.ignites??[],time,time+dt)){if(target.life<=0)break;const rates=mitigateDot({fire:i.rate},target.defence);target=applyDamage(target,Object.fromEntries(Object.entries(rates).map(([k,v])=>[k,v*(i.end-i.start)])),target.rules).state;}return {...target,ignites:(e.ignites??[]).filter(i=>i.end>time+dt)};});
 enemies=enemies.map(e=>e.life>0?moveToward(e,player,e.speed??0,dt,e.attackRange??.5):e);
 for(const p of state.projectiles){const result=advanceProjectile(p,dt,enemies);if(result.hitId){const i=enemies.findIndex(e=>e.id===result.hitId);if(onImpact)enemies[i]=onImpact(enemies[i],p,time+dt);events.push({type:'impact',target:result.hitId});}if(!result.expired)projectiles.push(result.projectile);}
 let cooldown=Math.max(0,(state.cooldown??0)-dt);
 const target=nearestEnemy(player,enemies,player.attackRange??10);
 if(cooldown===0&&target&&onFire){const shot=onFire(player,target,time);if(shot){player=shot.player??player;projectiles.push(shot.projectile);cooldown=shot.cooldown;events.push({type:'fire',target:target.id});}}
 return {...state,player,enemies:enemies.filter(e=>e.life>0),projectiles,time:time+dt,nextSpawn,nextId,cooldown,events};
}
