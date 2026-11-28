import test from 'node:test';
import assert from 'node:assert/strict';
import {integrateBleed} from './bleed.mjs';
import {stepWorld} from './game-loop.mjs';
import {rangerHooks} from './ranger.mjs';
import {allocate,tracePath} from './passive-tree.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {ModifierStore} from './modifiers.mjs';
import {gemById} from './projectile-catalog.mjs';
import {newTownServices} from './town-services.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+' ≠ '+b);
const bleed=(rate,options={})=>({key:'bleed',type:'physical',rate,start:0,end:5,...options});

test('normal bleed uses the strongest but weaker application resumes after its expiry',()=>{
 const a=bleed(10,{end:1.5}),b=bleed(4);
 near(integrateBleed([a,b],1,2,1),7);
 near(integrateBleed([a,b],1,2,1.25),12);
 near(integrateBleed([b],1,2,1,{armour:1e5,additionalPhysicalReduction:.25}),3);
});

test('Crimson Dance activates the top eight, regardless of effective movement or aggravation',()=>{
 const a=Array.from({length:9},(_,i)=>bleed(i+1,{crimson:true,aggravated:true}));
 near(integrateBleed(a,1,2,2),44);
 near(integrateBleed(a,1,2,1),44);
 a[8].end=1.5;
 near(integrateBleed(a,1,2,1),40);
 near(integrateBleed([bleed(10,{aggravated:true})],1,2),30);
});

test('canonical Ranger allocation halves real Puncture bleed before stacking and takes effect in combat',()=>{
 const start={characterClass:'Ranger',level:18,passivePoints:17};
 const path=tracePath(start,17818).slice(1);
 const progress=path.reduce((p,id)=>allocate(p,id),start);
 const mods=new ModifierStore(),town=newTownServices({starter:true});
 const load=p=>applyLoadout({x:0,y:0,life:100,mana:30},town,p,mods);
 const crimson=load(progress),normal={...crimson,rules:{...crimson.rules,crimsonDance:false}};
 assert.equal(crimson.rules.crimsonDance,true);
 const foe={id:'foe',x:.6,y:0,speed:4,attackRange:.5,life:1000,maximumLife:1000,evasion:0,defence:{}};
 const hooks=rangerHooks({modifiers:mods,random:()=>.4});
 const shot={attacker:{},rolls:{critical:.4,confirmation:.4,block:.4,ignite:.4},
  skill:{id:'puncture',source:'attack',baseDamage:{physical:10},criticalChance:0,active:gemById.get('puncture')}};
 const hit=(p,target)=>hooks.onImpact(target,shot,0,p);
 const a=hit(normal,foe),b=hit(crimson,foe),b2=hit(crimson,b);
 near(a.dots[0].rate,b.dots[0].rate*2);assert.equal(b2.dots.length,2);
 const tick=(p,e)=>stepWorld({player:p,enemies:[e],projectiles:[],time:0,cooldown:10},.05).enemies[0].life;
 // Only the half-tick the target moved into attack range gets the regular movement bonus.
 near(a.life-tick(normal,a),a.dots[0].rate*(.025*3+.025));
 near(b2.life-tick(crimson,b2),b2.dots[0].rate*.05*2);
 const frozen={...a,frozenUntil:1};
 near(frozen.life-tick(normal,frozen),a.dots[0].rate*.05);
});
