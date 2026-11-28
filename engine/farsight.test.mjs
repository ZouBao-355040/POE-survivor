import test from 'node:test';
import assert from 'node:assert/strict';
import {allocate,tracePath,nodes} from './passive-tree.mjs';
import {rangerHooks} from './ranger.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {newTownServices} from './town-services.mjs';
import {ModifierStore} from './modifiers.mjs';
import {compileAttack} from './skill.mjs';
import {basicBowAttack,crudeBow} from './starter-data.mjs';
import {weaponStats} from './weapon.mjs';
import {resolveAttackImpact} from './combat.mjs';
import {hitChance} from './core.mjs';
import {stepWorld} from './game-loop.mjs';
import {skillDotRate} from './dot.mjs';

const start={characterClass:'Ranger',passivePoints:11};
const path=tracePath(start,47743);
const before=path.slice(1,-3).reduce((p,id)=>allocate(p,id),start);
const after=path.slice(-3).reduce((p,id)=>allocate(p,id),before);
const setup=(p)=>{
 const modifiers=new ModifierStore(),town=newTownServices({starter:true});
 const player=applyLoadout({x:0,y:0,life:70,mana:58,energyShield:0,attackRange:10},town,p,modifiers,{refill:true});
 return {player,modifiers};
};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+' != '+b);
const enemy={id:'dodger',x:2,y:0,radius:.4,life:2000,maximumLife:2000,defence:{},evasion:1000,speed:0};
const rolls={critical:0,confirmation:.86,ignite:1,block:1};

test('Farsight and its preceding bow node make a real Ranger ordinary arrow hit the same dodging enemy',()=>{
 assert.equal(path.length-1,10);
 assert.deepEqual(path.slice(-3),[16851,12068,47743]);
 assert.equal(nodes.get(47743).effects.length,4);
 const a=setup(before),b=setup(after);
 const context={tags:['attack','projectile','bow']};
 close(skillDotRate(10,'chaos',b.modifiers,context)-skillDotRate(10,'chaos',a.modifiers,context),4.6);
 close(b.modifiers.calculate(1,'attackSpeed',context)-a.modifiers.calculate(1,'attackSpeed',context),.09);
 close(b.modifiers.calculate(1,'damage',context)-a.modifiers.calculate(1,'damage',context),.46);
 assert.equal(a.player.accuracy,b.player.accuracy);
 const low=hitChance(a.player.accuracy,enemy.evasion);
 const high=hitChance(Math.round(b.player.baseAccuracy*(1+b.player.increasedAccuracy+.24)),enemy.evasion);
 assert.ok(high>low);
 const fixture={...enemy,entropy:100-50*(low+high)};
 const run=({player,modifiers})=>{
  const hooks=rangerHooks({active:basicBowAttack,supports:[],modifiers,random:()=>.7});
  let state={player,enemies:[fixture],projectiles:[],time:0};
  for(let i=0;i<23;i++)state=stepWorld(state,.02,{...hooks,manaRegen:0});
  return state.enemies[0].life;
 };
 assert.equal(run(a),enemy.life);
 assert.ok(run(b)<enemy.life);
});

test('bow accuracy adds to global increases, helps critical confirmation, and never leaks to other sources',()=>{
 const {player,modifiers}=setup(after);
 const attacker={...player,baseAccuracy:200,increasedAccuracy:.20,accuracy:240};
 const base=compileAttack(basicBowAttack,weaponStats(crudeBow),[],modifiers,()=>.5);
 const impact=(tags,source='attack',extra={})=>resolveAttackImpact({attacker,target:{...enemy,entropy:99},modifiers,rolls,
  skill:{...base,source,context:{tags},criticalChance:.5,...extra}});
 const low=hitChance(240,enemy.evasion),high=hitChance(288,enemy.evasion);
 assert.ok(low<rolls.confirmation&&rolls.confirmation<high);
 close(impact(['bow','attack']).hit.chance,high);
 assert.equal(impact(['bow','attack']).hit.critical,true);
 for(const tags of [['attack','wand','projectile'],['attack','sword','melee'],['attack','bow','minion']]){
  close(impact(tags).hit.chance,low);
  assert.equal(impact(tags).hit.critical,false);
 }
 close(impact(['bow','spell'],'spell').hit.chance,1);
 const precise={...attacker,maximumLife:260,rules:{precise:true}};
 const hit=(who,tags)=>resolveAttackImpact({attacker:who,target:{...enemy,evasion:0},modifiers,rolls,
  skill:{source:'attack',baseDamage:{physical:10},context:{tags},criticalChance:.5}});
 const bow=['bow','attack'],wand=['wand','attack'];
 close(hit(precise,bow).damage.physical/hit({...precise,rules:{resolute:true}},bow).damage.physical,1.4);
 close(hit(precise,wand).damage.physical,10);
});
