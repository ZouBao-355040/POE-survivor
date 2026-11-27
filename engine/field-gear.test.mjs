import test from 'node:test';
import assert from 'node:assert/strict';
import {actOne,advanceRoute} from './act-one.mjs';
import {beginTrial} from './campaign.mjs';
import {affixCatalog,craftGear} from './gear-crafting.mjs';
import {newTownServices,emptyBattleLoot,queueTrialLoot,claimBattleLoot,equipGear,equippedStats,
 regularGearDropChance,satchelLimit,rollGear} from './town-services.mjs';

const seed=rank=>({zone:'trial',routeIndex:rank,encounter:{stageId:actOne[rank].id,stageName:actOne[rank].name,
 rank,phase:'cleared',boss:actOne[rank].boss},pendingLoot:emptyBattleLoot()});
const boss={target:'coast-boss',boss:true,gold:9};
const normal={target:'normal',boss:false,gold:1};

test('regular kill rolls gear only below its drop rate; boss guarantees one blueprint per named area',()=>{
 const start=seed(0);
 assert.equal(queueTrialLoot(start,normal,{random:()=>regularGearDropChance}).pendingLoot.gear.length,0);
 assert.equal(queueTrialLoot(start,normal,{random:()=>regularGearDropChance-.001}).pendingLoot.gear.length,1);
 const coast=queueTrialLoot(start,boss,{random:()=>.9});
 const item=coast.pendingLoot.gear[0];
 assert.equal(item.rarity,'普通');assert.equal(item.itemLevel,4);
 assert.equal(item.dropSource,actOne[0].boss.name);
 assert.equal(item.id,undefined,'IDs are assigned at settlement');
 const duplicate=queueTrialLoot(coast,boss,{random:()=>.9});
 assert.equal(duplicate.pendingLoot.gear.length,1);
 const next=beginTrial(advanceRoute(duplicate),actOne[1]);
 assert.equal(next.pendingLoot,duplicate.pendingLoot);
 assert.equal(queueTrialLoot(next,boss,{random:()=>.9}).pendingLoot.gear.length,2);
});

test('death settlement credits field gear once even when the bag is full; the dropped base is craftable',()=>{
 const town=newTownServices({starter:true});
 town.gear.push(...Array.from({length:satchelLimit-2},(_,i)=>({id:'starter-test-'+i,slot:'boots'})));
 const coast=queueTrialLoot({...seed(0),dead:true},boss,{random:()=>0});
 const settled=claimBattleLoot(town,0,coast.pendingLoot);
 assert.equal(settled.claimedGear,1);
 assert.equal(settled.town.gear.length,satchelLimit+1);
 assert.throws(()=>rollGear(settled.town,10,'boots'),/背包已滿/);
 const noDuplicate=claimBattleLoot(settled.town,settled.gold,settled.pending);
 assert.equal(noDuplicate.claimedGear,0);
 assert.equal(noDuplicate.town.gear.length,satchelLimit+1);
 const item=settled.town.gear.at(-1);
 const equipped=equipGear(settled.town,item.id);
 const craft=craftGear({...equipped,storedOrbs:{'蛻變石':1}},item.id,'蛻變石',()=>0);
 assert.equal(craft.town.equipped[item.slot],item.id);
 assert.equal(craft.item.dropArea,item.dropArea);
 assert.equal(craft.item.rarity,'魔法');
 assert.ok(equippedStats(craft.town).life>equippedStats(equipped).life);
});

test('higher area level unlocks stronger affix tiers, including on reroll',()=>{
 const coast=queueTrialLoot(seed(0),boss,{random:()=>0});
 const later=queueTrialLoot(seed(7),boss,{random:()=>.2});
 const base=newTownServices();
 const bank=claimBattleLoot(base,0,{...emptyBattleLoot(),gear:[...coast.pendingLoot.gear,...later.pendingLoot.gear]});
 const [first,second]=bank.town.gear;
 assert.ok(first.itemLevel<second.itemLevel);
 const funds={...bank.town,storedOrbs:{'蛻變石':2,'改造石':1}};
 const weak=craftGear(funds,first.id,'蛻變石',()=>0);
 const strong=craftGear(weak.town,second.id,'蛻變石',()=>0);
 assert.equal(weak.item.affixes[0].tier,3);
 assert.equal(strong.item.affixes[0].tier,2);
 assert.ok(strong.item.affixes[0].value>weak.item.affixes[0].value);
 assert.equal(craftGear(strong.town,second.id,'改造石',()=>0).item.affixes[0].tier,2);
 assert.deepEqual(affixCatalog(second.slot,second.itemLevel)[0].tiers.map(t=>t.tier),[2,3]);
});
