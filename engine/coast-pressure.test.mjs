import test from 'node:test';
import assert from 'node:assert/strict';
import {beginTrial,openingBeach,stepTrial} from './campaign.mjs';
import {stepWorld} from './game-loop.mjs';
import {ModifierStore} from './modifiers.mjs';
const player={x:0,y:0,speed:5,life:70,maximumLife:70,mana:58,maximumMana:58};
const opts={enemyModifiers:new ModifierStore(),random:()=>.4};
test('campaign teaching enemies stay simple, but coast mixes chase, threat at range, and armoured targets',()=>{
 assert.ok(openingBeach().every(e=>!e.fireCast));
 const stage=stepTrial(beginTrial({player,zone:'town',progression:{level:1},gold:0}),.02,opts);
 assert.equal(stage.enemies.length,12);
 const chase=stage.enemies.find(e=>e.family==='cannibal'),caster=stage.enemies.find(e=>e.family==='fire-eater'),shell=stage.enemies.find(e=>e.family==='crab');
 assert.ok(chase.speed>caster.speed);
 assert.ok(caster.attackRange>chase.attackRange&&caster.fireCast.windup>0);
 assert.ok(shell.life>chase.life&&shell.defence.armour>0);
});
test('coast fire circles telegraph first, hurt standing still, and can be dodged',()=>{
 const camp=stepTrial(beginTrial({player,zone:'town',progression:{level:1},gold:0}),.02,opts);
 const caster=camp.enemies.find(e=>e.fireCast);
 const s=stepWorld({player,enemies:[{...caster,x:3,y:0}],projectiles:[],time:0},.02,opts);
 assert.equal(s.player.life,70);
 assert.equal(s.enemyCasts.length,1);
 assert.deepEqual(stepWorld({...s,paused:true},.02,opts).enemyCasts,s.enemyCasts);
 let still=s,moving=s;
 for(let i=0;i<45;i++){
  still=stepWorld(still,.02,opts);
  moving=stepWorld(moving,.02,{...opts,direction:{x:0,y:1}});
 }
 assert.equal(still.player.life,63);
 assert.equal(moving.player.life,70);
});
