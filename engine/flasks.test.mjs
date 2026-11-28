import test from 'node:test';
import assert from 'node:assert/strict';
import {starterFlasks,autoFlasks,advanceFlaskRecovery} from './flasks.mjs';
import {stepWorld} from './game-loop.mjs';
import {applyLoadout} from "./player-loadout.mjs";
import {newTownServices} from "./town-services.mjs";
import {ModifierStore} from "./modifiers.mjs";
import {allocate,nodes,tracePath} from "./passive-tree.mjs";
const full={x:0,y:0,speed:1,life:100,maximumLife:100,mana:100,maximumMana:100};
test('starter flasks are full but never spend charges on a full resource',()=>{
 const flasks=starterFlasks();
 assert.deepEqual(autoFlasks(full,flasks,1),{flasks,used:[]});
 const result=autoFlasks({...full,mana:99},flasks);
 assert.deepEqual(result.used,['mana']);
 assert.equal(result.flasks.life.charges,21);
 assert.equal(result.flasks.mana.charges,18);
 assert.equal(result.flasks.mana.remaining,3);
});
test('a single missing life is enough, but not before the last charge',()=>{
 const player={...full,life:99};
 const flasks=starterFlasks();
 flasks.life.charges=19;
 assert.deepEqual(autoFlasks(player,flasks,1).used,[]);
 const result=autoFlasks(player,flasks,2);
 assert.deepEqual(result.used,['life']);
 assert.equal(result.flasks.life.charges,14);
});
test('recovery uses PoE starter amounts and ends at usable resource caps',()=>{
 const flasks=autoFlasks({...full,life:1,mana:0},starterFlasks()).flasks;
 const partial=advanceFlaskRecovery({...full,life:1,mana:0},flasks,1.5);
 assert.equal(partial.player.life,36);
 assert.equal(partial.player.mana,25);
 const finished=advanceFlaskRecovery(partial.player,partial.flasks,2);
 assert.equal(finished.player.life,71);
 assert.equal(finished.player.mana,50);
 assert.equal(finished.flasks.life.remaining,0);
 const capped=advanceFlaskRecovery({...full,life:99,mana:69,reservedMana:30},flasks,.2);
 assert.equal(capped.player.mana,70);
 assert.equal(capped.flasks.mana.remaining,0);
 assert.equal(capped.flasks.life.remaining,0);
 assert.deepEqual(autoFlasks({...full,life:0,mana:0},flasks,100).used,[]);
});
test('world orders mana spend and kill refill before autoflasks and pauses all flask state',()=>{
 const flasks=starterFlasks();flasks.life.charges=20;
 const state={player:{...full,life:98},flasks,enemies:[{id:'dead',x:2,y:0,life:0},{id:'target',x:3,y:0,life:50}],projectiles:[]};
 const shot=p=>({player:{...p,mana:99},projectiles:[],cooldown:1,skill:'test'});
 const next=stepWorld(state,.02,{onFire:shot});
 assert.deepEqual(next.events.filter(e=>e.type==='flask').map(e=>e.resource),['life','mana']);
 assert.equal(next.flasks.life.charges,14);
 assert.equal(next.flasks.mana.charges,18);
 const paused=stepWorld({...next,paused:true},.02);
 assert.deepEqual(paused.flasks,next.flasks);
 assert.deepEqual(paused.player,next.player);
});

