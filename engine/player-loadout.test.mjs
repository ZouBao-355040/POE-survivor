import test from 'node:test';
import assert from 'node:assert/strict';
import {ModifierStore} from './modifiers.mjs';
import {rangerHooks} from './ranger.mjs';
import {stepWorld} from './game-loop.mjs';
import {allocateTalent} from './act-one-talents.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {newTownServices,equipGear} from './town-services.mjs';
import {burningArrow} from './starter-data.mjs';

const original={x:0,y:0,life:70,maximumLife:70,mana:58,maximumMana:58,energyShield:0,speed:4,defence:{}};
test('official life node and gear both affect live resources; recalculation does not stack',()=>{
 const town=newTownServices({starter:true});
 const gear={id:'body-drop',slot:'body',value:12,affixes:[{key:'life',value:5},{key:'mana',value:3},{key:'fire',value:8}]};
 const equipped=equipGear({...town,gear:[...town.gear,gear]},gear.id);
 const talents=allocateTalent({passivePoints:1},'39821');
 const m=new ModifierStore();
 const live=applyLoadout(original,equipped,talents,m,{refill:true});
 assert.equal(live.maximumLife,101);
 assert.equal(live.life,101);assert.equal(live.maximumMana,61);assert.equal(live.defence.resistances.fire,.08);
 assert.equal(live.evasion,35);
 assert.deepEqual(applyLoadout(live,equipped,talents,m,{refill:true}),live);
});
test('official projectile node raises the damage of actual combat hits',()=>{
 const run=progression=>{
  const mods=new ModifierStore(),player=applyLoadout(original,newTownServices({starter:true}),progression,mods,{refill:true});
  const skill={...burningArrow,igniteChance:0};
  const hook=rangerHooks({modifiers:mods,active:skill,supports:[],random:()=>.5});
  let state={player,enemies:[{id:'dummy',x:2,y:0,life:5000,maximumLife:5000,evasion:0,speed:0,defence:{}}],projectiles:[]};
  for(let i=0;i<10;i++)state=stepWorld(state,.02,hook);
  return 5000-state.enemies[0].life;
 };
 const base=run({passivePoints:1}),upgraded=run(allocateTalent({passivePoints:1},'45035'));
 assert.ok(base>0);assert.ok(Math.abs(upgraded/base-1.16)<1e-7);
});
