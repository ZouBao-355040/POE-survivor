import test from 'node:test';
import assert from 'node:assert/strict';
import {canEnterTown,gate,hillockId,openingBeach,retryBeach,stepBeach} from './campaign.mjs';
import {newTownServices,rollGear,hillockLoot,equipGear,equippedStats,transferGem,transferGear} from './town-services.mjs';
import {purchaseGem} from './gem-shop.mjs';
import {GemInventory} from './gem-inventory.mjs';
const player={x:0,y:0,speed:4,life:70,maximumLife:70,mana:58,maximumMana:58};
const start={zone:'beach',player,gold:0,projectiles:[],enemies:openingBeach(),progression:{level:1}};
test('only the named boss opens the gate and the player must reach it',()=>{
 assert.equal(canEnterTown({...start,player:{...player,...gate}}),false);
 const noKill=stepBeach({...start,enemies:[{...openingBeach()[0],life:0}]},.02);
 assert.equal(noKill.gateOpen,false);
 const boss=openingBeach().find(e=>e.id===hillockId);
 const cleared=stepBeach({...start,enemies:[{...boss,life:0}]},.02);
 assert.ok(cleared.gateOpen);assert.equal(cleared.beachXP,16);
 assert.equal(cleared.progression.pendingChoices,undefined);
 assert.equal(canEnterTown(cleared),false);
 assert.ok(canEnterTown({...cleared,player:{...player,...gate}}));
 assert.equal(canEnterTown({...cleared,dead:true,player:{...player,...gate}}),false);
});
test('boss can drop only a few coins or grant gear and an orb in addition to gold',()=>{
 const town=newTownServices();
 const poor=hillockLoot(town,()=>.1);
 assert.equal(poor.gold,2);assert.equal(poor.item,null);assert.equal(poor.orb,null);
 const rich=hillockLoot(town,()=>.8);
 assert.ok(rich.gold>5);assert.equal(rich.item.rarity,'稀有');
 assert.equal(rich.town.storedOrbs[rich.orb],1);
 assert.equal(rich.town.gear.length,1);
 assert.equal(Object.hasOwn(rich.town,'orbs'),false);
});
test('town gear rolls charge the player, equip affects the right stat, and storage preserves items',()=>{
 const town=newTownServices();
 assert.throws(()=>rollGear(town,5,'boots'),/金幣不足/);
 const {gold,item,town:fresh}=rollGear(town,12,'boots',()=>.7);
 assert.equal(gold,6);assert.equal(item.slot,'boots');assert.equal(item.rarity,'稀有');
 const active=equipGear(fresh,item.id);
 assert.ok(equippedStats(active).speed>=1+item.value/100);
 assert.throws(()=>transferGear(active,item.id,true),/請先卸下/);
 const banked=transferGear(equipGear(active,item.id),item.id,true);
 assert.equal(banked.gear.length,0);
 assert.deepEqual(transferGear(banked,item.id,false).gear,[item]);
});
test('stash preserves gem level and experience, and storefront checks ownership across stash',()=>{
 const town=newTownServices(),inventory=new GemInventory();
 const gem={id:'test',kind:'active',level:3,tags:[]};
 const instance=inventory.acquire(gem);instance.experience=19;
 inventory.equip(gem.id,'weapon',0);
 assert.throws(()=>transferGem(town,inventory,gem.id,true),/請先卸下/);
 inventory.unequip('weapon',0);
 transferGem(town,inventory,gem.id,true);
 assert.equal(inventory.owned.size,0);
 assert.throws(()=>purchaseGem({inTown:true,gold:9,catalog:[gem],ownedIds:[...town.storedGems.keys()]},gem.id),/已擁有/);
 transferGem(town,inventory,gem.id,false);
 assert.equal(inventory.owned.get(gem.id).experience,19);
 assert.equal(purchaseGem({inTown:true,campaign:{chapter:1,reachedTown:true,cleared:0},gold:9,catalog:[{id:'other',kind:'active'}],ownedIds:[]},'other').gold,6);
});

