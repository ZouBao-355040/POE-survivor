import test from 'node:test';
import assert from 'node:assert/strict';
import {allocate,tracePath,nodes} from './passive-tree.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {newTownServices} from './town-services.mjs';
import {ModifierStore} from './modifiers.mjs';
import {rangerHooks} from './ranger.mjs';
import {basicBowAttack} from './starter-data.mjs';
import {catalog} from './projectile-catalog.mjs';
import {stepWorld} from './game-loop.mjs';
import {actOne} from './act-one.mjs';
import {beginTrial,stepTrial} from './campaign.mjs';

const origin={characterClass:'Ranger',level:15,passivePoints:15};
const path=tracePath(origin,8458);
const allocateAll=(p,ids)=>ids.reduce((p,id)=>allocate(p,id),p);
const neutral=allocateAll(origin,[...path.slice(1,-1),52288]);
const nearTree=allocate(neutral,31513),farTree=allocate(neutral,8458),both=allocate(farTree,31513);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+' != '+b);
const target=(x)=>({id:'fixture',x,y:0,radius:.42,speed:0,life:1000,maximumLife:1000,evasion:0,defence:{}});
function setup(p,active=basicBowAttack,supports=[]){
 const modifiers=new ModifierStore(),town=newTownServices({starter:true});
 const player=applyLoadout({x:0,y:0,life:70,mana:58,attackRange:12},town,p,modifiers,{refill:true});
 return {player,hooks:rangerHooks({modifiers,active,supports,random:()=>.4})};
}
function fire(p,d,active){
 const {player,hooks}=setup(p,active);
 let state={player,enemies:[target(d+.42)],projectiles:[],time:0};
 for(let i=0;i<23;i++)state=stepWorld(state,.02,hooks);
 return 1000-state.enemies[0].life;
}
test('both legal Ranger notables stack additively along the close, midpoint and capped travel bands',()=>{
 assert.equal(both.talents.length,13);
 assert.equal(nodes.get(31513).implemented,true);
 const unmodified=fire(neutral,2)/1.32;
 for(const [d,a,b] of [[0,.4,.4],[3.5,.4,.4],[5.25,.2,.5],[7,0,.6],[9,0,.6]]){
  near(fire(nearTree,d),unmodified*(1.32+a));
  near(fire(both,d),unmodified*(1.32+b));
 }
 const launch=p=>{const {player,hooks}=setup(p);return hooks.onFire(player,target(8),0).projectiles[0];};
 near(launch(both).speed/32.6,1.2);
 near(launch(nearTree).speed/launch(neutral).speed,.9);
 const spell={id:'spell',tags:['spell','projectile'],baseSpellDamage:{physical:[8,8]},cost:0};
 near(fire(nearTree,2,spell),8*1.72);
});
test('Lightning Strike direct melee does not inherit distance talents or Point Blank; a zero-distance collision still qualifies',()=>{
 const active=catalog.find(g=>g.id==='lightning-strike');
 const contact=target(.15);
 const sample=(p,pointBlank=false,supports=[])=>{
  const {hooks,player}=setup(p,active,supports);
  player.rules={...player.rules,pointBlank};
  let health=contact.life,component;
  const env={hit:(target,hit,source)=>{
   component=hit;health=hooks.onImpact(target,hit,0,source).life;
  }};
  const shot=hooks.onFire(player,contact,0,[contact],env).projectiles[0];
  assert.equal(component.hitKind,'melee');
  assert.equal(component.distanceTravelled,undefined);
  return [contact.life-health,contact.life-hooks.onImpact(contact,{...shot,distanceTravelled:0},.1,player).life];
 };
 const [melee,bolt]=sample(neutral);
 const [adjMelee,adjBolt]=sample(nearTree);
 near(melee,adjMelee);
 near(adjBolt/bolt,1.74/1.34);
 for(const [hasRule,supports] of [[true,[]],[false,[{id:'point-blank',pointBlank:true}]]]){
  const [pbMelee,pbBolt]=sample(nearTree,hasRule,supports);
  near(pbMelee,melee);near(pbBolt/adjBolt,1.3);
 }
});
test('matched true First Act boss opening: close and far damage differ with the same gear and tree',()=>{
 const stage=actOne.at(-1);
 function opening(p,nearStart){
  const {player,hooks}=setup(p);
  let s=beginTrial({player,zone:'town',progression:p,gold:0},stage);
  s=stepTrial({...s,time:stage.duration,encounter:{...s.encounter,generated:s.encounter.total}},.02,{random:()=>.4});
  assert.equal(s.enemies[0].name,'莫薇兒');
  s={...s,player:{...s.player,x:nearStart?5.75:-1.2}};
  for(let i=0;i<26;i++)s=stepTrial(s,.02,{...hooks,random:()=>.4});
  assert.equal(s.encounter.phase,'boss');
  return stage.boss.health-s.enemies[0].life;
 }
 const baseNear=opening(neutral,true),baseFar=opening(neutral,false);
 near(baseNear,baseFar);
 near(opening(nearTree,true)/baseNear,1.72/1.32);
 near(opening(nearTree,false),baseFar);
 near(opening(both,true)/baseNear,1.72/1.32);
 near(opening(both,false)/baseFar,1.92/1.32);
});
