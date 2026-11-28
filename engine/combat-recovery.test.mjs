import test from 'node:test';
import assert from 'node:assert/strict';
import {allocate,tracePath} from './passive-tree.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {ModifierStore} from './modifiers.mjs';
import {newTownServices} from './town-services.mjs';
import {stepWorld} from './game-loop.mjs';
import {rangerHooks} from './ranger.mjs';
import {starterFlasks,autoFlasks,advanceFlaskRecovery} from "./flasks.mjs";
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

test('Field Medicine gains life-flask charges from direct resolved hits only, at most once each second',()=>{
 const {player,modifiers}=load(path({...start,level:11,passivePoints:10},41137));
 assert.equal(player.flaskConfig.lifeOnHit,1);
 const hook=rangerHooks({modifiers,random:()=>0});
 const flasks={life:{charges:0,remaining:0},mana:{charges:0,remaining:0}};
 const base={player,flasks,enemies:[foe,{...foe,id:'double',x:2}],time:0};
 const hit=(state,shot,target=base.enemies)=>stepWorld({...state,projectiles:[shot],enemies:target},.05,hook);
 for(const [_,evade,shot] of [
  ['miss',{...foe,evasion:Infinity,entropy:0},projectile()],
  ['block',{...foe,defence:{attackBlock:.75}},projectile()],
  ...['totem','trap','mine','mirage','minion','wisp'].map(proxy=>[proxy,foe,projectile({proxy})]),
 ]){
  const no=hit(base,shot,[evade]);
  near(no.flasks.life.charges,0);assert.equal(no.player.flaskHitReadyAt,undefined);
 }
 const first=hit(base,projectile({pierce:2}));
 near(first.flasks.life.charges,1);near(first.flasks.mana.charges,0);
 assert.equal(first.player.pendingLifeFlaskCharges,undefined);
 near(first.player.flaskHitReadyAt,1.05);
 const early=hit({...first,time:.5},projectile({source:'spell'}));
 near(early.flasks.life.charges,1);
 const again=hit({...early,time:1},projectile({source:'spell'}));
 near(again.flasks.life.charges,2);near(again.flasks.mana.charges,0);
 const full=hit({...base,flasks:{...flasks,life:{charges:20,remaining:0}}},projectile());
 assert.deepEqual(full.events.filter(e=>e.type==='flask'),[{type:'flask',resource:'life'}]);
 assert.equal(full.flasks.life.charges,14);
 const retry=retryBeach({...first,dead:true,zone:'beach'});
 assert.equal(retry.player.flaskHitReadyAt,undefined);
});

test('flask effect changes recovery per second while duration keeps that rate and extends recovery',()=>{
 const progress=path(path({...start,level:30,passivePoints:29},16602),9373);
 const {player}=load(progress);
 const p={...player,life:5,maximumLife:300,mana:0,maximumMana:300};
 const use=autoFlasks(p,starterFlasks()).flasks;
 near(use.life.remaining,3.3);near(use.mana.remaining,3.3);
 const first=advanceFlaskRecovery(p,use,1);
 near(first.player.life-5,70*1.1*1.05/3);
 near(first.player.mana,50*1.05/3);
 const last=advanceFlaskRecovery(first.player,first.flasks,3);
 near(last.player.life-5,70*1.1*1.05*1.1);
 near(last.player.mana,50*1.05*1.1);
});

test('flask mastery recovers four percent of max life on either use but not Vaal Pact',()=>{
 const tree=allocate(path({...start,level:13,passivePoints:12},50690),41016,10815);
 const {player}=load(tree);
 const p={...player,life:20,mana:10,maximumLife:100,maximumMana:100};
 const state={player:p,flasks:starterFlasks(),enemies:[],projectiles:[]};
 const redAndBlue=stepWorld(state,.02);
 near(redAndBlue.player.life,28);
 const blueOnly=stepWorld({...state,flasks:{...state.flasks,life:{charges:0,remaining:0}}},.02);
 near(blueOnly.player.life,24);
 const vaal=stepWorld({...state,player:{...p,rules:{...p.rules,vaalPact:true}}},.02);
 near(vaal.player.life,20);assert.equal(vaal.flasks.life.charges,21);
 const atCaps=stepWorld({...state,player:{...p,life:90,reservedLife:10,mana:100}},.02);
 near(atCaps.player.life,90);assert.deepEqual(atCaps.events.filter(e=>e.type==='flask'),[]);
});
