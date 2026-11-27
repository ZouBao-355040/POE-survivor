import test from 'node:test';
import assert from 'node:assert/strict';
import {GemInventory} from './gem-inventory.mjs';
import {gemById} from './projectile-catalog.mjs';
import {ModifierStore} from './modifiers.mjs';
import {rangerHooks} from './ranger.mjs';
import {stepWorld} from './game-loop.mjs';

const player={x:0,y:0,life:100,maximumLife:100,mana:60,maximumMana:60,speed:4,attackRange:12,accuracy:200};
const dummy={id:'boss',x:6,y:0,speed:0,life:5000, maximumLife:5000,defence:{},evasion:0};
const setup=(ids,caster=null)=>{
 const inventory=new GemInventory();
 ids.forEach((id,i)=>{const g=gemById.get(id);inventory.acquire(g);inventory.equip(g.id,'weapon',i);if(g.kind==='active')inventory.setMode(id,id===caster?'manual':'auto');});
 return {inventory,hooks:rangerHooks({inventory,modifiers:new ModifierStore(),random:()=>.4})};
};
const initial=()=>({player:{...player},projectiles:[],enemies:[dummy]});
const fire=s=>s.events.filter(e=>e.type==='fire');
test('automatic gems cast independently while reserving one gem for the manual request',()=>{
 const {inventory,hooks}=setup(['burning-arrow','split-arrow','fireball'],'fireball');
 const options={...hooks,castPlan:inventory.castPlan()};
 let s=stepWorld(initial(),.02,options);
 assert.deepEqual(fire(s).map(e=>e.skill),['burning-arrow','split-arrow']);
 assert.ok(s.skillCooldowns['burning-arrow']>0&&s.skillCooldowns['split-arrow']>0);
 assert.equal(s.skillCooldowns.fireball,undefined);
 s=stepWorld(s,.02,{...options,manualRequest:{x:1,y:0}});
 assert.deepEqual(fire(s).map(e=>[e.skill,!!e.manual]),[['fireball',true]]);
 assert.ok(s.skillCooldowns.fireball>0&&s.player.mana<60);
 s=stepWorld(s,.02,{...options,manualRequest:{x:1,y:0}});
 assert.deepEqual(fire(s),[]);
});
test('manual fails safely without mana, cannot fall back to a free shot and respects a paused game',()=>{
 const {inventory,hooks}=setup(['fireball'],'fireball');
 const options={...hooks,castPlan:inventory.castPlan(),manualRequest:{x:1,y:0}};
 const state=initial();state.player.mana=0;
 const dry=stepWorld(state,.02,options);
 assert.equal(dry.player.mana,0);assert.equal(dry.projectiles.length,0);assert.deepEqual(fire(dry),[]);
 assert.deepEqual(fire(stepWorld({...initial(),paused:true},.02,options)),[]);
 assert.deepEqual(fire(stepWorld(initial(),.02,{...options,manualRequest:null})),[]);
});
test('manual ballistas pre-place without enemies, stack, have a cap and do not attack from the player',()=>{
 const {inventory,hooks}=setup(['siege-ballista'],'siege-ballista');
 const options={...hooks,castPlan:inventory.castPlan()};
 let s={...initial(),enemies:[]};
 for(let i=0;i<3;i++){
  const mana=s.player.mana;
  s=stepWorld(s,.02,{...options,manualRequest:{x:1,y:0}});
  assert.equal(fire(s)[0].manual,true);assert.ok(s.player.mana<mana);assert.equal(s.projectiles.length,0);
  assert.equal(s.fields.filter(f=>f.totemGroup==='ballista').length,Math.min(2,i+1));
  for(let j=0;j<25;j++)s=stepWorld(s,.02,options);
 }
 s={...s,enemies:[dummy]};
 for(let j=0;j<90;j++)s=stepWorld(s,.02,options);
 assert.ok(s.enemies[0].life<dummy.life);
});
test('switching manual skill keeps only one and shared linked support receives XP once',()=>{
 const {inventory}=setup(['burning-arrow','split-arrow','momentum'],'burning-arrow');
 inventory.setMode('split-arrow','manual');
 assert.equal(inventory.manual,'split-arrow');
 assert.equal(inventory.mode('burning-arrow'),'auto');
 inventory.grantExperience(1,1);
 assert.equal(inventory.owned.get('momentum').experience,1);
 assert.equal(inventory.owned.get('split-arrow').experience,1);
 inventory.unequip('weapon',1);
 assert.equal(inventory.castPlan().manual,null);
});
