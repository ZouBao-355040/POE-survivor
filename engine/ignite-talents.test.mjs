import test from 'node:test';
import assert from 'node:assert/strict';
import {allocate,tracePath,nodes} from './passive-tree.mjs';
import {ModifierStore} from './modifiers.mjs';
import {resolveAttackImpact} from './combat.mjs';
import {igniteIntervals} from './ignite.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {newTownServices} from './town-services.mjs';

const start={characterClass:'Ranger',level:30,passivePoints:29};
const path=(end,p=start)=>{
 const route=tracePath(p,end);
 assert.equal(route.at(-1),end);
 return route.slice(1).reduce((s,n)=>allocate(s,n),p);
};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+' != '+b);

test('real Ranger fire cluster grants attack-only ignition and damage, not hit damage',()=>{
 const mods=new ModifierStore(),town=newTownServices({starter:true});
 const attacker=p=>({...applyLoadout({life:70,mana:58},town,p,mods,{refill:true}),accuracy:1000});
 const hit=(p,source,ignite,{baseDamage={fire:20},minion=false,critical=1}={})=>resolveAttackImpact({
  attacker:attacker(p),target:{life:300,maximumLife:300,defence:{},evasion:0,entropy:0},
  skill:{source,baseDamage,criticalChance:1,context:{tags:[source,'projectile',...(minion?['minion']:[])]}},
  modifiers:mods,rolls:{critical,confirmation:0,block:1,ignite}
 });
 const chance=path(26365);
 assert.ok(nodes.get(26365).implemented);
 assert.equal(hit(start,'attack',.01).ignite,null);
 near(hit(chance,'attack',.149).ignite.rate,18);
 assert.equal(hit(chance,'attack',.151).ignite,null);
 assert.equal(hit(chance,'spell',.01).ignite,null);
 assert.equal(hit(chance,'attack',.01,{baseDamage:{physical:20}}).ignite,null);
 const cluster=path(36736,chance);
 const burn=hit(cluster,'attack',.01);
 near(burn.ignite.rate,18*1.18);
 near(burn.damage.fire,20);
 near(hit(cluster,'spell',1,{critical:0}).ignite.rate,18*1.5);
 near(hit(cluster,'attack',1,{minion:true,critical:0}).ignite.rate,18*1.5);
});

test('faster ignite compresses the duration while increased duration extends total damage',()=>{
 const modifiers=new ModifierStore();
 modifiers.replace('fixture',[
  {stat:'igniteFaster',kind:'flat',value:.2},{stat:'igniteDuration',kind:'increased',value:.25},
  {stat:'damage',kind:'increased',value:5,tags:['hit']},
  {stat:'damage',kind:'increased',value:3,tags:['projectile']}
 ]);
 const {ignite,damage}=resolveAttackImpact({
  attacker:{life:70,mana:58},target:{life:200,maximumLife:200,defence:{}},
  skill:{source:'spell',baseDamage:{fire:20},igniteChance:1,context:{tags:['spell','projectile']}},
  modifiers,rolls:{critical:1,confirmation:1,ignite:0,block:1}
 });
 near(damage.fire,180);
 near(ignite.rate,18*1.2);
 near(ignite.duration,4*1.25/1.2);
 near(ignite.rate*ignite.duration,90);
 const windows=igniteIntervals([{rate:ignite.rate,start:0,end:ignite.duration},{rate:5,start:1,end:5}],3,5);
 assert.deepEqual(windows,[{start:3,end:ignite.duration,rate:ignite.rate},{start:ignite.duration,end:5,rate:5}]);
});
