import test from 'node:test';
import assert from 'node:assert/strict';
import {allocate,tracePath,nodes} from './passive-tree.mjs';
import {rangerHooks} from './ranger.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {newTownServices} from './town-services.mjs';
import {ModifierStore} from './modifiers.mjs';
import {stepWorld} from './game-loop.mjs';

const start={characterClass:'Ranger',level:17,passivePoints:16};
const path=tracePath(start,1205);
const base=path.slice(1,-1).reduce((p,id)=>allocate(p,id),start);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+' != '+b);
const target={id:'enemy',x:2,y:0,radius:.4,life:2000,maximumLife:2000,defence:{},evasion:0,speed:0};
function setup(option){
 const modifiers=new ModifierStore(),p=option?allocate(base,1205,option):base;
 const player={...applyLoadout({life:70,mana:58,energyShield:0},newTownServices({starter:true}),p,modifiers,{refill:true}),x:0,y:0,accuracy:1000};
 const hooks=rangerHooks({modifiers,random:()=>.02});
 const strike=(e,time,{minion=false}={})=>hooks.onImpact(e,{skill:{id:'poison-mastery-test',source:'attack',
  active:{tags:['attack','projectile','bow'],poisonChance:minion?1:0},baseDamage:{physical:30},context:{tags:['attack','projectile','bow']}},
  attacker:{},rolls:{critical:1,confirmation:1,ignite:1,block:1},leechProxy:minion?'minion':undefined},time,player);
 return {strike,player};
}
const poisons=e=>e.dots.filter(d=>d.key==='poison');

test('first-poison mastery is real, additive, does not amplify a new stack on a poisoned target',()=>{
 assert.deepEqual(path.at(-1),1205);
 assert.equal(nodes.get(1205).options.find(x=>x.id===34563).available,true);
 const {strike,player}=setup(34563);
 const first=strike(target,0);
 const [one]=poisons(first);
 near(one.rate,9*4*1.18);
 const repeated=strike(first,1);
 const [stillFirst,two]=poisons(repeated);
 assert.deepEqual(stillFirst,one);
 near(two.rate,9*1.18);
 const tick=stepWorld({player,enemies:[repeated],projectiles:[],time:1},.04).enemies[0];
 near(repeated.life-tick.life,.04*(one.rate+two.rate));
 const after=strike(repeated,3);
 near(poisons(after).at(-1).rate,one.rate);
 near(poisons(strike(target,0,{minion:true})).at(-1).rate,
  poisons(setup().strike(target,0,{minion:true})).at(-1).rate);
});

test('faster poison deals the same total in less time, bleeding multiplier checks already-active bleed',()=>{
 const src=setup();
 const before=poisons(src.strike(target,0))[0];
 const fast=poisons(setup(62897).strike(target,0))[0];
 near(fast.rate,before.rate*1.2);
 near(fast.end,before.end/1.2);
 near(fast.rate*fast.end,before.rate*before.end);
 const bleed={key:'bleed',type:'physical',rate:3,start:0,end:1};
 const {strike}=setup(45300);
 const poisonedBleed=poisons(strike({...target,dots:[bleed]},.5))[0];
 near(poisonedBleed.rate,9*1.30);
 near(poisons(strike({...target,dots:[bleed]},1))[0].rate,before.rate);
 near(poisons(strike(target,.5))[0].rate,before.rate);
});
