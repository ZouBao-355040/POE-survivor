import test from 'node:test';
import assert from 'node:assert/strict';
import {allocate,tracePath} from './passive-tree.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {newTownServices} from './town-services.mjs';
import {ModifierStore} from './modifiers.mjs';
import {rangerHooks} from './ranger.mjs';
import {GemInventory} from './gem-inventory.mjs';
import {catalog} from './projectile-catalog.mjs';
import {purchaseGem,shopCampaign} from './gem-shop.mjs';
import {stepWorld} from './game-loop.mjs';

const origin={characterClass:'Ranger',level:12,passivePoints:11};
const route=tracePath(origin,15290);
const before=route.slice(1,-4).reduce((p,id)=>allocate(p,id),origin);
const watch=route.slice(-4).reduce((p,id)=>allocate(p,id),before);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+' != '+b);
const boss={id:'boss',x:6,y:0,speed:0,life:18000,maximumLife:18000,defence:{},evasion:0,boss:true,radius:.85};
const live=(s,group)=>s.fields.filter(f=>f.totemGroup===group&&f.until>s.time);
const make=(p,id='shrapnel-ballista',support)=>{
 const inventory=new GemInventory(),modifiers=new ModifierStore(),town=newTownServices({starter:true});
 const shop={catalog,progression:p,gold:15,ownedIds:[],campaign:shopCampaign({zone:'town',routeIndex:3}),inTown:true};
 const ids=[id,...(support?[support]:[])];
 ids.forEach((key,i)=>{const {gem}=purchaseGem(shop,key);inventory.acquire(gem);inventory.equip(gem.id,'weapon',i);});
 inventory.setMode(id,'manual');
 const player={x:0,y:0,speed:4,life:70,mana:58,accuracy:1000,attackRange:12};
 const state={time:0,player:applyLoadout(player,town,p,modifiers,{refill:true}),fields:[],enemies:[],projectiles:[]};
 const options={...rangerHooks({inventory,modifiers,random:()=>.4}),manaRegen:3,castPlan:inventory.castPlan()};
 const step=(s,changes={})=>stepWorld(s,.02,{...options,...changes});
 return {state,options,step};
};
const forward={manualRequest:{x:1,y:0}};
const run=(s,t,n,opts={})=>{for(let i=0;i<n;i++)s=t.step(s,opts);return s;};

test('Watchtowers is eleven real Ranger points; launch cap, placement, firing and move are separate',()=>{
 assert.deepEqual(route.slice(-4),[63618,4750,58288,15290]);
 assert.equal(route.length-1,11);
 const base=make(before),boost=make(watch);
 const a=base.step(base.state,forward),b=boost.step(boost.state,forward);
 near(a.skillCooldowns['shrapnel-ballista'],.48);
 near(b.skillCooldowns['shrapnel-ballista'],.48/1.3);
 near(live(a,'ballista')[0].pulseEvery,live(b,'ballista')[0].pulseEvery);
 const place=t=>{
  let s=t.state;
  for(let i=0;i<3;i++){s=t.step(s,forward);if(i<2)s=run(s,t,25);}
  return s;
 };
 const baseline=place(base),extra=place(boost);
 assert.equal(live(baseline,'ballista').length,2);
 assert.equal(live(extra,'ballista').length,3);
 const moved=boost.step(extra,{direction:{x:1,y:0}});
 near((moved.player.x-extra.player.x)/.02,4*1.03);
 const spell={deploy:'totem',totemGroup:'totem',until:200,next:200};
 const ignore=[{deploy:'trap',until:200},{deploy:'archer',until:200},...extra.fields.map(f=>({...f,until:extra.time}))];
 const expiry=boost.step({...extra,fields:[...ignore,spell]},{direction:{x:1,y:0}});
 near((expiry.player.x-extra.player.x)/.02,4*1.01);
 const after=boost.step({...extra,fields:ignore},{direction:{x:1,y:0}});
 near((after.player.x-extra.player.x)/.02,4);
 const bossRound=(s,t)=>boss.life-run({...s,enemies:[boss]},t,65).enemies[0].life;
 assert.ok(bossRound(extra,boost)>bossRound(baseline,base)*1.65,'real prepared boss opening deals materially more damage');
});

test('Watchtowers affects supported bow ballistas and spell totem damage, not spell totem count or direct bow',()=>{
 const supported=make(watch,'split-arrow','ballista-totem');
 let arrows=supported.state;
 for(let i=0;i<3;i++){arrows=supported.step(arrows,forward);if(i<2)arrows=run(arrows,supported,26);}
 assert.equal(live(arrows,'ballista').length,3);
 const solo=make(watch,'holy-flame-totem'),plain=make(before,'holy-flame-totem');
 const a=plain.step(plain.state,forward),b=solo.step(solo.state,forward);
 near(a.skillCooldowns['holy-flame-totem']/b.skillCooldowns['holy-flame-totem'],1.3);
 near(live(a,'totem')[0].pulseEvery,live(b,'totem')[0].pulseEvery);
 const later=solo.step(run(b,solo,65),forward);
 assert.equal(live(later,'totem').length,1);
 const spellHP=(s,t)=>run({...s,enemies:[boss]},t,65).enemies[0].life;
 assert.ok(spellHP(b,solo)<spellHP(a,plain));
 const bow=make(before,'split-arrow'),newBow=make(watch,'split-arrow');
 near(spellHP(bow.step({...bow.state,enemies:[boss]},forward),bow),
  spellHP(newBow.step({...newBow.state,enemies:[boss]},forward),newBow));
});
