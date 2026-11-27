import test from 'node:test';
import assert from 'node:assert/strict';
import {allocate,tracePath} from './passive-tree.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {ModifierStore} from './modifiers.mjs';
import {newTownServices} from './town-services.mjs';
import {stepWorld} from './game-loop.mjs';
import {rangerHooks} from './ranger.mjs';
import {queueHitRecoup,tickHitRecoup} from './combat-recovery.mjs';
import {applyDamage} from './resources.mjs';
import {retryBeach} from './campaign.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+' ≠ '+b);
const start={characterClass:'Ranger',level:1,passivePoints:150};
const path=(state,end)=>tracePath(state,end).slice(1).reduce((s,id)=>allocate(s,id),state);
const load=progression=>{
 const modifiers=new ModifierStore();
 const p=applyLoadout({life:40,mana:30,energyShield:0},newTownServices({starter:true}),progression,modifiers);
 return {modifiers,player:{...p,x:0,y:0,accuracy:300,maximumLife:100,life:20,maximumMana:60,mana:10,lifeRegen:0}};
};
const foe={id:'test',x:1,y:0,radius:.36,speed:0,life:200,maximumLife:200,evasion:0,accuracy:0,defence:{}};
const projectile=({source='attack',type='physical',proxy,damage=10,active={},...more}={})=>({
 x:0,y:0,dx:1,dy:0,speed:85,remainingRange:10,leechProxy:proxy,attacker:{},
 skill:{source,active:{tags:['projectile'],...active},baseDamage:{[type]:damage},context:{tags:[source]},hitDamageMultiplier:1,damageMultiplier:1},
 rolls:{block:.4,critical:.8,confirmation:.8,ignite:.8},...more
});
const run=(player,modifiers,shot,enemies=[foe])=>stepWorld({player,enemies,projectiles:[shot],time:0},.05,
 {onImpact:rangerHooks({modifiers,random:()=>0}).onImpact});
const reward=p=>p.events.find(e=>e.type==='kill')?.credit;

test('Ranger attack gain is flat per enemy, not per cast, and no gain from spells, misses, blocked hits or proxy damage',()=>{
 const {player,modifiers}=load(path(path(start,6042),49481));
 assert.equal(player.combatRecovery.life.attackHit,5);
 assert.equal(player.combatRecovery.mana.attackHit,3);
 const volley={hits:new Set()};
 const hit=run(player,modifiers,projectile({pierce:2,volley}),[foe,{...foe,id:'second',x:2.3}]);
 near(hit.player.life,30);near(hit.player.mana,16);
 const gainsAtCap=run({...player,life:88,reservedLife:10,mana:50,reservedMana:8},modifiers,projectile());
 near(gainsAtCap.player.life,90);near(gainsAtCap.player.mana,52);
 for(const shot of [projectile({source:'spell'}),...['totem','trap','mine','mirage','minion','wisp'].map(proxy=>projectile({proxy}))]){
  const result=run(player,modifiers,shot);
  near(result.player.life,20);near(result.player.mana,10);
 }
 for(const target of [{...foe,defence:{attackBlock:.75}},{...foe,evasion:Infinity,entropy:0}]){
  const result=run({...player,accuracy:0},modifiers,projectile(),[target]);
  near(result.player.life,20);near(result.player.mana,10);
 }
 const vaal=run({...player,rules:{vaalPact:true}},modifiers,projectile());
 near(vaal.player.life,20);near(vaal.player.mana,13);
});

test('kills reward once on actual settlement: direct, cull and proxy-inflicted poison differ from proxy hit',()=>{
 const {player,modifiers}=load(path(path(path(start,27788),42804),32176));
 const p={...player,maximumEnergyShield:100,energyShield:10};
 const small={...foe,life:3,maximumLife:20};
 const result=run(p,modifiers,projectile(),[small]);
 assert.equal(reward(result),'player-hit');
 near(result.player.life,22);near(result.player.mana,11.2);near(result.player.energyShield,12);
 near(stepWorld(result,.05).player.life,22);
 const capped=run({...p,evasion:11,rules:{ghostDance:true,vaalPact:true}},modifiers,projectile({source:'spell'}),[small]);
 near(capped.player.life,20);near(capped.player.energyShield,11);near(capped.player.mana,11.2);
 for(const proxy of ['totem','trap','mine','mirage','minion','wisp']){
  const proxyHit=run(p,modifiers,projectile({proxy}),[small]);
  assert.equal(reward(proxyHit),'proxy-hit');
  near(proxyHit.player.life,20);near(proxyHit.player.mana,10);near(proxyHit.player.energyShield,10);
 }
 const cull=run(p,modifiers,projectile({source:'spell',damage:2,active:{cull:true}}),[small]);
 assert.equal(reward(cull),'player-hit');
 const poison=run(p,modifiers,projectile({proxy:'mine',damage:100,active:{poisonChance:1}}),[{...small,life:100.7,maximumLife:125}]);
 assert.equal(reward(poison),undefined);
 const after=stepWorld(poison,.05);
 assert.equal(reward(after),'player-dot');
 near(after.player.life,22);near(after.player.mana,11.2);near(after.player.energyShield,12);
});

test('real incoming damage queues precise stacking recoup across ES, mana and life; vaal blocks only life',()=>{
 const {player}=load(allocate(path(path(start,52789),42804),10495,59064));
 assert.equal(player.combatRecovery.life.recoup,.24);
 assert.equal(player.combatRecovery.mana.recoup,.1);
 const p={...player,maximumEnergyShield:5,energyShield:5,life:60,mana:20,rules:{damageTakenFromManaBeforeLife:.4}};
 const close={...foe,x:.1,attack:{source:'attack',baseDamage:{fire:25},attacksPerSecond:1},accuracy:200};
 const initial={player:p,enemies:[close],projectiles:[]};
 const world=stepWorld(initial,.05,{enemyModifiers:new ModifierStore(),random:()=>.4});
 near(world.player.life,48);near(world.player.mana,12);
 assert.equal(world.player.recoupEffects.length,2);
 const tick=tickHitRecoup(world.player,1);
 near(tick.life,49.5);near(tick.mana,12.625);
 const settled=tickHitRecoup(world.player,4);
 near(settled.life,54);near(settled.mana,14.5);
 assert.equal(settled.recoupEffects.length,0);
 const blocked=tickHitRecoup({...world.player,rules:{vaalPact:true}},4);
 near(blocked.life,48);near(blocked.mana,14.5);
 const stacked=queueHitRecoup(world.player,applyDamage(world.player,{fire:10},p.rules).state);
 near(tickHitRecoup(stacked,4).life,50.4);
 const noDamage=queueHitRecoup(p,{...p});
 assert.equal(noDamage.recoupEffects,undefined);
 const fatal=queueHitRecoup({...p,energyShield:0},{...p,life:0,energyShield:0});
 assert.equal(fatal.recoupEffects,undefined);
 const retry=retryBeach({...world,zone:'beach',dead:true});
 assert.equal(retry.player.recoupEffects,undefined);
 const three=load(allocate(path(start,52789),10414,24305)).player;
 assert.equal(three.combatRecovery.life.recoupDuration,3);
});