function rangerWithFlaskNodes(ids){
 let progress={characterClass:'Ranger',level:32,passivePoints:31};
 for(const id of ids){
  const path=tracePath(progress,id);
  assert.equal(path.at(-1),id);
  for(const next of path.slice(1))progress=allocate(progress,next);
 }
 return applyLoadout(full,newTownServices({starter:true}),progress,new ModifierStore(),{refill:true});
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('canonical recovery passives affect real flasks independently from suppression and keep ordinary potion duration',()=>{
 const life=rangerWithFlaskNodes([6383]);
 near(life.defence.suppressionChance,.05);
 near(life.flaskConfig.recovery.life,1.12);
 near(life.flaskConfig.recovery.mana,1);
 const cast=autoFlasks({...life,life:1,mana:0,maximumLife:300,maximumMana:300},starterFlasks());
 assert.deepEqual(cast.used,['life','mana']);
 assert.equal(cast.flasks.life.remaining,3);
 const p={...life,life:1,mana:0,maximumLife:300,maximumMana:300};
 const a=advanceFlaskRecovery(p,cast.flasks,1.5);
 near(a.player.life,40.2);near(a.player.mana,25);
 const b=advanceFlaskRecovery(a.player,a.flasks,1.5);
 near(b.player.life,79.4);near(b.player.mana,50);
 const mana=rangerWithFlaskNodes([21634]);
 near(mana.flaskConfig.recovery.mana,1.3);
 near(mana.flaskConfig.recovery.life,1);
 assert.equal(mana.flaskConfig.periodic.mana,1);
});

test('charge gain retains fractions across kills; neither full resource spends a full flask',()=>{
 const flaskConfig={gain:1.15};
 const player={...full,life:10,flaskConfig};
 let flasks={life:{charges:18.8,remaining:0},mana:{charges:23,remaining:0}};
 const state={player,flasks,time:0,enemies:[{id:'kill',x:0,y:0,life:0}],projectiles:[]};
 const round1=stepWorld(state,.02);
 near(round1.flasks.life.charges,19.95);
 assert.equal(round1.flasks.mana.charges,24);
 assert.deepEqual(round1.events.filter(e=>e.type==='flask'),[]);
 const round2=stepWorld({...round1,enemies:state.enemies},.02);
 assert.equal(round2.flasks.life.charges,14);
 assert.equal(round2.flasks.mana.charges,24);
 assert.deepEqual(round2.events.filter(e=>e.type==='flask'),[{type:'flask',resource:'life'}]);
});

test('Replenishing Remedies grants both periodic charges on simulation boundaries and does not tick when paused',()=>{
 const player={...rangerWithFlaskNodes([50690]),life:10,mana:0,lifeRegen:0};
 assert.deepEqual(player.flaskConfig.periodic,{life:3,mana:2});
 near(player.flaskConfig.gain,1.25);
 const flasks={life:{charges:19,remaining:0},mana:{charges:22,remaining:0}};
 const state={player,flasks,time:2.97,enemies:[],projectiles:[]};
 const a=stepWorld(state,.02);assert.deepEqual(a.flasks,flasks);
 const paused=stepWorld({...a,paused:true},.05);
 assert.deepEqual(paused.flasks,flasks);assert.equal(paused.time,a.time);
 const b=stepWorld(a,.02);
 assert.deepEqual(b.events.filter(e=>e.type==='flask').map(e=>e.resource),['life','mana']);
 assert.equal(b.flasks.life.charges,14);assert.equal(b.flasks.mana.charges,18);
 const c=stepWorld(b,.02);
 assert.equal(c.flasks.life.charges,14);assert.equal(c.flasks.mana.charges,18);
 const vaal=stepWorld({...a,player:{...player,rules:{...player.rules,vaalPact:true}}},.02);
 assert.deepEqual(vaal.events.filter(e=>e.type==='flask').map(e=>e.resource),['mana']);
 assert.equal(vaal.flasks.life.charges,21);assert.equal(vaal.flasks.life.remaining,0);
 assert.equal(nodes.get(41420).implemented,false); // No partial unlock for mixed flask effects.
});

test('real flask mastery requires the group notable and adds a charge for both flasks per tick',()=>{
 const starting={characterClass:'Ranger',level:14,passivePoints:13};
 assert.throws(()=>allocate(starting,41016,29214),/重要天賦/);
 const notable=tracePath(starting,50690).slice(1).reduce((p,id)=>allocate(p,id),starting);
 const mastery=allocate(notable,41016,29214);
 const player=applyLoadout(full,newTownServices({starter:true}),mastery,new ModifierStore());
 assert.deepEqual(player.flaskConfig.periodic,{life:4,mana:3});
 const flasks={life:{charges:0,remaining:0},mana:{charges:0,remaining:0}};
 const before={player,flasks,time:5.99,enemies:[],projectiles:[]};
 const a=stepWorld(before,.02);
 near(a.flasks.life.charges,5);near(a.flasks.mana.charges,3.75);
 const tick=stepWorld(a,.02);
 near(tick.flasks.life.charges,5);near(tick.flasks.mana.charges,3.75);
});
