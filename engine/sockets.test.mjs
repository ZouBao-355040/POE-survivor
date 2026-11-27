import test from 'node:test';import assert from 'node:assert/strict';import {SocketBoard} from './sockets.mjs';
test('bow layout and support relocation',()=>{const b=new SocketBoard();assert.equal(Object.values(b.groups).flat().length,24);b.insert('weapon',0,{instanceId:'a',kind:'active'});b.insert('weapon',1,{instanceId:'s',kind:'support'});b.insert('body',0,{instanceId:'b',kind:'active'});assert.equal(b.linked('a').supports.length,1);b.move('weapon',1,'body',1);assert.equal(b.linked('a').supports.length,0);assert.equal(b.linked('b').supports.length,1);});

import {GemInventory} from './gem-inventory.mjs';
import {newTownServices,equipGear,rollGear,equippedSocketLayout} from './town-services.mjs';
test('campaign sockets follow equipped pieces, with starter bow and body only',()=>{
 let town=newTownServices({starter:true});
 const inventory=new GemInventory(new SocketBoard(equippedSocketLayout(town)));
 assert.deepEqual(Object.keys(inventory.board.groups),['weapon','body']);
 town=rollGear(town,20,'boots',()=>.4).town;
 const boots=town.gear.find(g=>g.slot==='boots');
 inventory.setLayout(equippedSocketLayout(town));
 assert.equal(inventory.board.groups.boots,undefined,'loot in the backpack does not create sockets');
 town=equipGear(town,boots.id);
 inventory.setLayout(equippedSocketLayout(town));
 assert.equal(inventory.board.groups.boots.length,4);
 const gem=inventory.acquire({id:'test-skill',kind:'active'});
 inventory.equip(gem.id,'boots',0);inventory.select(gem.id);
 town=equipGear(town,boots.id);
 inventory.setLayout(equippedSocketLayout(town));
 assert.equal(inventory.current(),null);
 assert.equal(inventory.owned.get(gem.id),gem);
 assert.throws(()=>inventory.equip(gem.id,'boots',0),/Invalid socket/);
 inventory.equip(gem.id,'weapon',0);
 assert.equal(inventory.board.groups.weapon[0],gem);
});
