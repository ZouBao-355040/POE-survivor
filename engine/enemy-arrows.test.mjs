import test from 'node:test';
import assert from 'node:assert/strict';
import {stepWorld} from './game-loop.mjs';
import {resolveAttackImpact} from './combat.mjs';
import {hitChance} from './core.mjs';
import {ModifierStore} from './modifiers.mjs';
import {beginTrial,stepTrial,retryBeach} from './campaign.mjs';
import {trialStage} from './act-one.mjs';
import {allocate,tracePath} from './passive-tree.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {newTownServices} from './town-services.mjs';
import {aimEnemyArrow,launchEnemyArrow,moveEnemyArrows,enemyArrowLimit} from './enemy-arrows.mjs';

const player={x:0,y:0,speed:4,life:50,maximumLife:50,mana:30,maximumMana:30,energyShield:0,maximumEnergyShield:0,evasion:0,defence:{}};
const archer={id:'bow',x:5,y:0,life:100,maximumLife:100,speed:0,attackRange:7,accuracy:1000,arrow:{speed:12,windup:.45,lifetime:.92},
 attack:{attacksPerSecond:.45,baseDamage:{physical:10},criticalChance:0}};
const mods=new ModifierStore(),opts={enemyModifiers:mods,random:()=>.4};
const run=(state,n=1,extra={})=>{for(let i=0;i<n;i++)state=stepWorld(state,.05,{...opts,...extra});return state;};
const initial=(p=player,foe=archer)=>({player:p,enemies:[foe],projectiles:[]});
const hitEvents=state=>state.events.filter(e=>e.type==='enemyAttack');

test('real Act I Ledge waves include a sparse archer, while the Coast still only uses its original enemies',()=>{
 const base={player,gold:0};
 const coast=stepTrial(beginTrial(base,trialStage(0)),.05,opts);
 const ledge=stepTrial(beginTrial(base,trialStage(3)),.05,opts);
 assert.equal(ledge.encounter.stageId,'ledge');
 const archers=ledge.enemies.filter(e=>e.arrow);
 assert.ok(archers.length>0&&archers.length<ledge.enemies.length/3);
 assert.ok(archers.every(e=>e.family==='ancient-archer'&&!e.fireCast));
 assert.ok(!coast.enemies.some(e=>e.arrow));
});

test('visible windup locks its direction; stationary targets are hit by a traveling arrow, sidesteps and frozen sources avoid it',()=>{
 const ready=run(initial());
 assert.equal(ready.enemyCasts[0].kind,'arrow-windup');assert.equal(ready.enemyCasts[0].dx,-1);
 assert.equal(ready.player.life,50);assert.equal(ready.enemyArrows,undefined);
 const launched=run(ready,10);
 assert.equal(launched.enemyArrows.length,1);assert.equal(launched.player.life,50);
 const impact=run(launched,7);
 assert.ok(impact.enemyArrows[0].x<5&&impact.enemyArrows[0].x>.46);
 assert.equal(impact.player.life,50);
 const contact=run(impact);
 assert.equal(contact.player.life,40);assert.equal(contact.enemyArrows.length,0);
 assert.deepEqual(hitEvents(contact).map(e=>[e.hit,e.attackKind]),[[true,'projectile']]);
 const moved=run(ready,32,{direction:{x:0,y:1}});
 assert.equal(moved.player.life,50);assert.equal(moved.enemyArrows.length,0);
 const frozen=run({...ready,enemies:[{...ready.enemies[0],frozenUntil:3}]},10);
 assert.ok(!frozen.enemyArrows?.length);
 const removed=run({...ready,enemies:[]},10);
 assert.ok(!removed.enemyArrows?.length);
 const staged=beginTrial({...launched,zone:'town'},trialStage(3));
 assert.deepEqual(staged.enemyArrows,[]);
 assert.deepEqual(retryBeach({...launched,zone:'beach',dead:true}).enemyArrows,[]);
});

test('swept arrows avoid tunneling, expire by range, and the launcher obeys the projectile cap',()=>{
 const shot=launchEnemyArrow(aimEnemyArrow(archer,player,0),archer);
 const faster=aimEnemyArrow({...archer,arrow:{...archer.arrow,speed:24}},player,0);
 assert.equal(faster.range,shot.remaining*2);
 const fast={...shot,speed:200};
 assert.equal(moveEnemyArrows([fast],.05,player,player).contacts.length,1);
 assert.equal(moveEnemyArrows([{...fast,remaining:1}],.05,player,player).active.length,0);
 assert.equal(moveEnemyArrows([shot],0,player,player).active.length,1);
 const cross=moveEnemyArrows([{...fast,x:3,speed:120}],.05,{x:0,y:-2},{x:0,y:2});
 assert.equal(cross.contacts.length,1);
 const ready=run(initial());
 const flooded={...ready,time:.5,enemyArrows:Array.from({length:enemyArrowLimit},()=>({...shot,y:100}))};
 const capped=run(flooded);
 assert.equal(capped.enemyArrows.length,enemyArrowLimit);
});

test('Arrow Dancing changes only local rating for accurately tagged attacks; Wind Dancer and recoup still see arrow hits',()=>{
 const p={characterClass:'Ranger',passivePoints:100};
 const route=tracePath(p,54922).slice(1).reduce((s,id)=>allocate(s,id),p);
 const real=applyLoadout(player,newTownServices({starter:true}),route,mods);
 assert.equal(real.rules.arrowDancing,true);
 const dancer={...real,evasion:800,life:50,maximumLife:50};
 const attack=(source,kind)=>resolveAttackImpact({attacker:{accuracy:100},target:{...dancer,entropy:99},skill:{source,attackKind:kind,baseDamage:{physical:10}},modifiers:mods,rolls:{critical:1,confirmation:1,block:1,ignite:1}});
 assert.equal(attack('attack','projectile').hit.chance,hitChance(100,1600));
 assert.equal(attack('attack','melee').hit.chance,hitChance(100,600));
 assert.equal(attack('attack',undefined).hit.chance,hitChance(100,800));
 assert.equal(attack('spell','projectile').hit.chance,1);
 assert.equal(attack('attack','projectile').target.evasion,800);
 const receiver={...player,rules:{arrowDancing:true,windDancer:true},combatRecovery:{life:{recoup:.2,recoupDuration:4}}};
 const result=run(initial(receiver),19);
 assert.equal(result.player.life,42);
 assert.ok(result.player.lastAttackHit>0);
 assert.equal(result.player.recoupEffects[0].rate,.4);
});
