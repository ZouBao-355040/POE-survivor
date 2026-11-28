import test from 'node:test';
import assert from 'node:assert/strict';
import {bleedApplication} from './bleed.mjs';
import {allocate,tracePath,nodes} from './passive-tree.mjs';
import {ModifierStore} from './modifiers.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {newTownServices} from './town-services.mjs';
import {rangerHooks} from './ranger.mjs';
import {compileAttack} from './skill.mjs';
import {basicBowAttack,crudeBow} from './starter-data.mjs';
import {weaponStats} from './weapon.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≠ ${b}`);
const result={hit:{hit:true,critical:false},mitigation:{blocked:false},canInflictHitAilments:true,ailmentBase:{physical:100}};
const skill={source:'attack',context:{tags:['bow','attack','projectile']}};
const config=(modifiers)=>({result,skill,modifiers,player:{rules:{}},time:1,random:()=>.01});

test('canonical Ranger node makes Bow Attack crit and bleed and does not bleed from spells or misses',()=>{
 let p={characterClass:'Ranger',level:14,passivePoints:13};
 const path=tracePath(p,5632).slice(1);
 assert.ok(nodes.get(5632).implemented);assert.ok(path.length<=13);
 for(const id of path)p=allocate(p,id);
 const modifiers=new ModifierStore();
 const player=applyLoadout({life:100,mana:50,x:0,y:0},newTownServices({starter:true}),p,modifiers);
 const input=config(modifiers);
 near(modifiers.calculate(0,'bleedChance',{tags:['attack']}),.1);
 const rng=()=>.4;
 const compiled=compileAttack(basicBowAttack,weaponStats(crudeBow),[],modifiers,rng,{tags:['bow']});
 assert.ok(compiled.criticalChance>compileAttack(basicBowAttack,weaponStats(crudeBow),[],new ModifierStore(),rng,{tags:['bow']}).criticalChance);
 const arrow={skill:compiled,rolls:{critical:.4,confirmation:.4,block:.4,ignite:.4},attacker:{}};
 const target={life:1000,maximumLife:1000,x:3,y:0,evasion:0,defence:{}};
 const fly=random=>rangerHooks({modifiers,random}).onImpact(target,arrow,0,player);
 assert.ok(fly(()=>.09).dots?.some(d=>d.key==='bleed'));
 assert.equal(fly(()=>.11).dots?.length??0,0);
 assert.equal(bleedApplication({...input,skill:{...skill,source:'spell'}}),null);
 assert.equal(bleedApplication({...input,result:{...result,mitigation:{blocked:true}}}),null);
 assert.equal(bleedApplication({...input,result:{...result,hit:{hit:false}}}),null);
 assert.equal(bleedApplication({...input,result:{...result,canInflictHitAilments:false}}),null);
 assert.equal(bleedApplication({...input,result:{...result,ailmentBase:{chaos:100}}}),null);
 assert.equal(bleedApplication({...input,minion:true}),null);
});

test('bleed modifiers scale their own layer, never attack or projectile hit damage',()=>{
 const modifiers=new ModifierStore();
 modifiers.replace('points',[
  {stat:'bleedChance',value:1,kind:'flat',tags:['attack']},
  {stat:'bleedDamage',value:.15,kind:'increased'},
  {stat:'damage',value:.4,kind:'increased',tags:['projectile']},
  {stat:'damage',value:.7,kind:'increased',tags:['attack']},
  {stat:'damage',value:.1,kind:'increased'},
  {stat:'bleedFaster',value:.2,kind:'flat'},
  {stat:'bleedDuration',value:.2,kind:'increased'},
  {stat:'bleedDotMultiplier',value:.06,kind:'flat'}
 ]);
 const input=config(modifiers);
 const regular=bleedApplication(input);
 near(regular.rate,70*1.25*1.06*1.2);
 near(regular.end-regular.start,5);
 const critical=bleedApplication({...input,result:{...result,hit:{hit:true,critical:true}}});
 near(critical.rate,70*1.25*1.56*1.2);
 const agony=bleedApplication({...input,result:{...result,hit:{hit:true,critical:true},ailmentCriticalMultiplier:2.4}});
 near(agony.rate,70*1.25*2.4*1.2);
 const crimson=bleedApplication({...input,player:{rules:{crimsonDance:true}}});
 near(crimson.rate,regular.rate*.5);assert.equal(crimson.crimson,true);
});