import {beginTrial,trialBudget,stepTrial,coastBossId,coastRules} from './campaign.mjs';
const trialStart=(rules={duration:20,packs:2,packSize:2,maxActive:2,refillAt:1},mods)=>beginTrial({
 player,gold:0,zone:'town',progression:{level:1},kills:0
},rules,mods);
const rng={random:()=>.4};
const withKills=(s,n)=>({...s,enemies:s.enemies.map((e,i)=>i<n?{...e,life:0}:e)});
test('map pack count and size modifiers calculate a finite normal budget independent of active cap',()=>{
 assert.deepEqual(trialBudget(coastRules),{groups:10,perGroup:6,total:60});
 assert.deepEqual(trialBudget(coastRules,{extraPacks:2,increasedPackSize:.5}),{groups:12,perGroup:9,total:108});
 assert.throws(()=>trialStart({packs:2,packSize:5,maxActive:4,refillAt:4}),RangeError);
});
test('threshold refills in the same tick, exact pack-size multiples not required',()=>{
 let s=stepTrial(trialStart({duration:15,packs:4,packSize:3,maxActive:10,refillAt:5}),.02,rng);
 assert.equal(s.encounter.generated,10);
 s=stepTrial(withKills(s,4),.02,rng);
 assert.equal(s.enemies.length,6);assert.equal(s.encounter.generated,10);
 const at=s.time;
 s=stepTrial(withKills(s,1),.02,rng);
 assert.equal(s.time,at+.02);
 assert.equal(s.enemies.length,7);assert.equal(s.encounter.generated,12);
 assert.equal(new Set(s.enemies.map(e=>e.id)).size,7);
 assert.equal(s.encounter.phase,'waves');
});
test('remaining supply tops up to cap and only the final real kill triggers an early boss',()=>{
 let s=stepTrial(trialStart(),.02,rng);
 assert.equal(s.encounter.generated,2);
 s=stepTrial(withKills(s,1),.02,rng);
 assert.equal(s.encounter.generated,3);assert.equal(s.enemies.length,2);assert.equal(s.encounter.phase,'waves');
 s=stepTrial(withKills(s,2),.02,rng);
 assert.equal(s.encounter.generated,4);assert.equal(s.enemies.length,1);assert.equal(s.encounter.phase,'waves');
 s=stepTrial(withKills(s,1),.02,rng);
 assert.equal(s.encounter.bossReason,'clear');assert.ok(s.time<s.encounter.duration);
 assert.equal(s.enemies.filter(e=>e.id===coastBossId).length,1);
 s=stepTrial({...s,time:20},.02,rng);
 assert.equal(s.enemies.filter(e=>e.id===coastBossId).length,1);
 assert.ok(!s.events.some(ev=>ev.type==='boss-arrives'));
});
test('deadline forces one boss at the hard cap without granting a phantom kill or new supply',()=>{
 let s=trialStart({duration:2,packs:5,packSize:2,maxActive:2,refillAt:1});
 s=stepTrial(s,.02,rng);
 const [first,second]=s.enemies;
 s=stepTrial({...s,time:1.99},.02,rng);
 assert.equal(s.encounter.bossReason,'time');assert.equal(s.encounter.generated,2);
 assert.equal(s.enemies.length,2);
 assert.equal(s.encounter.heldEnemy.id,second.id);
 assert.equal(s.enemies[0].id,first.id);
 assert.equal(s.gold,0);assert.ok(!s.events.some(e=>e.type==='kill'));
 s=stepTrial(withKills(s,1),.02,rng);
 assert.equal(s.enemies.length,2);assert.equal(s.encounter.heldEnemy,null);
 assert.ok(s.enemies.some(e=>e.id===second.id));assert.equal(s.enemies.filter(e=>e.boss).length,1);
 s=stepTrial({...s,time:30,enemies:s.enemies.map(e=>e.boss?{...e,life:0}:e)},.02,rng);
 assert.equal(s.encounter.phase,'cleared');assert.equal(s.enemies.length,1);
 assert.equal(s.gold,10);assert.deepEqual(stepTrial(s,.02,rng),{...s,events:[]});
});
test('deadline wins a same-tick final kill and the reward pauses the encounter',()=>{
 let s=trialStart({duration:1,packs:1,packSize:1,maxActive:2,refillAt:1});
 s=stepTrial(s,.02,rng);
 s=withKills({...s,time:.99},1);
 const shop={...s,progression:{...s.progression,pendingChoices:1}};
 assert.deepEqual(stepTrial(shop,.02,rng),{...shop,events:[]});
 s=stepTrial(s,.02,rng);
 assert.equal(s.encounter.bossReason,'time');
 assert.equal(s.enemies.filter(e=>e.boss).length,1);
});
test('a 100-monster map permits a fast clear without waiting for a scheduled wave',()=>{
 const fastRules={duration:120,packs:10,packSize:10,maxActive:10,refillAt:5};
 let s=stepTrial(trialStart(fastRules),.02,rng);
 assert.equal(s.enemies.length,10);
 for(let i=0;i<20;i++){
  const time=s.time+1.8; // Test combat throughput, not a claim about a particular player build.
  s=stepTrial(withKills({...s,time},5),.02,rng);
  assert.ok(s.enemies.length<=10);
  if(i===0){assert.equal(s.enemies.length,10);assert.equal(s.encounter.generated,15);}
 }
 assert.equal(s.encounter.generated,100);
 assert.equal(s.encounter.bossReason,'clear');
 const win=stepTrial(withKills({...s,time:s.time+5},1),.02,rng);
 assert.equal(win.encounter.phase,'cleared');assert.ok(win.time<60);
});

test('beach death retry preserves progress and loot without duplicate enemies or skipping Hillock',()=>{
 const dead={...start,dead:true,time:15,cooldown:9,beachXP:7,kills:1,gateOpen:false,
  player:{...player,x:10,y:1,life:0,mana:3},enemies:openingBeach().slice(1),
  projectiles:[{id:'expired-arrow'}],fields:[{id:'old-field'}],pendingLoot:{gold:1,orbs:[],gems:[],hillock:false}};
 const next=retryBeach(dead);
 assert.equal(next.dead,false);assert.equal(next.time,0);
 assert.deepEqual(next.player,{...player,energyShield:0});
 assert.equal(next.beachXP,7);assert.equal(next.kills,1);assert.equal(next.pendingLoot,dead.pendingLoot);
 assert.deepEqual(next.enemies.map(e=>e.id),dead.enemies.map(e=>e.id));
 assert.equal(next.enemies.filter(e=>e.id===hillockId).length,1);
 assert.deepEqual(next.projectiles,[]);assert.deepEqual(next.fields,[]);
 assert.equal(canEnterTown({...next,player:{...next.player,...gate}}),false);
 assert.equal(retryBeach(next),next);
 const unlocked=retryBeach({...dead,gateOpen:true,enemies:dead.enemies.filter(e=>!e.boss),pendingLoot:{...dead.pendingLoot,hillock:true}});
 assert.equal(unlocked.enemies.some(e=>e.id===hillockId),false);
 assert.ok(unlocked.pendingLoot.hillock);
 assert.ok(canEnterTown({...unlocked,player:{...unlocked.player,...gate}}));
});
