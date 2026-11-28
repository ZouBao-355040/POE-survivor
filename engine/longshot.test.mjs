import test from 'node:test';
import assert from 'node:assert/strict';
import {allocate,tracePath,nodes} from './passive-tree.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {newTownServices} from './town-services.mjs';
import {ModifierStore} from './modifiers.mjs';
import {rangerHooks} from './ranger.mjs';
import {basicBowAttack} from './starter-data.mjs';
import {stepWorld} from './game-loop.mjs';

const origin={characterClass:'Ranger',passivePoints:11};
const path=tracePath(origin,8458);
const before=path.slice(1,-1).reduce((p,id)=>allocate(p,id),origin);
const after=allocate(before,8458);
const target=(x)=>({id:'d'+x,x:x+.42,y:0,radius:.42,speed:0,life:1000,maximumLife:1000,evasion:0,defence:{}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+' != '+b);
const setup=(p,active=basicBowAttack,supports=[])=>{
 const modifiers=new ModifierStore();
 const player=applyLoadout({x:0,y:0,life:70,mana:58,attackRange:12},newTownServices({starter:true}),p,modifiers,{refill:true});
 return {player,hooks:rangerHooks({modifiers,active,supports,random:()=>.4})};
};
function fire(p,distances,active,supports){
 const {player,hooks}=setup(p,active,supports);
 let state={player,enemies:distances.map(target),projectiles:[],time:0};
 for(let i=0;i<25;i++)state=stepWorld(state,.02,hooks);
 return state.enemies.map(enemy=>1000-enemy.life);
}

test('Longshot real collision adds damage only from 3.5 to 7, including the next hit of a piercing arrow',()=>{
 assert.equal(path.length-1,11);
 assert.deepEqual(nodes.get(8458).effects,['投射物速度提高 30%','投射物飛行越遠，擊中傷害最多提高 60%']);
 const hit=(p,d)=>fire(p,[d])[0];
 near(hit(before,2),hit(after,2));
 near(hit(before,2),hit(after,3.5));
 near(hit(after,5.25)/hit(before,5.25),1.52/1.22);
 near(hit(after,7)/hit(before,7),1.82/1.22);
 near(hit(after,9),hit(after,7));
 const a=setup(before),b=setup(after);
 const launch=t=>t.hooks.onFire(t.player,target(6),0).projectiles[0];
 near(launch(b).speed/launch(a).speed,1.4/1.1);
 near(launch(b).remainingRange/launch(a).remainingRange,1.4/1.1);
 const pair=fire(after,[2,8],basicBowAttack,[{id:'test-pierce',pierce:1}]);
 near(pair[0],hit(after,2));near(pair[1],hit(after,8));
});

test('Longshot affects real spell projectile hits, not the poison rate, minion or nonprojectile hits',()=>{
 const spell={id:'spell',tags:['spell','projectile'],baseSpellDamage:{physical:[8,8]},cost:0};
 assert.ok(fire(after,[8],spell)[0]>fire(before,[8],spell)[0]);
 const active={...basicBowAttack,poisonChance:1};
 const a=setup(before,active),b=setup(after,active);
 const impact=(t,{tags=active.tags,proxy}={})=>{
  const p=t.hooks.onFire(t.player,target(8),0).projectiles[0];
  return t.hooks.onImpact(target(8),{...p,distanceTravelled:8,leechProxy:proxy,
   skill:{...p.skill,active:{...active,tags},context:{...p.skill.context,tags}}},.1,t.player);
 };
 const normal=impact(a),boost=impact(b);
 assert.ok(boost.life<normal.life);
 near(boost.dots[0].rate,normal.dots[0].rate);
 near(impact(a,{proxy:'minion'}).life,impact(b,{proxy:'minion'}).life);
 near(impact(a,{tags:['attack','bow']}).life,impact(b,{tags:['attack','bow']}).life);
});
