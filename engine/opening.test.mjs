import test from 'node:test';
import assert from 'node:assert/strict';
import {canEnterTown,gate,hillockId,openingBeach,stepBeach} from './campaign.mjs';
import {newTownServices,rollGear,hillockLoot,equipGear,equippedStats,transferGem,transferGear,transferOrb} from './town-services.mjs';
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
 assert.equal(rich.town.orbs[rich.orb],1);
 assert.equal(rich.town.gear.length,1);
 const stored=transferOrb(rich.town,rich.orb,true);
 assert.deepEqual(stored.orbs,{});assert.equal(stored.storedOrbs[rich.orb],1);
 assert.equal(transferOrb(stored,rich.orb,false).orbs[rich.orb],1);
});
test('town gear rolls charge the player, equip affects the right stat, and storage preserves items',()=>{
 const town=newTownServices();
 assert.throws(()=>rollGear(town,5,'boots'),/金幣不足/);
 const {gold,item,town:fresh}=rollGear(town,12,'boots',()=>.7);
 assert.equal(gold,6);assert.equal(item.slot,'boots');assert.equal(item.rarity,'稀有');
 const active=equipGear(fresh,item.id);
 assert.equal(equippedStats(active).speed,1+item.value/100);
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
 assert.equal(purchaseGem({inTown:true,gold:9,catalog:[{id:'other',kind:'active'}],ownedIds:[]},'other').gold,6);
});

import {beginTrial,trialBudget,stepTrial,coastBossId,coastRules} from './campaign.mjs';
const trialStart=(rules={duration:20,packs:2,packSize:2,spacing:4,minimumGap:1},mods)=>beginTrial({
 player,gold:0,zone:'town',progression:{level:1},kills:0
},rules,mods);
const rng={random:()=>.4};
test('map pack count and size modifiers calculate a finite normal budget',()=>{
 assert.deepEqual(trialBudget(coastRules),{groups:10,perGroup:6,total:60});
 assert.deepEqual(trialBudget(coastRules,{extraPacks:2,increasedPackSize:.5}),{groups:12,perGroup:9,total:108});
});
test('empty waves accelerate but only the last generated and cleared wave triggers an early boss',()=>{
 let s=stepTrial(trialStart(),.02,rng);
 assert.equal(s.encounter.generated,2);assert.equal(s.enemies.length,2);
 s=stepTrial({...s,enemies:s.enemies.map(e=>({...e,life:0}))},.02,rng);
 assert.equal(s.enemies.length,0);assert.equal(s.encounter.phase,'waves');
 s=stepTrial({...s,time:1.01},.02,rng);
 assert.equal(s.encounter.packsSpawned,2);assert.equal(s.encounter.generated,4);
 assert.equal(s.encounter.phase,'waves');
 s=stepTrial({...s,enemies:s.enemies.map(e=>({...e,life:0}))},.02,rng);
 assert.equal(s.encounter.bossReason,'clear');assert.ok(s.time<s.encounter.duration);
 assert.equal(s.enemies.filter(e=>e.id===coastBossId).length,1);
 s=stepTrial({...s,time:20},.02,rng);
 assert.equal(s.enemies.filter(e=>e.id===coastBossId).length,1);
 assert.ok(!s.events.some(ev=>ev.type==='boss-arrives'));
});
test('deadline forces exactly one boss with living monsters and discards unspawned groups',()=>{
 let s=trialStart({duration:2,packs:5,packSize:2,spacing:4,minimumGap:1});
 s=stepTrial(s,.02,rng);
 const normals=s.enemies.map(e=>e.id);
 s=stepTrial({...s,time:1.99},.02,rng);
 assert.equal(s.encounter.bossReason,'time');assert.equal(s.encounter.generated,2);
 assert.deepEqual(s.enemies.filter(e=>!e.boss).map(e=>e.id),normals);
 s=stepTrial({...s,time:30},.02,rng);
 assert.deepEqual(s.enemies.filter(e=>!e.boss).map(e=>e.id),normals);
 assert.equal(s.enemies.filter(e=>e.boss).length,1);
 const deadBoss=s.enemies.map(e=>e.boss?{...e,life:0}:e);
 s=stepTrial({...s,enemies:deadBoss},.02,rng);
 assert.equal(s.encounter.phase,'cleared');assert.equal(s.enemies.length,2);
 assert.equal(s.gold,9);
 assert.deepEqual(stepTrial(s,.02,rng),{...s,events:[]});
});
test('deadline wins a same-tick final kill and the shop pauses the encounter',()=>{
 let s=trialStart({duration:1,packs:1,packSize:1,spacing:4,minimumGap:1});
 s=stepTrial(s,.02,rng);
 s={...s,time:.99,enemies:s.enemies.map(e=>({...e,life:0}))};
 const shop={...s,progression:{...s.progression,pendingChoices:1}};
 assert.deepEqual(stepTrial(shop,.02,rng),{...shop,events:[]});
 s=stepTrial(s,.02,rng);
 assert.equal(s.encounter.bossReason,'time');
 assert.equal(s.enemies.filter(e=>e.boss).length,1);
});
test('low watermark refills before the arena empties without exceeding the map budget',()=>{
 let s=stepTrial(trialStart({duration:15,packs:3,packSize:3,spacing:8,minimumGap:.8}),.02,rng);
 assert.equal(s.encounter.minimumActive,3);
 const thinned=s.enemies.map((e,i)=>i===0?{...e,life:0}:e);
 s=stepTrial({...s,time:.3,enemies:thinned},.02,rng);
 assert.equal(s.enemies.length,2);assert.equal(s.encounter.generated,3);
 s=stepTrial({...s,time:.81},.02,rng);
 assert.equal(s.enemies.length,5);assert.equal(s.encounter.generated,6);
 s=stepTrial({...s,time:1.7},.02,rng);
 assert.equal(s.encounter.generated,6,'enough surviving enemies: no premature refill');
});
