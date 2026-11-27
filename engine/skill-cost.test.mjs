import test from 'node:test';
import assert from 'node:assert/strict';
import {compileAttack} from './skill.mjs';
import {paySkillCost} from './resources.mjs';
import {rangerHooks} from './ranger.mjs';
import {ModifierStore} from './modifiers.mjs';
import {gemById} from './projectile-catalog.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {newTownServices} from './town-services.mjs';
import {allocate,tracePath} from './passive-tree.mjs';
import {burningArrow,basicBowAttack,crudeBow} from './starter-data.mjs';
import {weaponStats} from './weapon.mjs';

const initial={characterClass:'Ranger',level:1,passivePoints:150};
const path=(state,end)=>tracePath(state,end).slice(1).reduce((s,id)=>allocate(s,id),state);
const base={x:0,y:0,maximumLife:100,life:70,maximumMana:100,mana:50,maximumEnergyShield:40,energyShield:20};
const bow=weaponStats(crudeBow),spell=gemById.get('fireball');
const load=(p,m=new ModifierStore())=>({m,p:applyLoadout(base,newTownServices({starter:true}),p,m)});
const compiled=(active,m,supports=[],context={})=>compileAttack(active,bow,supports,m,()=>.4,context);
const flat=(stat,value,tags)=>({stat,value,kind:'flat',tags});

test('attack and mana efficiency apply by resource and scope: divisor, rounding, then flat total',()=>{
 let p=path(initial,13935);
 p=allocate(path(p,42804),10495,12119);
 const {m}=load(p);
 const attack=compiled({...burningArrow,cost:25},m);
 const fireball=compiled({...spell,cost:25},m);
 assert.equal(attack.cost,16); // 25 / (1+.15+.25+.15), nearest integer.
 assert.equal(fireball.cost,22); // 25 / 1.15, not 25 - 15%.
 assert.equal(attack.costs.bloodMagicLife,18); // Attack-wide efficiency without mana-only mastery.
 assert.equal(fireball.costs.bloodMagicLife,25);
 assert.equal(compiled(basicBowAttack,m).cost,0);
 m.replace('flat-total',[flat('manaCost',-3)]);
 assert.equal(compiled({...burningArrow,cost:25},m).cost,13);
 assert.equal(compiled(basicBowAttack,m).cost,0);
 const support={id:'test-support',requiresAll:['attack'],costMultiplier:1.3};
 assert.equal(compiled({...burningArrow,cost:25},m,[support,support]).cost,18); // Base 32; one support; /1.55, then -3.
});

test('mixed payment is resource specific; Blood Magic combines base and EB only covers mana',()=>{
 const p=allocate(path(initial,27788),292,38454);
 const {m}=load(p);
 m.replace('cost-test',[flat('manaEfficiency',.5),flat('lifeCostRatio',.2,['attack'])]);
 const skill=compiled({...burningArrow,cost:20,baseLifeCost:2},m);
 assert.deepEqual(skill.costs,{mana:8,life:9,bloodMagicLife:22});
 const paid=paySkillCost({...base,rules:{eldritchBattery:true},energyShield:5},skill.costs);
 assert.equal(paid.state.life,61);assert.equal(paid.state.mana,47);assert.equal(paid.state.energyShield,0);
 const blood=paySkillCost({...base,rules:{bloodMagic:true,eldritchBattery:true}},skill.costs);
 assert.equal(blood.state.life,48);assert.equal(blood.state.mana,50);assert.equal(blood.state.energyShield,20);
 for(const state of [{...base,life:9},{...base,mana:7}]){
  const denied=paySkillCost(state,skill.costs);assert.equal(denied.paid,false);assert.equal(denied.state,state);
 }
 assert.equal(paySkillCost({...base,life:1,mana:0,energyShield:0},compiled(basicBowAttack,m).costs).paid,true);
 const native=load(path(initial,56359)).m;
 assert.equal(compiled({...burningArrow,cost:20},native).costs.life,1);
 assert.equal(compiled({...spell,cost:20},native).costs.life,0);
});

test('real casts use one payment for support repeats and fail without spending any pool',()=>{
 const {m}=load(allocate(path(initial,27788),292,38454));
 const active=gemById.get('fireball'),echo=gemById.get('spell-echo');
 const compiledSkill=compiled(active,m,[echo]);
 const hooks=rangerHooks({modifiers:m,inventory:{current:()=>({active,supports:[echo]})},random:()=>.4});
 const aim={x:3,y:0,id:'foe',life:10000};
 const cast={linked:{active,supports:[echo]},manual:true};
 const paid=hooks.onFire(base,aim,0,[aim],null,cast);
 assert.ok(paid.projectiles.length>=2);
 assert.equal(paid.player.mana,base.mana-compiledSkill.costs.mana);
 assert.equal(paid.player.life,base.life-compiledSkill.costs.life);
 assert.ok(compiledSkill.costs.life>0);
 const low={...base,life:compiledSkill.costs.life};
 assert.equal(hooks.onFire(low,aim,0,[aim],null,cast),null);
 assert.equal(low.mana,base.mana);
 assert.equal(low.life,compiledSkill.costs.life);
});
