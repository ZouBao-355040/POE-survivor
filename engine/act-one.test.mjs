import test from 'node:test';
import assert from 'node:assert/strict';
import {actOne,advanceRoute,trialStage} from './act-one.mjs';
import {beginTrial,stepTrial} from './campaign.mjs';
const player={x:0,y:0,speed:4,life:70,maximumLife:70,mana:58,maximumMana:58};
const base={player,zone:'town',progression:{level:2},gold:10};
const settings={random:()=>.4};
test('each main route stage is playable in order, and the route ends after Merveil',()=>{
 assert.equal(actOne.length,11);
 assert.equal(new Set(actOne.map(x=>x.id)).size,11);
 const reached=[];
 let route=base;
 for(let i=0;i<actOne.length;i++){
  const def=trialStage(route.routeIndex??0);
  reached.push(def.id);
  let stage=beginTrial(route,def);
  assert.equal(stage.encounter.stageName,def.name);
  const started=stepTrial(stage,.02,settings);
  assert.ok(started.enemies.length>0&&started.enemies.length<=def.maxActive);
  assert.equal(advanceRoute(started),started,'cannot skip a live stage');
  stage=stepTrial({...started,time:def.duration-.01},.02,settings);
  if(def.boss){
   const boss=stage.enemies.find(e=>e.boss);
   assert.equal(boss?.name,def.boss.name);
   assert.equal(boss.maximumLife,def.boss.health);
   assert.ok(boss.maximumLife>=400);
   assert.ok(stage.enemies.length<=def.maxActive);
   stage=stepTrial({...stage,enemies:stage.enemies.map(e=>e.boss?{...e,life:0}:e)},.02,settings);
  }
  if(def.glyphs){
   assert.equal(stage.encounter.phase,'glyphs');
   assert.equal(advanceRoute(stage),stage);
   for(const g of stage.encounter.glyphs){
    stage=stepTrial({...stage,player:{...stage.player,x:g.x,y:g.y}},.02,settings);
   }
   assert.equal(stage.encounter.glyphs.filter(g=>g.taken).length,3);
  }
  assert.equal(stage.encounter.phase,'cleared',def.id);
  route=advanceRoute(stage);
  assert.equal(route.routeIndex,i+1);
  assert.ok(route.gold>=10);
 }
 assert.deepEqual(reached,actOne.map(x=>x.id));
 assert.equal(actOne.at(-1).boss.name,'莫薇兒');
 assert.equal(route.chapterComplete,true);
 assert.equal(trialStage(route.routeIndex),null);
});
test('death cannot mark a stage as complete or advance its index',()=>{
 const active=beginTrial({...base,routeIndex:4},actOne[4]);
 const dead={...active,dead:true,encounter:{...active.encounter,phase:'cleared'}};
 assert.equal(advanceRoute(dead),dead);
});
test('Merveil has a second phase without restoring health',()=>{
 const def=actOne.at(-1);
 let s=stepTrial({...beginTrial(base,def),time:def.duration-.01},.02,settings);
 const boss=s.enemies.find(e=>e.boss);
 s=stepTrial({...s,enemies:s.enemies.map(e=>e===boss?{...boss,life:2450}:e)},.02,settings);
 const phase=s.enemies.find(e=>e.boss);
 assert.equal(phase.life,2450);assert.ok(phase.enraged);assert.equal(phase.fireCast.element,'cold');
 assert.ok(phase.fireCast.radius>boss.fireCast.radius);
 assert.equal(s.events.filter(e=>e.type==='boss-phase').length,1);
 assert.equal(stepTrial(s,.02,settings).events.filter(e=>e.type==='boss-phase').length,0);
});
