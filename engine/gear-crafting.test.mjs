import test from 'node:test';
import assert from 'node:assert/strict';
import {craftAvailability,craftGear,affixCatalog,rollGearAffixes} from './gear-crafting.mjs';
import {newTownServices,equippedStats,socketStoredGem} from './town-services.mjs';
import {GemInventory,createGemInstance} from './gem-inventory.mjs';
import {creditCurrency,debitCurrency,currencyBalance,currencies} from './currency.mjs';

const seq=(...values)=>()=>values.shift()??.4;
const stocked=()=>({...newTownServices({starter:true}),storedOrbs:Object.fromEntries(currencies.map(name=>[name,2]))});

test('transmute, augment, regal and alchemy alter legal affixes without changing the equipped base',()=>{
 const town=stocked(),body='starter-body';
 const magic=craftGear(town,body,'蛻變石',seq(.1,.1,.1));
 assert.equal(magic.item.rarity,'魔法');
 assert.equal(magic.item.affixes.length,1);
 assert.equal(magic.town.storedOrbs['蛻變石'],1);
 const aug=craftGear(magic.town,body,'增幅石',()=>.2);
 assert.deepEqual(aug.item.affixes[0],magic.item.affixes[0]);
 assert.equal(new Set(aug.item.affixes.map(a=>a.side)).size,2);
 assert.throws(()=>craftGear(aug.town,body,'增幅石'),/詞綴已滿/);
 const regaled=craftGear(aug.town,body,'富豪石',()=>.2);
 assert.equal(regaled.item.rarity,'稀有');
 assert.deepEqual(regaled.item.affixes.slice(0,2),aug.item.affixes);
 assert.equal(regaled.item.affixes.length,3);
 assert.equal(regaled.town.equipped.body,body);
 assert.equal(regaled.item.name,'漂流者外衣');
 assert.ok(equippedStats(regaled.town).life>0);
 const alch=craftGear(town,'starter-weapon','點金石',()=>.7);
 assert.equal(alch.item.rarity,'稀有');
 assert.equal(alch.item.affixes.length,4);
 assert.equal(new Set(alch.item.affixes.map(x=>x.key)).size,4);
 assert.equal(affixCatalog('weapon').filter(x=>x.side==='prefix').length,3);
 assert.equal(town.storedOrbs['點金石'],2);
});

test('alteration replaces affixes, and illegal and failed crafts debit nothing',()=>{
 const town=stocked(),id='starter-weapon';
 assert.equal(craftAvailability(town.gear[0],'改造石',town.storedOrbs).enabled,false);
 assert.throws(()=>craftGear(town,id,'改造石'),/只能用在魔法/);
 assert.throws(()=>craftGear({...town,storedOrbs:{}},id,'蛻變石'),/倉庫存量不足/);
 assert.throws(()=>craftGear(town,id,'蛻變石',()=>1),/無效擲骰/);
 const first=craftGear(town,id,'蛻變石',()=>0);
 const alteration=craftGear(first.town,id,'改造石',()=>.9);
 assert.ok(alteration.item.affixes.every(x=>x.key!==first.item.affixes[0].key));
 assert.equal(alteration.town.storedOrbs['改造石'],1);
 assert.equal(town.storedOrbs['蛻變石'],2);
 assert.deepEqual(rollGearAffixes(town.gear[0],()=>1).affixes,[]);
});

test('currency balance never splits stacks and stays exact past the safe-number boundary',()=>{
 const name='點金石',large=creditCurrency({[name]:Number.MAX_SAFE_INTEGER},[name,name]);
 assert.equal(currencyBalance(large,name),9007199254740993n);
 assert.equal(currencyBalance(debitCurrency(large,name),name),9007199254740992n);
 assert.equal(currencyBalance(debitCurrency({[name]:1},name),name),0);
});
test('stash gems directly socket into empty slots without resetting experience',()=>{
 const town=stocked(),inventory=new GemInventory();
 inventory.acquire({id:'other',kind:'active'});inventory.equip('other','weapon',0);
 const gem={...createGemInstance({id:'test',kind:'support'}),experience:15};
 town.storedGems.set(gem.id,gem);
 assert.throws(()=>socketStoredGem(town,inventory,gem.id,'weapon',0),/空插槽/);
 assert.equal(town.storedGems.has(gem.id),true);
 socketStoredGem(town,inventory,gem.id,'weapon',1);
 assert.equal(town.storedGems.has(gem.id),false);
 assert.equal(inventory.board.groups.weapon[1].experience,15);
});
